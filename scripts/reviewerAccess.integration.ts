/** Uses disposable storage and a fake SMS gateway inside the isolated QA container. */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';
import { PLAY_REVIEWER_PHONE } from '../server/phone';

if (process.env.DROP_ISOLATED_QA !== '1') throw new Error('Run in the isolated QA container only');
const directory = await mkdtemp(path.join(tmpdir(), 'drop-reviewer-'));
process.env.LANCEDB_PATH = path.join(directory, 'db');
const { saveToTable, syncDonorToPartition, getDb } = await import('../server/db');
const password = 'Isolated-reviewer-fixture-password';
const reviewer = {
  id: 'qa-play-reviewer', phone: PLAY_REVIEWER_PHONE, name: 'Isolated Play reviewer',
  password: await bcrypt.hash(password, 4), is_verified: true,
  roles: ['MEMBER'], created_at: new Date().toISOString(),
  donor_profile: { blood_group: 'B+', upazila: 'Savar', location: { area_name: 'Dhaka', lat: 23.8, lng: 90.4 },
    availability_status: 'AVAILABLE', availability_confirmed_at: new Date().toISOString(), deferral_status: 'NONE' }
};
await saveToTable('common_users', reviewer);
await syncDonorToPartition(reviewer);
assert.equal((await (await getDb()).tableNames()).some(name => name.startsWith('donors_')), false);
let smsCalls = 0;
const sms = createServer((_req, res) => { smsCalls += 1; res.writeHead(500); res.end(); }).listen(18561, '127.0.0.1');
await once(sms, 'listening');
let logs = '';
const server = spawn(process.execPath, ['--import', 'tsx', 'server/server.ts'], {
  env: { ...process.env, PORT: '18560', NODE_ENV: 'test', APP_URL: 'http://127.0.0.1:18560',
    COMMUNITY_MEDIA_PATH: path.join(directory, 'media'), SMS_PROVIDER: 'messavo',
    SMS_API_BASE_URL: 'http://127.0.0.1:18561', SMS_API_TOKEN: 'isolated-only' },
  stdio: ['ignore', 'pipe', 'pipe']
});
server.stdout.on('data', chunk => { logs = (logs + chunk).slice(-6000); });
server.stderr.on('data', chunk => { logs = (logs + chunk).slice(-6000); });
let cookie = '';
let requestNumber = 0;
async function call(route: string, body?: unknown, expected = 200) {
  const response = await fetch(`http://127.0.0.1:18560${route}`, {
    signal: AbortSignal.timeout(15000), method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://127.0.0.1:18560',
      'x-forwarded-for': `198.18.0.${++requestNumber}`, cookie },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const result = await response.json();
  assert.equal(response.status, expected, `${route}: ${JSON.stringify(result)}`);
  if (response.headers.getSetCookie().length) cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  return result;
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server.exitCode !== null) throw new Error(logs);
    try { ready = (await fetch('http://127.0.0.1:18560/health')).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, logs);
  assert.equal((await call('/api/v1/auth/start', { phone: '01000000046' })).next_step, 'PASSWORD');
  await call('/api/v1/auth/start', { phone: '01000000047' }, 400);
  await call('/api/v1/auth/login', { phone: PLAY_REVIEWER_PHONE, password: 'wrong-password' }, 401);
  const login = await call('/api/v1/auth/login', { phone: PLAY_REVIEWER_PHONE, password });
  assert.equal(login.user.id, reviewer.id);
  assert.deepEqual(login.user.roles, ['MEMBER']);
  assert.equal((await call('/api/v1/me')).id, reviewer.id);
  await call('/api/admin/session', undefined, 401);
  for (const purpose of ['REGISTER', 'RESET_PASSWORD']) {
    await call('/api/v1/auth/otp/request', { phone: PLAY_REVIEWER_PHONE, purpose }, 400);
  }
  await call('/api/v1/auth/otp/verify', { phone: PLAY_REVIEWER_PHONE, purpose: 'REGISTER', code: '123456' }, 400);
  await call('/api/v1/auth/register', { phone: PLAY_REVIEWER_PHONE, name: 'No new account', password,
    registration_context: 'REQUEST' }, 400);
  await call('/api/v1/auth/reset-password', { phone: PLAY_REVIEWER_PHONE, new_password: password, verification_token: 'invalid' }, 400);
  assert.equal(smsCalls, 0);
  console.log('PASS: reviewer password login, credential enforcement, member-only access, rejected OTP/registration/recovery, no donor partition and zero SMS');
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  if (server.exitCode === null) {
    server.kill('SIGTERM');
    await once(server, 'exit').catch(() => {});
  }
  await new Promise<void>(resolve => sms.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
}
