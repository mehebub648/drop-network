// Blood-domain helpers shared across pages: compatibility, urgency, and
// donor eligibility. Mirrors the compatibility map used by the server's
// donor matching (server/server.ts).

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

// For each recipient group, the donor groups whose blood they can receive.
export const COMPATIBLE_DONORS: Record<BloodGroup, BloodGroup[]> = {
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'A-': ['A-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  'AB-': ['A-', 'B-', 'AB-', 'O-'],
  'O+': ['O+', 'O-'],
  'O-': ['O-']
};

// For each donor group, the recipient groups they can give to.
export const CAN_DONATE_TO: Record<BloodGroup, BloodGroup[]> = {
  'A+': ['A+', 'AB+'],
  'A-': ['A+', 'A-', 'AB+', 'AB-'],
  'B+': ['B+', 'AB+'],
  'B-': ['B+', 'B-', 'AB+', 'AB-'],
  'AB+': ['AB+'],
  'AB-': ['AB+', 'AB-'],
  'O+': ['A+', 'B+', 'AB+', 'O+'],
  'O-': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
};

export function compatibleDonorsFor(group: string): BloodGroup[] {
  return COMPATIBLE_DONORS[group as BloodGroup] || [];
}

export type Urgency = 'CRITICAL' | 'URGENT' | 'SCHEDULED';

// Requests without a needed-by date were created for immediate need (ASAP).
export function getUrgency(neededBy?: string | null): Urgency {
  if (!neededBy) return 'CRITICAL';
  const hoursLeft = (new Date(neededBy).getTime() - Date.now()) / 3_600_000;
  if (hoursLeft <= 24) return 'CRITICAL';
  if (hoursLeft <= 72) return 'URGENT';
  return 'SCHEDULED';
}

export const URGENCY_ORDER: Record<Urgency, number> = { CRITICAL: 0, URGENT: 1, SCHEDULED: 2 };

// Minimum gap between whole-blood donations. BD guidelines commonly use ~3-4
// months; 90 days is the conservative default used across the app.
export const DONATION_INTERVAL_DAYS = 90;

export function getEligibility(lastDonationDate?: string | null) {
  if (!lastDonationDate) {
    return { eligible: true, daysLeft: 0, nextEligibleDate: null as Date | null, progress: 1 };
  }
  const last = new Date(lastDonationDate).getTime();
  if (Number.isNaN(last)) {
    return { eligible: true, daysLeft: 0, nextEligibleDate: null as Date | null, progress: 1 };
  }
  const next = new Date(last + DONATION_INTERVAL_DAYS * 86_400_000);
  const daysLeft = Math.max(0, Math.ceil((next.getTime() - Date.now()) / 86_400_000));
  const progress = Math.min(1, (DONATION_INTERVAL_DAYS - daysLeft) / DONATION_INTERVAL_DAYS);
  return { eligible: daysLeft === 0, daysLeft, nextEligibleDate: next, progress };
}
