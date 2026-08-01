import assert from 'node:assert/strict';
import test from 'node:test';
import { CAN_DONATE_TO, COMPATIBLE_DONORS } from './blood';
import {
  donorCanSeeRequest,
  donorEligibility,
  matchesUpazilaSearch,
  rankDonorResults,
  type SearchableDonorProfile
} from './donorSearch';

const search = { compatibleGroups: ['A+', 'A-', 'O+', 'O-'], district: 'Dhaka', upazilas: ['Banani'] };

function profile(overrides: Partial<SearchableDonorProfile> = {}): SearchableDonorProfile {
  return {
    blood_group: 'O-',
    upazila: 'Banani',
    location: { area_name: 'Dhaka' },
    availability_status: 'AVAILABLE',
    availability_confirmed_at: new Date().toISOString(),
    ...overrides
  };
}

test('an upazila search matches on exact place, not on distance', () => {
  assert.equal(matchesUpazilaSearch(profile(), search), true);
  // Same district, different thana: not a match. There are no upazila
  // coordinates, so nothing here may fall back to "nearby".
  assert.equal(matchesUpazilaSearch(profile({ upazila: 'Gulshan' }), search), false);
  assert.equal(matchesUpazilaSearch(profile({ location: { area_name: 'Gazipur' } }), search), false);
  // Case and padding differences in stored data must still match.
  assert.equal(matchesUpazilaSearch(profile({ upazila: ' banani ' }), search), true);
  // A profile from before upazila search existed is not guessed at.
  assert.equal(matchesUpazilaSearch(profile({ upazila: undefined }), search), false);
});

test('unavailable, ineligible, and incompatible donors are excluded', () => {
  assert.equal(matchesUpazilaSearch(profile({ blood_group: 'B+' }), search), false);
  assert.equal(matchesUpazilaSearch(profile({ availability_status: 'TRAVELING' }), search), false);
  assert.equal(matchesUpazilaSearch(profile({ last_donation_date: new Date().toISOString() }), search), false);
  assert.equal(matchesUpazilaSearch(profile({ deferral_status: 'PERMANENT' }), search), false);
  // Availability that was never reconfirmed goes stale on its own.
  assert.equal(matchesUpazilaSearch(profile({ availability_confirmed_at: undefined }), search), false);
  assert.equal(donorEligibility({}).eligible, false);
  assert.equal(donorEligibility({ availability_confirmed_at: new Date().toISOString() }).eligible, true);
});

test('the donor feed runs the compatibility table in the opposite direction', () => {
  const request = { blood_group: 'A+', upazila: 'Banani', location: { area_name: 'Dhaka' } };
  // An O- donor can supply an A+ patient.
  assert.equal(donorCanSeeRequest(profile({ blood_group: 'O-' }), request), true);
  // An A+ donor cannot supply an O- patient, so that request is not their feed.
  assert.equal(
    donorCanSeeRequest(profile({ blood_group: 'A+' }), { ...request, blood_group: 'O-' }),
    false
  );
  assert.equal(donorCanSeeRequest(profile({ upazila: 'Gulshan' }), request), false);
  // A request published before upazila existed still reaches the district.
  assert.equal(
    donorCanSeeRequest(profile({ upazila: 'Gulshan' }), { ...request, upazila: undefined }),
    true
  );
});

test('the two compatibility tables are exact inverses', () => {
  for (const [donor, recipients] of Object.entries(CAN_DONATE_TO)) {
    for (const recipient of recipients) {
      assert.ok(
        COMPATIBLE_DONORS[recipient].includes(donor as never),
        `${donor} claims it can donate to ${recipient}, which does not accept it`
      );
    }
  }
});

test('results put registered members first and the exact group above a compatible one', () => {
  const ranked = rankDonorResults([
    { donor_kind: 'IMPORTED', blood_group: 'A+', name: 'Imported exact' },
    { donor_kind: 'REGISTERED', blood_group: 'O-', name: 'Registered compatible' },
    { donor_kind: 'IMPORTED', blood_group: 'O-', name: 'Imported compatible' },
    { donor_kind: 'REGISTERED', blood_group: 'A+', name: 'Registered exact' }
  ], 'A+');
  assert.deepEqual(ranked.map(donor => donor.name), [
    'Registered exact',
    'Registered compatible',
    'Imported exact',
    'Imported compatible'
  ]);
});
