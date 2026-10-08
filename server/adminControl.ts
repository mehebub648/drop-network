import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export type StoredSmsProvider = {
  id: string;
  name: string;
  base_url: string;
  api_token_encrypted: string;
  priority: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string;
  deleted_at?: string;
};

function encryptionKey(secret: string) {
  if (secret.trim().length < 32) throw new Error('SMS credential encryption is not configured');
  return createHash('sha256').update('drop-admin-settings-v1\0').update(secret).digest();
}

export function encryptSetting(value: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

function decodeStoredPart(value: string, expectedLength?: number) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Stored SMS credential is invalid');
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.toString('base64url') !== value || (expectedLength !== undefined && decoded.length !== expectedLength)) {
    throw new Error('Stored SMS credential is invalid');
  }
  return decoded;
}

export function decryptSetting(value: string, secret: string) {
  const [version, iv, tag, ciphertext, extra] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !ciphertext || extra) throw new Error('Stored SMS credential is invalid');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), decodeStoredPart(iv, 12));
  decipher.setAuthTag(decodeStoredPart(tag, 16));
  return Buffer.concat([decipher.update(decodeStoredPart(ciphertext)), decipher.final()]).toString('utf8');
}

export function publicSmsProvider(provider: StoredSmsProvider) {
  const { api_token_encrypted: _token, updated_by: _updatedBy, ...safe } = provider;
  return { ...safe, has_api_token: Boolean(provider.api_token_encrypted) };
}

export function maskedPhone(phone: string) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 4 ? `••••${digits.slice(-4)}` : 'Unavailable';
}

export function humanAuditSummary(action: string, metadata: Record<string, unknown> | undefined) {
  const labels: Record<string, string> = {
    OTP_REQUESTED: 'Verification code requested', OTP_DELIVERY_SUCCEEDED: 'Verification SMS accepted by a provider',
    OTP_DELIVERY_FAILED: 'Verification SMS delivery failed', OTP_VERIFICATION_FAILED: 'Incorrect verification code entered',
    OTP_VERIFIED: 'Phone verification completed', LOGIN_FAILED: 'Password sign-in failed', LOGIN_SUCCEEDED: 'Password sign-in completed',
    OTP_LOGIN_SUCCEEDED: 'Code sign-in completed', USER_ADMIN_UPDATED: 'Administrator updated an account',
    USER_ADMIN_DELETED: 'Administrator deactivated an account', USER_ADMIN_RESTORED: 'Administrator restored an account',
    REQUEST_ADMIN_UPDATED: 'Administrator updated a blood request', COMMENT_ADMIN_UPDATED: 'Administrator updated a comment',
    COMMUNITY_POST_ADMIN_UPDATED: 'Administrator updated a community post', SMS_PROVIDER_CREATED: 'SMS provider added',
    SMS_PROVIDER_UPDATED: 'SMS provider updated', SMS_PROVIDER_DELETED: 'SMS provider removed',
    SMS_PROVIDER_RESTORED: 'SMS provider restored', SMS_PROVIDER_RANKED: 'SMS provider priority changed',
    ADMIN_ACTION_UNDONE: 'Administrator undid an earlier action'
  };
  const base = labels[action] || action.replaceAll('_', ' ').toLowerCase().replace(/^./, value => value.toUpperCase());
  const reason = typeof metadata?.reason === 'string' ? metadata.reason.trim() : '';
  return reason ? `${base}: ${reason}` : base;
}

export function auditCategory(action: string) {
  if (action.startsWith('OTP_') || action.startsWith('SMS_')) return 'SMS';
  if (action.includes('LOGIN') || action.includes('SESSION')) return 'AUTH';
  if (action.includes('USER') || action.includes('ACCOUNT')) return 'USER';
  if (action.includes('REQUEST') || action.includes('COMMENT') || action.includes('COMMUNITY')) return 'CONTENT';
  return 'ADMIN';
}

export function isPrivateSmsAddress(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === '::' || normalized === '::1' || normalized.startsWith('::ffff:')
    || /^fe[89ab][0-9a-f]:/.test(normalized) || normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  const octets = normalized.split('.').map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value))) return false;
  return octets[0] === 10 || octets[0] === 127 || octets[0] === 0 ||
    (octets[0] === 169 && octets[1] === 254) || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) || octets[0] >= 224;
}

/** Rejects dynamic SMS endpoints that could reach the host or private network. */
export async function validatePublicSmsBaseUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Enter a valid Messavo API URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Messavo API URL must be a public HTTPS URL without credentials, query, or fragment');
  }
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Messavo API URL must use a public host');
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addresses.length || addresses.some(result => isPrivateSmsAddress(result.address))) {
    throw new Error('Messavo API host must resolve only to public addresses');
  }
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString().replace(/\/$/, '');
}
