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

test('unknown explicit providers fail closed', () => {
  assert.equal(getSmsProvider(environment({ NODE_ENV: 'development', SMS_PROVIDER: 'smtp' })), null);
});
