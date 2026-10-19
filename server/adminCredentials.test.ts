import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hashAdminPassword,
  hashAdminSessionToken,
  isAdminRole,
  newAdminSessionToken,
  normalizeAdminUsername,
  publicAdminAccount,
  verifyAdminPassword
} from './adminCredentials';

test('admin usernames are normalized without accepting phone-style member credentials', () => {
  assert.equal(normalizeAdminUsername('  Drop.Owner  '), 'drop.owner');
  assert.equal(normalizeAdminUsername('ab'), '');
  assert.equal(normalizeAdminUsername('+8801712345678'), '');
  assert.equal(normalizeAdminUsername('owner@example.com'), '');
});

test('dedicated admin accounts support the three staff scopes', () => {
  assert.equal(isAdminRole('ADMIN'), true);
  assert.equal(isAdminRole('SUPERADMIN'), true);
  assert.equal(isAdminRole('MODERATOR'), true);
  assert.equal(isAdminRole('MEMBER'), false);
});

test('admin passwords and opaque session tokens are one-way at rest', async () => {
  const passwordHash = await hashAdminPassword('a-long-private-password');
  assert.notEqual(passwordHash, 'a-long-private-password');
  assert.equal(await verifyAdminPassword('a-long-private-password', passwordHash), true);
  assert.equal(await verifyAdminPassword('wrong-password', passwordHash), false);

  const token = newAdminSessionToken();
  const tokenHash = hashAdminSessionToken(token);
  assert.equal(token.length >= 40, true);
  assert.notEqual(tokenHash, token);
  assert.equal(tokenHash, hashAdminSessionToken(token));
});

test('public admin account never exposes a password hash', () => {
  const publicAccount = publicAdminAccount({
    id: 'admin-1',
    username: 'owner',
    password_hash: 'private',
    staff_role: 'SUPERADMIN',
    account_status: 'ACTIVE',
    created_at: '2026-10-20T00:00:00.000Z',
    updated_at: '2026-10-20T00:00:00.000Z'
  });
  assert.deepEqual(publicAccount, {
    id: 'admin-1',
    username: 'owner',
    name: 'owner',
    staff_role: 'SUPERADMIN',
    account_status: 'ACTIVE'
  });
  assert.equal('password_hash' in publicAccount, false);
});
