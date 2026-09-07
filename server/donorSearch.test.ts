import assert from 'node:assert/strict';
import test from 'node:test';
import { CAN_DONATE_TO, COMPATIBLE_DONORS } from './blood';
import {
  donorCanSeeRequest,
  donorEligibility,
  donorPreferenceMatch,
  matchesPreferenceSearch,
  matchesUpazilaSearch,
  rankDonorResults,
  type SearchableDonorProfile
} from './donorSearch';

const search = { compatibleGroups: ['A+', 'A-', 'O+', 'O-'], district: 'Dhaka', upazilas: ['Banani'] };
test('availability, registration, facility match and profile completeness determine priority', () => {
  const base = { donor_kind: 'REGISTERED' as const, blood_group: 'B+', name: 'Named donor' };
  const ordered = [
    { ...base, donor_ref: 'full', ranking: { facility_match: true, profile_complete: true } },
    { ...base, donor_ref: 'facility-name', ranking: { facility_match: true } },
    { ...base, donor_ref: 'facility', name: '', ranking: { facility_match: true } },
    { ...base, donor_ref: 'member' },
    { ...base, donor_ref: 'directory', donor_kind: 'IMPORTED' as const },
    { ...base, donor_ref: 'unavailable', availability_status: 'NOT_AVAILABLE', ranking: { facility_match: true, profile_complete: true } },
  ];
  assert.deepEqual(rankDonorResults([...ordered].reverse(), 'B+').map(item => item.donor_ref), ordered.map(item => item.donor_ref));
  assert.equal(matchesPreferenceSearch(profile({ availability_status: undefined, availability_confirmed_at: undefined }), search), true);
  assert.equal(matchesPreferenceSearch(profile({ deferral_status: 'PERMANENT' }), search), false);
});

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

test('preferred travel areas do not bypass the selected upazila', () => {
  assert.equal(matchesPreferenceSearch(profile({
    upazila: 'Gulshan',
    preferred_areas: [{ district: 'Dhaka', upazila: 'Banani' }],
    travel_willingness: 'PREFERRED_AREAS'
  }), search), false);
  assert.equal(matchesPreferenceSearch(profile({
    upazila: 'Gulshan',
    travel_willingness: 'ANYWHERE_IN_DISTRICT'
  }), search), false);
  assert.equal(matchesPreferenceSearch(profile({
    upazila: 'Gulshan',
    travel_willingness: 'HOME_ONLY'
  }), search), false);
});

test('preference reasons expose the match, not the private preference data', () => {
  const match = donorPreferenceMatch(profile({
    preferred_facilities: [{ registry_code: '100', name: 'Example Hospital', district: 'Dhaka', locality: 'Banani' }],
    contact_windows: [{ days: [4], start_time: '09:00', end_time: '18:00' }]
  }), {
    district: 'Dhaka',
    upazilas: ['Banani'],
    facilityCode: '100'
  }, new Date('2026-08-27T06:00:00.000Z'));
  assert.deepEqual(match.reasons, ['Home upazila', 'Preferred collection facility', 'Usually reachable around this time']);
  assert.equal(match.score, 9);
});

test('facility preference matching accepts canonical aliases from older registry rows', () => {
  const match = donorPreferenceMatch(profile({
    preferred_facilities: [{ registry_code: '10017223', name: 'East West Medical College', district: 'Dhaka', locality: 'Turag' }]
  }), {
    district: 'Dhaka',
    upazilas: ['Banani'],
    facilityCode: '10028939',
    facilityName: 'EAST-WEST MEDICAL COLLEGE & HOSPITAL LIMITED'
  });
  assert.ok(match.reasons.includes('Preferred collection facility'));
});

test('every public sort is deterministic and keeps verified registered donors above imports', () => {
  const donors = [
    { donor_ref: 'imp:1', donor_kind: 'IMPORTED' as const, blood_group: 'A+', name: 'A Imported', is_exact_group: true, ranking: { donation_total: 99, location_match_score: 9 } },
    { donor_ref: 'reg:2', donor_kind: 'REGISTERED' as const, blood_group: 'O-', name: 'B Registered', is_verified: true, is_exact_group: false, ranking: { donation_total: 2, location_match_score: 1, contact_issue_total: 2 } },
    { donor_ref: 'reg:1', donor_kind: 'REGISTERED' as const, blood_group: 'A+', name: 'A Registered', is_verified: true, is_exact_group: true, ranking: { donation_total: 1, location_match_score: 4, contact_issue_total: 0 } }
  ];
  for (const sort of ['recommended', 'recently_confirmed', 'best_location', 'most_donations', 'fewest_contact_issues', 'name'] as const) {
    const ranked = rankDonorResults(donors, 'A+', sort);
    assert.equal(ranked.at(-1)?.donor_kind, 'IMPORTED', `${sort} moved an import above verified members`);
    assert.deepEqual(rankDonorResults(donors, 'A+', sort), ranked, `${sort} changed between identical calls`);
  }
});

test('seeded ordering randomizes only exact ties and remains stable for pagination', () => {
  const donors = Array.from({ length: 12 }, (_, index) => ({
    donor_ref: `reg:${index}`,
    donor_kind: 'REGISTERED' as const,
    blood_group: 'A+',
    name: `Donor ${String(index).padStart(2, '0')}`,
    is_verified: true,
    ranking: { location_match_score: 4, contact_issue_total: 0, donation_total: 1, availability_confirmed_at: '2026-08-01T00:00:00.000Z' }
  }));
  const first = rankDonorResults(donors, 'A+', 'recommended', 'stable-seed-one');
  const repeat = rankDonorResults(donors, 'A+', 'recommended', 'stable-seed-one');
  const different = rankDonorResults(donors, 'A+', 'recommended', 'stable-seed-two');
  assert.deepEqual(first.map(item => item.donor_ref), repeat.map(item => item.donor_ref));
  assert.notDeepEqual(first.map(item => item.donor_ref), different.map(item => item.donor_ref));
  assert.equal(new Set(first.map(item => item.donor_ref)).size, donors.length);
  assert.deepEqual(first.slice(0, 5).concat(first.slice(5)).map(item => item.donor_ref), first.map(item => item.donor_ref));
});
