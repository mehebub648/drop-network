import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AVAILABILITY_REASON_MAX_LENGTH,
  parseAvailabilityReason,
  parseRegistrationAvailability
} from './donorProfile';

test('registration requires an explicit supported availability choice', () => {
  assert.deepEqual(parseRegistrationAvailability(undefined, undefined), {
    error: 'Choose whether you are available to donate'
  });
  assert.deepEqual(parseRegistrationAvailability('TRAVELING', undefined), {
    error: 'Choose whether you are available to donate'
  });
});

test('unavailable registration accepts and trims a private optional reason', () => {
  assert.deepEqual(parseRegistrationAvailability('NOT_AVAILABLE', '  Recovering  '), {
    value: { status: 'NOT_AVAILABLE', reason: 'Recovering' }
  });
  assert.deepEqual(parseRegistrationAvailability('NOT_AVAILABLE', '  '), {
    value: { status: 'NOT_AVAILABLE' }
  });
});

test('available registration rejects an unavailable reason', () => {
  assert.deepEqual(parseRegistrationAvailability('AVAILABLE', 'Traveling'), {
    error: 'Availability reason only applies when you are not available'
  });
  assert.deepEqual(parseRegistrationAvailability('AVAILABLE', undefined), {
    value: { status: 'AVAILABLE' }
  });
});

test('availability reasons are bounded', () => {
  assert.equal(parseAvailabilityReason('x'.repeat(AVAILABILITY_REASON_MAX_LENGTH)), 'x'.repeat(AVAILABILITY_REASON_MAX_LENGTH));
  assert.equal(parseAvailabilityReason('x'.repeat(AVAILABILITY_REASON_MAX_LENGTH + 1)), null);
});
