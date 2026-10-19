import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import type { StaffRole } from './adminPolicy';

export const ADMIN_ROLES = ['MODERATOR', 'ADMIN', 'SUPERADMIN'] as const;
export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export type AdminRole = Extract<StaffRole, (typeof ADMIN_ROLES)[number]>;

export type AdminAccount = {
  id: string;
  username: string;
  name?: string;
  password_hash: string;
  staff_role: AdminRole;
  account_status: 'ACTIVE' | 'SUSPENDED';
  created_at: string;
  updated_at: string;
  password_changed_at?: string;
};

export type AdminSession = {
  id: string;
  token_hash: string;
  admin_account_id: string;
  created_at: string;
  expires_at: string;
  revoked_at?: string;
  user_agent?: string;
  ip?: string;
  last_seen_at?: string;
};

export function normalizeAdminUsername(value: unknown) {
  if (typeof value !== 'string') return '';
  const username = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{2,63}$/.test(username) ? username : '';
}

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && ADMIN_ROLES.includes(value as AdminRole);
}

export function validAdminPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 12 && value.length <= 128;
}

export async function hashAdminPassword(password: string) {
  if (!validAdminPassword(password)) throw new Error('Admin password must be 12–128 characters');
  return bcrypt.hash(password, 12);
}

export async function verifyAdminPassword(password: unknown, passwordHash: string) {
  return typeof password === 'string' && password.length <= 128 && bcrypt.compare(password, passwordHash);
}

export function newAdminSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashAdminSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function publicAdminAccount(account: AdminAccount) {
  return {
    id: account.id,
    username: account.username,
    name: account.name || account.username,
    staff_role: account.staff_role,
    account_status: account.account_status
  };
}
