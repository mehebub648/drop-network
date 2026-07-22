import { getLocationByName } from '../../lib/locations';
import type { DonorProfileData, ProfileUser } from './types';

export function donorProfilePayload(user: ProfileUser, changes: Partial<DonorProfileData> = {}): DonorProfileData {
  const fallbackLocation = getLocationByName('Dhaka')!;
  return {
    blood_group: user.donor_profile?.blood_group || 'O+',
    availability_status: user.donor_profile?.availability_status || 'NOT_AVAILABLE',
    location: user.donor_profile?.location || fallbackLocation,
    last_donation_date: user.donor_profile?.last_donation_date,
    deferral_status: user.donor_profile?.deferral_status || 'NONE',
    deferred_until: user.donor_profile?.deferred_until,
    donation_history: user.donor_profile?.donation_history || [],
    availability_history: user.donor_profile?.availability_history || [],
    ...changes
  };
}
