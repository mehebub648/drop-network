import assert from 'node:assert/strict';
import test from 'node:test';
import { createRankedMessavoProvider, getFollowUpSmsProvider, getSmsProvider, isSmsConfigured, mapMessavoState, smsOutageReason, SmsProviderError, type SmsEnvironment } from './sms';

function environment(values: SmsEnvironment): SmsEnvironment {
  return values;
}

test('only confirmed service and sender failures qualify for blood-help access', () => {
  for (const code of ['device_offline', 'active_sync_device_required', 'subscription_unavailable', 'device_disconnected', 'device_disconnected_while_sending', 'radio_off', 'no_service']) {
    assert.equal(smsOutageReason(409, code), 'SENDER_UNAVAILABLE');
    assert.equal(smsOutageReason(0, code), 'SENDER_UNAVAILABLE');
  }
  for (const code of ['invalid_request', 'invalid_number', 'recipient_opted_out', 'sms_error_1', 'integration_canceled', 'device_unknown']) {
    assert.equal(smsOutageReason(409, code), undefined);
    assert.equal(smsOutageReason(0, code), undefined);
  }
  for (const status of [400, 404, 408, 422, 429]) assert.equal(smsOutageReason(status, 'device_offline'), undefined);
  assert.equal(smsOutageReason(503), 'SERVICE_UNAVAILABLE');
  assert.equal(smsOutageReason(401), 'PROVIDER_CONFIGURATION');
  assert.equal(smsOutageReason(403), 'PROVIDER_CONFIGURATION');
});

test('Messavo preserves transport and sender evidence while retaining its status interface', async () => {
  const original = globalThis.fetch;
  const provider = getSmsProvider({ SMS_PROVIDER: 'messavo', SMS_API_BASE_URL: 'https://sms.example.test', SMS_API_TOKEN: 'fixture' })!;
  try {
    globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
    await assert.rejects(provider.sendOtp('+8801700000001', '123456', 'test'), (error: unknown) => error instanceof SmsProviderError && error.outageReason === 'SERVICE_UNAVAILABLE');
    globalThis.fetch = async () => Response.json({ error: 'device_offline' }, { status: 409 });
    await assert.rejects(provider.sendOtp('+8801700000001', '123456', 'test'), (error: unknown) => error instanceof SmsProviderError && error.outageReason === 'SENDER_UNAVAILABLE');
    globalThis.fetch = async () => Response.json({ message: { status: 'failed', error: 'radio_off' } });
    assert.deepEqual(await provider.getDelivery!('job'), { status: 'failed', outageReason: 'SENDER_UNAVAILABLE' });
    assert.equal(await provider.getStatus!('job'), 'failed');
    for (const status of ['ready', 'sent', 'delivered', 'canceled']) {
      globalThis.fetch = async () => Response.json({ message: { status, error: 'radio_off' } });
      assert.equal((await provider.getDelivery!('job')).outageReason, undefined);
    }
    globalThis.fetch = async () => Response.json({ message: { status: 'failed', error: 'sms_error_1' } });
    assert.equal((await provider.getDelivery!('job')).outageReason, undefined);
  } finally { globalThis.fetch = original; }
});

test('ranked Messavo falls back only after a definitive rejection and keeps receipt affinity', async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  const attempts: Array<{ providerId: string; outcome: string }> = [];
  const provider = createRankedMessavoProvider([
    { id: 'primary', baseUrl: 'https://primary.example.test', token: 'one', priority: 1 },
    { id: 'backup', baseUrl: 'https://backup.example.test', token: 'two', priority: 2 }
  ], event => { attempts.push({ providerId: event.providerId, outcome: event.outcome }); })!;
  try {
    globalThis.fetch = async input => {
      const url = String(input); calls.push(url);
      if (url.includes('primary')) return Response.json({ error: 'unavailable' }, { status: 503 });
      if (url.endsWith('/api/v1/messages')) return Response.json({ id: 'backup-job', status: 'sent' }, { status: 202 });
      return Response.json({ message: { status: 'delivered' } });
    };
    const sent = await provider.sendOtp('+8801700000001', '123456', 'ranked');
    assert.equal(sent.providerId, 'backup');
    assert.equal(calls.length, 2);
    assert.deepEqual(attempts, [
      { providerId: 'primary', outcome: 'ATTEMPTED' }, { providerId: 'primary', outcome: 'FAILED' },
      { providerId: 'backup', outcome: 'ATTEMPTED' }, { providerId: 'backup', outcome: 'SUCCEEDED' }
    ]);
    assert.equal((await provider.getDelivery!(sent.jobId!)).status, 'delivered');
    assert.equal(calls.at(-1)?.includes('backup.example.test'), true);

    calls.length = 0;
    attempts.length = 0;
    globalThis.fetch = async input => { calls.push(String(input)); throw new TypeError('connection lost'); };
    await assert.rejects(provider.sendOtp('+8801700000001', '123456', 'ambiguous'));
    assert.equal(calls.length, 1);
    assert.deepEqual(attempts, [{ providerId: 'primary', outcome: 'ATTEMPTED' }, { providerId: 'primary', outcome: 'FAILED' }]);
  } finally { globalThis.fetch = original; }
});

test('blank, console, and unknown providers fail closed', () => {
  assert.equal(getSmsProvider(environment({ NODE_ENV: 'development' })), null);
  assert.equal(getSmsProvider(environment({ NODE_ENV: 'production', SMS_PROVIDER: 'console' })), null);
  assert.equal(getSmsProvider(environment({ SMS_PROVIDER: 'smtp' })), null);
});

test('a complete provider-neutral HTTP adapter remains supported', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 204 });
  try {
    const provider = getSmsProvider(environment({
      SMS_PROVIDER: 'http',
      SMS_HTTP_ENDPOINT: 'https://sms.example.test/send',
      SMS_HTTP_TOKEN: 'token'
    }));
    assert.equal(provider?.name, 'http');
    assert.equal(isSmsConfigured(environment({
      SMS_PROVIDER: 'http',
      SMS_HTTP_ENDPOINT: 'https://sms.example.test/send',
      SMS_HTTP_TOKEN: 'token'
    })), true);
    assert.deepEqual(await provider?.sendOtp('+8801712345678', '123456', 'drop-otp:test'), { status: 'sent' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('incomplete or invalid Messavo configuration fails closed', () => {
  assert.equal(getSmsProvider(environment({ SMS_PROVIDER: 'messavo' })), null);
  assert.equal(getSmsProvider(environment({ SMS_PROVIDER: 'messavo', SMS_API_BASE_URL: 'not a URL', SMS_API_TOKEN: 'secret' })), null);
});

test('Messavo sends with stable idempotency and supports status and cancellation', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });
    if (!init?.method) return Response.json({ message: { status: 'delivered' } });
    return Response.json({ id: '3be02b6c-3474-4f76-9fa8-dde7b7815345', status: 'ready', replayed: false }, { status: 202 });
  };

  try {
    const provider = getSmsProvider(environment({
      NODE_ENV: 'production',
      SMS_PROVIDER: 'messavo',
      SMS_API_BASE_URL: 'https://messavo.example.test/',
      SMS_API_TOKEN: 'private-test-token'
    }));
    assert.ok(provider);
    assert.equal(provider.name, 'messavo');
    assert.deepEqual(await provider.sendOtp('+8801712345678', '123456', 'drop-otp:stable-id'), {
      jobId: '3be02b6c-3474-4f76-9fa8-dde7b7815345',
      status: 'queued'
    });
    assert.equal(requests[0].url, 'https://messavo.example.test/api/v1/messages');
    assert.equal((requests[0].init?.headers as Record<string, string>)['idempotency-key'], 'drop-otp:stable-id');
    assert.equal(await provider.getStatus?.('3be02b6c-3474-4f76-9fa8-dde7b7815345'), 'delivered');
    assert.equal(await provider.cancel?.('3be02b6c-3474-4f76-9fa8-dde7b7815345'), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('the woven name is a compatibility alias and an unexpected manual approval is rejected', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    id: '3be02b6c-3474-4f76-9fa8-dde7b7815345',
    status: 'pending_approval',
    replayed: false
  }, { status: 202 });
  try {
    const provider = getSmsProvider(environment({
      SMS_PROVIDER: 'woven',
      SMS_API_BASE_URL: 'https://messavo.example.test',
      SMS_API_TOKEN: 'private-test-token'
    }));
    assert.ok(provider);
    assert.equal(provider?.name, 'messavo');
    await assert.rejects(provider.sendOtp('+8801712345678', '123456', 'drop-otp:manual-key'), /did not queue/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Messavo states map to public delivery states without exposing provider detail', () => {
  assert.equal(mapMessavoState('ready'), 'queued');
  assert.equal(mapMessavoState('leased'), 'queued');
  assert.equal(mapMessavoState('sent'), 'sent');
  assert.equal(mapMessavoState('delivered'), 'delivered');
  assert.equal(mapMessavoState('failed'), 'failed');
  assert.equal(mapMessavoState('pending_approval'), null);
});

test('follow-up delivery requires and uses its separate credential', async () => {
  const originalFetch = globalThis.fetch;
  let authorization = '';
  globalThis.fetch = async (_input, init) => {
    authorization = (init?.headers as Record<string, string>).authorization;
    return Response.json({ id: '3be02b6c-3474-4f76-9fa8-dde7b7815345', status: 'ready' }, { status: 202 });
  };
  try {
    const values = environment({ SMS_PROVIDER: 'messavo', SMS_API_BASE_URL: 'https://messavo.example.test', SMS_API_TOKEN: 'otp-token' });
    assert.equal(getFollowUpSmsProvider(values), null);
    const provider = getFollowUpSmsProvider({ ...values, SMS_FOLLOWUP_API_TOKEN: 'follow-up-token' });
    await provider?.sendMessage('+8801712345678', 'Privacy-safe follow-up', 'drop-follow-up:stable');
    assert.equal(authorization, 'Bearer follow-up-token');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
