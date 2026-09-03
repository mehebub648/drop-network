import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bearerTokenFromAuthorization,
  isTrustedCookieMutation,
  resolveSessionCredential,
  secureBearerMatches
} from './httpSecurity';

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

test('native bearer sessions take precedence over browser cookies', () => {
  assert.deepEqual(resolveSessionCredential({
    authorization: 'Bearer native-session',
    cookieToken: 'browser-session'
  }), { token: 'native-session', transport: 'bearer' });
  assert.deepEqual(resolveSessionCredential({
    authorization: undefined,
    cookieToken: 'browser-session'
  }), { token: 'browser-session', transport: 'cookie' });
  assert.deepEqual(resolveSessionCredential({
    authorization: 'Basic unsupported',
    cookieToken: undefined
  }), { token: '', transport: 'none' });
});

test('bearer parsing accepts the scheme case-insensitively and rejects whitespace', () => {
  assert.equal(bearerTokenFromAuthorization('bearer native-session'), 'native-session');
  assert.equal(bearerTokenFromAuthorization('Bearer two tokens'), '');
  assert.equal(bearerTokenFromAuthorization(undefined), '');
});

test('metrics bearer comparison is exact and fails closed', () => {
  const token = 'a-private-monitoring-token-value';
  assert.equal(secureBearerMatches(`Bearer ${token}`, token), true);
  assert.equal(secureBearerMatches(`Bearer ${token}x`, token), false);
  assert.equal(secureBearerMatches(undefined, token), false);
  assert.equal(secureBearerMatches(`Bearer ${token}`, ''), false);
});
