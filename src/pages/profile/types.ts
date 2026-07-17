export type AvailabilityStatus = 'AVAILABLE' | 'SICK' | 'TRAVELING' | 'NOT_AVAILABLE';

export type DonationRecord = {
  id: string;
  date: string;
  organization: string;
};

export type AvailabilityHistoryEntry = {
  status: AvailabilityStatus;
  changed_at: string;
};

export type DonorProfileData = {
  blood_group: string;
  last_donation_date: string;
  location: { lat: number; lng: number; area_name: string };
  availability_status: AvailabilityStatus;
  donation_history?: DonationRecord[];
  availability_history?: AvailabilityHistoryEntry[];
};

export type ProfileUser = {
  id: string;
  name: string;
  phone: string;
  is_verified: boolean;
  created_at?: string;
  donor_profile?: DonorProfileData;
};

export type ProfilePageProps = {
  user: ProfileUser;
  onUpdate: () => Promise<void> | void;
};
