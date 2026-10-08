import { randomUUID } from 'node:crypto';

export const BLOOD_HELP_TTL_MS = 24 * 60 * 60_000;
export const OUTAGE_EVIDENCE_TTL_MS = 10 * 60_000;
export type OutageReason = 'SERVICE_UNAVAILABLE' | 'SENDER_UNAVAILABLE' | 'PROVIDER_CONFIGURATION';
export type GuestDevice = {
  id: string;
  created_at: string;
  actor_id?: string;
  blood_help?: { challenge_id: string; issued_at: string; expires_at: string };
};
export type OutageEvidence = {
  id: string;
  guest_token_hash?: string;
  outage_reason?: OutageReason;
  outage_at?: string;
  blood_help_redeemed_at?: string;
};

export function bloodHelpActive(device: GuestDevice | undefined, now = Date.now()) {
  return Boolean(device?.blood_help && Date.parse(device.blood_help.expires_at) > now);
}

export function eligibleOutage(challenge: OutageEvidence, deviceHash: string, now = Date.now()) {
  const at = Date.parse(challenge.outage_at || '');
  return Boolean(deviceHash && challenge.guest_token_hash === deviceHash && challenge.outage_reason &&
    Number.isFinite(at) && at <= now && now - at < OUTAGE_EVIDENCE_TTL_MS);
}

/** Pure preparation: callers persist both records before publishing the grant. */
export function redeemBloodHelp(device: GuestDevice, challenge: OutageEvidence, now = Date.now()) {
  if (challenge.guest_token_hash !== device.id) return null;
  if (device.blood_help?.challenge_id === challenge.id) return { device, redeemedAt: device.blood_help.issued_at };
  if (!eligibleOutage(challenge, device.id, now) || challenge.blood_help_redeemed_at) return null;
  if (bloodHelpActive(device, now)) return { device, redeemedAt: new Date(now).toISOString() };
  const issuedAt = new Date(now).toISOString();
  return {
    device: { ...device, actor_id: device.actor_id || `guest:${randomUUID()}`, blood_help: {
      challenge_id: challenge.id, issued_at: issuedAt, expires_at: new Date(now + BLOOD_HELP_TTL_MS).toISOString()
    } },
    redeemedAt: issuedAt
  };
}

/** Explicitly unverified reports remain unverified after account adoption. */
export function verifiedContactEvidence(report: { actor_verified?: boolean; actor_id: string }, verifiedActors: Set<string>) {
  return report.actor_verified === true || (report.actor_verified === undefined && verifiedActors.has(report.actor_id));
}
