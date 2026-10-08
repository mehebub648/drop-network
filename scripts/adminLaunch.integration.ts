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
const { saveToTable } = await import('../server/db');
const { saveCommunityPost } = await import('../server/communityPosts');

const users = [
  { id: 'qa-superadmin', phone: '+8801700000001', name: 'QA Superadmin', staff_role: 'SUPERADMIN' },
  { id: 'qa-admin', phone: '+8801700000002', name: 'QA Admin', staff_role: 'ADMIN' },
  { id: 'qa-moderator', phone: '+8801700000003', name: 'QA Moderator', staff_role: 'MODERATOR' },
  { id: 'qa-member', phone: fullMemberPhone, name: 'QA Member' },
  { id: 'qa-delegated', phone: '+8801700000005', name: 'QA Delegated Account' }
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
      SMS_PROVIDER: 'http',
      SMS_HTTP_ENDPOINT: 'http://127.0.0.1:18561',
      SMS_HTTP_TOKEN: 'isolated-http-token'
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
}

function latest(events: any[], action: string, targetId?: string) {
  const event = events.find(item => item.action === action && (!targetId || item.target_id === targetId));
  assert.ok(event, `Expected ${action}${targetId ? ` for ${targetId}` : ''}`);
  return event;
}

try {
  await startServer();
  const anonymous = new Device('192.0.2.10');
  const member = new Device('192.0.2.11', 'qa-member');
  const moderator = new Device('192.0.2.12', 'qa-moderator');
  const admin = new Device('192.0.2.13', 'qa-admin');
  const superadmin = new Device('192.0.2.14', 'qa-superadmin');

  await anonymous.call('/admin/users/qa-member', { method: 'PATCH', body: { name: 'Forbidden', reason: 'QA forbidden' }, expected: 403 });
  await member.call('/admin/users/qa-member', { method: 'PATCH', body: { name: 'Forbidden', reason: 'QA forbidden' }, expected: 403 });
  await moderator.call('/admin/users/qa-member', { method: 'PATCH', body: { name: 'Forbidden', reason: 'QA forbidden' }, expected: 403 });
  await admin.call('/admin/users/qa-admin', { method: 'PATCH', body: { name: 'Self edit forbidden', reason: 'QA self protection' }, expected: 403 });
  await superadmin.call('/admin/users/qa-superadmin', { method: 'PATCH', body: { staff_role: 'ADMIN', reason: 'QA last superadmin protection' }, expected: 409 });
  console.log('PASS: unauthenticated, member, moderator, self-edit, and last-superadmin protections');

  await superadmin.call('/admin/users/qa-delegated', { method: 'PATCH', body: { staff_role: 'SUPERADMIN', reason: 'QA temporary staff fixture' } });
  await superadmin.call('/admin/users/qa-delegated', { method: 'PATCH', body: { staff_role: null, reason: 'QA staff demotion fixture' } });
  const staffEvents = await admin.call('/admin/audit?activity=USER_ADMIN_UPDATED&user_id=qa-delegated');
  const demotionEvent = latest(staffEvents, 'USER_ADMIN_UPDATED', 'qa-delegated');
  await admin.call(`/admin/audit/${demotionEvent.id}/undo`, { body: { reason: 'QA forbidden privilege escalation' }, expected: 403 });
  const restoredStaff = await superadmin.call(`/admin/audit/${demotionEvent.id}/undo`, { body: { reason: 'QA authorized staff restoration' } });
  assert.equal(restoredStaff.result.staff_role, 'SUPERADMIN');
  console.log('PASS: audit undo cannot escalate an administrator into staff-management privileges');

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

  const memberEvents = await admin.call('/admin/audit?user_id=qa-member&limit=500');
  assert.ok(memberEvents.length > 0);
  assert.ok(memberEvents.every((event: any) => event.actor_id === 'qa-member' || (event.target_type === 'USER' && event.target_id === 'qa-member')));
  assert.ok(memberEvents.every((event: any) => typeof event.summary === 'string' && typeof event.category === 'string'));

  await anonymous.call('/auth/login', { body: { phone: fullMemberPhone, password: 'wrong-password-never-log' }, expected: 401 });
  const otpFailure = await anonymous.call('/auth/otp/request', { body: { phone: fullMemberPhone, purpose: 'SIGN_IN' }, expected: 502 });
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
  const providers = await admin.call('/admin/sms-providers');
  assert.equal(providers.length, 1);
  assert.equal(providers[0].has_api_token, true);
  const providerJson = JSON.stringify(providers);
  assert.equal(providerJson.includes('qa-secret-token-never-return'), false);
  assert.equal(providerJson.includes('api_token_encrypted'), false);
  assert.equal(providerJson.includes('updated_by'), false);
  await admin.call('/admin/sms-providers/qa-provider', { method: 'PATCH', body: { enabled: true, reason: 'QA provider enable' } });
  await admin.call('/admin/sms-providers/qa-provider', { method: 'DELETE', body: { reason: 'QA provider deletion' } });
  await admin.call('/admin/sms-providers/qa-provider/restore', { body: { reason: 'QA provider restoration' } });
  await admin.call('/admin/sms-providers/rankings', { method: 'PUT', body: { provider_ids: ['qa-provider'], reason: 'QA provider ranking' } });
  console.log('PASS: SMS provider permissions, token secrecy, lifecycle, and ranking');

  await stopServer();
  await startServer();
  const persistedProviders = await admin.call('/admin/sms-providers');
  assert.equal(persistedProviders[0].id, 'qa-provider');
  assert.equal(persistedProviders[0].enabled, true);
  const persistedRequest = (await admin.call('/admin/requests')).find((item: any) => item.id === 'qa-request');
  assert.equal(persistedRequest.hospital_name, 'QA Hospital Updated');
  assert.equal(persistedRequest.comments[0].moderation_status, 'VISIBLE');
  assert.equal((await admin.call('/admin/community/qa-post')).status, 'PUBLISHED');
  console.log('PASS: admin account, content, audit, and provider state survived server restart');
} finally {
  await stopServer();
  await new Promise<void>(resolve => failedSms.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
}
