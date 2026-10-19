/** Runs only inside the network-isolated QA container against disposable storage. */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { encryptSetting } from '../server/adminControl';

if (process.env.DROP_ISOLATED_QA !== '1') {
  throw new Error('Requires isolated QA; never run against live users, storage, or SMS');
}

const directory = await mkdtemp(path.join(tmpdir(), 'drop-admin-launch-'));
process.env.LANCEDB_PATH = path.join(directory, 'db');
const origin = 'http://127.0.0.1:18560';
const encryptionSecret = 'isolated-admin-launch-secret-32-chars-minimum';
const now = new Date();
const later = new Date(now.getTime() + 24 * 60 * 60_000).toISOString();
const password = 'Disposable-admin-password-123';
const fullMemberPhone = '+8801700000004';
const { saveToTable, addImportedDonors } = await import('../server/db');
const { publicIdForImportedDonor, toImportedDonorRow } = await import('../server/importedDonors');
const { saveCommunityPost } = await import('../server/communityPosts');

const users = [
  { id: 'qa-superadmin', phone: '+8801700000001', name: 'Legacy QA Superadmin Member', staff_role: 'SUPERADMIN' },
  { id: 'qa-admin', phone: '+8801700000002', name: 'Legacy QA Admin Member', staff_role: 'ADMIN' },
  { id: 'qa-moderator', phone: '+8801700000003', name: 'Legacy QA Moderator Member', staff_role: 'MODERATOR' },
  { id: 'qa-member', phone: fullMemberPhone, name: 'QA Member' },
  { id: 'qa-delegated', phone: '+8801700000005', name: 'QA Delegated Account' },
  { id: 'qa-viewer', phone: '+8801700000006', name: 'QA Community Viewer' }
] as const;

for (const user of users) {
  await saveToTable('common_users', {
    ...user,
    password: await bcrypt.hash(password, 4),
    is_verified: true,
    account_status: 'ACTIVE',
    roles: ['MEMBER'],
    created_at: now.toISOString(),
    ...(user.id === 'qa-member' ? {
      donor_profile: {
        blood_group: 'B+', location: { area_name: 'Dhaka', lat: 23.8103, lng: 90.4125 }, upazila: 'Savar',
        availability_status: 'NOT_AVAILABLE', availability_reason: 'ISOLATED QA fixture'
      }
    } : {})
  });
}

for (const account of [
  { id: 'qa-superadmin-account', username: 'qa.superadmin', name: 'QA Superadmin', staff_role: 'SUPERADMIN' },
  { id: 'qa-admin-account', username: 'qa.admin', name: 'QA Admin', staff_role: 'ADMIN' },
  { id: 'qa-moderator-account', username: 'qa.moderator', name: 'QA Moderator', staff_role: 'MODERATOR' }
] as const) {
  await saveToTable('common_admin_accounts', {
    ...account,
    password_hash: await bcrypt.hash(password, 4),
    account_status: 'ACTIVE',
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  });
}

const sessionTokens = new Map<string, string>();
for (const user of users) {
  const token = `qa-session-${user.id}`;
  sessionTokens.set(user.id, token);
  await saveToTable('common_sessions', {
    id: `qa-session-id-${user.id}`, token, user_id: user.id,
    created_at: now.toISOString(), expires_at: later, user_agent: 'isolated-admin-integration', ip: '192.0.2.1'
  });
}

await saveToTable('common_requests', {
  id: 'qa-request', user_id: 'qa-member', ownership: 'USER', status: 'ACTIVE',
  blood_group: 'B+', blood_component: 'WHOLE_BLOOD', units_required: 1, units_confirmed: 0,
  location: { area_name: 'Dhaka', lat: 23.8103, lng: 90.4125 }, upazila: 'Savar',
  hospital_name: 'QA Hospital', hospital_address: 'ISOLATED QA', needed_by: later, expires_at: later,
  created_at: now.toISOString(), consent_at: now.toISOString(), contacts: [],
  comments: [{ id: 'qa-comment', user_id: 'qa-member', user_name: 'QA Member', text: 'Original QA comment', created_at: now.toISOString() }]
}, [90.4125, 23.8103]);

await saveCommunityPost({
  id: 'qa-post', author_id: 'qa-member', type: 'HEALTH_SUGGESTION', status: 'PUBLISHED',
  title: 'Isolated donation preparation',
  body_markdown: 'This is a disposable QA post with enough content to exercise the administrator moderation workflow safely.',
  created_at: now.toISOString(), updated_at: now.toISOString(), published_at: now.toISOString()
});

await saveToTable('common_sms_providers', {
  id: 'qa-provider', name: 'QA Messavo fallback', base_url: 'https://198.51.100.10',
  api_token_encrypted: encryptSetting('qa-secret-token-never-return', encryptionSecret),
  priority: 1, enabled: false, created_at: now.toISOString(), updated_at: now.toISOString(), updated_by: 'qa-superadmin'
});

await saveToTable('common_reports', {
  id: 'qa-report', reporter_id: 'qa-viewer', target_type: 'USER', target_id: 'qa-member',
  reason: 'PRIVACY', details: 'ISOLATED QA report', status: 'OPEN', created_at: now.toISOString(), updated_at: now.toISOString()
});
await saveToTable('common_support_tickets', {
  id: 'qa-ticket', name: 'QA Support Fixture', phone: '+8801700000007', category: 'SUPPORT',
  message: 'ISOLATED QA support request', status: 'OPEN', created_at: now.toISOString(), updated_at: now.toISOString()
});
await saveToTable('common_organizations', {
  id: 'qa-organization', owner_id: 'qa-viewer', name: 'QA Blood Support', type: 'NGO', district: 'Dhaka',
  address: 'ISOLATED QA address', phone: '+8801700000006', registration_reference: 'QA-ONLY',
  status: 'PENDING', created_at: now.toISOString(), updated_at: now.toISOString(), campaigns: []
});
const pendingClaimSource = { id: 'qa-admin', organization: 'ISOLATED QA', url: 'https://example.invalid', scraped_at: now.toISOString() };
const pendingClaimPublicId = publicIdForImportedDonor({
  phone: '+8801700000008', source: pendingClaimSource, source_ref: 'qa-pending-claim'
});
await addImportedDonors([toImportedDonorRow({
  id: 'qa-pending-claim', public_id: pendingClaimPublicId, claim_slug: 'QAPENDING001',
  source: pendingClaimSource,
  source_ref: 'qa-pending-claim', name: 'QA Pending Claim', phone: '+8801700000008',
  blood_group: 'B+', district: 'Dhaka', upazila: 'Savar', location: { area_name: 'Dhaka', lat: 23.8103, lng: 90.4125 },
  claim_status: 'PENDING_REVIEW', claimed_by: 'qa-delegated', claimed_at: now.toISOString(), claim_note: 'ISOLATED QA review',
  publication_state: 'PUBLIC', imported_at: now.toISOString()
})]);

const failedSms = createServer(async (request, response) => {
  for await (const _chunk of request) { /* Consume without logging OTP or phone. */ }
  response.statusCode = 503;
  response.setHeader('content-type', 'application/json');
  response.end('{"error":"isolated_provider_unavailable"}');
}).listen(18561, '127.0.0.1');
await once(failedSms, 'listening');

let server: ChildProcess | undefined;
let logs = '';

async function stopServer() {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await once(server, 'exit');
  }
}

async function startServer() {
  server = spawn(process.execPath, ['--import', 'tsx', 'server/server.ts'], {
    env: {
      ...process.env,
      PORT: '18560',
      NODE_ENV: 'test',
      APP_URL: origin,
      COMMUNITY_MEDIA_PATH: path.join(directory, 'media'),
      SETTINGS_ENCRYPTION_KEY: encryptionSecret,
      FOLLOW_UP_LINK_SECRET: encryptionSecret,
      SMS_PROVIDER: 'messavo',
      SMS_API_BASE_URL: 'http://127.0.0.1:18561',
      SMS_API_TOKEN: 'isolated-messavo-token'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout?.on('data', chunk => { logs = (logs + chunk).slice(-12_000); });
  server.stderr?.on('data', chunk => { logs = (logs + chunk).slice(-12_000); });
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      if ((await fetch(`${origin}/health`)).ok) return;
    } catch { /* startup */ }
    if (server.exitCode !== null) throw new Error(`Disposable server exited during startup: ${logs}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Disposable server did not become healthy: ${logs}`);
}

class Device {
  readonly cookies = new Map<string, string>();

  constructor(readonly ip: string, userId?: string) {
    const token = userId ? sessionTokens.get(userId) : undefined;
    if (token) this.cookies.set('drop_session', token);
  }

  async call(route: string, options: { method?: string; body?: unknown; expected?: number } = {}) {
    const method = options.method || (options.body === undefined ? 'GET' : 'POST');
    const response = await fetch(`${origin}/api${route}`, {
      method,
      signal: AbortSignal.timeout(30_000),
      headers: {
        'content-type': 'application/json',
        origin,
        'x-forwarded-for': this.ip,
        cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; ')
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const separator = pair.indexOf('=');
      this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    const text = await response.text();
    const value = text ? JSON.parse(text) : null;
    assert.equal(response.status, options.expected ?? 200, `${method} ${route}: ${text}`);
    return value;
  }

  async adminLogin(username: string, expected = 200) {
    return this.call('/admin/auth/login', { body: { username, password }, expected });
  }
}

function latest(events: any[], action: string, targetId?: string) {
  const event = events.find(item => item.action === action && (!targetId || item.target_id === targetId));
  assert.ok(event, `Expected ${action}${targetId ? ` for ${targetId}` : ''}`);
  return event;
}

function assertNoAdminSecret(value: unknown, context: string) {
  const serialized = JSON.stringify(value);
  for (const secret of ['qa-secret-token-never-return', 'isolated-http-token', encryptionSecret]) {
    assert.equal(serialized.includes(secret), false, `${context} exposed a configured secret`);
  }
  for (const key of ['password_hash', 'api_token_encrypted', 'verification_token', 'code_hash']) {
    assert.equal(serialized.includes(`"${key}"`), false, `${context} exposed ${key}`);
  }
}

try {
  await startServer();
  const anonymous = new Device('192.0.2.10');
  const member = new Device('192.0.2.11', 'qa-member');
  const legacyStaff = new Device('192.0.2.12', 'qa-superadmin');
  const moderator = new Device('192.0.2.13');
  const admin = new Device('192.0.2.14');
  const superadmin = new Device('192.0.2.15');
  const viewer = new Device('192.0.2.15', 'qa-viewer');

  await anonymous.call('/admin/auth/login', { body: { username: 'qa.superadmin', password: 'wrong-password' }, expected: 401 });
  assertNoAdminSecret(await moderator.adminLogin('qa.moderator'), 'moderator login');
  assertNoAdminSecret(await admin.adminLogin('qa.admin'), 'admin login');
  assertNoAdminSecret(await superadmin.adminLogin('qa.superadmin'), 'superadmin login');
  const browserAdminSession = await superadmin.call('/admin/session');
  assertNoAdminSecret(browserAdminSession, 'admin session');
  assert.equal(browserAdminSession.session_token, undefined);

  const adminSections = [
    { route: '/admin/overview', moderator: 200, admin: 200, superadmin: 200 },
    { route: '/admin/users', moderator: 200, admin: 200, superadmin: 200 },
    { route: '/admin/requests', moderator: 200, admin: 200, superadmin: 200 },
    { route: '/admin/community', moderator: 200, admin: 200, superadmin: 200 },
    { route: '/admin/reports', moderator: 200, admin: 200, superadmin: 200 },
    { route: '/admin/call-reports', moderator: 200, admin: 200, superadmin: 200 },
    { route: '/admin/directory/claims', moderator: 200, admin: 200, superadmin: 200 },
    { route: '/admin/tickets', moderator: 403, admin: 200, superadmin: 200 },
    { route: '/admin/organizations', moderator: 403, admin: 200, superadmin: 200 },
    { route: '/admin/audit', moderator: 403, admin: 200, superadmin: 200 },
    { route: '/admin/sms-providers', moderator: 403, admin: 200, superadmin: 200 },
    { route: '/admin/accounts', moderator: 403, admin: 403, superadmin: 200 }
  ];
  for (const section of adminSections) {
    await anonymous.call(section.route, { expected: 403 });
    await member.call(section.route, { expected: 403 });
    await legacyStaff.call(section.route, { expected: 403 });
    assertNoAdminSecret(await moderator.call(section.route, { expected: section.moderator }), `moderator ${section.route}`);
    assertNoAdminSecret(await admin.call(section.route, { expected: section.admin }), `admin ${section.route}`);
    assertNoAdminSecret(await superadmin.call(section.route, { expected: section.superadmin }), `superadmin ${section.route}`);
  }
  const moderatorOverview = await moderator.call('/admin/overview');
  assert.deepEqual(moderatorOverview.viewer.capabilities.sort(), ['DASHBOARD', 'MODERATE_CONTENT', 'SUSPEND_MEMBER', 'VIEW_USERS'].sort());
  assert.deepEqual(moderatorOverview.tickets, []);
  const adminOverview = await admin.call('/admin/overview');
  assert.ok(adminOverview.viewer.capabilities.includes('MANAGE_SUPPORT'));
  assert.ok(adminOverview.viewer.capabilities.includes('MANAGE_INVITATIONS'));
  assert.equal(adminOverview.system.otp_bypass_enabled, false);
  await moderator.call('/admin/settings/otp-bypass', { method: 'PATCH', body: { enabled: false, reason: 'QA forbidden setting' }, expected: 403 });
  await admin.call('/admin/settings/otp-bypass', { method: 'PATCH', body: { enabled: false, reason: 'QA forbidden setting' }, expected: 403 });
  const systemSetting = await superadmin.call('/admin/settings/otp-bypass', { method: 'PATCH', body: { enabled: false, reason: 'QA confirms secure default' } });
  assert.equal(systemSetting.otp_bypass_enabled, false);
  console.log('PASS: every existing admin resource enforces dedicated moderator/admin/superadmin scopes and denies member, legacy staff, and anonymous callers');

  const publicCommunity = await viewer.call('/community');
  const memberPost = publicCommunity.posts.find((item: any) => item.id === 'qa-post');
  assert.equal(memberPost.author.id, 'qa-member');
  const draft = await viewer.call('/community', {
    body: {
      type: 'HEALTH_SUGGESTION',
      title: 'Safe community publishing acceptance',
      body_markdown: 'This disposable guidance is long enough to verify that every public community publication requires current conduct acceptance.'
    },
    expected: 201
  });
  await viewer.call(`/community/${draft.id}/publish`, { body: { consent: true }, expected: 400 });
  const published = await viewer.call(`/community/${draft.id}/publish`, {
    body: { consent: true, terms_and_conduct_accepted: true }
  });
  assert.equal(published.author.id, 'qa-viewer');

  const requestBeforeBlock = await viewer.call('/requests/qa-request');
  assert.ok(requestBeforeBlock.request.comments.some((item: any) => item.id === 'qa-comment'));
  await viewer.call('/me/blocks/qa-member', { method: 'POST' });
  const filteredCommunity = await viewer.call('/community');
  assert.equal(filteredCommunity.posts.some((item: any) => item.author.id === 'qa-member'), false);
  await viewer.call(`/community/${memberPost.slug}`, { expected: 404 });
  const requestAfterBlock = await viewer.call('/requests/qa-request');
  assert.equal(requestAfterBlock.request.comments.some((item: any) => item.id === 'qa-comment'), false);
  console.log('PASS: community publishing requires conduct acceptance and blocks hide author posts and comments');

  await anonymous.call('/admin/users/qa-member', { method: 'PATCH', body: { name: 'Forbidden', reason: 'QA forbidden' }, expected: 403 });
  await member.call('/admin/users/qa-member', { method: 'PATCH', body: { name: 'Forbidden', reason: 'QA forbidden' }, expected: 403 });
  await moderator.call('/admin/users/qa-member', { method: 'PATCH', body: { name: 'Forbidden', reason: 'QA forbidden' }, expected: 403 });
  await superadmin.call('/admin/users/qa-member', { method: 'PATCH', body: { staff_role: 'ADMIN', reason: 'QA member promotion forbidden' }, expected: 400 });
  const suspended = await moderator.call('/admin/users/qa-delegated', { method: 'PATCH', body: { account_status: 'SUSPENDED', suspension_reason: 'QA scoped moderation', reason: 'QA scoped moderation' } });
  assert.equal(suspended.account_status, 'SUSPENDED');
  const reactivated = await moderator.call('/admin/users/qa-delegated', { method: 'PATCH', body: { account_status: 'ACTIVE', reason: 'QA moderation complete' } });
  assert.equal(reactivated.account_status, 'ACTIVE');
  console.log('PASS: unauthenticated and member updates are denied, moderators remain scoped, and members cannot be promoted into administration');

  await anonymous.call('/admin/accounts', { expected: 403 });
  await member.call('/admin/accounts', { expected: 403 });
  await admin.call('/admin/accounts', { expected: 403 });
  const accountList = await superadmin.call('/admin/accounts');
  assert.equal(accountList.accounts.length, 3);
  await superadmin.call('/admin/accounts/qa-superadmin-account', { method: 'PATCH', body: { staff_role: 'ADMIN' }, expected: 409 });
  const createdAdmin = await superadmin.call('/admin/accounts', {
    body: { username: 'qa.reviewer', name: 'QA Reviewer', staff_role: 'MODERATOR', initial_password: 'Disposable-reviewer-password-123' },
    expected: 201
  });
  assert.equal(createdAdmin.admin.staff_role, 'MODERATOR');
  assertNoAdminSecret(createdAdmin, 'created admin');
  const promotedAdmin = await superadmin.call(`/admin/accounts/${createdAdmin.admin.id}`, { method: 'PATCH', body: { staff_role: 'ADMIN' } });
  assert.equal(promotedAdmin.admin.staff_role, 'ADMIN');
  const suspendedAdmin = await superadmin.call(`/admin/accounts/${createdAdmin.admin.id}`, { method: 'PATCH', body: { account_status: 'SUSPENDED' } });
  assert.equal(suspendedAdmin.admin.account_status, 'SUSPENDED');
  await superadmin.call(`/admin/accounts/${createdAdmin.admin.id}`, { method: 'PATCH', body: { account_status: 'ACTIVE' } });
  await superadmin.call(`/admin/accounts/${createdAdmin.admin.id}/reset-password`, { body: { new_password: 'Disposable-reviewer-reset-456' } });
  const reviewer = new Device('192.0.2.18');
  await reviewer.call('/admin/auth/login', { body: { username: 'qa.reviewer', password: 'Disposable-reviewer-password-123' }, expected: 401 });
  await reviewer.call('/admin/auth/login', { body: { username: 'qa.reviewer', password: 'Disposable-reviewer-reset-456' } });
  await reviewer.call('/admin/auth/logout', { method: 'POST' });
  await reviewer.call('/admin/session', { expected: 401 });
  console.log('PASS: dedicated administration accounts are superadmin-managed, guarded, resettable, and independent from member sessions');

  const renamed = await admin.call('/admin/users/qa-member', {
    method: 'PATCH', body: { name: 'QA Member Updated', reason: 'QA reversible account edit' }
  });
  assert.equal(renamed.name, 'QA Member Updated');
  let events = await admin.call('/admin/audit?activity=USER_ADMIN_UPDATED&user_id=qa-member');
  const renameEvent = latest(events, 'USER_ADMIN_UPDATED', 'qa-member');
  assert.equal(renameEvent.summary.includes('Administrator updated an account'), true);
  assert.equal(renameEvent.reversible, true);
  const undone = await admin.call(`/admin/audit/${renameEvent.id}/undo`, { body: { reason: 'QA undo account edit' } });
  assert.equal(undone.result.name, 'QA Member');
  await admin.call(`/admin/audit/${renameEvent.id}/undo`, { body: { reason: 'QA duplicate undo rejection' }, expected: 409 });

  await admin.call('/admin/users/qa-member', { method: 'PATCH', body: { name: 'QA Member First', reason: 'QA first edit' } });
  events = await admin.call('/admin/audit?activity=USER_ADMIN_UPDATED&user_id=qa-member');
  const firstEvent = latest(events, 'USER_ADMIN_UPDATED', 'qa-member');
  await admin.call('/admin/users/qa-member', { method: 'PATCH', body: { name: 'QA Member Second', reason: 'QA newer edit' } });
  await admin.call(`/admin/audit/${firstEvent.id}/undo`, { body: { reason: 'QA stale undo rejection' }, expected: 409 });
  console.log('PASS: account update, readable audit, successful undo, duplicate and stale undo conflicts');

  const revoked = await admin.call('/admin/users/qa-member/revoke-sessions', { body: { reason: 'QA explicit session revocation' } });
  assert.ok(revoked.revoked_sessions >= 1);
  const removed = await admin.call('/admin/users/qa-member', { method: 'DELETE', body: { reason: 'QA reversible account deletion' } });
  assert.ok(removed.deleted_at);
  await member.call('/me', { expected: 401 });
  const withDeleted = await admin.call('/admin/users?include_deleted=true&search=QA%20Member');
  assert.ok(withDeleted.some((item: any) => item.id === 'qa-member' && item.deleted_at));
  const restored = await admin.call('/admin/users/qa-member/restore', { body: { reason: 'QA account restoration' } });
  assert.equal(restored.deleted_at, undefined);
  await member.call('/me', { expected: 401 });
  console.log('PASS: account delete/restore and irreversible session revocation');

  let request = await moderator.call('/admin/requests/qa-request', {
    method: 'PATCH', body: { action: 'UPDATE', changes: { status: 'ACTIVE', hospital_name: 'QA Hospital Updated', units_required: 2 }, reason: 'QA request edit' }
  });
  assert.equal(request.hospital_name, 'QA Hospital Updated');
  assert.equal(request.units_required, 2);
  request = await moderator.call('/admin/requests/qa-request', { method: 'PATCH', body: { action: 'DELETE', reason: 'QA request deletion' } });
  assert.ok(request.admin_deleted_at);
  request = await moderator.call('/admin/requests/qa-request', { method: 'PATCH', body: { action: 'RESTORE', reason: 'QA request restoration' } });
  assert.equal(request.admin_deleted_at, undefined);

  let comment = await moderator.call('/admin/requests/qa-request/comments/qa-comment', { method: 'PATCH', body: { action: 'UPDATE', text: 'Updated QA comment', reason: 'QA comment edit' } });
  assert.equal(comment.text, 'Updated QA comment');
  comment = await moderator.call('/admin/requests/qa-request/comments/qa-comment', { method: 'PATCH', body: { action: 'DELETE', reason: 'QA comment deletion' } });
  assert.equal(comment.moderation_status, 'HIDDEN');
  comment = await moderator.call('/admin/requests/qa-request/comments/qa-comment', { method: 'PATCH', body: { action: 'RESTORE', reason: 'QA comment restoration' } });
  assert.equal(comment.moderation_status, 'VISIBLE');

  let post = await moderator.call('/admin/community/qa-post', {
    method: 'PATCH', body: { action: 'UPDATE', changes: { title: 'Updated isolated donation preparation' }, reason: 'QA post edit' }
  });
  assert.equal(post.title, 'Updated isolated donation preparation');
  post = await moderator.call('/admin/community/qa-post', { method: 'PATCH', body: { status: 'HIDDEN', reason: 'QA post hide' } });
  assert.equal(post.status, 'HIDDEN');
  post = await moderator.call('/admin/community/qa-post', { method: 'PATCH', body: { status: 'PUBLISHED', reason: 'QA post unhide' } });
  assert.equal(post.status, 'PUBLISHED');
  post = await moderator.call('/admin/community/qa-post', { method: 'PATCH', body: { action: 'DELETE', reason: 'QA post deletion' } });
  assert.equal(post.status, 'DELETED');
  post = await moderator.call('/admin/community/qa-post', { method: 'PATCH', body: { action: 'RESTORE', reason: 'QA post restoration' } });
  assert.equal(post.status, 'PUBLISHED');
  console.log('PASS: request, comment, and community content edit/delete/restore workflows');

  const report = await moderator.call('/admin/reports/qa-report', { method: 'PATCH', body: { status: 'RESOLVED', resolution_note: 'QA reviewed' } });
  assert.equal(report.status, 'RESOLVED');
  const ticket = await admin.call('/admin/tickets/qa-ticket', { method: 'PATCH', body: { status: 'IN_PROGRESS' } });
  assert.equal(ticket.status, 'IN_PROGRESS');
  const organization = await admin.call('/admin/organizations/qa-organization', { method: 'PATCH', body: { status: 'VERIFIED', note: 'QA verified' } });
  assert.equal(organization.status, 'VERIFIED');
  const claims = await moderator.call('/admin/directory/claims');
  assert.ok(claims.claims.some((item: any) => item.id === pendingClaimPublicId));
  const claimResult = await moderator.call(`/admin/directory/claims/${pendingClaimPublicId}`, { method: 'PATCH', body: { approve: false, note: 'QA claim declined' } });
  assert.equal(claimResult.status, 'UNCLAIMED');
  console.log('PASS: report, support, organization, and profile-claim queues support their scoped review actions');

  const memberEvents = await admin.call('/admin/audit?user_id=qa-member&limit=500');
  assert.ok(memberEvents.length > 0);
  assert.ok(memberEvents.every((event: any) => event.actor_id === 'qa-member' || (event.target_type === 'USER' && event.target_id === 'qa-member')));
  assert.ok(memberEvents.every((event: any) => typeof event.summary === 'string' && typeof event.category === 'string'));

  await anonymous.call('/auth/login', { body: { phone: fullMemberPhone, password: 'wrong-password-never-log' }, expected: 401 });
  const otpFailure = await anonymous.call('/auth/otp/request', { body: { phone: fullMemberPhone, purpose: 'RESET_PASSWORD' }, expected: 502 });
  assert.equal(otpFailure.verification_token, undefined);
  const authEvents = await admin.call('/admin/audit?activity=LOGIN_FAILED&limit=20');
  const failedLogin = latest(authEvents, 'LOGIN_FAILED');
  const loginJson = JSON.stringify(failedLogin);
  assert.equal(loginJson.includes(fullMemberPhone), false);
  assert.equal(loginJson.includes('wrong-password-never-log'), false);
  assert.match(String(failedLogin.metadata?.phone || ''), /0004$/);
  const smsEvents = await admin.call('/admin/audit?activity=OTP_&limit=20');
  assert.ok(smsEvents.some((event: any) => event.action === 'OTP_REQUESTED'));
  assert.ok(smsEvents.some((event: any) => event.action === 'OTP_DELIVERY_FAILED'));
  assert.equal(JSON.stringify(smsEvents).includes(fullMemberPhone), false);
  console.log('PASS: filtered member, anonymous login, OTP request, and failed SMS activity are readable and redacted');

  await moderator.call('/admin/sms-providers', { expected: 403 });
  await admin.call('/admin/sms-providers', { body: { name: 'Invalid provider', base_url: 'https://example.invalid', reason: 'QA missing token' }, expected: 400 });
  const providerResult = await admin.call('/admin/sms-providers');
  const providers = providerResult.providers;
  assert.equal(providers.length, 1);
  assert.equal(providers[0].has_api_token, true);
  assert.deepEqual(providerResult.routing, { strategy: 'SINGLE_MESSAVO', source: 'ENVIRONMENT' });
  const providerJson = JSON.stringify(providerResult);
  assert.equal(providerJson.includes('qa-secret-token-never-return'), false);
  assert.equal(providerJson.includes('api_token_encrypted'), false);
  assert.equal(providerJson.includes('updated_by'), false);
  await admin.call('/admin/sms-providers/qa-provider', { method: 'PATCH', body: { enabled: true, reason: 'QA provider enable' } });
  assert.equal((await admin.call('/admin/sms-providers')).routing.source, 'MANAGED');
  const secondaryProvider = { name: 'QA secondary Messavo', base_url: 'https://198.51.100.11', api_token: 'qa-secondary-secret-token', reason: 'QA single-route boundary' };
  await admin.call('/admin/sms-providers', { body: secondaryProvider, expected: 409 });
  assert.equal((await admin.call('/admin/sms-providers')).providers.length, 1);
  const disabledSecondary = await admin.call('/admin/sms-providers', { body: { ...secondaryProvider, enabled: false }, expected: 201 });
  await admin.call(`/admin/sms-providers/${disabledSecondary.id}`, { method: 'PATCH', body: { name: 'MUTATION MUST NOT PERSIST', enabled: true, reason: 'QA second-route enable boundary' }, expected: 409 });
  const unchangedSecondary = (await admin.call('/admin/sms-providers')).providers.find((provider: any) => provider.id === disabledSecondary.id);
  assert.equal(unchangedSecondary.name, secondaryProvider.name);
  assert.equal(unchangedSecondary.enabled, false);
  await admin.call(`/admin/sms-providers/${disabledSecondary.id}`, { method: 'DELETE', body: { reason: 'QA secondary fixture cleanup' } });
  await admin.call('/admin/sms-providers/qa-provider', { method: 'DELETE', body: { reason: 'QA provider deletion' } });
  await admin.call('/admin/sms-providers/qa-provider/restore', { body: { reason: 'QA provider restoration' } });
  await admin.call('/admin/sms-providers/rankings', { method: 'PUT', body: { provider_ids: ['qa-provider'], reason: 'QA provider ranking' } });
  console.log('PASS: SMS provider permissions, token secrecy, lifecycle, and ranking');

  await stopServer();
  await startServer();
  const persistedProviders = await admin.call('/admin/sms-providers');
  assert.equal(persistedProviders.providers[0].id, 'qa-provider');
  assert.equal(persistedProviders.providers[0].enabled, true);
  assert.equal(persistedProviders.routing.source, 'MANAGED');
  const persistedRequest = (await admin.call('/admin/requests')).find((item: any) => item.id === 'qa-request');
  assert.equal(persistedRequest.hospital_name, 'QA Hospital Updated');
  assert.equal(persistedRequest.comments[0].moderation_status, 'VISIBLE');
  assert.equal((await admin.call('/admin/community/qa-post')).status, 'PUBLISHED');
  console.log('PASS: admin account, content, audit, and provider state survived server restart');

  await admin.call('/admin/account/password', { body: { current_password: password, new_password: 'Disposable-admin-reset-password-456' } });
  await admin.call('/admin/session', { expected: 401 });
  await admin.call('/admin/auth/login', { body: { username: 'qa.admin', password }, expected: 401 });
  await admin.call('/admin/auth/login', { body: { username: 'qa.admin', password: 'Disposable-admin-reset-password-456' } });
  console.log('PASS: administration password change revokes sessions without changing member authentication');
} finally {
  await stopServer();
  await new Promise<void>(resolve => failedSms.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
}
