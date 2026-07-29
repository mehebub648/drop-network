import * as lancedb from '@lancedb/lancedb';
import path from 'path';
import fs from 'fs';

// Storage location for the LanceDB data files.
// In production, set LANCEDB_PATH to a path backed by a persistent volume
// (e.g. /data/lancedb). Falls back to a local .lancedb directory for
// direct local runs.
const DB_DIR = process.env.LANCEDB_PATH
  ? path.resolve(process.env.LANCEDB_PATH)
  : path.join(process.cwd(), '.lancedb');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let db: lancedb.Connection;

function idFilter(id: string) {
  return `id = ${JSON.stringify(String(id))}`;
}

export async function getDb() {
  if (!db) {
    db = await lancedb.connect(DB_DIR);
  }
  return db;
}

export async function ensureTable(name: string) {
  const conn = await getDb();
  const tables = await conn.tableNames();
  if (!tables.includes(name)) {
    // create with dummy data to infer schema, then delete it
    const table = await conn.createTable(name, [{ vector: [0, 0], id: "dummy", doc: "{}" }]);
    await table.delete(idFilter('dummy'));
    return table;
  }
  return await conn.openTable(name);
}

export async function getPartitionName(district: string, group: string) {
  const d = district.replace(/\W/g, '_');
  const g = group.replace(/\W/g, '_').replace('+', '_plus').replace('-', '_minus');
  return `donors_${d}_${g}`;
}

export async function syncDonorToPartition(user: any) {
  if (!user.donor_profile) return;
  const pName = await getPartitionName(user.donor_profile.location.area_name, user.donor_profile.blood_group);
  const table = await ensureTable(pName);
  
  // Remove if exists to replace it
  try {
    await table.delete(idFilter(user.id));
  } catch (e) {}

  await table.add([{
    vector: [user.donor_profile.location.lng, user.donor_profile.location.lat],
    id: user.id,
    doc: JSON.stringify(user)
  }]);
}

export async function removeDonorFromAllPartitions(userId: string) {
  const conn = await getDb();
  const tables = await conn.tableNames();
  const donorTables = tables.filter(name => name.startsWith('donors_'));

  for (const name of donorTables) {
    try {
      const table = await conn.openTable(name);
      await table.delete(idFilter(userId));
    } catch (e) {}
  }
}

export async function getAllFromTable(name: string) {
  const conn = await getDb();
  const tables = await conn.tableNames();
  if (!tables.includes(name)) return [];
  const table = await conn.openTable(name);
  try {
    // @ts-ignore
    const results = await table.query().limit(10000).toArray();
    return results.map(r => JSON.parse(r.doc));
  } catch(e) {
    // fallback if query().toArray() is different
    // @ts-ignore
    const results = await table.search([0,0]).limit(10000).toArray();
    return results.filter(r => r.id !== 'dummy').map(r => JSON.parse(r.doc));
  }
}

// --- Imported donor directory -------------------------------------------
//
// Imported donors are far more numerous than accounts, so unlike the other
// tables they are never loaded into memory. The columns that the directory
// filters on are stored as real columns so LanceDB can push the predicate
// down; the full record still travels in `doc`.

const IMPORTED_TABLE = 'imported_donors';

function stringLiteral(value: string) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export type ImportedDonorRow = {
  id: string;
  blood_group: string;
  district: string;
  phone: string;
  claim_status: string;
  source_id: string;
  search_text: string;
  doc: string;
  vector: number[];
};

export async function ensureImportedDonorTable() {
  const conn = await getDb();
  const tables = await conn.tableNames();
  if (tables.includes(IMPORTED_TABLE)) return await conn.openTable(IMPORTED_TABLE);

  const table = await conn.createTable(IMPORTED_TABLE, [{
    vector: [0, 0],
    id: 'dummy',
    blood_group: '',
    district: '',
    phone: '',
    claim_status: '',
    source_id: '',
    search_text: '',
    doc: '{}'
  }]);
  await table.delete(idFilter('dummy'));
  return table;
}

export async function addImportedDonors(rows: ImportedDonorRow[]) {
  if (rows.length === 0) return;
  const table = await ensureImportedDonorTable();
  await table.add(rows);
}

export async function deleteImportedDonors(ids: string[]) {
  if (ids.length === 0) return;
  const table = await ensureImportedDonorTable();
  await table.delete(`id IN (${ids.map(stringLiteral).join(', ')})`);
}

/** Replaces a single row in place (LanceDB has no in-place update). */
export async function replaceImportedDonor(row: ImportedDonorRow) {
  await deleteImportedDonors([row.id]);
  await addImportedDonors([row]);
}

export type ImportedDonorQuery = {
  bloodGroups?: string[];
  district?: string;
  sourceId?: string;
  claimStatus?: string;
  /** Case-insensitive substring match against name/district/upazila. */
  search?: string;
  limit?: number;
  offset?: number;
};

function buildImportedFilter(query: ImportedDonorQuery) {
  const clauses: string[] = [];
  if (query.bloodGroups?.length) {
    clauses.push(`blood_group IN (${query.bloodGroups.map(stringLiteral).join(', ')})`);
  }
  if (query.district) clauses.push(`district = ${stringLiteral(query.district)}`);
  if (query.sourceId) clauses.push(`source_id = ${stringLiteral(query.sourceId)}`);
  if (query.claimStatus) clauses.push(`claim_status = ${stringLiteral(query.claimStatus)}`);
  if (query.search) {
    clauses.push(`search_text LIKE ${stringLiteral(`%${query.search.toLowerCase()}%`)}`);
  }
  return clauses.join(' AND ');
}

export async function queryImportedDonors(query: ImportedDonorQuery) {
  const conn = await getDb();
  const tables = await conn.tableNames();
  if (!tables.includes(IMPORTED_TABLE)) return [];

  const table = await conn.openTable(IMPORTED_TABLE);
  const limit = Math.max(1, query.limit ?? 30);
  const offset = Math.max(0, query.offset ?? 0);
  const filter = buildImportedFilter(query);

  // LanceDB has no OFFSET, so over-fetch by the offset and slice. Directory
  // paging is shallow, which keeps this cheap.
  let builder = table.query().limit(offset + limit);
  if (filter) builder = builder.where(filter);
  const results = await builder.toArray();
  return results.slice(offset).map((row: any) => JSON.parse(row.doc));
}

export async function countImportedDonors(query: ImportedDonorQuery = {}) {
  const conn = await getDb();
  const tables = await conn.tableNames();
  if (!tables.includes(IMPORTED_TABLE)) return 0;
  const table = await conn.openTable(IMPORTED_TABLE);
  const filter = buildImportedFilter(query);
  return await table.countRows(filter || undefined);
}

export async function getImportedDonor(id: string) {
  const conn = await getDb();
  const tables = await conn.tableNames();
  if (!tables.includes(IMPORTED_TABLE)) return null;
  const table = await conn.openTable(IMPORTED_TABLE);
  const results = await table.query().where(`id = ${stringLiteral(id)}`).limit(1).toArray();
  return results.length > 0 ? JSON.parse((results[0] as any).doc) : null;
}

export async function saveToTable(name: string, obj: any, vector: number[] = [0,0]) {
  const table = await ensureTable(name);
  try {
    await table.delete(idFilter(obj.id));
  } catch (e) {}
  await table.add([{ vector, id: obj.id, doc: JSON.stringify(obj) }]);
}
