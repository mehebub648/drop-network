export const STAFF_ROLES = ['MODERATOR', 'ADMIN', 'SUPERADMIN'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export type StaffUser = {
  id: string;
  staff_role?: StaffRole;
  account_status?: 'ACTIVE' | 'SUSPENDED';
};

export type AdminCapability =
  | 'DASHBOARD'
  | 'MODERATE_CONTENT'
  | 'SUSPEND_MEMBER'
  | 'VIEW_USERS'
  | 'EDIT_USERS'
  | 'REVOKE_SESSIONS'
  | 'MANAGE_SUPPORT'
  | 'MANAGE_ORGANIZATIONS'
  | 'VIEW_AUDIT'
  | 'MANAGE_STAFF';

const capabilities: Record<StaffRole, AdminCapability[]> = {
  MODERATOR: ['DASHBOARD', 'MODERATE_CONTENT', 'SUSPEND_MEMBER', 'VIEW_USERS'],
  ADMIN: ['DASHBOARD', 'MODERATE_CONTENT', 'SUSPEND_MEMBER', 'VIEW_USERS', 'EDIT_USERS', 'REVOKE_SESSIONS', 'MANAGE_SUPPORT', 'MANAGE_ORGANIZATIONS', 'VIEW_AUDIT'],
  SUPERADMIN: ['DASHBOARD', 'MODERATE_CONTENT', 'SUSPEND_MEMBER', 'VIEW_USERS', 'EDIT_USERS', 'REVOKE_SESSIONS', 'MANAGE_SUPPORT', 'MANAGE_ORGANIZATIONS', 'VIEW_AUDIT', 'MANAGE_STAFF']
};

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && STAFF_ROLES.includes(value as StaffRole);
}

export function capabilitiesFor(role: StaffRole | undefined): AdminCapability[] {
  return role ? [...capabilities[role]] : [];
}

export function hasCapability(user: StaffUser | undefined, capability: AdminCapability) {
  return Boolean(user?.staff_role && capabilities[user.staff_role].includes(capability));
}

export function legacyStaffRole(roles: string[] | undefined): StaffRole | undefined {
  if (roles?.includes('ADMIN')) return 'ADMIN';
  if (roles?.some(role => ['MODERATOR', 'SUPPORT', 'VERIFIER'].includes(role))) return 'MODERATOR';
  return undefined;
}

export function canManageMember(actor: StaffUser, target: StaffUser) {
  if (!hasCapability(actor, 'SUSPEND_MEMBER') || actor.id === target.id) return false;
  return actor.staff_role === 'SUPERADMIN' || !target.staff_role;
}

export function canEditMember(actor: StaffUser, target: StaffUser) {
  if (!hasCapability(actor, 'EDIT_USERS') || actor.id === target.id) return false;
  return actor.staff_role === 'SUPERADMIN' || !target.staff_role;
}

export function canAssignStaffRole(actor: StaffUser, target: StaffUser, nextRole: StaffRole | undefined, activeSuperadmins: number) {
  if (!hasCapability(actor, 'MANAGE_STAFF') || actor.id === target.id) return false;
  if (target.staff_role === 'SUPERADMIN' && nextRole !== 'SUPERADMIN' && activeSuperadmins <= 1) return false;
  return true;
}
