/** Network-isolated fixtures only; never connects to production data or SMS. */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';

if (process.env.DROP_ISOLATED_QA !== '1') throw new Error('Requires isolated QA');
const directory = await mkdtemp(path.join(tmpdir(), 'drop-call-feedback-'));
process.env.LANCEDB_PATH = path.join(directory, 'db');
const { saveToTable, addCallReports, queryCallReports } = await import('../server/db');
const password = 'Disposable-fixture-password';
for (const [id, phone] of [['owner', '+8801700000001'], ['other', '+8801700000002']]) {
  await saveToTable('common_users', { id, phone, name: `Fixture ${id}`, is_verified: true, password: await bcrypt.hash(password, 4), roles: ['MEMBER'] });
}
await saveToTable('common_users', { id: 'donor', phone: '+8801700000003', name: 'Previous fixture donor', is_verified: true });
for (const [id, status] of [['active', 'ACTIVE'], ['closed', 'CANCELLED']]) {
  await saveToTable('common_requests', { id, user_id: 'owner', ownership: 'USER', lifecycle_version: 2, status, blood_group: 'B+',
    location: { area_name: 'Dhaka', lat: 23.8, lng: 90.4 }, upazila: 'Savar', expires_at: new Date(Date.now() + 86400000).toISOString(), comments: [], contacts: [] });
  await addCallReports([{ id: `reveal-${id}`, kind: 'REVEAL', request_id: id, actor_id: 'owner', donor_ref: 'reg:donor', donor_kind: 'REGISTERED', created_at: id === 'closed' ? '2026-01-01T00:00:00Z' : new Date().toISOString() }]);
}
const origin = 'http://127.0.0.1:18552';
const server = spawn(process.execPath, ['--import', 'tsx', 'server/server.ts'], { env: { ...process.env, NODE_ENV: 'test', PORT: '18552', APP_URL: origin, COMMUNITY_MEDIA_PATH: path.join(directory, 'media'), SMS_PROVIDER: '' }, stdio: 'ignore' });
async function call(route: string, body?: object, cookie = '', status = 200) {
  const response = await fetch(origin + '/api/v1' + route, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', origin, cookie }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const value = await response.json();
  assert.equal(response.status, status, JSON.stringify(value));
  return { value, cookie: response.headers.getSetCookie().map(item => item.split(';')[0]).join('; ') };
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { ready = (await fetch(origin + '/health')).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready);
  const owner = (await call('/auth/login', { phone: '+8801700000001', password })).cookie;
  const other = (await call('/auth/login', { phone: '+8801700000002', password })).cookie;
  const pending = (await call('/me/reveals/pending', undefined, owner)).value.pending;
  assert.equal(pending.request_id, 'active');
  assert.equal(pending.name, 'Previous fixture donor');
  assert.equal(pending.phone, undefined);
  await call('/requests/active/reveals', { donor_ref: 'reg:another' }, owner, 409);
  await call('/requests/active/call-reports', { reveal_id: pending.reveal_id, outcome: 'NO_ANSWER' }, other, 403);
  const first = (await call('/requests/active/call-reports', { reveal_id: pending.reveal_id, outcome: 'NO_ANSWER' }, owner, 201)).value;
  assert.equal((await call('/me/reveals/pending', undefined, owner)).value.pending, null);
  const summary = (await call('/requests/active/contacted-donors', undefined, owner)).value.items[0];
  assert.equal(summary.reveal_id, pending.reveal_id);
  assert.equal(summary.latest_report_id, first.report_id);
  assert.equal(summary.phone, undefined);
  await call('/requests/active/call-reports', { reveal_id: pending.reveal_id, outcome: 'CALL_BACK_LATER', supersedes_report_id: first.report_id }, owner, 201);
  await call('/requests/active/call-reports', { reveal_id: pending.reveal_id, outcome: 'DECLINED', reason: 'UNAVAILABLE', supersedes_report_id: first.report_id }, owner, 409);
  assert.equal((await call('/requests/active/contacted-donors', undefined, owner)).value.items[0].latest_call_outcome, 'CALL_BACK_LATER');
  assert.equal((await queryCallReports({ requestId: 'active' })).length, 3);
  console.log('PASS: pending identity without phone, cross-donor block, owner authorization, correction, stale-edit conflict and retained history');
} finally {
  server.kill('SIGTERM');
  if (server.exitCode === null) await once(server, 'exit');
  await rm(directory, { recursive: true, force: true });
}
