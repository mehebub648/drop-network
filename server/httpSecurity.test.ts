import assert from 'node:assert/strict';
import test from 'node:test';
import { isTrustedCookieMutation, secureBearerMatches } from './httpSecurity';

const origins = new Set(['https://drop.example']);

test('cookie-authenticated mutations require the exact configured origin', () => {
  assert.equal(isTrustedCookieMutation({ method: 'POST', sessionToken: 'session', origin: undefined, trustedOrigins: origins }), false);
  assert.equal(isTrustedCookieMutation({ method: 'POST', sessionToken: 'session', origin: 'https://evil.example', trustedOrigins: origins }), false);
  assert.equal(isTrustedCookieMutation({ method: 'POST', sessionToken: 'session', origin: 'https://drop.example', trustedOrigins: origins }), true);
});

test('safe or unauthenticated requests do not require an origin', () => {
  assert.equal(isTrustedCookieMutation({ method: 'GET', sessionToken: 'session', origin: undefined, trustedOrigins: origins }), true);
  assert.equal(isTrustedCookieMutation({ method: 'POST', sessionToken: '', origin: undefined, trustedOrigins: origins }), true);
});

test('metrics bearer comparison is exact and fails closed', () => {
  const token = 'a-private-monitoring-token-value';
  assert.equal(secureBearerMatches(`Bearer ${token}`, token), true);
  assert.equal(secureBearerMatches(`Bearer ${token}x`, token), false);
  assert.equal(secureBearerMatches(undefined, token), false);
  assert.equal(secureBearerMatches(`Bearer ${token}`, ''), false);
});
