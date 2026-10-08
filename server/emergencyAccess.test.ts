import assert from 'node:assert/strict';
import test from 'node:test';
import { bloodHelpActive, redeemBloodHelp, eligibleOutage, verifiedContactEvidence, BLOOD_HELP_TTL_MS, OUTAGE_EVIDENCE_TTL_MS, type GuestDevice, type OutageEvidence } from './emergencyAccess';

const now = Date.parse('2026-09-09T00:00:00Z');
const device: GuestDevice = { id: 'private-device-hash', created_at: new Date(now).toISOString() };
const challenge: OutageEvidence = { id: 'failed-challenge', guest_token_hash: device.id, outage_reason: 'SENDER_UNAVAILABLE', outage_at: new Date(now).toISOString() };

test('a confirmed device-bound outage gives exactly 24 hours without verification', () => {
  const grant = redeemBloodHelp(device, challenge, now)!;
  assert.ok(grant.device.actor_id?.startsWith('guest:'));
  assert.equal(Date.parse(grant.device.blood_help!.expires_at), now + BLOOD_HELP_TTL_MS);
  assert.equal(bloodHelpActive(grant.device, now + BLOOD_HELP_TTL_MS - 1), true);
  assert.equal(bloodHelpActive(grant.device, now + BLOOD_HELP_TTL_MS), false);
  assert.equal('verification_token' in grant.device, false);
  assert.equal('is_verified' in grant.device, false);
});

test('other devices, stale evidence, missing evidence and future evidence cannot redeem', () => {
  assert.equal(redeemBloodHelp({ ...device, id: 'other' }, challenge, now), null);
  assert.equal(eligibleOutage(challenge, device.id, now + OUTAGE_EVIDENCE_TTL_MS), false);
  assert.equal(redeemBloodHelp(device, { ...challenge, outage_reason: undefined }, now), null);
  assert.equal(redeemBloodHelp(device, { ...challenge, outage_at: new Date(now + 1).toISOString() }, now), null);
});

test('repeat redemption, including after expiry and restart, never extends the pass', () => {
  const grant = redeemBloodHelp(device, challenge, now)!;
  const saved = JSON.parse(JSON.stringify(grant.device)) as GuestDevice;
  const redeemed = { ...challenge, blood_help_redeemed_at: grant.redeemedAt };
  assert.equal(redeemBloodHelp(saved, redeemed, now + BLOOD_HELP_TTL_MS)!.device.blood_help!.expires_at, saved.blood_help!.expires_at);
  assert.equal(bloodHelpActive(saved, now + BLOOD_HELP_TTL_MS), false);
});

test('renewal requires a new recent outage and retains the original guest actor', () => {
  const initial = redeemBloodHelp(device, challenge, now)!.device;
  const later = now + BLOOD_HELP_TTL_MS;
  const fresh = { ...challenge, id: 'new-failure', outage_at: new Date(later).toISOString() };
  const renewed = redeemBloodHelp(initial, fresh, later)!.device;
  assert.equal(renewed.actor_id, initial.actor_id);
  assert.equal(Date.parse(renewed.blood_help!.expires_at), later + BLOOD_HELP_TTL_MS);
  assert.equal(redeemBloodHelp(initial, { ...fresh, blood_help_redeemed_at: new Date(now).toISOString() }, later), null);
});

test('new failures during active access do not accumulate more time', () => {
  const initial = redeemBloodHelp(device, challenge, now)!.device;
  const fresh = { ...challenge, id: 'second-failure', outage_at: new Date(now + 1000).toISOString() };
  assert.equal(redeemBloodHelp(initial, fresh, now + 1000)!.device.blood_help!.expires_at, initial.blood_help!.expires_at);
});

test('adopted outage reports remain excluded from verified donor evidence', () => {
  const verifiedActors = new Set(['member']);
  assert.equal(verifiedContactEvidence({ actor_id: 'member', actor_verified: false }, verifiedActors), false);
  assert.equal(verifiedContactEvidence({ actor_id: 'member' }, verifiedActors), true);
  assert.equal(verifiedContactEvidence({ actor_id: 'guest:device' }, verifiedActors), false);
  assert.equal(verifiedContactEvidence({ actor_id: 'member', actor_verified: true }, verifiedActors), true);
});
