import assert from 'node:assert/strict';
import test from 'node:test';
import { auditCategory, decryptSetting, encryptSetting, humanAuditSummary, isPrivateSmsAddress, maskedPhone, publicSmsProvider, validatePublicSmsBaseUrl } from './adminControl';

test('stored SMS credentials are authenticated, encrypted, and never projected', () => {
  const secret = 'a'.repeat(32);
  const encrypted = encryptSetting('private-token', secret);
  assert.notEqual(encrypted, 'private-token');
  assert.equal(decryptSetting(encrypted, secret), 'private-token');
  const tampered = encrypted.split('.');
  const ciphertext = Buffer.from(tampered[3], 'base64url');
  ciphertext[0] ^= 1;
  tampered[3] = ciphertext.toString('base64url');
  assert.throws(() => decryptSetting(tampered.join('.'), secret));
  assert.throws(() => decryptSetting(`${encrypted}=`, secret), /invalid/);
  const projected = publicSmsProvider({ id: 'one', name: 'Primary', base_url: 'https://sms.example', api_token_encrypted: encrypted,
    priority: 1, enabled: true, created_at: 'now', updated_at: 'now', updated_by: 'admin' });
  assert.equal(projected.has_api_token, true);
  assert.equal('api_token_encrypted' in projected, false);
  assert.equal(JSON.stringify(projected).includes('private-token'), false);
});

test('dynamic SMS endpoints reject private and non-HTTPS targets', async () => {
  await assert.rejects(validatePublicSmsBaseUrl('http://example.com'), /public HTTPS/);
  await assert.rejects(validatePublicSmsBaseUrl('https://127.0.0.1:3000'), /public addresses/);
  await assert.rejects(validatePublicSmsBaseUrl('https://localhost'), /public host/);
});

test('human audit helpers reveal useful activity without phone numbers', () => {
  assert.equal(maskedPhone('+8801712345678'), '••••5678');
  assert.equal(humanAuditSummary('LOGIN_FAILED', { reason: 'Wrong password' }), 'Password sign-in failed: Wrong password');
  assert.equal(auditCategory('OTP_DELIVERY_FAILED'), 'SMS');
});

test('provider DNS safety rejects mapped loopback and the full IPv6 link-local range', () => {
  for (const address of ['::', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', 'fe90::1', 'fea0::1', 'febf::1', 'fd00::1']) {
    assert.equal(isPrivateSmsAddress(address), true, address);
  }
  assert.equal(isPrivateSmsAddress('1.1.1.1'), false);
  assert.equal(isPrivateSmsAddress('2606:4700:4700::1111'), false);
});
