export const PLAY_REVIEWER_PHONE = '+8801000000046';

function localDigits(value: unknown) {
  if (typeof value !== 'string') return '';
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('880') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
}

export function normalizeBangladeshPhone(value: unknown) {
  const local = localDigits(value);
  return /^1[3-9]\d{8}$/.test(local) ? `+880${local}` : null;
}

/** A non-routable identifier for one privately provisioned password account. */
export function isPlayReviewerPhone(value: unknown) {
  return localDigits(value) === PLAY_REVIEWER_PHONE.slice(4);
}

export function normalizePasswordLoginPhone(value: unknown) {
  return isPlayReviewerPhone(value) ? PLAY_REVIEWER_PHONE : normalizeBangladeshPhone(value);
}
