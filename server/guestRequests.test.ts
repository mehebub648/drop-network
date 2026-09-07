import test from 'node:test';
import assert from 'node:assert/strict';
import { newGuestToken, guestTokenHash, ownsGuestRequest, adoptGuestRequest, RequestWriteQueue, guestCanPublish, guestCanReveal, guestDeviceExpired, GUEST_IDLE_MS } from './guestRequests';
import { requestIsLive, type LifecycleRequest } from './requestLifecycle';

const token = newGuestToken();
const now = Date.parse('2026-09-04T12:00:00Z');
const request = { ownership: 'GUEST' as const, user_id: '', status: 'ACTIVE', needed_by: '2026-09-04T18:00:00Z', expires_at: '2026-09-04T18:00:00Z', guest_token_hash: guestTokenHash(token) };
test('guest limits count distinct numbers and expire only unclaimed inactive identities', () => {
  const device = { id: 'fixture', created_at: new Date(now).toISOString(), last_seen_at: new Date(now).toISOString(), request_count: 2 };
  assert.equal(guestCanPublish(device), true);
  assert.equal(guestCanPublish({ ...device, request_count: 3 }), false);
  const reports = ['a', 'b', 'a', 'c'].map(donor_ref => ({ kind: 'REVEAL', donor_ref }));
  assert.equal(guestCanReveal('a', reports), true);
  assert.equal(guestCanReveal('d', reports), false);
  assert.equal(guestDeviceExpired(device, now + GUEST_IDLE_MS - 1), false);
  assert.equal(guestDeviceExpired(device, now + GUEST_IDLE_MS), true);
  assert.equal(guestDeviceExpired({ ...device, user_id: 'member' }, now + GUEST_IDLE_MS), false);
});
test('only the secret device credential grants unexpired guest management', () => {
  assert.equal(ownsGuestRequest(request, token, now), true);
  for (const wrong of ['', 'fingerprint-known-to-client', newGuestToken()]) assert.equal(ownsGuestRequest(request, wrong, now), false);
  assert.equal(ownsGuestRequest(request, token, Date.parse(request.expires_at)), false);
  assert.equal(ownsGuestRequest({ ...request, expires_at: 'invalid' }, token, now), false);
});
test('adoption removes the credential and cannot be replayed or stolen', () => {
  const adopted = adoptGuestRequest(request, token, 'member', now)!;
  assert.equal(adopted.user_id, 'member');
  assert.equal(adopted.expires_at, '2026-10-04T18:00:00.000Z');
  assert.equal('guest_token_hash' in adopted, false);
  assert.equal(ownsGuestRequest(adopted, token, now), false);
  assert.equal(adoptGuestRequest(adopted, token, 'attacker', now), null);
  assert.equal(adoptGuestRequest(request, token, 'member', Date.parse(request.expires_at)), null);
});
test('failed writes release the queue and concurrent ownership writes serialize', async () => {
  const queue = new RequestWriteQueue();
  const order: number[] = [];
  await Promise.allSettled([
    queue.run(async () => { order.push(1); await Promise.resolve(); order.push(2); throw new Error('disk'); }),
    queue.run(async () => { order.push(3); })
  ]);
  assert.deepEqual(order, [1, 2, 3]);
});

test('adoption racing expiry either persists one owner or leaves the request expired', async () => {
  const deadline = Date.parse(request.expires_at);
  for (const adoptionFirst of [true, false]) {
    const queue = new RequestWriteQueue();
    let current: LifecycleRequest | null = { ...request };
    const adopt = () => queue.run(async () => {
      if (!current) return;
      const next = adoptGuestRequest(current, token, 'member', adoptionFirst ? deadline - 1 : deadline);
      if (next) { await Promise.resolve(); current = next; }
    });
    const expire = () => queue.run(async () => {
      if (current?.ownership === 'GUEST' && !requestIsLive(current, deadline)) current = null;
    });
    await Promise.all(adoptionFirst ? [adopt(), expire(), adopt()] : [expire(), adopt(), adopt()]);
    if (adoptionFirst) {
      assert.equal(current?.ownership, 'USER');
      assert.equal(current?.user_id, 'member');
      assert.equal(ownsGuestRequest(current!, token, deadline), false);
    } else assert.equal(current, null);
  }
});
