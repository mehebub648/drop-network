const AUTH_ROUTES = new Set(['/login', '/register', '/forgot-password']);

export function getSafeReturnTo(value: string | null, fallback: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback;
  }

  const pathname = value.split(/[?#]/, 1)[0];
  return AUTH_ROUTES.has(pathname) ? fallback : value;
}
