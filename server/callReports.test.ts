import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCallOutcome, parseDonorReport, parseDonorRef } from './callReports';

function error(input: Parameters<typeof parseCallOutcome>[0]) {
  const result = parseCallOutcome(input);
  return 'error' in result ? result.error : null;
}

test('a simple outcome carries no reason and rejects one', () => {
  const parsed = parseCallOutcome({ outcome: 'NOT_CALLED' });
  assert.deepEqual(parsed, { value: { outcome: 'NOT_CALLED', note: undefined } });
  assert.ok(parseCallOutcome({ outcome: 'WILL_DONATE' }).value);
  // "I did not call, because they recently donated" is not something the
  // caller can know, so the combination is refused rather than stored.
  assert.ok(error({ outcome: 'NOT_CALLED', reason: 'RECENTLY_DONATED' }));
  assert.ok(error({ outcome: 'NO_ANSWER', detail: 'TRAVELLING' }));
  assert.ok(error({ outcome: 'MAYBE' }));
  assert.ok(error({}));
});

test('declining requires a reason, and distance requires a detail', () => {
  assert.ok(error({ outcome: 'DECLINED' }));
  assert.ok(error({ outcome: 'DECLINED', reason: 'NOWHERE_NEAR' }));
  assert.ok(error({ outcome: 'DECLINED', reason: 'LOCATION_FAR' }));
  assert.ok(error({ outcome: 'DECLINED', reason: 'LOCATION_FAR', detail: 'SOMEWHERE' }));
  // The detail only belongs to the distance branch.
  assert.ok(error({ outcome: 'DECLINED', reason: 'DONOR_ILL', detail: 'TRAVELLING' }));

  const parsed = parseCallOutcome({ outcome: 'DECLINED', reason: 'LOCATION_FAR', detail: 'TRAVELLING' });
  assert.deepEqual(parsed.value, {
    outcome: 'DECLINED', reason: 'LOCATION_FAR', detail: 'TRAVELLING', note: undefined
  });
  assert.ok(parseCallOutcome({ outcome: 'DECLINED', reason: 'UNSPECIFIED' }).value);
});

test('an "other" reason has to say what it was, and notes are bounded', () => {
  assert.ok(error({ outcome: 'DECLINED', reason: 'OTHER' }));
  assert.ok(error({ outcome: 'DECLINED', reason: 'OTHER', note: '   ' }));
  assert.equal(
    parseCallOutcome({ outcome: 'DECLINED', reason: 'OTHER', note: ' asked for money ' }).value?.note,
    'asked for money'
  );
  assert.ok(error({ outcome: 'NOT_CALLED', note: 'x'.repeat(301) }));
});

test('a donor response validates separately and demands a question', () => {
  assert.equal(parseDonorReport({ outcome: 'CAN_DONATE' }).value?.outcome, 'CAN_DONATE');
  assert.ok('error' in parseDonorReport({ outcome: 'NEED_MORE_INFO' }));
  assert.ok('error' in parseDonorReport({ outcome: 'WILL_DONATE' }));
  assert.equal(
    parseDonorReport({ outcome: 'REQUESTER_NO_LONGER_NEEDS', note: 'Already arranged' }).value?.note,
    'Already arranged'
  );
});

test('donor references distinguish accounts from directory listings', () => {
  assert.deepEqual(parseDonorRef('reg:user-1'), { kind: 'REGISTERED', id: 'user-1' });
  assert.deepEqual(parseDonorRef('imp:imp_abc'), { kind: 'IMPORTED', id: 'imp_abc' });
  assert.equal(parseDonorRef('reg:'), null);
  assert.equal(parseDonorRef('user-1'), null);
});
