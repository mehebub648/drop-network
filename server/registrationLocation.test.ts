import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveRegistrationLocation } from './registrationLocation';

test('native registration resolves a canonical district on the server', () => {
  assert.deepEqual(
    resolveRegistrationLocation(undefined, 'Dhaka', () => null),
    { area_name: 'Dhaka', lat: 23.8103, lng: 90.4125 }
  );
});

test('legacy browser registration keeps its supplied location contract', () => {
  const supplied = { area_name: 'Dhaka', lat: 23.8, lng: 90.4 };
  assert.equal(
    resolveRegistrationLocation(supplied, 'Rangpur', value => value === supplied ? supplied : null),
    supplied
  );
});

test('registration rejects unknown districts and malformed inputs', () => {
  assert.equal(resolveRegistrationLocation(undefined, 'Atlantis', () => null), null);
  assert.equal(resolveRegistrationLocation(undefined, 123, () => null), undefined);
});
