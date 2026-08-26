import type { LastDonationDeclaration, LastDonationInput } from '../../lib/donation';

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

export type PreferredDonationArea = { district: string; upazila: string };
export type PreferredCollectionFacility = {
  registry_code: string;
  name: string;
  district: string;
  locality: string;
};
export type TravelWillingness = 'HOME_ONLY' | 'PREFERRED_AREAS' | 'ANYWHERE_IN_DISTRICT';
export type RecurringContactWindow = { days: number[]; start_time: string; end_time: string };

export type DonorProfileData = {
  blood_group: string;
  last_donation?: LastDonationDeclaration;
  donation_count?: number;
  /** Legacy normalized value retained for eligibility and older profiles. */
  last_donation_date?: string;
  location: { lat: number; lng: number; area_name: string };
  /** Upazila within `location.area_name`; required to appear in donor search. */
  upazila?: string;
  /** Self-declared only. Eligibility is decided by the collection facility. */
  age?: number;
  weight_kg?: number;
  /** Private self-report. It is not published or used as medical clearance. */
  medical_conditions?: string;
  availability_status: AvailabilityStatus;
  /** Private optional context for a non-available status. */
  availability_reason?: string;
  availability_confirmed_at?: string;
  deferral_status?: 'NONE' | 'TEMPORARY' | 'PERMANENT';
  deferred_until?: string;
  donation_history?: DonationRecord[];
  availability_history?: AvailabilityHistoryEntry[];
  preferred_areas?: PreferredDonationArea[];
  preferred_facilities?: PreferredCollectionFacility[];
  travel_willingness?: TravelWillingness;
  contact_windows?: RecurringContactWindow[];
  /** Private to the owner; never included in donor search cards. */
  private_coordination_note?: string;
};

export type DonorProfilePayload = Omit<DonorProfileData, 'last_donation'> & {
  last_donation?: LastDonationDeclaration | LastDonationInput;
};

export type ProfileUser = {
  id: string;
  name: string;
  phone: string;
  is_verified: boolean;
  phone_verified_at?: string;
  roles?: string[];
  created_at?: string;
  donor_profile?: DonorProfileData;
};

export type ProfilePageProps = {
  user: ProfileUser;
  onUpdate: () => Promise<void> | void;
};
