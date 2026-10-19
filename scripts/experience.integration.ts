/** Runs only in the network-isolated QA container, against disposable storage. */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';
import { dhakaDate, DAY_MS, requestExpiry } from '../server/requestLifecycle';
import { guestTokenHash } from '../server/guestRequests';

if (process.env.DROP_ISOLATED_QA !== '1') throw new Error('Run in the isolated QA container only');
const directory = await mkdtemp(path.join(tmpdir(), 'drop-experience-'));
process.env.LANCEDB_PATH = path.join(directory, 'db');
const { saveToTable, getAllFromTable, addImportedDonors } = await import('../server/db');
const { toImportedDonorRow } = await import('../server/importedDonors');
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
const importedSource = { id: 'isolated-qa', organization: 'ISOLATED QA', url: 'https://example.invalid', scraped_at: new Date().toISOString() };
await addImportedDonors([
  toImportedDonorRow({ id: 'qa-claim-existing', public_id: 'qa-claim-existing', claim_slug: 'QACLAIMEXIST', source: importedSource, source_ref: 'qa-existing', name: 'Existing claim fixture', phone: privatePhone, blood_group: 'AB+', district: 'Dhaka', upazila: 'Savar', location: seededRequest.location, claim_status: 'UNCLAIMED', publication_state: 'PUBLIC', imported_at: new Date().toISOString() }),
  toImportedDonorRow({ id: 'qa-claim-new', public_id: 'qa-claim-new', claim_slug: 'QACLAIMNEW01', source: importedSource, source_ref: 'qa-new', name: 'New claim fixture', phone: '+8801700000007', blood_group: 'AB+', district: 'Dhaka', upazila: 'Savar', location: seededRequest.location, claim_status: 'UNCLAIMED', publication_state: 'PUBLIC', imported_at: new Date().toISOString() })
]);
const followUpSecret = 'isolated-follow-up-secret';
await saveToTable('common_donation_followups', {
  id: 'qa-auth-follow-up', request_id: 'qa-overdue-owned', requester_id: 'qa-existing', donor_ref: 'reg:qa-existing', donor_kind: 'REGISTERED',
  agreed_at: new Date().toISOString(), sms_consent: false, due_at: new Date().toISOString(), delivery: { status: 'NOT_REQUESTED', attempts: 0 },
  reminder_count: 0, state: 'FOLLOW_UP_DUE', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
});
for (const token of ['qa-follow-up-proof-1', 'qa-follow-up-proof-2']) {
  await saveToTable('common_otps', { id: token, phone: privatePhone, purpose: 'DONATION_FOLLOW_UP', code_hash: 'fixture', created_at: new Date().toISOString(), expires_at: new Date(Date.now() + DAY_MS).toISOString(), attempts: 0, verified_at: new Date().toISOString(), verification_token: token, verification_expires_at: new Date(Date.now() + DAY_MS).toISOString() });
}
for (let i = 0; i < 34; i++) {
  await saveToTable('common_users', { id: `qa-donor-${i}`, name: `Fixture Donor ${i}`, phone: `+8801900000${String(i).padStart(3, '0')}`, is_verified: true, roles: ['MEMBER'], created_at: new Date().toISOString(), donor_profile: { blood_group: 'B+', upazila: i < 4 ? 'Savar' : 'Dhamrai', location: { area_name: 'Dhaka', lat: 23.8, lng: 90.4 }, last_donation: { kind: 'NEVER' } } });
}
const idleToken = 'b'.repeat(64);
await saveToTable('common_guest_devices', { id: guestTokenHash(idleToken), created_at: new Date(Date.now() - 16 * DAY_MS).toISOString(), last_seen_at: new Date(Date.now() - 16 * DAY_MS).toISOString(), request_count: 1 });
await saveToTable('common_requests', { ...seededRequest, id: 'qa-idle-guest', user_id: '', ownership: 'GUEST', guest_token_hash: guestTokenHash(idleToken), needed_by: new Date(Date.now() + DAY_MS).toISOString(), expires_at: new Date(Date.now() + DAY_MS).toISOString() });
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
    FOLLOW_UP_LINK_SECRET: followUpSecret,
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
  const followUpPayload = Buffer.from(JSON.stringify({ id: 'qa-auth-follow-up', exp: Date.now() + DAY_MS })).toString('base64url');
  const followUpToken = `${followUpPayload}.${createHmac('sha256', followUpSecret).update(followUpPayload).digest('base64url')}`;
  const sessionsBeforeFollowUp = (await getAllFromTable('common_sessions')).length;
  const verifiedFollowUp = await stranger.call('/api/donation-follow-ups/verify', { token: followUpToken, phone: privatePhone, verification_token: 'qa-follow-up-proof-1' });
  assert.equal(verifiedFollowUp.sign_in_required, true);
  assert.equal(verifiedFollowUp.user, undefined);
  assert.equal(stranger.cookies.has('drop_session'), false);
  assert.equal((await getAllFromTable('common_sessions')).length, sessionsBeforeFollowUp);
  const followUpMember = new Device('192.0.2.15');
  await followUpMember.call('/api/auth/login', { phone: privatePhone, password });
  const sessionsAfterPasswordLogin = (await getAllFromTable('common_sessions')).length;
  const authenticatedFollowUp = await followUpMember.call('/api/donation-follow-ups/verify', { token: followUpToken, phone: privatePhone, verification_token: 'qa-follow-up-proof-2' });
  assert.equal(authenticatedFollowUp.user.id, 'qa-existing');
  assert.equal(authenticatedFollowUp.sign_in_required, undefined);
  assert.equal((await getAllFromTable('common_sessions')).length, sessionsAfterPasswordLogin);
  console.log('PASS: follow-up phone verification never creates an existing-account session');
  const existingClaim = new Device('192.0.2.16');
  await existingClaim.call('/api/auth/otp/request', { phone: privatePhone, purpose: 'CLAIM_PROFILE' });
  const existingClaimProof = await existingClaim.call('/api/auth/otp/verify', { phone: privatePhone, purpose: 'CLAIM_PROFILE', code: codes.get(privatePhone) });
  const sessionsBeforeExistingClaim = (await getAllFromTable('common_sessions')).length;
  const existingClaimResult = await existingClaim.call('/api/claims/QACLAIMEXIST/complete', {
    phone: privatePhone, verification_token: existingClaimProof.verification_token, name: 'Existing claim fixture', blood_group: 'AB+',
    district: 'Dhaka', upazila: 'Savar', availability_status: 'NOT_AVAILABLE', availability_reason: 'ISOLATED QA', availability_consent: true
  });
  assert.equal(existingClaimResult.account_created, false);
  assert.equal(existingClaimResult.sign_in_required, true);
  assert.equal(existingClaim.cookies.has('drop_session'), false);
  assert.equal((await getAllFromTable('common_sessions')).length, sessionsBeforeExistingClaim);

  const newClaim = new Device('192.0.2.17');
  const newClaimPhone = '+8801700000007';
  await newClaim.call('/api/auth/otp/request', { phone: newClaimPhone, purpose: 'CLAIM_PROFILE' });
  const newClaimProof = await newClaim.call('/api/auth/otp/verify', { phone: newClaimPhone, purpose: 'CLAIM_PROFILE', code: codes.get(newClaimPhone) });
  const newClaimBody = {
    phone: newClaimPhone, verification_token: newClaimProof.verification_token, name: 'New claim fixture', blood_group: 'AB+',
    district: 'Dhaka', upazila: 'Savar', availability_status: 'AVAILABLE', availability_consent: true
  };
  await newClaim.call('/api/claims/QACLAIMNEW01/complete', newClaimBody, 'POST', 400);
  const sessionsBeforeNewClaim = (await getAllFromTable('common_sessions')).length;
  const newClaimResult = await newClaim.call('/api/claims/QACLAIMNEW01/complete', { ...newClaimBody, password });
  assert.equal(newClaimResult.account_created, true);
  assert.equal(newClaim.cookies.has('drop_session'), true);
  assert.equal((await getAllFromTable('common_sessions')).length, sessionsBeforeNewClaim + 1);
  console.log('PASS: existing claims require password sign-in while new claim accounts set a password');
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
  await guest.call('/api/requests/qa-idle-guest', undefined, 'GET', 404);
  const local = await guest.call('/api/search/donors?blood_group=B%2B&district=Dhaka&upazila=Savar');
  assert.equal(local.local_total, 4);
  assert.equal(local.includes_district, true);
  assert.equal(local.items.slice(0, 4).every((item: any) => item.upazila === 'Savar' && !item.is_district_fallback), true);
  assert.equal(local.items.slice(4).every((item: any) => item.upazila === 'Dhamrai' && item.is_district_fallback), true);
  const district = await guest.call('/api/search/donors?blood_group=B%2B&district=Dhaka&upazila=Dhamrai');
  assert.equal(district.local_total, 30);
  assert.equal(district.includes_district, false);
  assert.equal(district.items.every((item: any) => item.upazila === 'Dhamrai'), true);
  await stranger.call(`/api/requests/${id}/reveals`, { donor_ref: 'reg:qa-donor-0' }, 'POST', 401);
  await guest.call(`/api/requests/${id}/reveals`, { donor_ref: 'reg:qa-donor-0' }, 'POST', 401);
  const third = await guest.call('/api/search/requests', { ...payload('01800000008'), needed_when: 'THIS_WEEK', collection_facility: '' }, 'POST', 201);
  assert.equal(third.request.needed_date, dhakaDate(Date.now() + 7 * DAY_MS));
  await guest.call(`/api/requests/${third.request.id}/close`, { reason: 'CANCELLED' });
  const full = await guest.call('/api/search/requests', payload('01800000009'), 'POST', 428);
  assert.equal(full.reason, 'GUEST_REQUEST_LIMIT');
  console.log('PASS: account-gated donor contact, total request quota after closure, 15-day idle purge, optional facility, timing and upazila fallback threshold');
  console.log('PASS: guest privacy, consent, deadline bounds, device isolation and duplicate publication');
  assert.equal((await guest.call('/api/auth/start', { phone: privatePhone })).next_step, 'PASSWORD');
  const guestComment = await guest.call(`/api/requests/${id}/comments`, { text: 'ISOLATED guest adoption regression', anonymous_name: 'ISOLATED guest', client_id: 'isolated-adoption-comment' });
  await guest.call('/api/auth/login', { phone: privatePhone, password });
  const adoptedComment = (await guest.call(`/api/requests/${id}`)).request.comments.find((comment: any) => comment.id === guestComment.id);
  assert.equal(adoptedComment.is_mine, true);
  assert.equal('user_id' in adoptedComment, false);
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
  const fourth = await guest.call(`/api/requests/${id}/reveals`, { donor_ref: 'reg:qa-donor-3' });
  await guest.call(`/api/requests/${id}/call-reports`, { reveal_id: fourth.reveal_id, outcome: 'NOT_CALLED' }, 'POST', 201);
  console.log('PASS: password login adopted guest requests and unlocked protected donor contact');
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
  assert.equal((await newcomer.call('/api/auth/start', { phone: newPhone })).next_step, 'PASSWORD');
  await newcomer.call('/api/auth/otp/request', { phone: newPhone, purpose: 'SIGN_IN' }, 'POST', 400);
  await newcomer.call('/api/auth/otp/request', { phone: newPhone, purpose: 'REGISTER' });
  assert.ok(codes.get(newPhone), 'test SMS adapter captured OTP');
  const verified = await newcomer.call('/api/auth/otp/verify', { phone: newPhone, purpose: 'REGISTER', code: codes.get(newPhone) });
  assert.deepEqual(Object.keys(verified), ['verification_token']);
  await stranger.call('/api/auth/verify-phone', { verification_token: verified.verification_token }, 'POST', 401);
  await newcomer.call('/api/auth/register', {
    registration_context: 'REQUEST', phone: newPhone, verification_token: verified.verification_token,
    name: 'Passwordless account must fail'
  }, 'POST', 400);
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
  await volunteer.call('/api/auth/otp/request', { phone: donorPhone, purpose: 'REGISTER' });
  await volunteer.call('/api/auth/otp/verify', { phone: donorPhone, purpose: 'REGISTER', code: '000000' }, 'POST', 400);
  const donorProof = await volunteer.call('/api/auth/otp/verify', { phone: donorPhone, purpose: 'REGISTER', code: codes.get(donorPhone) });
  const donorRegistration = {
    registration_context: 'GUIDED', phone: donorPhone, verification_token: donorProof.verification_token,
    name: 'Isolated donor', date_of_birth: '1995-02-03', district: 'Dhaka', upazila: 'Savar',
    password, donor_opt_in: true, blood_group: 'O-', last_donation: { kind: 'NEVER' }, donation_count: 0
  };
  await volunteer.call('/api/auth/register', donorRegistration, 'POST', 400);
  const enrolled = await volunteer.call('/api/auth/register', { ...donorRegistration, availability_status: 'AVAILABLE' });
  assert.equal(enrolled.user.donor_profile.availability_status, 'AVAILABLE');
  assert.equal(enrolled.user.donor_profile.donation_count, 0);
  const { getPartitionName } = await import('../server/db');
  const cachedDonor = (await getAllFromTable(await getPartitionName('Dhaka', 'O-'))).find(item => item.id === enrolled.user.id);
  assert.ok(cachedDonor);
  assert.equal('date_of_birth' in cachedDonor, false);
  assert.equal('account_location' in cachedDonor, false);
  assert.equal('password' in cachedDonor, false);
  const overdueReveal = await guest.call('/api/requests/qa-overdue-owned/reveals', { donor_ref: `reg:${enrolled.user.id}` });
  assert.equal(overdueReveal.phone, donorPhone, 'Owned overdue requests retain protected contact access');
  await volunteer.call('/api/auth/otp/login', { phone: donorPhone, verification_token: donorProof.verification_token }, 'POST', 410);
  const recovery = new Device('192.0.2.32');
  await recovery.call('/api/guest/session', {});
  const recoveryPost = await recovery.call('/api/search/requests', payload('01800000004'), 'POST', 201);
  const existingSession = new Device('192.0.2.33');
  await recovery.call('/api/auth/login', { phone: privatePhone, password });
  await existingSession.call('/api/auth/login', { phone: privatePhone, password });
  await recovery.call('/api/auth/otp/request', { phone: privatePhone, purpose: 'RESET_PASSWORD' });
  const recoveryProof = await recovery.call('/api/auth/otp/verify', { phone: privatePhone, purpose: 'RESET_PASSWORD', code: codes.get(privatePhone) });
  const recoveredPassword = 'Recovered-test-password-456';
  await recovery.call('/api/auth/reset-password', { phone: privatePhone, new_password: recoveredPassword, verification_token: recoveryProof.verification_token });
  await recovery.call('/api/me', undefined, 'GET', 401);
  await existingSession.call('/api/me', undefined, 'GET', 401);
  await recovery.call('/api/auth/login', { phone: privatePhone, password: recoveredPassword });
  assert.equal((await recovery.call(`/api/requests/${recoveryPost.request.id}`)).request.verification_state, 'ACCOUNT_OWNED');
  console.log('PASS: explicit donor availability, private donor search cache, password recovery and session revocation');
  for (const [phone, suffix, hasPassword] of [['+8801700000004', '41', true], ['+8801700000005', '42', false]] as const) {
    const device = new Device(`192.0.2.${suffix}`);
    await device.call('/api/v1/guest/session', {});
    const post = await device.call('/api/v1/search/requests', payload(`018000000${suffix}`), 'POST', 201);
    const challenge = await device.call('/api/v1/auth/start', { phone });
    assert.equal(challenge.next_step, 'PASSWORD');
    assert.equal('user' in challenge, false);
    if (hasPassword) {
      await device.call('/api/v1/auth/login', { phone, password });
      assert.equal((await device.call(`/api/v1/requests/${post.request.id}`)).request.permitted_actions.reveal, false);
      await device.call('/api/v1/me/contact-reports/confirm-phone', {}, 'POST', 403);
      await device.call('/api/v1/auth/otp/request', { phone, purpose: 'REGISTER' });
      const proof = await device.call('/api/v1/auth/otp/verify', { phone, purpose: 'REGISTER', code: codes.get(phone) });
      const verifiedUser = await device.call('/api/v1/auth/verify-phone', { verification_token: proof.verification_token });
      assert.equal(verifiedUser.user.is_verified, true);
      await device.call('/api/v1/me/contact-reports/confirm-phone', {});
    } else {
      await device.call('/api/v1/auth/login', { phone, password }, 'POST', 401);
      await device.call('/api/v1/auth/otp/request', { phone, purpose: 'RESET_PASSWORD' });
      const proof = await device.call('/api/v1/auth/otp/verify', { phone, purpose: 'RESET_PASSWORD', code: codes.get(phone) });
      await device.call('/api/v1/auth/reset-password', { phone, new_password: password, verification_token: proof.verification_token });
      await device.call('/api/v1/auth/login', { phone, password });
    }
    const owned = (await device.call(`/api/v1/requests/${post.request.id}`)).request;
    assert.equal(owned.verification_state, 'ACCOUNT_OWNED');
    assert.equal(owned.permitted_actions.reveal, true);
  }
  const limited = new Device('192.0.2.51');
  for (let i = 0; i < 5; i++) await limited.call('/api/auth/start', { phone: '+8801700000099' });
  assert.equal((await limited.call('/api/auth/start', { phone: '+8801700000099' })).next_step, 'PASSWORD');
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
  await newcomer.call('/api/me/push/devices', { token: 'isolated-deletion-device-token', enabled: true });
  await newcomer.call(`/api/requests/${newPost.request.id}/comments`, { text: 'ISOLATED QA personal comment to remove' });
  await newcomer.call('/api/me', undefined, 'DELETE');
  await newcomer.call('/api/me', undefined, 'GET', 401);
  const deletedUser = (await getAllFromTable('common_users')).find(item => item.id === account.user.id);
  assert.ok(deletedUser.deleted_at);
  for (const field of ['date_of_birth', 'account_location', 'phone_verified_at', 'password', 'donor_profile', 'recipient_profile']) {
    assert.equal(deletedUser[field], undefined, `deleted account clears ${field}`);
  }
  assert.equal(deletedUser.phone.startsWith('deleted-'), true);
  assert.equal((await getAllFromTable('common_push_devices')).some(item => item.user_id === account.user.id), false);
  assert.equal((await getAllFromTable('common_push_deliveries')).some(item => item.user_id === account.user.id), false);
  assert.equal((await getAllFromTable('common_notifications')).some(item => item.user_id === account.user.id), false);
  const deletedRequest = (await getAllFromTable('common_requests')).find(item => item.id === newPost.request.id);
  assert.equal(deletedRequest.status, 'CANCELLED');
  assert.deepEqual(deletedRequest.contacts, []);
  const deletedComment = deletedRequest.comments.find(item => item.user_id === account.user.id);
  assert.equal(deletedComment.text, '');
  assert.ok(deletedComment.deleted_at);
  console.log('PASS: account deletion removes private profile fields, push tokens, notifications, request contacts and authored comments');
  console.log('PASS: legacy phone verification, passwordless recovery, versioned API adoption and generic password routing');
  console.log('PASS: isolated publication, date bounds, consent, privacy, device isolation, retry, adoption, closure and guided opt-out registration');
} finally {
  server.kill('SIGTERM');
  if (server.exitCode === null) await once(server, 'exit');
  sms.close(); await once(sms, 'close');
  await rm(directory, { recursive: true, force: true });
}
