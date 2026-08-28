// Rules for deciding who a blood request can reach, kept as pure functions so
// they can be tested without an HTTP server or a datastore.
//
// Requesters search by district and upazila. Upazilas have no coordinates in
// this project, so matching is string equality against the canonical spelling
// in `server/upazilas.ts` - there is no radius and none should be invented.

import { canDonateTo, compatibleDonorsFor, type BloodGroup } from './blood';
import { createHash } from 'node:crypto';
import type {
  DonorPreferences,
  RecurringContactWindow
} from './donorPreferences';
import { sameFacilityName } from '../src/lib/facilityIdentity';

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

export type SearchableDonorProfile = EligibilityProfile & DonorPreferences & {
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

function profileMatchesLocation(profile: SearchableDonorProfile, search: Pick<UpazilaSearch, 'district' | 'upazilas'>) {
  const homeDistrict = sameText(profile.location?.area_name, search.district);
  const homeUpazila = homeDistrict && search.upazilas.some(value => sameText(profile.upazila, value));
  const preferredArea = profile.travel_willingness === 'PREFERRED_AREAS' &&
    (profile.preferred_areas || []).some(area =>
      sameText(area.district, search.district) && search.upazilas.some(value => sameText(area.upazila, value))
    );
  const anywhereInHomeDistrict = profile.travel_willingness === 'ANYWHERE_IN_DISTRICT' && homeDistrict;
  return homeUpazila || preferredArea || anywhereInHomeDistrict;
}

/** Preference-aware version used by the public request search. */
export function matchesPreferenceSearch(profile: SearchableDonorProfile | undefined, search: UpazilaSearch, now = Date.now()) {
  if (!profile) return false;
  if (!search.compatibleGroups.includes(profile.blood_group)) return false;
  if (!profileMatchesLocation(profile, search)) return false;
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
  profile: Pick<SearchableDonorProfile, 'blood_group' | 'upazila' | 'location' | 'preferred_areas' | 'travel_willingness'> | undefined,
  request: { blood_group: string; upazila?: string; location: { area_name: string } }
) {
  if (!profile) return false;
  if (!canDonateTo(profile.blood_group).includes(request.blood_group as BloodGroup)) return false;
  if (!request.upazila) return sameText(profile.location?.area_name, request.location?.area_name);
  return profileMatchesLocation(profile as SearchableDonorProfile, {
    district: request.location.area_name,
    upazilas: [request.upazila]
  });
}

export const SEARCH_SORTS = [
  'recommended',
  'recently_confirmed',
  'best_location',
  'most_donations',
  'fewest_contact_issues',
  'name'
] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

function asiaDhakaDayAndMinute(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now);
  const weekday = parts.find(part => part.type === 'weekday')?.value || 'Sun';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  const hour = Number(parts.find(part => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find(part => part.type === 'minute')?.value || 0);
  return { day, minute: hour * 60 + minute };
}

function timeMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function matchesWindow(window: RecurringContactWindow, now: Date) {
  const current = asiaDhakaDayAndMinute(now);
  if (!window.days.includes(current.day)) return false;
  const start = timeMinutes(window.start_time);
  const end = timeMinutes(window.end_time);
  return start < end
    ? current.minute >= start && current.minute < end
    : current.minute >= start || current.minute < end;
}

export function donorPreferenceMatch(
  profile: SearchableDonorProfile,
  search: { district: string; upazilas: string[]; facilityCode?: string; facilityName?: string },
  now = new Date()
) {
  const reasons: string[] = [];
  let score = 0;
  const homeDistrict = sameText(profile.location?.area_name, search.district);
  const homeUpazila = homeDistrict && search.upazilas.some(value => sameText(profile.upazila, value));
  if (homeUpazila) {
    reasons.push('Home upazila');
    score += 4;
  } else if (profile.travel_willingness === 'PREFERRED_AREAS' && (profile.preferred_areas || []).some(area =>
    sameText(area.district, search.district) && search.upazilas.some(value => sameText(area.upazila, value))
  )) {
    reasons.push('Preferred donation area');
    score += 3;
  } else if (profile.travel_willingness === 'ANYWHERE_IN_DISTRICT' && homeDistrict) {
    reasons.push('Can travel within this district');
    score += 1;
  }

  const facility = (profile.preferred_facilities || []).find(item =>
    Boolean(search.facilityCode) && item.registry_code === search.facilityCode
  ) || (profile.preferred_facilities || []).find(item =>
    sameFacilityName(item.name, search.facilityName)
  );
  if (facility) {
    reasons.push('Preferred collection facility');
    score += 4;
  }
  if ((profile.contact_windows || []).some(window => matchesWindow(window, now))) {
    reasons.push('Usually reachable around this time');
    score += 1;
  }
  return { reasons, score };
}

export type RankableDonor = {
  donor_kind: 'REGISTERED' | 'IMPORTED';
  blood_group: string;
  name: string;
  donor_ref?: string;
  is_current_user?: boolean;
  is_verified?: boolean;
  is_exact_group?: boolean;
  ranking?: {
    location_match_score?: number;
    availability_confirmed_at?: string;
    donation_total?: number;
    contact_issue_total?: number;
  };
};

/**
 * Ordering for a result page:
 *
 * 1. the signed-in requester's own eligible donor profile, when present;
 * 2. registered members before imported listings - they opted in to be called;
 * 3. the patient's exact group before a merely compatible one - a compatible
 *    donor is still useful, just less certain to be what the hospital asked for;
 * 4. name, so the order is stable between reloads.
 */
export function rankDonorResults<T extends RankableDonor>(donors: T[], exactGroup: string, sort: SearchSort = 'recommended', orderSeed = ''): T[] {
  const currentUserTier = (donor: T) => donor.is_current_user ? 0 : 1;
  const verifiedTier = (donor: T) => donor.donor_kind === 'REGISTERED' && donor.is_verified !== false ? 0 : 1;
  const exactTier = (donor: T) => (donor.is_exact_group ?? donor.blood_group === exactGroup) ? 0 : 1;
  const confirmed = (donor: T) => new Date(donor.ranking?.availability_confirmed_at || 0).getTime() || 0;
  const location = (donor: T) => donor.ranking?.location_match_score || 0;
  const donations = (donor: T) => donor.ranking?.donation_total || 0;
  const issues = (donor: T) => donor.ranking?.contact_issue_total || 0;
  const stableName = (a: T, b: T) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
    || (a.donor_ref || '').localeCompare(b.donor_ref || '', 'en');
  const seededKey = (donor: T) => createHash('sha256')
    .update(`${orderSeed}:${donor.donor_ref || donor.name}`)
    .digest('hex');
  const stableTie = (a: T, b: T) => orderSeed
    ? seededKey(a).localeCompare(seededKey(b), 'en') || stableName(a, b)
    : stableName(a, b);
  return [...donors].sort((a, b) => {
    const currentUser = currentUserTier(a) - currentUserTier(b);
    if (currentUser) return currentUser;
    const tier = verifiedTier(a) - verifiedTier(b);
    if (tier) return tier;
    if (sort === 'name') return stableName(a, b);
    if (sort === 'recently_confirmed') {
      return confirmed(b) - confirmed(a) || exactTier(a) - exactTier(b) || stableTie(a, b);
    }
    if (sort === 'best_location') {
      return location(b) - location(a) || exactTier(a) - exactTier(b) || confirmed(b) - confirmed(a) || stableTie(a, b);
    }
    if (sort === 'most_donations') {
      return donations(b) - donations(a) || exactTier(a) - exactTier(b) || location(b) - location(a) || stableTie(a, b);
    }
    if (sort === 'fewest_contact_issues') {
      return issues(a) - issues(b) || exactTier(a) - exactTier(b) || location(b) - location(a) || stableTie(a, b);
    }
    return exactTier(a) - exactTier(b)
      || location(b) - location(a)
      || confirmed(b) - confirmed(a)
      || issues(a) - issues(b)
      || stableTie(a, b);
  });
}

export { canDonateTo, compatibleDonorsFor };
