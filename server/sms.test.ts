import assert from 'node:assert/strict';
import test from 'node:test';
import { getSmsProvider, isSmsConfigured, type SmsEnvironment } from './sms';

function environment(values: SmsEnvironment): SmsEnvironment {
  return values;
}

test('blank provider falls back to console outside production', () => {
  assert.equal(getSmsProvider(environment({ NODE_ENV: 'development' }))?.name, 'console');
  assert.equal(getSmsProvider(environment({ NODE_ENV: 'test', SMS_PROVIDER: '  ' }))?.name, 'console');
  assert.equal(isSmsConfigured(environment({ NODE_ENV: 'development' })), true);
});

test('production never falls back to console', () => {
  assert.equal(getSmsProvider(environment({ NODE_ENV: 'production' })), null);
  assert.equal(getSmsProvider(environment({ NODE_ENV: 'production', SMS_PROVIDER: 'console' })), null);
  assert.equal(isSmsConfigured(environment({ NODE_ENV: 'production' })), false);
});

test('an explicitly selected incomplete HTTP provider fails closed', () => {
  assert.equal(getSmsProvider(environment({ NODE_ENV: 'development', SMS_PROVIDER: 'http' })), null);
  assert.equal(getSmsProvider(environment({
    NODE_ENV: 'development',
    SMS_PROVIDER: 'http',
    SMS_HTTP_ENDPOINT: 'https://sms.example.test/send'
  })), null);
  assert.equal(getSmsProvider(environment({
    NODE_ENV: 'development',
    SMS_PROVIDER: 'http',
    SMS_HTTP_TOKEN: 'token'
  })), null);
});

test('a complete HTTP provider resolves in every environment', () => {
  const configured = environment({
    NODE_ENV: 'production',
    SMS_PROVIDER: 'http',
    SMS_HTTP_ENDPOINT: 'https://sms.example.test/send',
    SMS_HTTP_TOKEN: 'token'
  });
  assert.equal(getSmsProvider(configured)?.name, 'http');
  assert.equal(isSmsConfigured(configured), true);
});

test('an explicitly selected incomplete Woven provider fails closed', () => {
  assert.equal(getSmsProvider(environment({ NODE_ENV: 'production', SMS_PROVIDER: 'woven' })), null);
  assert.equal(getSmsProvider(environment({
    NODE_ENV: 'production',
    SMS_PROVIDER: 'woven',
    SMS_API_BASE_URL: 'https://woven.example.test'
  })), null);
  assert.equal(getSmsProvider(environment({
    NODE_ENV: 'production',
    SMS_PROVIDER: 'woven',
    SMS_API_TOKEN: 'wvi_secret'
  })), null);
  assert.equal(getSmsProvider(environment({
    NODE_ENV: 'production',
    SMS_PROVIDER: 'woven',
    SMS_API_BASE_URL: 'not a URL',
    SMS_API_TOKEN: 'wvi_secret'
  })), null);
});

test('Woven provider builds the v1 endpoint and maps the OTP request contract', async () => {
  const originalFetch = globalThis.fetch;
  let request: { url?: string; init?: RequestInit } = {};
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), init };
    return new Response(JSON.stringify({ id: 'message-id', status: 'pending_approval', replayed: false }), {
      status: 202,
      headers: { 'content-type': 'application/json' }
    });
  };

  try {
    const provider = getSmsProvider(environment({
      NODE_ENV: 'production',
      SMS_PROVIDER: 'woven',
      SMS_API_BASE_URL: 'https://woven.example.test/',
      SMS_API_TOKEN: 'wvi_secret'
    }));
    assert.ok(provider);
    assert.equal(provider.name, 'woven');
    await provider.sendOtp('+8801712345678', '123456');
    assert.equal(request.url, 'https://woven.example.test/api/v1/messages');
    assert.equal(request.init?.method, 'POST');
    assert.deepEqual(request.init?.headers, {
      'content-type': 'application/json',
      authorization: 'Bearer wvi_secret'
    });
    assert.deepEqual(JSON.parse(String(request.init?.body)), {
      to: '+8801712345678',
      message: 'Your Drop verification code is 123456. It expires in 10 minutes.'
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Woven provider rejects a response that was not queued for approval', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 401 });

  try {
    const provider = getSmsProvider(environment({
      NODE_ENV: 'production',
      SMS_PROVIDER: 'woven',
      SMS_API_BASE_URL: 'https://woven.example.test',
      SMS_API_TOKEN: 'wvi_secret'
    }));
    assert.ok(provider);
    await assert.rejects(provider.sendOtp('+8801712345678', '123456'), /returned 401/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('unknown explicit providers fail closed', () => {
  assert.equal(getSmsProvider(environment({ NODE_ENV: 'development', SMS_PROVIDER: 'smtp' })), null);
});
