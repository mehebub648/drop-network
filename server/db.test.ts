import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { toImportedDonor } from './importedDonors';

const originalDatabasePath = process.env.LANCEDB_PATH;
const databasePath = await fs.mkdtemp(path.join(os.tmpdir(), 'drop-imported-id-test-'));
process.env.LANCEDB_PATH = databasePath;
const database = await import('./db');

after(async () => {
  (await database.getDb()).close();
  if (originalDatabasePath === undefined) delete process.env.LANCEDB_PATH;
  else process.env.LANCEDB_PATH = originalDatabasePath;
  await fs.rm(databasePath, { recursive: true, force: true });
});

test('legacy imported rows gain an opaque public id without changing their storage identity', async () => {
  const donor = toImportedDonor({
    source_id: 'bd-scouts',
    source_organization: 'Bangladesh Scouts',
    source_url: 'https://service.scouts.gov.bd/blood-donation/1',
    scraped_at: '2026-07-29T00:00:00.000Z',
    source_ref: 'AA1583',
    name: 'Scout Md. Robin',
    phone: '+8801961161996',
    blood_group: 'A+',
    district: 'Dhaka',
    upazila: 'Adabor'
  }, '2026-07-29T00:00:00.000Z');
  const legacyStorageId = 'imp_deadbeef_i_phone%3A%2B8801961161996';
  const { public_id: _publicId, ...legacyDocument } = donor;
  const storedDocument = {
    ...legacyDocument,
    id: legacyStorageId,
    claim_status: 'PENDING_REVIEW',
    claimed_by: 'member-1'
  };

  const connection = await database.getDb();
  await connection.createTable('imported_donors', [{
    vector: [0, 0],
    id: legacyStorageId,
    blood_group: donor.blood_group,
    district: donor.district,
    phone: donor.phone,
    claim_status: storedDocument.claim_status,
    source_id: donor.source.id,
    search_text: `${donor.name} ${donor.district} ${donor.upazila}`.toLowerCase(),
    doc: JSON.stringify(storedDocument)
  }]);

  const table = await database.ensureImportedDonorTable();
  const schema = await table.schema();
  assert.equal(schema.fields.some(field => field.name === 'public_id'), true);

  const hydrated = await database.getImportedDonor(donor.public_id);
  assert.ok(hydrated);
  assert.equal(hydrated.id, legacyStorageId);
  assert.equal(hydrated.public_id, donor.public_id);
  assert.equal(hydrated.claim_status, 'PENDING_REVIEW');
  assert.equal(hydrated.claimed_by, 'member-1');
  assert.equal(await database.getImportedDonor(legacyStorageId), null);

  const rows = await database.queryImportedDonors({ limit: 10 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].public_id, donor.public_id);
  assert.equal(rows[0].id, legacyStorageId);

  await database.deleteImportedDonorsByPublicIds([donor.public_id]);
  assert.equal(await database.countImportedDonors(), 0);
});
