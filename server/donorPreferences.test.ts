import assert from 'node:assert/strict';
import test from 'node:test';
import { listRegisteredFacilities, parseDonorPreferences } from './donorPreferences';

test('donor preferences validate bounds and canonical registered facilities', async () => {
  const result = await parseDonorPreferences({
    preferred_areas: [{ district: 'Dhaka', upazila: 'Banani' }],
    preferred_facilities: [{ registry_code: '10029843', name: 'ignored client label', district: 'Dhaka', locality: 'ignored' }],
    travel_willingness: 'PREFERRED_AREAS',
    contact_windows: [{ days: [1, 3, 5], start_time: '09:00', end_time: '17:30' }],
    private_coordination_note: 'Call after work.'
  }, undefined);
  assert.ok('value' in result);
  if ('value' in result) {
    assert.equal(result.value.preferred_facilities?.[0]?.name, 'Banani Clinic');
    assert.equal(result.value.preferred_areas?.[0]?.upazila, 'Banani');
  }
});

test('donor preferences reject forged facilities and invalid windows', async () => {
  assert.ok('error' in await parseDonorPreferences({
    preferred_facilities: [{ registry_code: 'not-registered', district: 'Dhaka' }]
  }, undefined));
  assert.ok('error' in await parseDonorPreferences({
    contact_windows: [{ days: [], start_time: '09:00', end_time: '09:00' }]
  }, undefined));
});

test('lists canonical registered facilities for native and browser discovery', async () => {
  const facilities = await listRegisteredFacilities('Meherpur');
  assert.ok(facilities.length > 0);
  assert.equal(facilities[0]?.district, 'Meherpur');
  assert.ok(facilities.every(item => item.registry_code && item.name && item.registry_codes.length > 0));
  assert.deepEqual(await listRegisteredFacilities('Not a district'), []);
});
