import type { ImportedDonorLocationCounts } from './db';
import { matchesPreferenceSearch, type SearchableDonorProfile } from './donorSearch';

export type CountableRegisteredDonor = {
  is_verified?: boolean;
  account_status?: string;
  deleted_at?: string;
  donor_profile?: SearchableDonorProfile & { contact_suspended_at?: string };
};

const normalized = (value: string) => value.trim().toLocaleLowerCase('en-US');

/** Verification is a trust signal, not a condition for being a donor. */
export function isSearchableRegisteredDonor(donor: CountableRegisteredDonor) {
  return Boolean(donor.donor_profile) &&
    donor.account_status !== 'SUSPENDED' &&
    !donor.deleted_at &&
    !donor.donor_profile?.contact_suspended_at;
}

/** Counts each registered donor once for the requested location. */
export function countRegisteredDonorsForLocation(
  donors: CountableRegisteredDonor[],
  bloodGroup: string,
  district: string,
  upazilas: string[],
  now = Date.now()
) {
  return donors.filter(donor =>
    isSearchableRegisteredDonor(donor) &&
    matchesPreferenceSearch(donor.donor_profile, {
      compatibleGroups: [bloodGroup],
      district,
      upazilas
    }, now)
  ).length;
}

export function countImportedDonorsForLocation(
  counts: ImportedDonorLocationCounts,
  district: string,
  upazilas?: string[]
) {
  const districtKey = Object.keys(counts.districts).find(value => normalized(value) === normalized(district));
  if (!districtKey) return 0;
  if (!upazilas) return counts.districts[districtKey] || 0;
  const requested = new Set(upazilas.map(normalized));
  return Object.entries(counts.upazilas[districtKey] || {}).reduce(
    (total, [upazila, count]) => total + (requested.has(normalized(upazila)) ? count : 0),
    0
  );
}
