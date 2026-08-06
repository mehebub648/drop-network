import * as lancedb from '@lancedb/lancedb';
import path from 'path';
import fs from 'fs';
import {
  IMPORTED_ROW_VERSION,
  toImportedDonorRow,
  withImportedDonorIdentity,
  type ImportedDonor
} from './importedDonors';

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
const IMPORTED_BACKFILL_BATCH_SIZE = 1_000;
let importedTableReady: Promise<Awaited<ReturnType<typeof prepareImportedDonorTable>>> | null = null;

function stringLiteral(value: string) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Moves a cached table handle to the newest committed version before reading.
 *
 * A LanceDB `Table` is pinned to the version it was opened at, and these
 * handles are memoized for the life of the process - so without this, a row
 * written a moment ago is invisible to the next query and only appears after a
 * restart. That is not a slow read, it is a wrong one: it silently broke the
 * rule that a requester must report a call before opening another number.
 *
 * Reopening the table per query would work too, but this keeps the memoized
 * handle and costs a metadata check.
 */
async function readable(table: lancedb.Table) {
  try {
    await table.checkoutLatest();
  } catch {
    // An older LanceDB, or a table already at the latest version. Reading the
    // pinned version is still better than failing the request.
  }
  return table;
}

export type ImportedDonorRow = {
  id: string;
  row_version: string;
  public_id: string;
  blood_group: string;
  district: string;
  upazila: string;
  phone: string;
  claim_status: string;
  source_id: string;
  search_text: string;
  doc: string;
  vector: number[];
};

function importedDonorFromRow(row: Record<string, unknown>): ImportedDonor {
  const parsed = JSON.parse(String(row.doc || '{}')) as ImportedDonor;
  return withImportedDonorIdentity(
    {
      ...parsed,
      public_id: typeof row.public_id === 'string' ? row.public_id : parsed.public_id
    },
    String(row.id)
  );
}

/**
 * Promotes values that already live inside `doc` into the filterable columns
 * added after a row was first written, rebuilding each row through
 * `toImportedDonorRow`.
 *
 * Progress is tracked by `row_version` rather than by whether a column still
 * looks empty. A row whose upazila is legitimately blank - a source that
 * publishes none - would otherwise keep matching its own backfill predicate
 * forever. Stamping the version instead makes each batch strictly reduce the
 * remaining set, and makes an interrupted migration resume where it stopped
 * instead of starting over.
 */
async function backfillImportedDonorColumns(table: lancedb.Table) {
  const stalePredicate = `row_version IS NULL OR row_version <> ${stringLiteral(IMPORTED_ROW_VERSION)}`;
  const total = await table.countRows(stalePredicate);
  if (total === 0) return;

  // A full-table rewrite is slow enough that a silent boot would look like a
  // hang. /ready stays 503 until it finishes.
  console.log(`imported_donors: migrating ${total} rows to row schema v${IMPORTED_ROW_VERSION}`);
  let done = 0;
  while (true) {
    const staleRows = await table
      .query()
      .where(stalePredicate)
      .limit(IMPORTED_BACKFILL_BATCH_SIZE)
      .toArray();
    if (staleRows.length === 0) break;

    await table
      .mergeInsert('id')
      .whenMatchedUpdateAll()
      .execute((staleRows as unknown as Array<Record<string, unknown>>)
        .map(row => toImportedDonorRow(importedDonorFromRow(row))));

    done += staleRows.length;
    console.log(`imported_donors: migrated ${done}/${total}`);
  }
  console.log('imported_donors: migration complete');
}

/**
 * A phone number is mandatory for an imported listing: a record nobody can call
 * is not a usable donor. The importer rejects those rows, so this only clears
 * rows written before that rule existed. Deleting once beats filtering on
 * every query.
 */
async function deleteContactlessImportedDonors(table: lancedb.Table) {
  await table.delete(`phone IS NULL OR phone = ''`);
}

async function prepareImportedDonorTable() {
  const conn = await getDb();
  const tables = await conn.tableNames();
  if (tables.includes(IMPORTED_TABLE)) {
    const table = await conn.openTable(IMPORTED_TABLE);
    const schema = await table.schema();
    const missing = ['public_id', 'upazila', 'row_version']
      .filter(name => !schema.fields.some(field => field.name === name));
    // Upazila is the granularity a requester searches at, and was always
    // present in `doc`; this promotes it to a column so LanceDB can filter on
    // it. row_version records which set of columns a row was written with.
    if (missing.length > 0) {
      await table.addColumns(missing.map(name => ({ name, valueSql: "''" })));
    }
    await deleteContactlessImportedDonors(table);
    await backfillImportedDonorColumns(table);
    return table;
  }

  const table = await conn.createTable(IMPORTED_TABLE, [{
    vector: [0, 0],
    id: 'dummy',
    row_version: IMPORTED_ROW_VERSION,
    public_id: '',
    blood_group: '',
    district: '',
    upazila: '',
    phone: '',
    claim_status: '',
    source_id: '',
    search_text: '',
    doc: '{}'
  }]);
  await table.delete(idFilter('dummy'));
  return table;
}

export async function ensureImportedDonorTable() {
  if (!importedTableReady) importedTableReady = prepareImportedDonorTable();
  try {
    return await importedTableReady;
  } catch (error) {
    importedTableReady = null;
    throw error;
  }
}

export async function addImportedDonors(rows: ImportedDonorRow[]) {
  if (rows.length === 0) return;
  const table = await ensureImportedDonorTable();
  await table.add(rows);
}

export async function deleteImportedDonorsByStorageIds(ids: string[]) {
  if (ids.length === 0) return;
  const table = await ensureImportedDonorTable();
  await table.delete(`id IN (${ids.map(stringLiteral).join(', ')})`);
}

export async function deleteImportedDonorsByPublicIds(publicIds: string[]) {
  if (publicIds.length === 0) return;
  const table = await ensureImportedDonorTable();
  await table.delete(`public_id IN (${publicIds.map(stringLiteral).join(', ')})`);
}

/** @deprecated Prefer an explicit storage-id or public-id deletion helper. */
export async function deleteImportedDonors(ids: string[]) {
  return await deleteImportedDonorsByStorageIds(ids);
}

/** Replaces a single row in place (LanceDB has no in-place update). */
export async function replaceImportedDonor(row: ImportedDonorRow) {
  await deleteImportedDonorsByStorageIds([row.id]);
  await addImportedDonors([row]);
}

export type ImportedDonorQuery = {
  bloodGroups?: string[];
  district?: string;
  /**
   * Every stored spelling of one upazila. The source register writes some
   * places two ways, so matching a single string would silently hide listings;
   * `getUpazilaVariants` in server/upazilas.ts produces this list.
   */
  upazilas?: string[];
  sourceId?: string;
  claimStatus?: string;
  /** Case-insensitive substring match against name/district/upazila. */
  search?: string;
  limit?: number;
  offset?: number;
};

/** Exported for tests; callers should use the query helpers below. */
export function buildImportedFilter(query: ImportedDonorQuery) {
  const clauses: string[] = [];
  if (query.bloodGroups?.length) {
    clauses.push(`blood_group IN (${query.bloodGroups.map(stringLiteral).join(', ')})`);
  }
  if (query.district) clauses.push(`district = ${stringLiteral(query.district)}`);
  if (query.upazilas?.length) {
    clauses.push(`upazila IN (${query.upazilas.map(stringLiteral).join(', ')})`);
  }
  if (query.sourceId) clauses.push(`source_id = ${stringLiteral(query.sourceId)}`);
  if (query.claimStatus) clauses.push(`claim_status = ${stringLiteral(query.claimStatus)}`);
  if (query.search) {
    clauses.push(`search_text LIKE ${stringLiteral(`%${query.search.toLowerCase()}%`)}`);
  }
  return clauses.join(' AND ');
}

export async function queryImportedDonors(query: ImportedDonorQuery) {
  const table = await readable(await ensureImportedDonorTable());
  const limit = Math.max(1, query.limit ?? 30);
  const offset = Math.max(0, query.offset ?? 0);
  const filter = buildImportedFilter(query);

  // LanceDB has no OFFSET, so over-fetch by the offset and slice. Directory
  // paging is shallow, which keeps this cheap.
  let builder = table.query().limit(offset + limit);
  if (filter) builder = builder.where(filter);
  const results = await builder.toArray();
  return results
    .slice(offset)
    .map((row: unknown) => importedDonorFromRow(row as Record<string, unknown>));
}

export async function countImportedDonors(query: ImportedDonorQuery = {}) {
  const table = await readable(await ensureImportedDonorTable());
  const filter = buildImportedFilter(query);
  return await table.countRows(filter || undefined);
}

/**
 * Directory listings that can back a district+upazila blood request.
 *
 * Claimed rows are excluded: they now belong to a registered account, which the
 * live donor search already covers, so including them would list the same
 * person twice and bypass their account's availability settings.
 */
export async function queryImportedDonorsForRequest(params: {
  district: string;
  upazilas: string[];
  bloodGroups: string[];
  limit?: number;
  offset?: number;
}) {
  return await queryImportedDonors({
    district: params.district,
    upazilas: params.upazilas,
    bloodGroups: params.bloodGroups,
    claimStatus: 'UNCLAIMED',
    limit: params.limit,
    offset: params.offset
  });
}

export async function getImportedDonor(publicId: string) {
  const table = await readable(await ensureImportedDonorTable());
  const results = await table.query().where(`public_id = ${stringLiteral(publicId)}`).limit(1).toArray();
  return results.length > 0
    ? importedDonorFromRow(results[0] as unknown as Record<string, unknown>)
    : null;
}

// --- Call reports --------------------------------------------------------
//
// One row per revealed contact and per reported outcome, so this table grows
// faster than any other: a single search can show fifty donors and every
// revealed number is expected to come back with an outcome. That is why it is
// queried on demand like the imported directory rather than being loaded into
// memory at boot - `getAllFromTable` silently stops at 10,000 rows, and this is
// the table that would reach it first.

const CALL_REPORT_TABLE = 'common_call_reports';
let callReportTableReady: Promise<lancedb.Table> | null = null;

export type CallReportRow = {
  id: string;
  kind: string;
  request_id: string;
  actor_id: string;
  donor_ref: string;
  doc: string;
  vector: number[];
};

async function prepareCallReportTable() {
  const conn = await getDb();
  const tables = await conn.tableNames();
  if (tables.includes(CALL_REPORT_TABLE)) return await conn.openTable(CALL_REPORT_TABLE);

  const table = await conn.createTable(CALL_REPORT_TABLE, [{
    vector: [0, 0],
    id: 'dummy',
    kind: '',
    request_id: '',
    actor_id: '',
    donor_ref: '',
    doc: '{}'
  }]);
  await table.delete(idFilter('dummy'));
  return table;
}

export async function ensureCallReportTable() {
  if (!callReportTableReady) callReportTableReady = prepareCallReportTable();
  try {
    return await callReportTableReady;
  } catch (error) {
    callReportTableReady = null;
    throw error;
  }
}

/**
 * Call reports are append-only; there is no update path by design.
 *
 * The five named fields become filterable columns. Anything else on the record
 * travels in `doc`, so the report taxonomy can grow without a schema change.
 */
export async function addCallReports(reports: Array<{
  id: string;
  kind: string;
  request_id: string;
  actor_id: string;
  donor_ref: string;
  [key: string]: unknown;
}>) {
  if (reports.length === 0) return;
  const table = await ensureCallReportTable();
  await table.add(reports.map(report => ({
    vector: [0, 0],
    id: report.id,
    kind: report.kind,
    request_id: report.request_id,
    actor_id: report.actor_id,
    donor_ref: report.donor_ref,
    doc: JSON.stringify(report)
  })));
}

export type CallReportQuery = {
  requestId?: string;
  actorId?: string;
  donorRef?: string;
  kind?: string;
  limit?: number;
  offset?: number;
};

/** Exported for tests; callers should use the query helpers below. */
export function buildCallReportFilter(query: CallReportQuery) {
  const clauses: string[] = [];
  if (query.requestId) clauses.push(`request_id = ${stringLiteral(query.requestId)}`);
  if (query.actorId) clauses.push(`actor_id = ${stringLiteral(query.actorId)}`);
  if (query.donorRef) clauses.push(`donor_ref = ${stringLiteral(query.donorRef)}`);
  if (query.kind) clauses.push(`kind = ${stringLiteral(query.kind)}`);
  return clauses.join(' AND ');
}

export async function queryCallReports<T = Record<string, unknown>>(query: CallReportQuery = {}): Promise<T[]> {
  const table = await readable(await ensureCallReportTable());
  const limit = Math.max(1, query.limit ?? 200);
  const offset = Math.max(0, query.offset ?? 0);
  const filter = buildCallReportFilter(query);

  // Same over-fetch-and-slice as the directory: LanceDB has no OFFSET.
  let builder = table.query().limit(offset + limit);
  if (filter) builder = builder.where(filter);
  const results = await builder.toArray();
  return (results as unknown as Array<Record<string, unknown>>)
    .slice(offset)
    .map(row => JSON.parse(String(row.doc || '{}')) as T);
}

export async function countCallReports(query: CallReportQuery = {}) {
  const table = await readable(await ensureCallReportTable());
  const filter = buildCallReportFilter(query);
  return await table.countRows(filter || undefined);
}

export async function saveToTable(name: string, obj: any, vector: number[] = [0,0]) {
  const table = await ensureTable(name);
  try {
    await table.delete(idFilter(obj.id));
  } catch (e) {}
  await table.add([{ vector, id: obj.id, doc: JSON.stringify(obj) }]);
}
