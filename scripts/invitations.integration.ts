import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';

if (process.env.DROP_ISOLATED_QA !== '1') throw new Error('Run in the isolated QA container only');
const directory = await mkdtemp(path.join(tmpdir(), 'drop-invitations-'));
process.env.LANCEDB_PATH = path.join(directory, 'db');
const { addImportedDonors, getAllFromTable, findImportedDonorsByPublicIds, replaceImportedDonor, saveToTable } = await import('../server/db');
const { toImportedDonor, toImportedDonorRow } = await import('../server/importedDonors');
const password = 'Invitation-fixture-password-123';
const users = [
  { id: 'member', phone: '+8801711000001', name: 'Member fixture' },
  { id: 'other', phone: '+8801711000002', name: 'Other fixture' }
] as const;
for (const user of users) await saveToTable('common_users', {
  ...user, password: await bcrypt.hash(password, 4), is_verified: true, roles: ['MEMBER'], account_status: 'ACTIVE', created_at: new Date().toISOString()
});
await saveToTable('common_admin_accounts', {
  id: 'admin', username: 'invitation-admin', password_hash: await bcrypt.hash(password, 4),
  staff_role: 'ADMIN', account_status: 'ACTIVE', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
});
await saveToTable('common_admin_accounts', {
  id: 'moderator', username: 'invitation-moderator', password_hash: await bcrypt.hash(password, 4),
  staff_role: 'MODERATOR', account_status: 'ACTIVE', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
});
const now = new Date().toISOString();
const ambiguousPhone = '+8801911888999';
const donorRecords = Array.from({ length: 60 }, (_, index) => toImportedDonor({
  source_id: 'invitation-qa', source_organization: 'Invitation QA', source_url: 'https://example.invalid',
  scraped_at: now, source_ref: `donor-${index}`, name: `Campaign Donor ${index}`,
  phone: `+8801811${String(index).padStart(6, '0')}`, blood_group: 'B+', district: 'Dhaka', upazila: 'Savar'
}, now, () => ({ area_name: 'Dhaka', lat: 23.8, lng: 90.4 })));
await addImportedDonors(donorRecords.map(toImportedDonorRow));
for (let index = 0; index < 21; index += 1) await saveToTable('common_profile_invitations', {
  id: index === 0 ? 'already-invited' : `already-invited-${index}`, donor_public_id: donorRecords[index].public_id, donor_phone: donorRecords[index].phone,
  claim_path: `/c/${donorRecords[index].claim_slug}`, status: 'ACTIVE', delivery_status: 'DELIVERED', outcome: 'PENDING',
  response_due_at: new Date(Date.now() - 1_000).toISOString(), attempts: [], created_at: now, updated_at: now
});

const delivery = new Map<string, 'scheduled' | 'sent' | 'delivered' | 'failed'>();
const accepted: Array<{ id: string; to: string; key: string }> = [];
const fakeSms = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  if (req.method === 'POST' && url.pathname === '/api/v1/messages') {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    const key = String(req.headers['idempotency-key'] || '');
    const replay = accepted.find(item => item.key === key);
    const id = replay?.id || `job-${accepted.length + 1}`;
    if (!replay) accepted.push({ id, to: body.to, key });
    delivery.set(id, delivery.get(id) || 'scheduled');
    if (body.to === ambiguousPhone && !replay) { res.destroy(); return; }
    res.writeHead(202, { 'content-type': 'application/json' }); res.end(JSON.stringify({ id, status: delivery.get(id) })); return;
  }
  const match = url.pathname.match(/^\/api\/v1\/messages\/(job-\d+)$/);
  if (req.method === 'GET' && match) {
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ message: { status: delivery.get(match[1]) || 'failed' } })); return;
  }
  if (req.method === 'DELETE' && match) { delivery.set(match[1], 'failed'); res.writeHead(204); res.end(); return; }
  res.writeHead(404); res.end();
}).listen(18651, '127.0.0.1');
await once(fakeSms, 'listening');

let logs = '';
const spawnDrop = () => {
  const processHandle = spawn(process.execPath, ['--import', 'tsx', 'server/server.ts'], {
    env: { ...process.env, NODE_ENV: 'test', PORT: '18650', APP_URL: 'http://127.0.0.1:18650',
      COMMUNITY_MEDIA_PATH: path.join(directory, 'media'), SMS_PROVIDER: 'messavo',
      SMS_API_BASE_URL: 'http://127.0.0.1:18651', SMS_API_TOKEN: 'isolated-fixture-only' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  processHandle.stdout.on('data', value => { logs = (logs + value).slice(-20_000); });
  processHandle.stderr.on('data', value => { logs = (logs + value).slice(-20_000); });
  return processHandle;
};
let child = spawnDrop();

class Client {
  cookies = new Map<string, string>();
  constructor(readonly ip: string) {}
  headers(extra: Record<string, string> = {}) {
    return { origin: 'http://127.0.0.1:18650', 'x-forwarded-for': this.ip,
      cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '), ...extra };
  }
  async json(url: string, body?: unknown, method = body === undefined ? 'GET' : 'POST', expected = 200) {
    const response = await fetch(`http://127.0.0.1:18650${url}`, {
      method, headers: this.headers({ 'content-type': 'application/json' }),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30_000)
    });
    for (const cookie of response.headers.getSetCookie()) { const [pair] = cookie.split(';'); const at = pair.indexOf('='); this.cookies.set(pair.slice(0, at), pair.slice(at + 1)); }
    const result = await response.json();
    assert.equal(response.status, expected, `${method} ${url}: ${JSON.stringify(result)}`);
    return result;
  }
  async raw(url: string, bytes: Buffer, headers: Record<string, string>, expected = 200) {
    const response = await fetch(`http://127.0.0.1:18650${url}`, { method: 'PUT', headers: this.headers(headers), body: bytes, signal: AbortSignal.timeout(30_000) });
    const result = await response.json(); assert.equal(response.status, expected, `PUT ${url}: ${JSON.stringify(result)}`); return result;
  }
}

const waitFor = async (predicate: () => Promise<boolean>, message: string, timeout = 15_000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 250)); }
  assert.fail(message);
};

try {
  await waitFor(async () => { try { return (await fetch('http://127.0.0.1:18650/health')).ok; } catch { return false; } }, `server ready: ${logs}`);
  const member = new Client('192.0.2.10'); const other = new Client('192.0.2.11');
  const moderator = new Client('192.0.2.12'); const admin = new Client('192.0.2.13');
  for (const [client, phone] of [[member, users[0].phone], [other, users[1].phone]] as const) {
    await client.json('/api/auth/login', { phone, password });
  }
  await moderator.json('/api/admin/auth/login', { username: 'invitation-moderator', password });
  await admin.json('/api/admin/auth/login', { username: 'invitation-admin', password });
  await member.json('/api/admin/invitations', undefined, 'GET', 403);
  await moderator.json('/api/admin/invitations', undefined, 'GET', 403);
  assert.deepEqual((await admin.json('/api/admin/invitations')).invitations.length, 21);
  const noResponse = await admin.json('/api/admin/invitations?outcome=NO_RESPONSE');
  assert.equal(noResponse.total, 21);
  await admin.json('/api/admin/invitations/resend', { filter: 'NO_RESPONSE', mode: 'INSTANT' }, 'POST', 400);

  const singleInput = { name: 'Private invite', phone: '+8801911000001' };
  const acceptedBeforeSingle = accepted.length;
  const first = await member.json('/api/me/donor-contributions', singleInput, 'POST', 202);
  assert.equal(first.message.includes('stays private'), true);
  assert.equal(accepted.length, acceptedBeforeSingle + 1);
  const duplicate = await member.json('/api/me/donor-contributions', singleInput, 'POST', 202);
  assert.equal(duplicate.invitation.id, first.invitation.id);
  assert.equal(accepted.length, acceptedBeforeSingle + 1, 'duplicate submission does not send again');
  const registeredCheck = new Client('192.0.2.15'); await registeredCheck.json('/api/auth/login', { phone: users[0].phone, password });
  const registered = await registeredCheck.json('/api/me/donor-contributions', { name: 'Already registered', phone: users[1].phone }, 'POST', 202);
  assert.equal(registered.invitation, null, 'registered member numbers are not invited');
  assert.equal(accepted.length, acceptedBeforeSingle + 1);
  for (let index = 2; index <= 10; index += 1) await member.json('/api/me/donor-contributions', { name: `Rate ${index}`, phone: `+8801911${String(index).padStart(6, '0')}` }, 'POST', 202);
  await member.json('/api/me/donor-contributions', { name: 'Rate blocked', phone: '+8801911099999' }, 'POST', 429);
  const ambiguousClient = new Client('192.0.2.14'); await ambiguousClient.json('/api/auth/login', { phone: users[1].phone, password });
  const ambiguous = await ambiguousClient.json('/api/me/donor-contributions', { name: 'Ambiguous fixture', phone: ambiguousPhone }, 'POST', 202);
  assert.equal(ambiguous.invitation.delivery_status, 'UNKNOWN');
  await waitFor(async () => {
    const item = (await admin.json('/api/admin/invitations')).invitations.find((value: any) => value.donor?.name === 'Ambiguous fixture');
    return item?.delivery_status === 'QUEUED';
  }, 'ambiguous accepted send recovered with the same key');
  assert.equal(accepted.filter(item => item.to === ambiguousPhone).length, 1, 'ambiguous retry reuses one Messavo job');

  const batchOwner = new Client('192.0.2.20'); await batchOwner.json('/api/auth/login', { phone: users[0].phone, password });
  const boundaryText = 'manual review';
  const boundaryFileBytes = 50 * 1024 * 1024 - Buffer.byteLength(boundaryText);
  const exactBoundary = await batchOwner.json('/api/me/donor-contribution-batches', { pasted_text: boundaryText, files: [{ name: 'large.pdf', content_type: 'application/pdf', size_bytes: boundaryFileBytes }] }, 'POST', 201);
  assert.equal(exactBoundary.batch.total_bytes, 50 * 1024 * 1024);
  {
    const boundaryBytes = Buffer.alloc(boundaryFileBytes);
    boundaryBytes.write('%PDF-1.7\n% isolated invitation QA boundary\n');
    const boundaryFile = exactBoundary.batch.files[0];
    await batchOwner.raw(`/api/me/donor-contribution-batches/${exactBoundary.batch.id}/files/${boundaryFile.id}`, boundaryBytes, {
      'content-type': 'application/pdf', 'x-file-name': encodeURIComponent('large.pdf'),
      'x-content-fingerprint': createHash('sha256').update(boundaryBytes).digest('hex')
    });
  }
  assert.equal((await batchOwner.json(`/api/me/donor-contribution-batches/${exactBoundary.batch.id}/submit`, {})).batch.status, 'SUBMITTED');
  await batchOwner.json('/api/me/donor-contribution-batches', { files: [{ name: 'too-large.pdf', content_type: 'application/pdf', size_bytes: 50 * 1024 * 1024 + 1 }] }, 'POST', 413);
  const bytes = Buffer.from('name,phone\nFixture,+8801911222333\n');
  const draft = await batchOwner.json('/api/me/donor-contribution-batches', { pasted_text: 'image notes', files: [{ name: 'দাতা.csv', content_type: 'text/csv', size_bytes: bytes.length }] }, 'POST', 201);
  const file = draft.batch.files[0]; const fileUrl = `/api/me/donor-contribution-batches/${draft.batch.id}/files/${file.id}`;
  await other.raw(fileUrl, bytes, { 'content-type': 'text/csv', 'x-file-name': encodeURIComponent('দাতা.csv'), 'x-content-fingerprint': createHash('sha256').update(bytes).digest('hex') }, 404);
  await batchOwner.raw(fileUrl, bytes, { 'content-type': 'text/csv', 'x-file-name': encodeURIComponent('দাতা.csv'), 'x-content-fingerprint': '0'.repeat(64) }, 400);
  await batchOwner.raw(fileUrl, bytes, { 'content-type': 'text/csv', 'x-file-name': encodeURIComponent('দাতা.csv'), 'x-content-fingerprint': createHash('sha256').update(bytes).digest('hex') });
  await batchOwner.json(`/api/me/donor-contribution-batches/${draft.batch.id}/submit`, {});
  const adminBatch = (await admin.json(`/api/admin/donor-contribution-batches/${draft.batch.id}`)).batch;
  await member.json(adminBatch.files[0].download_path, undefined, 'GET', 403);
  const downloaded = await fetch(`http://127.0.0.1:18650${adminBatch.files[0].download_path}`, { headers: admin.headers() as any });
  assert.equal(downloaded.status, 200); assert.equal(Buffer.from(await downloaded.arrayBuffer()).equals(bytes), true);
  const approved = await admin.json(`/api/admin/donor-contribution-batches/${draft.batch.id}`, { action: 'APPROVE', note: 'Fixture reviewed', donors: [
    { name: 'Reviewed donor', phone: '+8801911222333', blood_group: 'A+', district: 'Dhaka', upazila: 'Savar' },
    { name: 'Duplicate reviewed donor', phone: '+8801911222333' }
  ] }, 'PATCH');
  assert.equal(approved.published.length, 1, 'review approval deduplicates normalized phone numbers');
  const rejectDraft = await batchOwner.json('/api/me/donor-contribution-batches', { pasted_text: 'bad row', files: [] }, 'POST', 201);
  await batchOwner.json(`/api/me/donor-contribution-batches/${rejectDraft.batch.id}/submit`, {});
  assert.equal((await admin.json(`/api/admin/donor-contribution-batches/${rejectDraft.batch.id}`, { action: 'REJECT', note: 'Invalid source' }, 'PATCH')).batch.status, 'REJECTED');

  await admin.json('/api/admin/invitation-campaigns', { label: 'Too fast', count: 21, mode: 'INSTANT' }, 'POST', 400);
  const campaign = (await admin.json('/api/admin/invitation-campaigns', { label: 'Instant fixture', count: 2, mode: 'INSTANT' }, 'POST', 201)).campaign;
  const detail = await admin.json(`/api/admin/invitation-campaigns/${campaign.id}`);
  assert.equal(detail.invitations.length, 2);
  assert.equal(detail.invitations.some((item: any) => item.donor.public_id === donorRecords[0].public_id), false, 'previously invited donor excluded');
  const acceptedBeforeCampaign = accepted.length;
  await admin.json(`/api/admin/invitation-campaigns/${campaign.id}/start`, {});
  await waitFor(async () => accepted.length >= acceptedBeforeCampaign + 2, 'instant campaign dispatched');
  delivery.set(accepted.at(-2)!.id, 'sent');
  await waitFor(async () => (await admin.json(`/api/admin/invitation-campaigns/${campaign.id}`)).campaign.counts.sent === 1, 'sent receipt remains distinct from delivered');
  for (const item of accepted.slice(-2)) delivery.set(item.id, 'delivered');
  await waitFor(async () => (await admin.json(`/api/admin/invitation-campaigns/${campaign.id}`)).campaign.counts.delivered === 2, 'delivery receipts reconciled');
  const campaignInvitations = (await admin.json(`/api/admin/invitation-campaigns/${campaign.id}`)).invitations;
  const claimedId = campaignInvitations[0].donor.public_id;
  const claimed = (await findImportedDonorsByPublicIds([claimedId])).get(claimedId)!;
  claimed.claim_status = 'CLAIMED'; claimed.claimed_at = new Date().toISOString(); await replaceImportedDonor(toImportedDonorRow(claimed));
  await waitFor(async () => (await admin.json(`/api/admin/invitations?outcome=CLAIMED`)).invitations.some((item: any) => item.donor.public_id === claimedId), 'claim outcome reconciled');
  const removedId = campaignInvitations[1].donor.public_id;
  const removed = (await findImportedDonorsByPublicIds([removedId])).get(removedId)!;
  removed.listing_state = 'REMOVED'; removed.removed_at = new Date().toISOString(); await replaceImportedDonor(toImportedDonorRow(removed));
  await waitFor(async () => (await admin.json('/api/admin/invitations?outcome=REJECTED_REMOVED')).invitations.some((item: any) => item.donor?.public_id === removedId), 'removal outcome reconciled');

  const ramp = (await admin.json('/api/admin/invitation-campaigns', { label: 'Ramp fixture', count: 3, mode: 'RAMPED', pacing: { start_per_minute: 1, peak_per_minute: 4, end_per_minute: 1, ramp_up_minutes: 1, steady_minutes: 1, ramp_down_minutes: 1 } }, 'POST', 201)).campaign;
  await admin.json(`/api/admin/invitation-campaigns/${ramp.id}/start`, {});
  await admin.json(`/api/admin/invitation-campaigns/${ramp.id}/pause`, {});
  assert.equal((await admin.json(`/api/admin/invitation-campaigns/${ramp.id}`)).campaign.status, 'PAUSED');
  await admin.json(`/api/admin/invitation-campaigns/${ramp.id}/cancel`, {});
  assert.equal((await admin.json(`/api/admin/invitation-campaigns/${ramp.id}`)).campaign.status, 'CANCELED');
  const beforeResend = accepted.length;
  const resend = await admin.json('/api/admin/invitations/resend', { invitation_ids: campaignInvitations.map((item: any) => item.id) }, 'POST', 202);
  assert.equal(resend.queued, 0, '24-hour resend cooldown prevents immediate duplicate');
  assert.equal(accepted.length, beforeResend);

  const acceptedBeforeBulkResend = accepted.length;
  const bulkResend = await admin.json('/api/admin/invitations/resend', { filter: 'NO_RESPONSE', pacing: { start_per_minute: 1, peak_per_minute: 1, end_per_minute: 1, ramp_up_minutes: 0, steady_minutes: 1, ramp_down_minutes: 0 } }, 'POST', 202);
  assert.equal(bulkResend.queued, 21); assert.equal(bulkResend.mode, 'RAMPED');
  await waitFor(async () => accepted.length === acceptedBeforeBulkResend + 1, 'non-responder resend starts at the configured gentle pace');

  const storedCampaign = (await getAllFromTable('common_invitation_campaigns')).find((item: any) => item.id === campaign.id);
  assert.deepEqual(storedCampaign.invitation_ids.sort(), detail.invitations.map((item: any) => item.id).sort(), 'campaign target snapshot persisted');
  const acceptedBeforeRestart = accepted.length;
  child.kill('SIGTERM'); await once(child, 'exit'); child = spawnDrop();
  await waitFor(async () => { try { return (await fetch('http://127.0.0.1:18650/health')).ok; } catch { return false; } }, `restarted server ready: ${logs}`);
  const restartedAdmin = new Client('192.0.2.40'); await restartedAdmin.json('/api/admin/auth/login', { username: 'invitation-admin', password });
  const restoredCampaign = await restartedAdmin.json(`/api/admin/invitation-campaigns/${campaign.id}`);
  assert.equal(restoredCampaign.invitations.length, 2);
  assert.equal(accepted.length, acceptedBeforeRestart, 'restart does not duplicate accepted Messavo sends');
  console.log('PASS: invitation ledger, scopes, private intake, review, pacing, receipts, outcomes and resend safety');
} finally {
  child.kill('SIGTERM'); if (child.exitCode === null) await Promise.race([once(child, 'exit'), new Promise(resolve => setTimeout(resolve, 5_000))]);
  fakeSms.close(); await rm(directory, { recursive: true, force: true });
}
