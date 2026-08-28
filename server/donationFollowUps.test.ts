import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveFollowUpState, followUpDueAt, outsideDhakaQuietHours, remindTomorrowAt } from './donationFollowUps';

test('schedules six hours after needed-by and moves quiet-hour reminders to 8 AM Dhaka', () => {
  assert.equal(followUpDueAt('2026-08-28T00:00:00.000Z', '2026-08-28T14:00:00.000Z'), '2026-08-29T02:00:00.000Z');
  assert.equal(outsideDhakaQuietHours(new Date('2026-08-28T03:00:00.000Z')).toISOString(), '2026-08-28T03:00:00.000Z');
});

test('uses 24 hours after agreement when no deadline exists', () => {
  assert.equal(followUpDueAt('2026-08-28T03:00:00.000Z'), '2026-08-29T03:00:00.000Z');
  assert.equal(remindTomorrowAt(new Date('2026-08-28T16:00:00.000Z')), '2026-08-30T02:00:00.000Z');
});

test('derives every two-party outcome', () => {
  assert.equal(deriveFollowUpState(), 'FOLLOW_UP_DUE');
  assert.equal(deriveFollowUpState('DONATED'), 'AWAITING_REQUESTER');
  assert.equal(deriveFollowUpState(undefined, 'DONATED'), 'AWAITING_DONOR');
  assert.equal(deriveFollowUpState('DONATED', 'DONATED'), 'CONFIRMED');
  assert.equal(deriveFollowUpState('NOT_DONATED'), 'NOT_DONATED');
  assert.equal(deriveFollowUpState('DONATED', 'NOT_DONATED'), 'DISPUTED');
});
