import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MS, dhakaDate, requestDeadline, requestExpiry, requestIsLive, requestIsOverdue, migrateRequestLifecycle, isCalendarDate } from './requestLifecycle';

const now = Date.parse('2026-09-04T12:00:00Z');
test('Dhaka date and inclusive 15-day window use calendar dates', () => {
  assert.equal(dhakaDate(Date.parse('2026-09-04T18:00:00Z')), '2026-09-05');
  assert.equal(requestDeadline('2026-09-04', now), '2026-09-04T18:00:00.000Z');
  assert.equal(requestDeadline('2026-09-19', now), '2026-09-19T18:00:00.000Z');
  for (const date of ['2026-09-03', '2026-09-20', '2026-02-30', '', '2026-09-04T10:00:00Z']) assert.equal(requestDeadline(date, now), null);
  assert.equal(isCalendarDate('2000-02-29'), true);
  assert.equal(isCalendarDate('2001-02-29'), false);
});
test('guest deadline is exclusive; owned contact remains live for exactly 30 more days', () => {
  const needed_by = requestDeadline('2026-09-04', now)!;
  const deadline = Date.parse(needed_by);
  const request = { user_id: '', status: 'ACTIVE', needed_by, expires_at: requestExpiry(needed_by, 'GUEST') };
  assert.equal(requestIsLive(request, deadline - 1), true);
  assert.equal(requestIsLive(request, deadline), false);
  request.expires_at = requestExpiry(needed_by, 'USER');
  assert.equal(requestIsLive(request, deadline), true);
  assert.equal(requestIsOverdue(request, deadline), true);
  assert.equal(requestIsLive(request, deadline + 30 * DAY_MS), false);
  assert.equal(requestIsLive({ ...request, status: 'CANCELLED' }, deadline), false);
});
test('migration is idempotent and does not resurrect history or fingerprint ownership', () => {
  const source = { user_id: 'member', status: 'ACTIVE', needed_by: '2026-09-05T14:00:00Z', expires_at: '2026-09-05T20:00:00Z' };
  const migrated = migrateRequestLifecycle(source, true, now);
  assert.equal(migrated.expires_at, '2026-10-05T18:00:00.000Z');
  assert.deepEqual(migrateRequestLifecycle(migrated, true, now), migrated);
  const guest = migrateRequestLifecycle({ ...source, guest_token_hash: 'legacy-fingerprint' }, false, now);
  assert.equal(guest.status, 'ACTIVE');
  assert.equal(guest.expires_at, '2026-09-05T18:00:00.000Z');
  assert.equal(guest.user_id, '');
  assert.equal(guest.guest_token_hash, undefined);
  assert.deepEqual(migrateRequestLifecycle(guest, false, now), guest);
  assert.equal(migrateRequestLifecycle({ ...source, status: 'CANCELLED' }, true, now).status, 'CANCELLED');
  assert.equal(migrateRequestLifecycle({ ...source, expires_at: '2026-09-01T00:00:00Z' }, true, now).expires_at, '2026-09-01T00:00:00Z');
});
