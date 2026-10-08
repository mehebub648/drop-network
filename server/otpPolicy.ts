export const OTP_MAX_WRONG_CODES = 5;
export const OTP_RESEND_COOLDOWN_MS = 60_000;

export function otpResendRetrySeconds(createdAt: string, now = Date.now()) {
  const elapsed = now - new Date(createdAt).getTime();
  return Math.max(0, Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000));
}

export function otpWrongCodeStatus(attemptsAfterFailure: number) {
  return attemptsAfterFailure > OTP_MAX_WRONG_CODES ? 429 : 400;
}
