import { timingSafeEqual } from 'node:crypto';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isTrustedCookieMutation(input: {
  method: string;
  sessionToken: string;
  origin: string | undefined;
  trustedOrigins: ReadonlySet<string>;
}) {
  if (SAFE_METHODS.has(input.method.toUpperCase()) || !input.sessionToken) return true;
  return Boolean(input.origin && input.trustedOrigins.has(input.origin));
}

export function secureBearerMatches(authorization: string | undefined, expectedToken: string) {
  if (!expectedToken || !authorization?.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(authorization.slice('Bearer '.length));
  const expected = Buffer.from(expectedToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
