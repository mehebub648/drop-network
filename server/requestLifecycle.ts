/** All request dates are Bangladesh calendar dates, regardless of client timezone. */
export const DAY_MS = 86_400_000;
const DHAKA_OFFSET_MS = 6 * 3_600_000;
export const OWNED_REQUEST_GRACE_MS = 30 * DAY_MS;
export const OPEN_REQUEST_STATUSES = new Set(['ACTIVE', 'PARTIALLY_FULFILLED']);
export const REQUEST_CLOSURE_REASONS = ['RECEIVED', 'NOT_NEEDED', 'CANCELLED', 'OTHER'] as const;
export type RequestOwnership = 'GUEST' | 'USER';

export function dhakaDate(now = Date.now()) {
  return new Date(now + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

export function isCalendarDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function requestDeadline(date: unknown, now = Date.now()) {
  if (!isCalendarDate(date) || date < dhakaDate(now) || date > dhakaDate(now + 15 * DAY_MS)) return null;
  return new Date(Date.parse(date) + DAY_MS - DHAKA_OFFSET_MS).toISOString();
}

export function requestExpiry(deadline: string, ownership: RequestOwnership) {
  return new Date(Date.parse(deadline) + (ownership === 'USER' ? OWNED_REQUEST_GRACE_MS : 0)).toISOString();
}

export type LifecycleRequest = {
  ownership?: RequestOwnership;
  user_id: string;
  status: string;
  needed_by?: string;
  needed_date?: string;
  expires_at: string;
  guest_token_hash?: string;
  lifecycle_version?: number;
};

export function requestIsLive(request: LifecycleRequest, now = Date.now()) {
  return OPEN_REQUEST_STATUSES.has(request.status) && Date.parse(request.expires_at) > now;
}

export function requestIsOverdue(request: Pick<LifecycleRequest, 'needed_by'>, now = Date.now()) {
  return Boolean(request.needed_by && Date.parse(request.needed_by) <= now);
}

/** Never re-open an expired/closed legacy request, even if it would fit the new window. */
export function migrateRequestLifecycle<T extends LifecycleRequest>(request: T, accountExists: boolean, now = Date.now()): T {
  if (request.lifecycle_version === 2) return request;
  const ownership: RequestOwnership = accountExists ? 'USER' : 'GUEST';
  const next = { ...request, ownership, lifecycle_version: 2, ...(!accountExists ? { user_id: '', guest_token_hash: undefined } : {}) };
  if (!requestIsLive(request, now)) return next;
  const needed_date = request.needed_date || dhakaDate(Date.parse(request.needed_by || request.expires_at) - 1);
  const needed_by = new Date(Date.parse(needed_date) + DAY_MS - DHAKA_OFFSET_MS).toISOString();
  return { ...next, needed_date, needed_by, expires_at: requestExpiry(needed_by, ownership) };
}
