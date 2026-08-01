import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APPROXIMATE_DONATION_LIMITS,
  MAX_DONATION_COUNT,
  canonicalLastDonationDate,
  createPublicDonationSummary,
  parseDonationCount,
  parseDonationDate,
  parseLastDonationDeclaration
} from './donation';

const NOW = new Date('2026-08-31T12:34:56.000Z');

test('omitted declarations stay omitted and malformed declarations are invalid', () => {
  assert.equal(parseLastDonationDeclaration(undefined, NOW), undefined);
  assert.equal(parseLastDonationDeclaration(null, NOW), undefined);
  assert.equal(parseLastDonationDeclaration('', NOW), undefined);
  assert.equal(parseLastDonationDeclaration('NEVER', NOW), null);
  assert.equal(parseLastDonationDeclaration({ kind: 'UNKNOWN' }, NOW), null);
});

test('exact declarations accept only real, nonfuture YYYY-MM-DD dates', () => {
  assert.deepEqual(parseLastDonationDeclaration({ kind: 'EXACT', date: '2024-02-29' }, NOW), {
    kind: 'EXACT',
    date: '2024-02-29',
    reported_at: NOW.toISOString()
  });
  assert.equal(parseDonationDate('2025-02-29', NOW), null);
  assert.equal(parseDonationDate('2026-02-30', NOW), null);
  assert.equal(parseDonationDate('2026-9-01', NOW), null);
  assert.equal(parseDonationDate('2026-09-01', NOW), null);
  assert.equal(parseDonationDate('0000-01-01', NOW), null);
});

test('approximate declarations are anchored to the server clock with calendar clamping', () => {
  assert.deepEqual(parseLastDonationDeclaration({
    kind: 'APPROXIMATE',
    value: 1,
    unit: 'DAYS',
    estimated_date: '2099-01-01',
    reported_at: '2099-01-01T00:00:00.000Z'
  }, NOW), {
    kind: 'APPROXIMATE',
    value: 1,
    unit: 'DAYS',
    estimated_date: '2026-08-30',
    reported_at: NOW.toISOString()
  });

  assert.deepEqual(parseLastDonationDeclaration({ kind: 'APPROXIMATE', value: 6, unit: 'MONTHS' }, NOW), {
    kind: 'APPROXIMATE',
    value: 6,
    unit: 'MONTHS',
    estimated_date: '2026-02-28',
    reported_at: NOW.toISOString()
  });

  const leapDay = new Date('2024-02-29T08:00:00.000Z');
  assert.deepEqual(parseLastDonationDeclaration({ kind: 'APPROXIMATE', value: 1, unit: 'YEARS' }, leapDay), {
    kind: 'APPROXIMATE',
    value: 1,
    unit: 'YEARS',
    estimated_date: '2023-02-28',
    reported_at: leapDay.toISOString()
  });
});

test('approximate declarations enforce positive integer unit-specific bounds', () => {
  for (const [unit, maximum] of Object.entries(APPROXIMATE_DONATION_LIMITS)) {
    assert.notEqual(parseLastDonationDeclaration({ kind: 'APPROXIMATE', value: maximum, unit }, NOW), null);
    assert.equal(parseLastDonationDeclaration({ kind: 'APPROXIMATE', value: maximum + 1, unit }, NOW), null);
  }
  assert.equal(parseLastDonationDeclaration({ kind: 'APPROXIMATE', value: 0, unit: 'DAYS' }, NOW), null);
  assert.equal(parseLastDonationDeclaration({ kind: 'APPROXIMATE', value: 1.5, unit: 'MONTHS' }, NOW), null);
  assert.equal(parseLastDonationDeclaration({ kind: 'APPROXIMATE', value: '3', unit: 'MONTHS' }, NOW), null);
  assert.equal(parseLastDonationDeclaration({ kind: 'APPROXIMATE', value: 3, unit: 'WEEKS' }, NOW), null);
});

test('never declarations have no canonical donation date', () => {
  const declaration = parseLastDonationDeclaration({ kind: 'NEVER' }, NOW);
  assert.deepEqual(declaration, { kind: 'NEVER', reported_at: NOW.toISOString() });
  assert.equal(canonicalLastDonationDate(declaration), undefined);

  const exact = parseLastDonationDeclaration({ kind: 'EXACT', date: '2026-01-02' }, NOW);
  assert.equal(canonicalLastDonationDate(exact), '2026-01-02');
  const approximate = parseLastDonationDeclaration({ kind: 'APPROXIMATE', value: 2, unit: 'DAYS' }, NOW);
  assert.equal(canonicalLastDonationDate(approximate), '2026-08-29');
});

test('donation counts are optional, bounded, and consistent with declarations and records', () => {
  const never = parseLastDonationDeclaration({ kind: 'NEVER' }, NOW)!;
  const exact = parseLastDonationDeclaration({ kind: 'EXACT', date: '2026-01-02' }, NOW)!;

  assert.equal(parseDonationCount(undefined, exact), undefined);
  assert.equal(parseDonationCount(0, never), 0);
  assert.equal(parseDonationCount(1, never), null);
  assert.equal(parseDonationCount(0, exact), null);
  assert.equal(parseDonationCount(4, exact, 5), null);
  assert.equal(parseDonationCount(5, exact, 5), 5);
  assert.equal(parseDonationCount(MAX_DONATION_COUNT), MAX_DONATION_COUNT);
  assert.equal(parseDonationCount(MAX_DONATION_COUNT + 1), null);
  assert.equal(parseDonationCount(2.5), null);
  assert.equal(parseDonationCount('5'), null);
});

test('public summaries expose bounded donation facts without report metadata or history', () => {
  const exact = parseLastDonationDeclaration({ kind: 'EXACT', date: '2026-01-02' }, NOW)!;
  assert.deepEqual(createPublicDonationSummary(exact, 7), {
    kind: 'EXACT',
    date: '2026-01-02',
    donation_count: 7
  });

  const approximate = parseLastDonationDeclaration({ kind: 'APPROXIMATE', value: 6, unit: 'MONTHS' }, NOW)!;
  assert.deepEqual(createPublicDonationSummary(approximate, 4), {
    kind: 'APPROXIMATE',
    value: 6,
    unit: 'MONTHS',
    estimated_date: '2026-02-28',
    donation_count: 4
  });

  const never = parseLastDonationDeclaration({ kind: 'NEVER' }, NOW)!;
  const summary = createPublicDonationSummary(never, 0);
  assert.deepEqual(summary, { kind: 'NEVER', donation_count: 0 });
  assert.equal('reported_at' in summary!, false);
  assert.equal('donation_history' in summary!, false);
  assert.equal(createPublicDonationSummary(undefined, 3), undefined);
});

test('public summaries fall back to a valid legacy last donation date without inferring a count', () => {
  assert.deepEqual(createPublicDonationSummary(undefined, undefined, '2025-05-04', NOW), {
    kind: 'EXACT',
    date: '2025-05-04'
  });
  assert.deepEqual(createPublicDonationSummary(undefined, 9, '2025-05-04T00:00:00.000Z', NOW), {
    kind: 'EXACT',
    date: '2025-05-04',
    donation_count: 9
  });
  assert.equal(createPublicDonationSummary(undefined, undefined, '2026-09-01', NOW), undefined);

  const never = parseLastDonationDeclaration({ kind: 'NEVER' }, NOW)!;
  assert.deepEqual(createPublicDonationSummary(never, 0, '2025-05-04', NOW), {
    kind: 'NEVER',
    donation_count: 0
  });
});
