import { timingSafeEqual } from 'node:crypto';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export type SessionCredential = {
  token: string;
  transport: 'bearer' | 'cookie' | 'none';
};

export function bearerTokenFromAuthorization(authorization: string | undefined) {
  const match = /^Bearer ([^\s]+)$/i.exec(authorization?.trim() || '');
  return match?.[1] || '';
}

export function resolveSessionCredential(input: {
  authorization: string | undefined;
  cookieToken: unknown;
}): SessionCredential {
  const bearerToken = bearerTokenFromAuthorization(input.authorization);
  if (bearerToken) return { token: bearerToken, transport: 'bearer' };

  const cookieToken = typeof input.cookieToken === 'string' ? input.cookieToken.trim() : '';
  if (cookieToken) return { token: cookieToken, transport: 'cookie' };

  return { token: '', transport: 'none' };
}

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
  const suppliedToken = bearerTokenFromAuthorization(authorization);
  if (!expectedToken || !suppliedToken) return false;
  const supplied = Buffer.from(suppliedToken);
  const expected = Buffer.from(expectedToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
