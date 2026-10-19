export type InvitationDeliveryStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'CANCELED' | 'UNKNOWN';

export type InvitationOutcome =
  | 'PENDING'
  | 'CLAIMED'
  | 'REJECTED_REMOVED'
  | 'PHONE_CHANGED'
  | 'SEPARATE_ACCOUNT'
  | 'NO_RESPONSE';

export type DonorInvitation = {
  id: string;
  masked_phone: string;
  donor: {
    public_id: string;
    name: string;
    blood_group?: string;
    district?: string;
    upazila?: string;
  };
  campaign?: { id: string; label: string } | null;
  delivery: {
    status: InvitationDeliveryStatus;
    provider?: string;
    attempts: number;
    updated_at?: string;
    last_error?: string;
  };
  outcome: InvitationOutcome;
  created_at: string;
  responded_at?: string;
  resend_eligible: boolean;
};

export type ContributionBatchStatus = 'DRAFT' | 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'NEEDS_CHANGES';

export type ContributionBatchFile = {
  id: string;
  name: string;
  content_type: string;
  size_bytes: number;
  uploaded: boolean;
  download_path?: string;
};

export type ContributionBatch = {
  id: string;
  status: ContributionBatchStatus;
  pasted_text?: string;
  pasted_text_preview?: string;
  note?: string;
  reviewer_note?: string;
  total_bytes: number;
  files: ContributionBatchFile[];
  submitter?: { id: string; name: string; masked_phone: string };
  created_at: string;
  submitted_at?: string;
  reviewed_at?: string;
};

export type InvitationPacing = {
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
  status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELED';
  mode: 'INSTANT' | 'RAMPED';
  pacing?: InvitationPacing;
  target_count: number;
  counts: {
    selected: number;
    queued: number;
    sent: number;
    delivered: number;
    failed: number;
    claimed: number;
    rejected_removed: number;
    phone_changed: number;
    separate_account: number;
    no_response: number;
  };
  created_at: string;
  started_at?: string;
  paused_at?: string;
  completed_at?: string;
};

export type ReviewedDonorInput = {
  name: string;
  phone: string;
  blood_group?: string;
  district?: string;
  upazila?: string;
};
