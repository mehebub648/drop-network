import assert from 'node:assert/strict';
import test from 'node:test';
import { countImportedDonorsForLocation, countRegisteredDonorsForLocation, isSearchableRegisteredDonor } from './locationDonorCounts';
import type { SearchableDonorProfile } from './donorSearch';

const now = Date.parse('2026-10-19T12:00:00.000Z');
type CountProfile = SearchableDonorProfile & { contact_suspended_at?: string };
const available = (overrides: Partial<CountProfile> = {}): CountProfile => ({
  blood_group: 'B+',
  location: { area_name: 'Dhaka' },
  upazila: 'Savar',
  availability_status: 'AVAILABLE',
  availability_confirmed_at: '2026-10-18T12:00:00.000Z',
  deferral_status: 'NONE',
  travel_willingness: 'HOME_ONLY',
  ...overrides
});

test('registered location counts use exact group, eligibility and unique donor matches', () => {
  const donors = [
    { is_verified: false, donor_profile: available() },
    { donor_profile: available({ preferred_areas: [{ district: 'Dhaka', upazila: 'Dhamrai' }], travel_willingness: 'PREFERRED_AREAS' }) },
    { donor_profile: available({ blood_group: 'O+' }) },
    { account_status: 'SUSPENDED', donor_profile: available() },
    { donor_profile: available({ availability_status: 'NOT_AVAILABLE' }) },
    { donor_profile: available({ contact_suspended_at: '2026-10-18T12:00:00.000Z' }) }
  ];

  assert.equal(countRegisteredDonorsForLocation(donors, 'B+', 'Dhaka', ['Savar', 'Dhamrai'], now), 2,
    'an unverified but opted-in and eligible donor is still a real searchable donor');
  assert.equal(countRegisteredDonorsForLocation(donors, 'B+', 'Dhaka', ['Dhamrai'], now), 1);
  assert.equal(countRegisteredDonorsForLocation(donors, 'O+', 'Dhaka', ['Savar'], now), 1);
});

test('verification never controls donor search eligibility', () => {
  assert.equal(isSearchableRegisteredDonor({ is_verified: false, donor_profile: available() }), true);
  assert.equal(isSearchableRegisteredDonor({ account_status: 'SUSPENDED', donor_profile: available() }), false);
  assert.equal(isSearchableRegisteredDonor({ deleted_at: '2026-10-19T00:00:00.000Z', donor_profile: available() }), false);
  assert.equal(isSearchableRegisteredDonor({ donor_profile: available({ contact_suspended_at: '2026-10-19T00:00:00.000Z' }) }), false);
});

test('the review-only password account never appears as a public donor', () => {
  const reviewer = { phone: '+8801000000046', is_verified: true, donor_profile: available() };
  assert.equal(isSearchableRegisteredDonor(reviewer), false);
  assert.equal(countRegisteredDonorsForLocation([reviewer], 'B+', 'Dhaka', ['Savar'], now), 0);
});

test('imported counts match canonical districts and stored upazila variants', () => {
  const counts = {
    districts: { Dhaka: 4, Rajshahi: 2 },
    upazilas: { Dhaka: { 'Chalk Bazar': 2, 'Chackbazar Model': 1, Savar: 1 }, Rajshahi: { Bagha: 2 } }
  };
  assert.equal(countImportedDonorsForLocation(counts, 'dhaka'), 4);
  assert.equal(countImportedDonorsForLocation(counts, 'Dhaka', ['Chackbazar Model', 'Chalk Bazar']), 3);
  assert.equal(countImportedDonorsForLocation(counts, 'Dhaka', ['Dhamrai']), 0);
});
