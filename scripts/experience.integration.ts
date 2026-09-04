/** Runs only in the network-isolated QA container, against disposable storage. */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';
import { dhakaDate, DAY_MS, requestExpiry } from '../server/requestLifecycle';
import { guestTokenHash } from '../server/guestRequests';

if (process.env.DROP_ISOLATED_QA !== '1') throw new Error('Run in the isolated QA container only');
const directory = await mkdtemp(path.join(tmpdir(), 'drop-experience-'));
process.env.LANCEDB_PATH = path.join(directory, 'db');
const { saveToTable } = await import('../server/db');
const password = 'Isolated-test-password-123';
const privatePhone = '+8801700000001';
await saveToTable('common_users', {
  id: 'qa-existing', phone: privatePhone, name: 'Isolated fixture',
  password: await bcrypt.hash(password, 4), is_verified: true,
  roles: ['MEMBER'], created_at: new Date().toISOString()
});
const expiredDevice = 'a'.repeat(64);
await saveToTable('common_users', { id: 'qa-staff', phone: '+8801700000006', name: 'Isolated moderator',
  password: await bcrypt.hash(password, 4), is_verified: true, staff_role: 'MODERATOR', roles: ['MEMBER'], created_at: new Date().toISOString() });
for (const [id, phone, verified] of [['qa-legacy', '+8801700000004', false], ['qa-passwordless', '+8801700000005', true]] as const) {
  await saveToTable('common_users', { id, phone, name: 'Isolated legacy fixture', is_verified: verified, roles: ['MEMBER'], created_at: new Date().toISOString(), ...(verified ? {} : { password: await bcrypt.hash(password, 4) }) });
}
const seededRequest = {
  blood_group: 'O-', location: { area_name: 'Dhaka', lat: 23.8103, lng: 90.4125 },
  upazila: 'Savar', status: 'ACTIVE', flow_version: 'SEARCH_V1', lifecycle_version: 2,
  needed_date: dhakaDate(Date.now() - DAY_MS), needed_by: new Date(Date.now() - 1000).toISOString(),
  created_at: new Date(Date.now() - DAY_MS).toISOString(), consent_at: new Date().toISOString(),
  comments: [], contacts: [{ type: 'PATIENT', name: 'ISOLATED QA', phone: '+8801800000099' }],
  hospital_name: 'ISOLATED QA', units_required: 1, units_confirmed: 0
};
await saveToTable('common_requests', { ...seededRequest, id: 'qa-expired-guest', user_id: '', ownership: 'GUEST', guest_token_hash: guestTokenHash(expiredDevice), expires_at: seededRequest.needed_by });
await saveToTable('common_requests', { ...seededRequest, id: 'qa-overdue-owned', user_id: 'qa-existing', ownership: 'USER', expires_at: requestExpiry(seededRequest.needed_by, 'USER') });
await saveToTable('common_requests', { ...seededRequest, id: 'qa-expired-owned', user_id: 'qa-existing', ownership: 'USER', expires_at: seededRequest.needed_by });
const codes = new Map<string, string>();
const sms = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw); if (body.code) codes.set(body.phone, body.code);
  res.end('{}');
}).listen(18551, '127.0.0.1');
await once(sms, 'listening');
let logs = '';
const server = spawn(process.execPath, ['--import', 'tsx', 'server/server.ts'], {
  env: { ...process.env, PORT: '18550', NODE_ENV: 'test', APP_URL: 'http://127.0.0.1:18550',
    COMMUNITY_MEDIA_PATH: path.join(directory, 'media'),
    SMS_PROVIDER: 'http', SMS_HTTP_ENDPOINT: 'http://127.0.0.1:18551', SMS_HTTP_TOKEN: 'isolated-only' },
  stdio: ['ignore', 'pipe', 'pipe']
});
server.stdout.on('data', chunk => { logs = (logs + chunk).slice(-10000); });
server.stderr.on('data', chunk => { logs = (logs + chunk).slice(-10000); });
class Device {
  cookies = new Map<string, string>();
  constructor(readonly ip: string) {}
  async call(url: string, body?: unknown, method = body === undefined ? 'GET' : 'POST', expected = 200) {
    const response = await fetch(`http://127.0.0.1:18550${url}`, {
      signal: AbortSignal.timeout(15000),
      method, headers: { 'content-type': 'application/json', 'x-forwarded-for': this.ip,
        origin: 'http://127.0.0.1:18550', cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';'); const at = pair.indexOf('='); this.cookies.set(pair.slice(0, at), pair.slice(at + 1));
    }
    const result = await response.json();
    assert.equal(response.status, expected, `${method} ${url}: ${JSON.stringify(result)}`);
    return result;
  }
}
const payload = (phone: string, date = dhakaDate()) => ({
  blood_group: 'B+', blood_component: 'WHOLE_BLOOD', units_required: 1,
  request_reason: 'SURGERY', district: 'Dhaka', upazila: 'Savar',
  collection_facility: 'ISOLATED QA - NOT A REAL REQUEST', requester_role: 'PATIENT',
  patient_sex: 'MALE', patient_name: 'ISOLATED QA', patient_age: 30,
  contact_owner: 'PATIENT', contact_phone: phone, needed_date: date, consent: true
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch('http://127.0.0.1:18550/health')).ok) { ready = true; break; } } catch {}
    if (server.exitCode !== null) throw new Error(`QA server exited: ${logs}`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, 'QA server became ready');
  const guest = new Device('192.0.2.11');
  const stranger = new Device('192.0.2.12');
  const expired = new Device('192.0.2.14'); expired.cookies.set('drop_guest', expiredDevice);
  await expired.call('/api/search/requests', payload('01800000099'), 'POST', 428);
  await expired.call('/api/requests/qa-expired-guest', undefined, 'GET', 404);
  await expired.call('/api/requests/qa-expired-guest/close', { reason: 'CANCELLED' }, 'POST', 404);
  assert.equal((await expired.call('/api/guest/requests')).items.length, 0);
  await guest.call('/api/guest/session', {});
  await stranger.call('/api/v1/guest/session', {});
  await guest.call('/api/search/requests', { ...payload('01800000001'), consent: false }, 'POST', 400);
  await guest.call('/api/search/requests', payload('01800000001', dhakaDate(Date.now() - DAY_MS)), 'POST', 400);
  await guest.call('/api/search/requests', payload('01800000001', dhakaDate(Date.now() + 16 * DAY_MS)), 'POST', 400);
  const published = await guest.call('/api/search/requests', payload('01800000001'), 'POST', 201);
  const id = published.request.id;
  assert.equal(published.request.verification_state, 'UNVERIFIED');
  assert.equal(published.request.permitted_actions.reveal, false);
  assert.equal(published.request.expires_at, published.request.needed_by);
  assert.equal('guest_token_hash' in published.request, false);
  const duplicate = await guest.call('/api/search/requests', payload('01800000001'));
  assert.equal(duplicate.request.id, id);
  assert.equal(duplicate.reused, true);
  await stranger.call(`/api/requests/${id}/close`, { reason: 'RECEIVED' }, 'POST', 404);
  await guest.call(`/api/requests/${id}/reveals`, { donor_ref: 'registered:any' }, 'POST', 401);
  const publicDetail = await stranger.call(`/api/requests/${id}`);
  assert.equal(publicDetail.request.permitted_actions.manage, false);
  assert.equal('user_id' in publicDetail.request, false);
  assert.equal(JSON.stringify(publicDetail).includes(privatePhone), false);
  const second = await guest.call('/api/search/requests', payload('01800000002', dhakaDate(Date.now() + 15 * DAY_MS)), 'POST', 201);
  const guestCredential = guest.cookies.get('drop_guest')!;
  assert.equal((await guest.call('/api/guest/requests')).items.length, 2);
  console.log('PASS: guest privacy, consent, deadline bounds, device isolation and duplicate publication');
  assert.equal((await guest.call('/api/auth/start', { phone: privatePhone })).next_step, 'PASSWORD');
  await guest.call('/api/auth/login', { phone: privatePhone, password });
  const overdue = (await guest.call('/api/requests/qa-overdue-owned')).request;
  assert.equal(overdue.past_deadline, true);
  assert.equal(overdue.verification_state, 'ACCOUNT_OWNED');
  assert.equal(overdue.permitted_actions.reveal, true);
  for (const requestId of [id, second.request.id]) {
    const detail = await guest.call(`/api/requests/${requestId}`);
    assert.equal(detail.request.verification_state, 'ACCOUNT_OWNED');
    assert.equal(detail.request.permitted_actions.reveal, true);
    assert.equal(detail.request.expires_at, requestExpiry(detail.request.needed_by, 'USER'));
    assert.equal(JSON.stringify(await stranger.call(`/api/requests/${requestId}`)).includes(privatePhone), false);
  }
  assert.equal((await guest.call('/api/guest/requests')).items.length, 0);
  console.log('PASS: password login adopted all guest requests');
  const replay = new Device('192.0.2.13'); replay.cookies.set('drop_guest', guestCredential);
  await replay.call(`/api/requests/${id}/close`, { reason: 'CANCELLED' }, 'POST', 404);
  await guest.call('/api/guest/requests/adopt', {});
  const closed = await guest.call(`/api/requests/${id}/close`, { reason: 'RECEIVED' });
  assert.equal(closed.closure_reason, 'RECEIVED');
  assert.equal(closed.units_confirmed, 0);
  await stranger.call(`/api/requests/${id}`, undefined, 'GET', 404);

  const newcomer = new Device('192.0.2.21');
  const newPhone = '+8801700000002';
  await newcomer.call('/api/guest/session', {});
  const newPost = await newcomer.call('/api/search/requests', payload('01800000003'), 'POST', 201);
  assert.equal((await newcomer.call('/api/auth/start', { phone: newPhone })).next_step, 'OTP');
  await newcomer.call('/api/auth/otp/request', { phone: newPhone, purpose: 'SIGN_IN' });
  assert.ok(codes.get(newPhone), 'test SMS adapter captured OTP');
  const verified = await newcomer.call('/api/auth/otp/verify', { phone: newPhone, purpose: 'SIGN_IN', code: codes.get(newPhone) });
  const account = await newcomer.call('/api/auth/register', {
    registration_context: 'GUIDED', phone: newPhone, verification_token: verified.verification_token,
    name: 'Isolated new account', date_of_birth: '1995-02-03', district: 'Dhaka', upazila: 'Savar',
    password, donor_opt_in: false
  });
  assert.equal(account.user.donor_profile, undefined);
  assert.equal(account.user.date_of_birth, '1995-02-03');
  assert.equal((await newcomer.call(`/api/requests/${newPost.request.id}`)).request.verification_state, 'ACCOUNT_OWNED');
  const anon = JSON.stringify(await stranger.call(`/api/requests/${newPost.request.id}`));
  assert.equal(anon.includes(newPhone), false);
  assert.equal(anon.includes('1995-02-03'), false);
  const volunteer = new Device('192.0.2.31');
  const donorPhone = '+8801700000003';
  await volunteer.call('/api/guest/session', {});
  await volunteer.call('/api/auth/otp/request', { phone: donorPhone, purpose: 'SIGN_IN' });
  await volunteer.call('/api/auth/otp/verify', { phone: donorPhone, purpose: 'SIGN_IN', code: '000000' }, 'POST', 400);
  const donorProof = await volunteer.call('/api/auth/otp/verify', { phone: donorPhone, purpose: 'SIGN_IN', code: codes.get(donorPhone) });
  const donorRegistration = {
    registration_context: 'GUIDED', phone: donorPhone, verification_token: donorProof.verification_token,
    name: 'Isolated donor', date_of_birth: '1995-02-03', district: 'Dhaka', upazila: 'Savar',
    password, donor_opt_in: true, blood_group: 'O-', last_donation: { kind: 'NEVER' }, donation_count: 0
  };
  await volunteer.call('/api/auth/register', donorRegistration, 'POST', 400);
  const enrolled = await volunteer.call('/api/auth/register', { ...donorRegistration, availability_status: 'AVAILABLE' });
  assert.equal(enrolled.user.donor_profile.availability_status, 'AVAILABLE');
  assert.equal(enrolled.user.donor_profile.donation_count, 0);
  const { getPartitionName, getAllFromTable } = await import('../server/db');
  const cachedDonor = (await getAllFromTable(await getPartitionName('Dhaka', 'O-'))).find(item => item.id === enrolled.user.id);
  assert.ok(cachedDonor);
  assert.equal('date_of_birth' in cachedDonor, false);
  assert.equal('account_location' in cachedDonor, false);
  assert.equal('password' in cachedDonor, false);
  const overdueReveal = await guest.call('/api/requests/qa-overdue-owned/reveals', { donor_ref: `reg:${enrolled.user.id}` });
  assert.equal(overdueReveal.phone, donorPhone, 'Owned overdue requests retain protected contact access');
  await volunteer.call('/api/auth/otp/login', { phone: donorPhone, verification_token: donorProof.verification_token }, 'POST', 403);
  const recovery = new Device('192.0.2.32');
  await recovery.call('/api/guest/session', {});
  const recoveryPost = await recovery.call('/api/search/requests', payload('01800000004'), 'POST', 201);
  await recovery.call('/api/auth/otp/request', { phone: privatePhone, purpose: 'SIGN_IN' });
  const recoveryProof = await recovery.call('/api/auth/otp/verify', { phone: privatePhone, purpose: 'SIGN_IN', code: codes.get(privatePhone) });
  await recovery.call('/api/auth/otp/login', { phone: privatePhone, verification_token: recoveryProof.verification_token });
  assert.equal((await recovery.call(`/api/requests/${recoveryPost.request.id}`)).request.verification_state, 'ACCOUNT_OWNED');
  console.log('PASS: explicit donor availability, private donor search cache, OTP errors/replay and OTP-login adoption');
  for (const [phone, suffix, hasPassword] of [['+8801700000004', '41', true], ['+8801700000005', '42', false]] as const) {
    const device = new Device(`192.0.2.${suffix}`);
    await device.call('/api/v1/guest/session', {});
    const post = await device.call('/api/v1/search/requests', payload(`018000000${suffix}`), 'POST', 201);
    const challenge = await device.call('/api/v1/auth/start', { phone });
    assert.equal(challenge.next_step, hasPassword ? 'PASSWORD' : 'OTP');
    assert.equal('user' in challenge, false);
    if (hasPassword) {
      await device.call('/api/v1/auth/login', { phone, password });
      assert.equal((await device.call(`/api/v1/requests/${post.request.id}`)).request.permitted_actions.reveal, false);
    }
    await device.call('/api/v1/auth/otp/request', { phone, purpose: 'SIGN_IN' });
    const proof = await device.call('/api/v1/auth/otp/verify', { phone, purpose: 'SIGN_IN', code: codes.get(phone) });
    await device.call('/api/v1/auth/otp/login', { phone, verification_token: proof.verification_token });
    const owned = (await device.call(`/api/v1/requests/${post.request.id}`)).request;
    assert.equal(owned.verification_state, 'ACCOUNT_OWNED');
    assert.equal(owned.permitted_actions.reveal, true);
  }
  const limited = new Device('192.0.2.51');
  for (let i = 0; i < 5; i++) await limited.call('/api/auth/start', { phone: '+8801700000099' });
  await limited.call('/api/auth/start', { phone: '+8801700000099' }, 'POST', 429);
  await newcomer.call('/api/v1/admin/overview', undefined, 'GET', 403);
  const moderator = new Device('192.0.2.61');
  await moderator.call('/api/v1/auth/login', { phone: '+8801700000006', password });
  const operations = await moderator.call('/api/v1/admin/overview');
  assert.ok(operations.viewer.capabilities.includes('MODERATE_CONTENT'));
  assert.equal(operations.viewer.capabilities.includes('MANAGE_STAFF'), false);
  const staffRequests = await moderator.call('/api/v1/admin/requests');
  assert.equal(staffRequests.some((item: { id: string }) => item.id === 'qa-expired-guest'), false);
  await moderator.call('/api/v1/admin/requests/qa-expired-owned', { status: 'ACTIVE', note: 'Isolated expiry check' }, 'PATCH', 409);
  await moderator.call('/api/v1/admin/settings/otp-bypass', { enabled: true, reason: 'Isolated unauthorized check' }, 'PATCH', 403);
  await moderator.call(`/api/v1/admin/requests/${second.request.id}`, { status: 'REJECTED', note: 'Isolated moderation check' }, 'PATCH');
  await stranger.call(`/api/requests/${second.request.id}`, undefined, 'GET', 404);
  console.log('PASS: native-versioned staff permissions, moderation, guest expiry and forbidden resurrection');
  console.log('PASS: legacy verification-only, passwordless OTP, versioned API adoption and phone challenge throttling');
  console.log('PASS: isolated publication, date bounds, consent, privacy, device isolation, retry, adoption, closure and guided opt-out registration');
} finally {
  server.kill('SIGTERM');
  if (server.exitCode === null) await once(server, 'exit');
  sms.close(); await once(sms, 'close');
  await rm(directory, { recursive: true, force: true });
}
