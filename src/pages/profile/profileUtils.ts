import { getLocationByName } from '../../lib/locations';
import type { DonorProfilePayload, ProfileUser } from './types';

export function donorProfilePayload(user: ProfileUser, changes: Partial<DonorProfilePayload> = {}): DonorProfilePayload {
  const fallbackLocation = getLocationByName('Dhaka')!;
  return {
    blood_group: user.donor_profile?.blood_group || 'O+',
    availability_status: user.donor_profile?.availability_status || 'NOT_AVAILABLE',
    availability_reason: user.donor_profile?.availability_reason,
    location: user.donor_profile?.location || fallbackLocation,
    upazila: user.donor_profile?.upazila,
    age: user.donor_profile?.age,
    weight_kg: user.donor_profile?.weight_kg,
    medical_conditions: user.donor_profile?.medical_conditions,
    // Pages send last_donation only when it changes; omission preserves the
    // server-stamped reported_at value on unrelated profile updates.
    donation_count: user.donor_profile?.donation_count,
    last_donation_date: user.donor_profile?.last_donation_date,
    deferral_status: user.donor_profile?.deferral_status || 'NONE',
    deferred_until: user.donor_profile?.deferred_until,
    donation_history: user.donor_profile?.donation_history || [],
    availability_history: user.donor_profile?.availability_history || [],
    ...changes
  };
}
