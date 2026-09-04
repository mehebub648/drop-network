export const DONATION_OUTCOMES = ['DONATED', 'NOT_DONATED', 'REMIND_LATER'] as const;
export type DonationOutcome = (typeof DONATION_OUTCOMES)[number];

export type FollowUpDelivery = {
  status: 'NOT_REQUESTED' | 'PENDING' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'CANCELED';
  provider?: string;
  job_id?: string;
  attempts: number;
  updated_at?: string;
  last_error?: string;
};

export type DonationFollowUpState =
  | 'FOLLOW_UP_DUE'
  | 'AWAITING_DONOR'
  | 'AWAITING_REQUESTER'
  | 'CONFIRMED'
  | 'NOT_DONATED'
  | 'DISPUTED';

export type DonationFollowUp = {
  id: string;
  request_id: string;
  requester_id: string;
  donor_ref: string;
  donor_kind: 'REGISTERED' | 'IMPORTED';
  donor_user_id?: string;
  response_id?: string;
  reveal_id?: string;
  agreed_at: string;
  sms_consent: boolean;
  due_at: string;
  delivery: FollowUpDelivery;
  next_attempt_at?: string;
  reminder_count: number;
  donor_outcome?: Exclude<DonationOutcome, 'REMIND_LATER'>;
  donor_reported_at?: string;
  requester_outcome?: Exclude<DonationOutcome, 'REMIND_LATER'>;
  requester_reported_at?: string;
  donated_on?: string;
  state: DonationFollowUpState;
  created_at: string;
  updated_at: string;
};

export type ContactedDonorSummary = {
  reveal_id: string;
  latest_report_id?: string;
  blood_group?: string;
  district?: string;
  upazila?: string;
  is_verified?: boolean;
  availability_status?: string;
  donor_ref: string;
  donor_kind: 'REGISTERED' | 'IMPORTED';
  name: string;
  phone_masked: string;
  latest_call_outcome?: string;
  agreed: boolean;
  reminder_state: FollowUpDelivery['status'] | 'IN_APP_ONLY' | 'NOT_SCHEDULED';
  donor_outcome?: DonationFollowUp['donor_outcome'];
  requester_outcome?: DonationFollowUp['requester_outcome'];
  final_state?: DonationFollowUpState;
  next_action: string;
  contacted_at: string;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Dhaka has no daylight-saving transition, so quiet-hour adjustment is deterministic. */
export function outsideDhakaQuietHours(date: Date) {
  const shifted = new Date(date.getTime() + 6 * HOUR);
  const hour = shifted.getUTCHours();
  if (hour >= 8 && hour < 21) return date;
  if (hour >= 21) shifted.setUTCDate(shifted.getUTCDate() + 1);
  shifted.setUTCHours(8, 0, 0, 0);
  return new Date(shifted.getTime() - 6 * HOUR);
}

export function followUpDueAt(agreedAt: string, neededBy?: string) {
  const agreement = new Date(agreedAt);
  const needed = neededBy ? new Date(neededBy) : null;
  const target = needed && Number.isFinite(needed.getTime())
    ? new Date(needed.getTime() + 6 * HOUR)
    : new Date(agreement.getTime() + DAY);
  return outsideDhakaQuietHours(target).toISOString();
}

export function remindTomorrowAt(now = new Date()) {
  return outsideDhakaQuietHours(new Date(now.getTime() + DAY)).toISOString();
}

export function deriveFollowUpState(
  donor?: DonationFollowUp['donor_outcome'],
  requester?: DonationFollowUp['requester_outcome']
): DonationFollowUpState {
  if (donor && requester && donor !== requester) return 'DISPUTED';
  if (donor === 'DONATED' && requester === 'DONATED') return 'CONFIRMED';
  if (donor === 'NOT_DONATED' || requester === 'NOT_DONATED') return 'NOT_DONATED';
  if (donor === 'DONATED') return 'AWAITING_REQUESTER';
  if (requester === 'DONATED') return 'AWAITING_DONOR';
  return 'FOLLOW_UP_DUE';
}

export function followUpNextAction(followUp?: DonationFollowUp) {
  if (!followUp) return 'Record whether the donor agreed';
  switch (followUp.state) {
    case 'CONFIRMED': return 'Donation confirmed';
    case 'NOT_DONATED': return 'No further action';
    case 'DISPUTED': return 'Operator review required';
    case 'AWAITING_REQUESTER': return 'Requester confirmation needed';
    case 'AWAITING_DONOR': return 'Donor confirmation needed';
    default: return followUp.sms_consent ? 'Waiting for the follow-up' : 'Follow up in the app';
  }
}
