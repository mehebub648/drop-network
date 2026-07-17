import { getLocationByName } from '../../lib/locations';
import type { DonorProfileData, ProfileUser } from './types';

export function donorProfilePayload(user: ProfileUser, changes: Partial<DonorProfileData> = {}): DonorProfileData {
  const fallbackLocation = getLocationByName('Dhaka')!;
  const fallbackDonationDate = new Date(Date.now() - 365 * 86_400_000).toISOString();
  return {
    blood_group: user.donor_profile?.blood_group || 'O+',
    availability_status: user.donor_profile?.availability_status || 'NOT_AVAILABLE',
    location: user.donor_profile?.location || fallbackLocation,
    last_donation_date: user.donor_profile?.last_donation_date || fallbackDonationDate,
    donation_history: user.donor_profile?.donation_history || [],
    availability_history: user.donor_profile?.availability_history || [],
    ...changes
  };
}
