import assert from 'node:assert/strict';
import test from 'node:test';
import { getSafeReturnTo } from './navigation';

test('safe return paths preserve an in-app search destination', () => {
  assert.equal(
    getSafeReturnTo('/directory?blood_group=O%2B&district=Dhaka', '/profile'),
    '/directory?blood_group=O%2B&district=Dhaka'
  );
});

test('unsafe and auth-loop return paths use the supplied fallback', () => {
  assert.equal(getSafeReturnTo('https://example.test', '/profile'), '/profile');
  assert.equal(getSafeReturnTo('//example.test', '/profile'), '/profile');
  assert.equal(getSafeReturnTo('/\\example.test', '/profile'), '/profile');
  assert.equal(getSafeReturnTo('/login?returnTo=/directory', '/profile'), '/profile');
});
