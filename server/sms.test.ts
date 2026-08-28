import assert from 'node:assert/strict';
import test from 'node:test';
import { getFollowUpSmsProvider, getSmsProvider, isSmsConfigured, mapMessavoState, type SmsEnvironment } from './sms';

function environment(values: SmsEnvironment): SmsEnvironment {
  return values;
}

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
