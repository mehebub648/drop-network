// Rules for deciding who a blood request can reach, kept as pure functions so
// they can be tested without an HTTP server or a datastore.
//
// Requesters search by district and upazila. Upazilas have no coordinates in
// this project, so matching is string equality against the canonical spelling
// in `server/upazilas.ts` - there is no radius and none should be invented.

import { canDonateTo, compatibleDonorsFor, type BloodGroup } from './blood';

export const DONATION_INTERVAL_DAYS = Math.max(1, Number(process.env.DONATION_INTERVAL_DAYS || 120));
export const AVAILABILITY_TTL_DAYS = Math.max(1, Number(process.env.AVAILABILITY_TTL_DAYS || 14));

export type EligibilityProfile = {
  last_donation_date?: string;
  availability_confirmed_at?: string;
  deferral_status?: 'NONE' | 'TEMPORARY' | 'PERMANENT';
  deferred_until?: string;
};

/**
 * Whether a donor may currently be offered to a requester. Deliberately does
 * not consider self-declared age or weight: that would imply a medical screen
 * this project does not perform, and the collection facility decides.
 */
export function donorEligibility(profile: EligibilityProfile, now = Date.now()) {
  if (profile.deferral_status === 'PERMANENT') return { eligible: false, reason: 'Permanently deferred' };
  if (profile.deferral_status === 'TEMPORARY') {
    const until = profile.deferred_until ? new Date(profile.deferred_until).getTime() : Number.POSITIVE_INFINITY;
    if (until > now) return { eligible: false, reason: 'Temporarily deferred' };
  }
  if (profile.last_donation_date) {
    const next = new Date(profile.last_donation_date).getTime() + DONATION_INTERVAL_DAYS * 86_400_000;
    if (next > now) return { eligible: false, reason: 'Donation interval not complete' };
  }
  const confirmed = profile.availability_confirmed_at ? new Date(profile.availability_confirmed_at).getTime() : 0;
  if (confirmed + AVAILABILITY_TTL_DAYS * 86_400_000 < now) {
    return { eligible: false, reason: 'Availability confirmation expired' };
  }
  return { eligible: true, reason: null };
}

export type SearchableDonorProfile = EligibilityProfile & {
  blood_group: string;
  upazila?: string;
  location: { area_name: string };
  availability_status: string;
};

export type UpazilaSearch = {
  /** Every donor group medically compatible with the patient's group. */
  compatibleGroups: string[];
  district: string;
  /** Canonical upazila value, plus any other spelling of the same place. */
  upazilas: string[];
};

function sameText(a: string | undefined, b: string | undefined) {
  return Boolean(a) && Boolean(b) && a!.trim().toLowerCase() === b!.trim().toLowerCase();
}

/**
 * A registered donor is offered when their group is compatible, they are in the
 * searched upazila, and they are currently available and eligible.
 *
 * A profile with no upazila does not match. Those donors registered before
 * upazila search existed; guessing that a district centroid means a particular
 * upazila would put a stranger's phone number in front of a requester on the
 * strength of an assumption.
 */
export function matchesUpazilaSearch(profile: SearchableDonorProfile | undefined, search: UpazilaSearch, now = Date.now()) {
  if (!profile) return false;
  if (!search.compatibleGroups.includes(profile.blood_group)) return false;
  if (!sameText(profile.location?.area_name, search.district)) return false;
  if (!profile.upazila) return false;
  if (!search.upazilas.some(value => sameText(profile.upazila, value))) return false;
  if (profile.availability_status !== 'AVAILABLE') return false;
  return donorEligibility(profile, now).eligible;
}

/**
 * The donor-side view of the same relationship, which runs in the opposite
 * direction: the requester needs a group, and the donor asks whether their own
 * group can supply it.
 *
 * Requests published before upazila existed fall back to the district, so they
 * do not silently vanish from every donor's feed.
 */
export function donorCanSeeRequest(
  profile: Pick<SearchableDonorProfile, 'blood_group' | 'upazila' | 'location'> | undefined,
  request: { blood_group: string; upazila?: string; location: { area_name: string } }
) {
  if (!profile) return false;
  if (!canDonateTo(profile.blood_group).includes(request.blood_group as BloodGroup)) return false;
  if (!sameText(profile.location?.area_name, request.location?.area_name)) return false;
  if (!request.upazila) return true;
  return sameText(profile.upazila, request.upazila);
}

export type RankableDonor = {
  donor_kind: 'REGISTERED' | 'IMPORTED';
  blood_group: string;
  name: string;
};

/**
 * Ordering for a result page:
 *
 * 1. registered members before imported listings - they opted in to be called;
 * 2. the patient's exact group before a merely compatible one - a compatible
 *    donor is still useful, just less certain to be what the hospital asked for;
 * 3. name, so the order is stable between reloads.
 */
export function rankDonorResults<T extends RankableDonor>(donors: T[], exactGroup: string): T[] {
  const rank = (donor: T) =>
    (donor.donor_kind === 'REGISTERED' ? 0 : 2) + (donor.blood_group === exactGroup ? 0 : 1);
  return [...donors].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'en'));
}

export { canDonateTo, compatibleDonorsFor };
