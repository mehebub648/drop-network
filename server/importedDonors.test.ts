import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimSlugForPublicId,
  dedupeKey,
  evaluateClaim,
  importedDonorId,
  importedDonorStorageId,
  maskPhone,
  missingFields,
  toImportedDonor,
  toImportedDonorRow,
  toPublicImportedDonor,
  toRevealedImportedDonor,
  withCollisionCheckedClaimSlugs,
  withImportedDonorIdentity,
  type ImportedDonor
} from './importedDonors';

const scraped = {
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
};

test('records with the same phone collapse across sources', () => {
  const a = dedupeKey({ phone: '+8801961161996', source_id: 'bd-scouts', source_ref: 'AA1583' });
  const b = dedupeKey({ phone: '+8801961161996', source_id: 'quantum-method', source_ref: '332496' });
  assert.equal(a, b);
  assert.equal(importedDonorId(a), importedDonorId(b));
  assert.equal(importedDonorStorageId(a), importedDonorStorageId(b));
  assert.match(importedDonorId(a), /^imp_[a-f0-9]{64}$/);
  assert.match(importedDonorStorageId(a), /^imp_row_[a-f0-9]{64}$/);
});

test('records without a phone stay unique per source', () => {
  const a = dedupeKey({ phone: '', source_id: 'quantum-method', source_ref: '332496' });
  const b = dedupeKey({ phone: '', source_id: 'quantum-method', source_ref: '332497' });
  assert.notEqual(a, b);
});

test('imported donors start unclaimed and never expose a raw phone publicly', () => {
  const donor = toImportedDonor(scraped, '2026-07-29T00:00:00.000Z');
  assert.equal(donor.claim_status, 'UNCLAIMED');
  const publicView = toPublicImportedDonor(donor);
  const serialized = JSON.stringify(publicView);
  assert.equal(publicView.has_phone, true);
  assert.ok(!publicView.phone_masked.includes('61161'));
  assert.equal(publicView.phone_masked, '+88019••••••96');
  assert.deepEqual(publicView.missing_fields, []);
  assert.equal(publicView.id, donor.public_id);
  assert.match(donor.claim_slug, /^[A-Za-z0-9_-]{12}$/);
  assert.equal(publicView.claim_path, `/c/${donor.claim_slug}`);
  assert.notEqual(publicView.id, donor.id);
  assert.equal(serialized.includes(scraped.phone), false);
  assert.equal(serialized.includes(encodeURIComponent(scraped.phone)), false);
  assert.equal(serialized.includes(encodeURIComponent(`phone:${scraped.phone}`)), false);
  assert.equal(serialized.includes(donor.id), false);
});

test('storage rows keep separate internal and public identities', () => {
  const donor = toImportedDonor(scraped, '2026-07-29T00:00:00.000Z');
  const row = toImportedDonorRow(donor);
  assert.equal(row.id, donor.id);
  assert.equal(row.public_id, donor.public_id);
  assert.equal(row.claim_slug, donor.claim_slug);
  assert.equal(row.publication_state, 'PUBLIC');
  assert.equal(JSON.parse(row.doc).public_id, donor.public_id);
  // Upazila is a filterable column, not only a `doc` field, so a district and
  // upazila search can push the predicate down.
  assert.equal(row.upazila, scraped.upazila);
});

test('claim slugs are stable and deterministic collisions are resolved', () => {
  const first = toImportedDonor(scraped, '2026-07-29T00:00:00.000Z');
  const second = toImportedDonor(
    { ...scraped, source_ref: 'AA1584', phone: '+8801712345678' },
    '2026-07-29T00:00:00.000Z'
  );
  second.claim_slug = first.claim_slug;

  const resolved = withCollisionCheckedClaimSlugs([second, first]);
  const winner = [first, second].sort((left, right) =>
    left.imported_at.localeCompare(right.imported_at) || left.public_id.localeCompare(right.public_id)
  )[0];
  const loser = winner.public_id === first.public_id ? second : first;
  const winnerResult = resolved.find(donor => donor.public_id === winner.public_id)!;
  const loserResult = resolved.find(donor => donor.public_id === loser.public_id)!;
  assert.equal(winnerResult.claim_slug, first.claim_slug);
  assert.equal(loserResult.claim_slug, claimSlugForPublicId(loser.public_id, 1));
  assert.notEqual(resolved[0].claim_slug, resolved[1].claim_slug);
});

test('the reveal projection adds the raw phone and keeps the masked one', () => {
  const donor = toImportedDonor(scraped, '2026-07-29T00:00:00.000Z');
  const revealed = toRevealedImportedDonor(donor);
  assert.equal(revealed.phone, scraped.phone);
  assert.equal(revealed.phone_masked, '+88019••••••96');
  // Everything the public projection guarantees still holds, because the
  // reveal is built on top of it rather than replacing it.
  assert.equal(revealed.id, donor.public_id);
  assert.equal(JSON.stringify(revealed).includes(donor.id), false);
});

test('legacy storage ids remain internal when public identity is hydrated', () => {
  const donor = toImportedDonor(scraped, '2026-07-29T00:00:00.000Z');
  const legacyStorageId = 'imp_legacy_phone%3A%2B8801961161996';
  const hydrated = withImportedDonorIdentity({ ...donor, id: legacyStorageId, public_id: undefined });
  const publicView = toPublicImportedDonor(hydrated);

  assert.equal(hydrated.id, legacyStorageId);
  assert.match(hydrated.public_id, /^imp_[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(publicView).includes(legacyStorageId), false);
  assert.equal(JSON.stringify(publicView).includes(scraped.phone), false);
});

test('masking keeps only the operator prefix and the last two digits', () => {
  assert.equal(maskPhone('+8801712345678'), '+88017••••••78');
  assert.equal(maskPhone(''), '');
});

test('missing fields are reported so the claim form can require them', () => {
  assert.deepEqual(
    missingFields({ name: 'Gopal', phone: '', blood_group: 'O+', district: '' }),
    ['phone', 'district']
  );
});

test('a claim from the published number is auto-approved', () => {
  const decision = evaluateClaim(
    { ...scraped, claim_status: 'UNCLAIMED' },
    {},
    '+8801961161996'
  );
  assert.ok(!('error' in decision));
  if ('error' in decision) return;
  assert.equal(decision.status, 'CLAIMED');
  assert.equal(decision.resolved.district, 'Dhaka');
});

test('a claim from a different number is queued for review, not granted', () => {
  const decision = evaluateClaim(
    { ...scraped, claim_status: 'UNCLAIMED' },
    {},
    '+8801711111111'
  );
  assert.ok(!('error' in decision));
  if ('error' in decision) return;
  assert.equal(decision.status, 'PENDING_REVIEW');
  // The claimant's own verified number wins over the scraped one.
  assert.equal(decision.resolved.phone, '+8801711111111');
});

test('a contact-less record cannot be auto-approved and must be completed', () => {
  const stub = { name: 'Gopal', phone: '', blood_group: '', district: '', claim_status: 'UNCLAIMED' as const };

  const incomplete = evaluateClaim(stub, {}, '+8801711111111');
  assert.ok('error' in incomplete);

  const completed = evaluateClaim(stub, { blood_group: 'O+', district: 'Khulna' }, '+8801711111111');
  assert.ok(!('error' in completed));
  if ('error' in completed) return;
  assert.equal(completed.status, 'PENDING_REVIEW');
  assert.equal(completed.resolved.blood_group, 'O+');
});

test('already-claimed and in-review profiles reject further claims', () => {
  const claimed: Pick<ImportedDonor, 'name' | 'phone' | 'blood_group' | 'district' | 'claim_status'> = {
    ...scraped,
    claim_status: 'CLAIMED'
  };
  assert.ok('error' in evaluateClaim(claimed, {}, '+8801961161996'));
  assert.ok('error' in evaluateClaim({ ...claimed, claim_status: 'PENDING_REVIEW' }, {}, '+8801961161996'));
});
