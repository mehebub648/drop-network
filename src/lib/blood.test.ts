import assert from 'node:assert/strict';
import test from 'node:test';
import { compatibleDonorsFor, getEligibility, getUrgency } from './blood';

test('red-cell compatibility keeps O negative universal', () => {
  assert.deepEqual(compatibleDonorsFor('O-'), ['O-']);
  assert.ok(compatibleDonorsFor('AB+').includes('O-'));
  assert.equal(compatibleDonorsFor('invalid').length, 0);
});

test('eligibility blocks a recent donation and accepts no history', () => {
  assert.equal(getEligibility().eligible, true);
  assert.equal(getEligibility(new Date().toISOString().slice(0, 10)).eligible, false);
});

test('urgency follows required time thresholds', () => {
  assert.equal(getUrgency(), 'CRITICAL');
  assert.equal(getUrgency(new Date(Date.now() + 12 * 3_600_000).toISOString()), 'CRITICAL');
  assert.equal(getUrgency(new Date(Date.now() + 48 * 3_600_000).toISOString()), 'URGENT');
  assert.equal(getUrgency(new Date(Date.now() + 96 * 3_600_000).toISOString()), 'SCHEDULED');
});
