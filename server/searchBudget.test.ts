import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DAILY_UNIQUE_SEARCH_LIMIT,
  DailySearchBudget,
  dhakaDay,
  nextDhakaDay,
  searchFingerprint
} from './searchBudget';

const NOW = new Date('2026-08-26T12:00:00.000Z');

function consume(
  budget: DailySearchBudget,
  overrides: Partial<{ identities: string[]; bloodGroup: string; district: string; upazila: string; now: Date }> = {}
) {
  return budget.consume({
    identities: ['ip:203.0.113.10'],
    bloodGroup: 'A+',
    district: 'Dhaka',
    upazila: 'Gulshan',
    now: NOW,
    ...overrides
  });
}

test('fingerprints normalize criteria and never include a page number', () => {
  assert.equal(
    searchFingerprint({ bloodGroup: ' A+ ', district: 'DHAKA', upazila: ' Gulshan ' }),
    'a+|dhaka|gulshan'
  );
});

test('repeating or paging one search does not consume another unique search', () => {
  const budget = new DailySearchBudget();
  const first = consume(budget);
  const nextPage = consume(budget);
  assert.equal(first.allowed, true);
  assert.equal(nextPage.allowed, true);
  assert.equal(first.remaining, DAILY_UNIQUE_SEARCH_LIMIT - 1);
  assert.equal(nextPage.remaining, first.remaining);
});

test('a fourth district or fourth blood group is blocked', () => {
  const districts = new DailySearchBudget();
  for (const district of ['Dhaka', 'Gazipur', 'Narayanganj']) {
    assert.equal(consume(districts, { district, upazila: `${district} Sadar` }).allowed, true);
  }
  assert.equal(consume(districts, { district: 'Cumilla', upazila: 'Cumilla Sadar' }).allowed, false);

  const groups = new DailySearchBudget();
  for (const bloodGroup of ['A+', 'B+', 'O+']) {
    assert.equal(consume(groups, { bloodGroup }).allowed, true);
  }
  assert.equal(consume(groups, { bloodGroup: 'AB+' }).allowed, false);
});

test('ten distinct criteria combinations are blocked even inside three districts and groups', () => {
  const budget = new DailySearchBudget();
  let count = 0;
  for (const district of ['Dhaka', 'Gazipur', 'Narayanganj']) {
    for (const bloodGroup of ['A+', 'B+', 'O+']) {
      count += 1;
      assert.equal(consume(budget, { district, bloodGroup, upazila: `${district} ${count}` }).allowed, true);
    }
  }
  assert.equal(consume(budget, { district: 'Dhaka', bloodGroup: 'A+', upazila: 'Dhanmondi' }).allowed, false);
});

test('new searches must fit both account and IP budgets, while a known search can continue', () => {
  const budget = new DailySearchBudget();
  const userIdentity = ['user:member-1'];
  for (const district of ['Dhaka', 'Gazipur', 'Narayanganj']) {
    assert.equal(consume(budget, { identities: userIdentity, district, upazila: `${district} Sadar` }).allowed, true);
  }
  assert.equal(consume(budget, {
    identities: ['user:member-1', 'ip:203.0.113.10'],
    district: 'Cumilla',
    upazila: 'Cumilla Sadar'
  }).allowed, false);
  assert.equal(consume(budget, {
    identities: ['user:member-1', 'ip:203.0.113.10'],
    district: 'Dhaka',
    upazila: 'Dhaka Sadar'
  }).allowed, true);

  const sharedIpBudget = new DailySearchBudget();
  for (const district of ['Dhaka', 'Gazipur', 'Narayanganj']) {
    assert.equal(consume(sharedIpBudget, { district, upazila: `${district} Sadar` }).allowed, true);
  }
  assert.equal(consume(sharedIpBudget, {
    identities: ['user:member-with-room', 'ip:203.0.113.10'],
    district: 'Cumilla',
    upazila: 'Cumilla Sadar'
  }).allowed, false);
});

test('budgets reset at midnight in Bangladesh', () => {
  const beforeMidnight = new Date('2026-08-26T17:59:59.000Z');
  const afterMidnight = new Date('2026-08-26T18:00:00.000Z');
  assert.equal(dhakaDay(beforeMidnight), '2026-08-26');
  assert.equal(dhakaDay(afterMidnight), '2026-08-27');
  assert.equal(nextDhakaDay(beforeMidnight), '2026-08-26T18:00:00.000Z');

  const budget = new DailySearchBudget();
  for (const district of ['Dhaka', 'Gazipur', 'Narayanganj']) {
    consume(budget, { district, upazila: `${district} Sadar`, now: beforeMidnight });
  }
  assert.equal(consume(budget, { district: 'Cumilla', upazila: 'Cumilla Sadar', now: beforeMidnight }).allowed, false);
  assert.equal(consume(budget, { district: 'Cumilla', upazila: 'Cumilla Sadar', now: afterMidnight }).allowed, true);
});
