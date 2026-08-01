// Blood-domain helpers shared across pages: compatibility, urgency, and
// donor eligibility.
//
// The compatibility tables themselves are owned by `server/blood.ts` and
// re-exported here, so the API and the frontend cannot disagree about who can
// give blood to whom. See src/lib/upazilas.ts for the same arrangement.

export {
  BLOOD_GROUPS,
  COMPATIBLE_DONORS,
  CAN_DONATE_TO,
  compatibleDonorsFor,
  canDonateTo,
  type BloodGroup
} from '../../server/blood';

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
// Educational default only; deployments may configure the server differently
// after local clinical review. Collection staff always make the final decision.
export const DONATION_INTERVAL_DAYS = 120;

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
