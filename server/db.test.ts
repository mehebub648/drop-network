import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { toImportedDonor, toImportedDonorRow } from './importedDonors';

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
  // The legacy row was written before either filterable column existed, so
  // this also covers the upazila backfill promoting the value out of `doc`.
  assert.equal(schema.fields.some(field => field.name === 'upazila'), true);

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

  const forRequest = await database.queryImportedDonorsForRequest({
    district: 'Dhaka',
    upazilas: ['Adabor'],
    bloodGroups: ['A+', 'O-']
  });
  assert.equal(forRequest.length, 0, 'a claim under review must not be offered as a callable listing');
  assert.equal((await database.queryImportedDonorsForRequest({
    district: 'Dhaka',
    upazilas: ['Gulshan'],
    bloodGroups: ['A+']
  })).length, 0);

  await database.deleteImportedDonorsByPublicIds([donor.public_id]);
  assert.equal(await database.countImportedDonors(), 0);
});

test('unclaimed listings are reachable by any stored spelling of their upazila', async () => {
  const donor = toImportedDonor({
    source_id: 'bd-scouts',
    source_organization: 'Bangladesh Scouts',
    source_url: 'https://service.scouts.gov.bd/blood-donation/1',
    scraped_at: '2026-07-29T00:00:00.000Z',
    source_ref: 'BB2001',
    name: 'Scout Nadia',
    phone: '+8801711000022',
    blood_group: 'O-',
    district: 'Dhaka',
    // The register spells this thana two ways; the search must find the row
    // whichever spelling it was stored under.
    upazila: 'Chalk Bazar'
  }, '2026-07-29T00:00:00.000Z');

  await database.addImportedDonors([toImportedDonorRow(donor)]);

  const found = await database.queryImportedDonorsForRequest({
    district: 'Dhaka',
    upazilas: ['Chackbazar Model', 'Chalk Bazar'],
    bloodGroups: ['O-', 'O+']
  });
  assert.equal(found.length, 1);
  assert.equal(found[0].name, 'Scout Nadia');

  const wrongGroup = await database.queryImportedDonorsForRequest({
    district: 'Dhaka',
    upazilas: ['Chackbazar Model', 'Chalk Bazar'],
    bloodGroups: ['A+']
  });
  assert.equal(wrongGroup.length, 0);

  await database.deleteImportedDonorsByPublicIds([donor.public_id]);
});

test('filters escape quoted values instead of breaking the predicate', () => {
  assert.equal(
    database.buildImportedFilter({ upazilas: ["Cox's Bazar Sadar"] }),
    `upazila IN ('Cox''s Bazar Sadar')`
  );
  assert.equal(
    database.buildImportedFilter({ district: 'Dhaka', bloodGroups: ['A+', 'O-'] }),
    `blood_group IN ('A+', 'O-') AND district = 'Dhaka'`
  );
  assert.equal(database.buildImportedFilter({}), '');
});

test('call reports are queryable per request without loading the table', async () => {
  await database.addCallReports([
    { id: 'cr-1', kind: 'REVEAL', request_id: 'req-1', actor_id: 'user-1', donor_ref: 'imp:abc' },
    { id: 'cr-2', kind: 'CALL_OUTCOME', request_id: 'req-1', actor_id: 'user-1', donor_ref: 'imp:abc' },
    { id: 'cr-3', kind: 'REVEAL', request_id: 'req-2', actor_id: 'user-2', donor_ref: 'reg:xyz' }
  ]);

  const forRequest = await database.queryCallReports<{ id: string }>({ requestId: 'req-1' });
  assert.deepEqual(forRequest.map(report => report.id).sort(), ['cr-1', 'cr-2']);

  const reveals = await database.queryCallReports<{ id: string }>({ kind: 'REVEAL' });
  assert.deepEqual(reveals.map(report => report.id).sort(), ['cr-1', 'cr-3']);
  assert.equal(await database.countCallReports({ requestId: 'req-2' }), 1);
});

test('a report written now is visible to the very next read', async () => {
  // A cached LanceDB table handle is pinned to the version it was opened at,
  // so without an explicit move to the latest version this row stays invisible
  // until the process restarts. That silently disabled the rule that a
  // requester must report a call before opening another number, so it is
  // pinned here rather than left to be rediscovered.
  await database.addCallReports([
    { id: 'fresh-1', kind: 'REVEAL', request_id: 'req-fresh', actor_id: 'user-9', donor_ref: 'imp:zzz' }
  ]);
  const immediately = await database.queryCallReports<{ id: string }>({ requestId: 'req-fresh' });
  assert.deepEqual(immediately.map(report => report.id), ['fresh-1']);
  assert.equal(await database.countCallReports({ requestId: 'req-fresh' }), 1);

  await database.addCallReports([
    { id: 'fresh-2', kind: 'CALL_OUTCOME', request_id: 'req-fresh', actor_id: 'user-9', donor_ref: 'imp:zzz' }
  ]);
  assert.equal((await database.queryCallReports({ requestId: 'req-fresh' })).length, 2);
});
