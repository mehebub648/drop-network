import { createHash, randomUUID } from 'node:crypto';

export const INVITATION_DELIVERY_STATUSES = ['QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'CANCELED', 'UNKNOWN'] as const;
export type InvitationDeliveryStatus = (typeof INVITATION_DELIVERY_STATUSES)[number];
export const INVITATION_OUTCOMES = ['PENDING', 'CLAIMED', 'REJECTED_REMOVED', 'PHONE_CHANGED', 'SEPARATE_ACCOUNT', 'NO_RESPONSE'] as const;
export type InvitationOutcome = (typeof INVITATION_OUTCOMES)[number];
export type CampaignStatus = 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELED';

export type InvitationAttempt = {
  id: string;
  provider: 'messavo';
  job_id?: string;
  delivery_status: InvitationDeliveryStatus;
  attempted_at: string;
  updated_at: string;
  last_error?: string;
};

export type ProfileInvitation = {
  id: string;
  donor_public_id: string;
  donor_phone: string;
  claim_path: string;
  submitted_by?: string;
  campaign_id?: string;
  resend_batch_id?: string;
  resend_mode?: 'INSTANT' | 'RAMPED';
  resend_pacing?: CampaignPacing;
  status: 'ACTIVE' | 'CANCELED';
  delivery_status: InvitationDeliveryStatus;
  outcome: InvitationOutcome;
  response_due_at: string;
  attempts: InvitationAttempt[];
  next_send_at?: string;
  created_at: string;
  updated_at: string;
  sent_at?: string;
  delivered_at?: string;
  responded_at?: string;
};

export type CampaignPacing = {
  start_per_minute: number;
  peak_per_minute: number;
  end_per_minute: number;
  ramp_up_minutes: number;
  steady_minutes: number;
  ramp_down_minutes: number;
};

export type InvitationCampaign = {
  id: string;
  label: string;
  status: CampaignStatus;
  mode: 'INSTANT' | 'RAMPED';
  target_count: number;
  pacing: CampaignPacing;
  invitation_ids: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  paused_at?: string;
  completed_at?: string;
  canceled_at?: string;
};

export type ContributionFile = {
  id: string;
  storage_key: string;
  name: string;
  content_type: string;
  size_bytes: number;
  sha256?: string;
  uploaded_at?: string;
};

export type ContributionBatch = {
  id: string;
  submitter_id: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  pasted_text?: string;
  note?: string;
  files: ContributionFile[];
  total_bytes: number;
  created_at: string;
  updated_at: string;
  submitted_at?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  reviewer_note?: string;
  published_donor_ids?: string[];
};

export const MAX_CONTRIBUTION_BATCH_BYTES = 50 * 1024 * 1024;
export const CONTRIBUTION_FILE_TYPES = new Set([
  'text/plain', 'text/csv', 'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

export function safeContributionFileName(value: unknown) {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/[\u0000-\u001f\u007f]/g, '');
  if (!name || name.length > 160 || /[\\/]/.test(name)) return null;
  return name;
}

export function validatePacing(input: unknown): CampaignPacing | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const number = (key: string, minimum: number, maximum: number) => {
    const candidate = Number(value[key]);
    return Number.isInteger(candidate) && candidate >= minimum && candidate <= maximum ? candidate : null;
  };
  const pacing = {
    start_per_minute: number('start_per_minute', 1, 20),
    peak_per_minute: number('peak_per_minute', 1, 20),
    end_per_minute: number('end_per_minute', 1, 20),
    ramp_up_minutes: number('ramp_up_minutes', 0, 1_440),
    steady_minutes: number('steady_minutes', 0, 10_080),
    ramp_down_minutes: number('ramp_down_minutes', 0, 1_440)
  };
  if (Object.values(pacing).some(item => item === null)) return null;
  const result = pacing as CampaignPacing;
  if (result.peak_per_minute < result.start_per_minute || result.peak_per_minute < result.end_per_minute) return null;
  if (result.ramp_up_minutes + result.steady_minutes + result.ramp_down_minutes < 1) return null;
  return result;
}

function rateAtMinute(minute: number, pacing: CampaignPacing) {
  if (minute < pacing.ramp_up_minutes && pacing.ramp_up_minutes > 0) {
    return pacing.start_per_minute + (pacing.peak_per_minute - pacing.start_per_minute) * (minute / pacing.ramp_up_minutes);
  }
  const afterUp = minute - pacing.ramp_up_minutes;
  if (afterUp < pacing.steady_minutes) return pacing.peak_per_minute;
  const afterSteady = afterUp - pacing.steady_minutes;
  if (afterSteady < pacing.ramp_down_minutes && pacing.ramp_down_minutes > 0) {
    return pacing.peak_per_minute - (pacing.peak_per_minute - pacing.end_per_minute) * (afterSteady / pacing.ramp_down_minutes);
  }
  return pacing.end_per_minute;
}

/** Deterministic planned send times survive restarts and worker delays. */
export function campaignSendTimes(count: number, startedAt: string, mode: 'INSTANT' | 'RAMPED', pacing: CampaignPacing) {
  const start = Date.parse(startedAt);
  if (mode === 'INSTANT') return Array.from({ length: count }, () => new Date(start).toISOString());
  const result: string[] = [];
  let elapsedMinutes = 0;
  for (let index = 0; index < count; index += 1) {
    result.push(new Date(start + elapsedMinutes * 60_000).toISOString());
    elapsedMinutes += 1 / Math.max(1, rateAtMinute(elapsedMinutes, pacing));
  }
  return result;
}

export function invitationIdempotencyKey(invitationId: string, attemptId: string) {
  return `drop-profile-invite:${invitationId}:${attemptId}`;
}

export function donorPhoneHash(phone: string) {
  return createHash('sha256').update(`drop:invitation-phone:v1\0${phone}`).digest('hex');
}

export function createInvitation(input: Pick<ProfileInvitation, 'donor_public_id' | 'donor_phone' | 'claim_path'> & {
  submitted_by?: string; campaign_id?: string; next_send_at?: string; now?: string;
}): ProfileInvitation {
  const now = input.now || new Date().toISOString();
  return {
    id: randomUUID(), donor_public_id: input.donor_public_id, donor_phone: input.donor_phone,
    claim_path: input.claim_path, submitted_by: input.submitted_by, campaign_id: input.campaign_id,
    status: 'ACTIVE', delivery_status: 'QUEUED', outcome: 'PENDING', attempts: [],
    next_send_at: input.next_send_at || now,
    response_due_at: new Date(Date.parse(now) + 14 * 24 * 60 * 60_000).toISOString(),
    created_at: now, updated_at: now
  };
}

export function deliveryAggregate(invitations: ProfileInvitation[]) {
  const counts = { selected: invitations.length, queued: 0, sent: 0, delivered: 0, failed: 0, claimed: 0, phone_changed: 0, separate_account: 0, rejected_removed: 0, no_response: 0 };
  for (const invitation of invitations) {
    if (invitation.delivery_status === 'QUEUED') counts.queued += 1;
    if (invitation.delivery_status === 'SENT') counts.sent += 1;
    if (invitation.delivery_status === 'DELIVERED') counts.delivered += 1;
    if (invitation.delivery_status === 'FAILED') counts.failed += 1;
    if (invitation.outcome === 'CLAIMED') counts.claimed += 1;
    if (invitation.outcome === 'PHONE_CHANGED') counts.phone_changed += 1;
    if (invitation.outcome === 'SEPARATE_ACCOUNT') counts.separate_account += 1;
    if (invitation.outcome === 'REJECTED_REMOVED') counts.rejected_removed += 1;
    if (invitation.outcome === 'NO_RESPONSE') counts.no_response += 1;
  }
  return counts;
}
