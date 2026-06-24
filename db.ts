import * as lancedb from '@lancedb/lancedb';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), '.lancedb');
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

export async function saveToTable(name: string, obj: any, vector: number[] = [0,0]) {
  const table = await ensureTable(name);
  try {
    await table.delete(idFilter(obj.id));
  } catch (e) {}
  await table.add([{ vector, id: obj.id, doc: JSON.stringify(obj) }]);
}
