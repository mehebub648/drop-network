import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OTP_MAX_WRONG_CODES,
  otpResendRetrySeconds,
  otpWrongCodeStatus
} from './otpPolicy';

test('a code request is limited only during its one-minute resend cooldown', () => {
  const createdAt = '2026-09-05T10:00:00.000Z';
  const created = Date.parse(createdAt);
  assert.equal(otpResendRetrySeconds(createdAt, created), 60);
  assert.equal(otpResendRetrySeconds(createdAt, created + 59_001), 1);
  assert.equal(otpResendRetrySeconds(createdAt, created + 60_000), 0);
});

test('the first five wrong codes stay validation errors and the sixth is rate limited', () => {
  for (let attempts = 1; attempts <= OTP_MAX_WRONG_CODES; attempts += 1) {
    assert.equal(otpWrongCodeStatus(attempts), 400);
  }
  assert.equal(otpWrongCodeStatus(OTP_MAX_WRONG_CODES + 1), 429);
});
