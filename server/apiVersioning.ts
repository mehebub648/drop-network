export const CURRENT_API_VERSION = '1';
export const VERSIONED_API_PREFIX = `/api/v${CURRENT_API_VERSION}`;

/**
 * Keeps the established route handlers available behind a stable versioned
 * prefix while the backend is extracted from the browser application.
 */
export function rewriteVersionedApiUrl(url: string) {
  if (url === VERSIONED_API_PREFIX) return '/api';
  if (url.startsWith(`${VERSIONED_API_PREFIX}/`) || url.startsWith(`${VERSIONED_API_PREFIX}?`)) {
    return `/api${url.slice(VERSIONED_API_PREFIX.length)}`;
  }
  return null;
}
