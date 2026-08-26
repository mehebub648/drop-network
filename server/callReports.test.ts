import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateContactIssues,
  findPendingReveal,
  parseCallOutcome,
  parseDonorReport,
  parseDonorRef,
  recentConnectionFailureReporterCount,
  type CallReport
} from './callReports';

function error(input: Parameters<typeof parseCallOutcome>[0]) {
  const result = parseCallOutcome(input);
  return 'error' in result ? result.error : null;
}

test('a simple outcome carries no reason and rejects one', () => {
  const parsed = parseCallOutcome({ outcome: 'NOT_CALLED' });
  assert.deepEqual(parsed, { value: { outcome: 'NOT_CALLED', note: undefined } });
  assert.ok(parseCallOutcome({ outcome: 'WILL_DONATE' }).value);
  assert.ok(parseCallOutcome({ outcome: 'CALL_BACK_LATER' }).value);
  assert.ok(parseCallOutcome({ outcome: 'UNREACHABLE' }).value);
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
  assert.ok(parseCallOutcome({ outcome: 'DECLINED', reason: 'UNAVAILABLE' }).value);
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

test('the oldest unanswered reveal is pending across every request', () => {
  const reports: CallReport[] = [
    { id: 'newer', kind: 'REVEAL', request_id: 'request-2', actor_id: 'user-1', donor_ref: 'reg:2', donor_kind: 'REGISTERED', created_at: '2026-08-26T12:02:00.000Z' },
    { id: 'pending', kind: 'REVEAL', request_id: 'request-3', actor_id: 'user-1', donor_ref: 'reg:3', donor_kind: 'REGISTERED', created_at: '2026-08-26T12:01:30.000Z' },
    { id: 'older', kind: 'REVEAL', request_id: 'request-1', actor_id: 'user-1', donor_ref: 'reg:1', donor_kind: 'REGISTERED', created_at: '2026-08-26T12:01:00.000Z' },
    { id: 'answered', kind: 'CALL_OUTCOME', request_id: 'request-1', actor_id: 'user-1', donor_ref: 'reg:1', donor_kind: 'REGISTERED', reveal_id: 'older', outcome: 'NO_ANSWER', created_at: '2026-08-26T12:03:00.000Z' }
  ];
  assert.equal(findPendingReveal(reports)?.id, 'pending');
});

test('contact issue summaries count each requester once and keep notes private', () => {
  const reports: CallReport[] = [
    { id: '1', kind: 'CALL_OUTCOME', request_id: 'r1', actor_id: 'u1', donor_ref: 'reg:d1', donor_kind: 'REGISTERED', outcome: 'WRONG_NUMBER', note: 'private', created_at: '2026-08-01T00:00:00.000Z' },
    { id: '2', kind: 'CALL_OUTCOME', request_id: 'r2', actor_id: 'u1', donor_ref: 'reg:d1', donor_kind: 'REGISTERED', outcome: 'WRONG_NUMBER', created_at: '2026-08-02T00:00:00.000Z' },
    { id: '3', kind: 'CALL_OUTCOME', request_id: 'r3', actor_id: 'u2', donor_ref: 'reg:d1', donor_kind: 'REGISTERED', outcome: 'DECLINED', reason: 'DONOR_ILL', created_at: '2026-08-03T00:00:00.000Z' }
  ];
  assert.deepEqual(aggregateContactIssues(reports), { WRONG_NUMBER: 1, DECLINED: 1, HEALTH: 1 });
  assert.equal(JSON.stringify(aggregateContactIssues(reports)).includes('private'), false);
});

test('owner resolution makes earlier evidence stale without deleting it', () => {
  const reports: CallReport[] = [
    { id: '1', kind: 'CALL_OUTCOME', request_id: 'r1', actor_id: 'u1', donor_ref: 'reg:d1', donor_kind: 'REGISTERED', outcome: 'NO_ANSWER', created_at: '2026-08-01T00:00:00.000Z' },
    { id: '2', kind: 'OWNER_RESOLUTION', request_id: '', actor_id: 'd1', donor_ref: 'reg:d1', donor_kind: 'REGISTERED', categories: ['UNREACHABLE'], resolution_kind: 'PHONE_REVERIFIED', created_at: '2026-08-02T00:00:00.000Z' },
    { id: '3', kind: 'CALL_OUTCOME', request_id: 'r2', actor_id: 'u2', donor_ref: 'reg:d1', donor_kind: 'REGISTERED', outcome: 'UNREACHABLE', created_at: '2026-08-03T00:00:00.000Z' }
  ];
  assert.deepEqual(aggregateContactIssues(reports), { UNREACHABLE: 1 });
  assert.equal(reports.length, 3);
});

test('three distinct recent connection-failure reporters trigger suppression', () => {
  const reports: CallReport[] = ['u1', 'u2', 'u3'].map((actor_id, index) => ({
    id: String(index), kind: 'CALL_OUTCOME' as const, request_id: `r${index}`, actor_id,
    donor_ref: 'imp:d1', donor_kind: 'IMPORTED' as const,
    outcome: index === 0 ? 'WRONG_NUMBER' : 'UNREACHABLE', created_at: `2026-08-0${index + 1}T00:00:00.000Z`
  }));
  assert.equal(recentConnectionFailureReporterCount(reports, new Date('2026-08-26T00:00:00.000Z').getTime()), 3);
  reports.push({ id: 'resolved', kind: 'OWNER_RESOLUTION', request_id: '', actor_id: 'd1', donor_ref: 'imp:d1', donor_kind: 'IMPORTED', categories: ['WRONG_NUMBER', 'UNREACHABLE'], created_at: '2026-08-20T00:00:00.000Z' });
  assert.equal(recentConnectionFailureReporterCount(reports, new Date('2026-08-26T00:00:00.000Z').getTime()), 0);
});
