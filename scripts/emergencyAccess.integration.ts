/** Run only in a network-isolated Compose QA container with disposable storage. */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { dhakaDate, DAY_MS } from '../server/requestLifecycle';
import { guestTokenHash } from '../server/guestRequests';

if (process.env.DROP_ISOLATED_QA !== '1') throw new Error('Requires isolated QA; never use live SMS or data');
const directory = await mkdtemp(path.join(tmpdir(), 'drop-emergency-'));
process.env.LANCEDB_PATH = path.join(directory, 'db');
const { saveToTable, getAllFromTable, queryCallReports, syncDonorToPartition } = await import('../server/db');
const origin = 'http://127.0.0.1:18554';
const password = 'Disposable-test-password';
await saveToTable('common_users', { id: 'owner', phone: '+8801700000001', name: 'ISOLATED OWNER', password: await bcrypt.hash(password, 4), is_verified: true, roles: ['MEMBER'] });
for (let i = 1; i <= 3; i++) {
  const donor = { id: `donor-${i}`, phone: `+880170000001${i}`, name: `ISOLATED DONOR ${i}`, is_verified: true, roles: ['MEMBER'],
    donor_profile: { blood_group: 'O+', location: { area_name: 'Dhaka', lat: 23.8, lng: 90.4 }, upazila: 'Savar',
      availability_status: 'AVAILABLE', availability_confirmed_at: new Date().toISOString(), eligibility_status: 'ELIGIBLE', deferral_status: 'NONE' } };
  await saveToTable('common_users', donor); await syncDonorToPartition(donor);
}
let mode = 'offline';
let jobStatus = 'ready';
let jobError = '';
const sms = createServer(async (req, res) => {
  res.setHeader('content-type', 'application/json');
  if (req.method === 'DELETE') { res.statusCode = 204; return res.end(); }
  if (req.method === 'GET') return res.end(JSON.stringify({ message: { status: jobStatus, error: jobError } }));
  for await (const _ of req) { /* Consume fixture message without logging OTP or phone. */ }
  if (mode === 'offline') { res.statusCode = 409; return res.end('{"error":"device_offline"}'); }
  if (mode === 'rate') { res.statusCode = 429; return res.end('{"error":"send_rate_limit_reached"}'); }
  res.statusCode = 202; res.end(JSON.stringify({ id: randomUUID(), status: 'ready' }));
}).listen(18555, '127.0.0.1');
await once(sms, 'listening');
let server: ChildProcess | undefined;
async function stop() {
  if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); }
}
async function start() {
  server = spawn(process.execPath, ['--import', 'tsx', 'server/server.ts'], { env: {
    ...process.env, PORT: '18554', NODE_ENV: 'test', APP_URL: origin, COMMUNITY_MEDIA_PATH: path.join(directory, 'media'),
    SMS_PROVIDER: 'messavo', SMS_API_BASE_URL: 'http://127.0.0.1:18555', SMS_API_TOKEN: 'isolated-only',
    SMS_FOLLOWUP_API_TOKEN: '', FIREBASE_SERVICE_ACCOUNT_FILE: '', FOLLOW_UP_LINK_SECRET: 'isolated-fixture-secret',
  }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch(origin + '/health')).ok) return; } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Disposable server did not become healthy');
}
class Device {
  cookies = new Map<string, string>();
  constructor(readonly ip: string) {}
  async call(route: string, body?: object, expected = 200) {
    const response = await fetch(origin + '/api/v1' + route, { method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(45_000),
      headers: { 'content-type': 'application/json', origin, 'x-forwarded-for': this.ip, cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    for (const cookie of response.headers.getSetCookie()) { const [pair] = cookie.split(';'); const at = pair.indexOf('='); this.cookies.set(pair.slice(0, at), pair.slice(at + 1)); }
    const value = await response.json(); assert.equal(response.status, expected, JSON.stringify(value)); return value;
  }
}
const requestBody = (i: number) => ({ blood_group: 'O+', blood_component: 'NOT_SURE', units_required: 1, request_reason: 'OTHER',
  district: 'Dhaka', upazila: 'Savar', requester_role: 'PATIENT', patient_name: `ISOLATED PATIENT ${i}`, patient_sex: 'MALE', patient_age: 30,
  collection_facility: 'ISOLATED FACILITY', contact_phone: `+88018000000${String(i).padStart(2, '0')}`, needed_date: dhakaDate(Date.now() + DAY_MS), consent: true });
try {
  await start();
  const a = new Device('127.0.0.2'), b = new Device('127.0.0.3'), c = new Device('127.0.0.4');
  for (const device of [a, b, c]) await device.call('/guest/session', {});
  const first = (await a.call('/search/requests', requestBody(1), 201)).request.id;
  for (let i = 2; i <= 3; i++) await a.call('/search/requests', requestBody(i), 201);
  const capped = await a.call('/search/requests', requestBody(4), 428);
  assert.equal(capped.code, 'ACCOUNT_REQUIRED');
  assert.equal(capped.reason, 'GUEST_REQUEST_LIMIT');
  const outage = await a.call('/auth/otp/request', { phone: '+8801700000001', purpose: 'SIGN_IN' }, 502);
  assert.equal(outage.blood_help_eligible, true);
  assert.equal(outage.verification_token, undefined);
  await b.call('/guest/emergency-access', { challenge_id: outage.challenge_id }, 403);
  const pass = await a.call('/guest/emergency-access', { challenge_id: outage.challenge_id });
  assert.equal(pass.blood_help_access.active, true);
  assert.equal((await a.call('/guest/emergency-access', { challenge_id: outage.challenge_id })).blood_help_access.expires_at, pass.blood_help_access.expires_at);
  await a.call('/search/requests', requestBody(4), 201);
  await a.call('/me', undefined, 401);
  await a.call('/auth/otp/login', { phone: '+8801700000001', verification_token: outage.challenge_id }, 403);
  await a.call('/auth/reset-password', { phone: '+8801700000001', new_password: 'Never-used-password', verification_token: outage.challenge_id }, 403);
  const reveal = await a.call(`/requests/${first}/reveals`, { donor_ref: 'reg:donor-1' });
  await a.call(`/requests/${first}/reveals`, { donor_ref: 'reg:donor-2' }, 409);
  await b.call(`/requests/${first}/reveals`, { donor_ref: 'reg:donor-1' }, 401);
  await a.call(`/requests/${first}/call-reports`, { reveal_id: reveal.reveal_id, outcome: 'NO_ANSWER' }, 201);
  const second = await a.call(`/requests/${first}/reveals`, { donor_ref: 'reg:donor-2' });
  const agreement = await a.call(`/requests/${first}/call-reports`, { reveal_id: second.reveal_id, outcome: 'WILL_DONATE', sms_consent: false }, 201);
  assert.ok(agreement.follow_up);
  const history = (await a.call(`/requests/${first}/contacted-donors`)).items;
  const followUpId = history.find((item: any) => item.donor_ref === 'reg:donor-2').follow_up_id;
  await b.call('/donation-follow-ups/' + followUpId + '/outcome', { outcome: 'DONATED' }, 401);
  await a.call('/donation-follow-ups/' + followUpId + '/outcome', { outcome: 'NOT_DONATED' });
  await stop(); await start();
  assert.equal((await a.call('/guest/session')).blood_help_access.expires_at, pass.blood_help_access.expires_at);
  assert.equal((await a.call(`/requests/${first}`)).request.permitted_actions.reveal, true);
  mode = 'queued'; jobStatus = 'ready';
  const queued = await c.call('/auth/otp/request', { phone: '+8801700000002', purpose: 'RESET_PASSWORD' });
  assert.equal((await c.call(`/auth/otp/${queued.challenge_id}/status`)).blood_help_eligible, false);
  jobStatus = 'failed'; jobError = 'radio_off';
  assert.equal((await c.call(`/auth/otp/${queued.challenge_id}/status`)).blood_help_eligible, true);
  await c.call('/guest/emergency-access', { challenge_id: queued.challenge_id });
  await c.call(`/requests/${first}/reveals`, { donor_ref: 'reg:donor-3' }, 403);
  mode = 'rate';
  const rejected = await b.call('/auth/otp/request', { phone: '+8801700000003', purpose: 'REGISTER' }, 502);
  assert.equal(rejected.blood_help_eligible, false);
  await b.call('/guest/emergency-access', { challenge_id: rejected.challenge_id }, 403);
  // Change only disposable persisted metadata while the fixture server is stopped.
  await stop();
  const deviceHash = guestTokenHash(a.cookies.get('drop_guest')!);
  const devices = await getAllFromTable('common_guest_devices');
  const saved = devices.find((device: any) => device.id === deviceHash);
  saved.blood_help.expires_at = new Date(Date.now() - 1000).toISOString();
  await saveToTable('common_guest_devices', saved);
  await start();
  await a.call(`/requests/${first}/reveals`, { donor_ref: 'reg:donor-3' }, 403);
  const reopened = await a.call(`/requests/${first}/reveals`, { donor_ref: 'reg:donor-1' });
  await a.call(`/requests/${first}/call-reports`, { reveal_id: reopened.reveal_id, outcome: 'NOT_CALLED' }, 201);
  await a.call('/auth/login', { phone: '+8801700000001', password });
  assert.equal((await a.call(`/requests/${first}`)).request.permitted_actions.reveal, true);
  const reports = await queryCallReports<any>({ requestId: first });
  assert.equal(new Set(reports.map(report => report.id)).size, reports.length);
  assert.ok(reports.every(report => report.actor_id === 'owner' && report.actor_verified === false));
  assert.equal((await a.call(`/requests/${first}/contacted-donors`)).items.length, 2);
  console.log('PASS: outage detection, device isolation, member allowances, contact feedback, protected auth, follow-ups, restart, expiry and adoption');
} finally {
  await stop(); await new Promise<void>(resolve => sms.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
}
