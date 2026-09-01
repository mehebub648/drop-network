import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldExposeRequestContacts } from './requestVisibility';

test('active request contacts are public for urgent coordination', () => {
  assert.equal(shouldExposeRequestContacts('ACTIVE'), true);
  assert.equal(shouldExposeRequestContacts('PARTIALLY_FULFILLED'), true);
});

test('closed request contacts stop being public', () => {
  assert.equal(shouldExposeRequestContacts('FULFILLED'), false);
  assert.equal(shouldExposeRequestContacts('CANCELLED'), false);
  assert.equal(shouldExposeRequestContacts('EXPIRED'), false);
});

test('owners and accepted participants retain purpose-limited access', () => {
  assert.equal(shouldExposeRequestContacts('FULFILLED', true), true);
});
