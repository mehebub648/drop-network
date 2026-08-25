import assert from 'node:assert/strict';
import test from 'node:test';
import { canAssignStaffRole, canEditMember, canManageMember, capabilitiesFor, legacyStaffRole } from './adminPolicy';

const member = { id: 'member' };
const moderator = { id: 'moderator', staff_role: 'MODERATOR' as const };
const admin = { id: 'admin', staff_role: 'ADMIN' as const };
const superadmin = { id: 'superadmin', staff_role: 'SUPERADMIN' as const };

test('staff capabilities follow the three-level hierarchy', () => {
  assert.deepEqual(capabilitiesFor('MODERATOR'), ['DASHBOARD', 'MODERATE_CONTENT', 'SUSPEND_MEMBER', 'VIEW_USERS']);
  assert.equal(capabilitiesFor('ADMIN').includes('EDIT_USERS'), true);
  assert.equal(capabilitiesFor('ADMIN').includes('MANAGE_STAFF'), false);
  assert.equal(capabilitiesFor('SUPERADMIN').includes('MANAGE_STAFF'), true);
  assert.equal(capabilitiesFor('ADMIN').includes('MANAGE_SYSTEM'), false);
  assert.equal(capabilitiesFor('SUPERADMIN').includes('MANAGE_SYSTEM'), true);
});

test('moderators and admins can suspend members but cannot affect staff', () => {
  assert.equal(canManageMember(moderator, member), true);
  assert.equal(canManageMember(admin, member), true);
  assert.equal(canManageMember(admin, moderator), false);
  assert.equal(canManageMember(admin, { ...admin, id: 'other-admin' }), false);
  assert.equal(canManageMember(superadmin, moderator), true);
  assert.equal(canManageMember(superadmin, superadmin), false);
});

test('only admins and superadmins edit validated member profiles', () => {
  assert.equal(canEditMember(moderator, member), false);
  assert.equal(canEditMember(admin, member), true);
  assert.equal(canEditMember(admin, moderator), false);
  assert.equal(canEditMember(superadmin, moderator), true);
});

test('only a superadmin assigns staff and the last superadmin is protected', () => {
  assert.equal(canAssignStaffRole(admin, member, 'MODERATOR', 1), false);
  assert.equal(canAssignStaffRole(superadmin, member, 'MODERATOR', 1), true);
  assert.equal(canAssignStaffRole(superadmin, { ...superadmin, id: 'other' }, undefined, 1), false);
  assert.equal(canAssignStaffRole(superadmin, { ...superadmin, id: 'other' }, undefined, 2), true);
});

test('legacy operational roles migrate predictably', () => {
  assert.equal(legacyStaffRole(['MEMBER', 'ADMIN']), 'ADMIN');
  assert.equal(legacyStaffRole(['SUPPORT']), 'MODERATOR');
  assert.equal(legacyStaffRole(['VERIFIER', 'ORGANIZATION_OPERATOR']), 'MODERATOR');
  assert.equal(legacyStaffRole(['MEMBER']), undefined);
});
