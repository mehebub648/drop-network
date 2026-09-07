import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { DAY_MS, requestExpiry, type LifecycleRequest } from './requestLifecycle';

export const GUEST_COOKIE = 'drop_guest';
export function newGuestToken() { return randomBytes(32).toString('hex'); }
export function guestToken(value: unknown) { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) ? value : ''; }
export function guestTokenHash(token: string) { return createHash('sha256').update(`drop:guest:v1:${token}`).digest('hex'); }
export function ownsGuestRequest(request: LifecycleRequest, token: string, now = Date.now()) {
  const expiry = Date.parse(request.expires_at);
  if (request.ownership !== 'GUEST' || request.user_id || !guestToken(token) || !request.guest_token_hash || !Number.isFinite(expiry) || expiry <= now) return false;
  const expected = Buffer.from(request.guest_token_hash, 'hex');
  const actual = Buffer.from(guestTokenHash(token), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function adoptGuestRequest<T extends LifecycleRequest>(request: T, token: string, userId: string, now = Date.now()): T | null {
  if (!userId || !ownsGuestRequest(request, token, now) || !request.needed_by) return null;
  const { guest_token_hash: _hash, ...rest } = request;
  return { ...rest, ownership: 'USER', user_id: userId, expires_at: requestExpiry(request.needed_by, 'USER') } as T;
}

/** Serialize ownership, expiry and edits in the supported single-instance runtime. */
export class RequestWriteQueue {
  private pending: Promise<unknown> = Promise.resolve();
  run<T>(work: () => Promise<T>): Promise<T> {
    const result = this.pending.then(work);
    this.pending = result.catch(() => {});
    return result;
  }
}

export const GUEST_IDLE_MS = 15 * DAY_MS;
export const GUEST_REQUEST_LIMIT = 3;
export const GUEST_CONTACT_LIMIT = 3;
export type GuestDevice = { id: string; created_at: string; last_seen_at: string; request_count: number; user_id?: string };
export function guestDeviceExpired(device: GuestDevice, now = Date.now()) {
  return !device.user_id && Date.parse(device.last_seen_at || device.created_at) + GUEST_IDLE_MS <= now;
}
export function guestCanPublish(device: GuestDevice) { return !device.user_id && device.request_count < GUEST_REQUEST_LIMIT; }
export function guestCanReveal(donorRef: string, reports: Array<{ kind: string; donor_ref: string }>) {
  const contacts = new Set(reports.filter(report => report.kind === 'REVEAL').map(report => report.donor_ref));
  return contacts.has(donorRef) || contacts.size < GUEST_CONTACT_LIMIT;
}
