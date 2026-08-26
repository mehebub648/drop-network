import assert from 'node:assert/strict';
import test from 'node:test';
import { migrateDonationLedger, resolveDonationLedger } from './donationLedger';

test('migrates a legacy lifetime total without double-counting detailed history', () => {
  assert.deepEqual(migrateDonationLedger({ donation_count: 9, donation_history: [{}, {}, {}] }), {
    donations_before_history: 6,
    donation_count: 9
  });
});

test('history edits preserve the baseline and count every record exactly once', () => {
  assert.deepEqual(resolveDonationLedger({
    requestedTotal: 9,
    requestedBeforeHistory: 6,
    existingTotal: 9,
    existingBeforeHistory: 6,
    existingHistoryLength: 3,
    nextHistoryLength: 4
  }), {
    donations_before_history: 6,
    donation_count: 10
  });
});

test('an explicit lifetime correction recalculates the baseline', () => {
  assert.deepEqual(resolveDonationLedger({
    requestedTotal: 12,
    requestedBeforeHistory: 6,
    existingTotal: 9,
    existingBeforeHistory: 6,
    existingHistoryLength: 3,
    nextHistoryLength: 3
  }), {
    donations_before_history: 9,
    donation_count: 12
  });
});

test('rejects a lifetime total below the detailed history', () => {
  assert.equal(resolveDonationLedger({
    requestedTotal: 2,
    existingTotal: 9,
    existingHistoryLength: 3,
    nextHistoryLength: 3
  }), null);
});
