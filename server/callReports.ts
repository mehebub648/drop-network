// What happened after a contact number was revealed.
//
// The requester's answer is a three-level tree - outcome, then why, then where -
// so it is validated here as a tree rather than flattened into the donor
// response status enum, which is load-bearing for units accounting and cannot
// represent an imported listing at all (those are not user accounts).
//
// Nothing recorded here changes a donor's own state. A requester saying "she
// recently donated" or "he is ill" is an unverified third-party claim; acting on
// it would let anyone deactivate any donor with one click. The donor's own
// report, filed from their side, is a different matter.

export const CALL_OUTCOMES = [
  'WILL_DONATE',
  'NOT_CALLED',
  'NO_ANSWER',
  'WRONG_NUMBER',
  'DECLINED'
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

/** Required when, and only when, the outcome is DECLINED. */
export const DECLINE_REASONS = [
  'RECENTLY_DONATED',
  'LOCATION_FAR',
  'DONOR_ILL',
  'OTHER',
  'UNSPECIFIED'
] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

/** Required when, and only when, the reason is LOCATION_FAR. */
export const FAR_DETAILS = [
  'OUTSIDE_DISTRICT',
  'TRAVELLING',
  'FAR_WITHIN_DISTRICT'
] as const;
export type FarDetail = (typeof FAR_DETAILS)[number];

/** What a donor reports back about a request they were shown. */
export const DONOR_REPORT_OUTCOMES = [
  'CAN_DONATE',
  'NEED_MORE_INFO',
  'NOT_ELIGIBLE_RECENT_DONATION',
  'NOT_ELIGIBLE_HEALTH',
  'TOO_FAR',
  'REQUESTER_NO_LONGER_NEEDS',
  'REQUESTER_UNREACHABLE',
  'WRONG_NUMBER',
  'SUSPECTED_MISUSE'
] as const;
export type DonorReportOutcome = (typeof DONOR_REPORT_OUTCOMES)[number];

export const CALL_REPORT_KINDS = ['REVEAL', 'CALL_OUTCOME', 'DONOR_REPORT'] as const;

export type CallReport = {
  id: string;
  kind: (typeof CALL_REPORT_KINDS)[number];
  request_id: string;
  /** Requester for REVEAL and CALL_OUTCOME; donor for DONOR_REPORT. */
  actor_id: string;
  /** `reg:<user_id>` or `imp:<public_id>`. */
  donor_ref: string;
  donor_kind: 'REGISTERED' | 'IMPORTED';
  outcome?: string;
  reason?: string;
  detail?: string;
  note?: string;
  /** On a CALL_OUTCOME, the REVEAL it answers. */
  reveal_id?: string;
  created_at: string;
};

export function findUnansweredReveals(reports: CallReport[]) {
  const answered = new Set(
    reports.filter(report => report.kind === 'CALL_OUTCOME').map(report => report.reveal_id)
  );
  return reports
    .filter(report => report.kind === 'REVEAL' && !answered.has(report.id))
    .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
}

export function findPendingReveal(reports: CallReport[]) {
  return findUnansweredReveals(reports)[0] || null;
}

const NOTE_MAX_LENGTH = 300;

export type CallOutcomeInput = {
  outcome?: unknown;
  reason?: unknown;
  detail?: unknown;
  note?: unknown;
};

/**
 * Validates the outcome tree, rejecting answers that are individually valid but
 * cannot occur together - "I did not call, because they recently donated" is not
 * something the caller can know.
 */
export function parseCallOutcome(input: CallOutcomeInput) {
  const outcome = input.outcome;
  const reason = input.reason === undefined || input.reason === null || input.reason === '' ? undefined : input.reason;
  const detail = input.detail === undefined || input.detail === null || input.detail === '' ? undefined : input.detail;
  const rawNote = input.note === undefined || input.note === null ? '' : String(input.note).trim();

  if (typeof outcome !== 'string' || !CALL_OUTCOMES.includes(outcome as CallOutcome)) {
    return { error: 'Choose what happened when you called' } as const;
  }
  if (rawNote.length > NOTE_MAX_LENGTH) {
    return { error: `Keep the note under ${NOTE_MAX_LENGTH} characters` } as const;
  }

  if (outcome !== 'DECLINED') {
    if (reason !== undefined || detail !== undefined) {
      return { error: 'A reason only applies when the donor declined' } as const;
    }
    return { value: { outcome: outcome as CallOutcome, note: rawNote || undefined } } as const;
  }

  if (typeof reason !== 'string' || !DECLINE_REASONS.includes(reason as DeclineReason)) {
    return { error: 'Choose why the donor could not help' } as const;
  }
  if (reason !== 'LOCATION_FAR' && detail !== undefined) {
    return { error: 'That extra detail only applies when the donor is too far away' } as const;
  }
  if (reason === 'LOCATION_FAR' && (typeof detail !== 'string' || !FAR_DETAILS.includes(detail as FarDetail))) {
    return { error: 'Say how far away the donor is' } as const;
  }
  if (reason === 'OTHER' && !rawNote) {
    return { error: 'Add a short note describing the reason' } as const;
  }

  return {
    value: {
      outcome: outcome as CallOutcome,
      reason: reason as DeclineReason,
      detail: detail as FarDetail | undefined,
      note: rawNote || undefined
    }
  } as const;
}

export function parseDonorReport(input: { outcome?: unknown; note?: unknown }) {
  const outcome = input.outcome;
  const note = input.note === undefined || input.note === null ? '' : String(input.note).trim();

  if (typeof outcome !== 'string' || !DONOR_REPORT_OUTCOMES.includes(outcome as DonorReportOutcome)) {
    return { error: 'Choose a response' } as const;
  }
  if (note.length > NOTE_MAX_LENGTH) {
    return { error: `Keep the note under ${NOTE_MAX_LENGTH} characters` } as const;
  }
  if (outcome === 'NEED_MORE_INFO' && !note) {
    return { error: 'Write the question you want to ask' } as const;
  }
  return { value: { outcome: outcome as DonorReportOutcome, note: note || undefined } } as const;
}

/** `reg:` / `imp:` reference helpers, so the prefixes are defined in one place. */
export function parseDonorRef(donorRef: string) {
  if (donorRef.startsWith('reg:')) {
    const id = donorRef.slice(4);
    return id ? { kind: 'REGISTERED' as const, id } : null;
  }
  if (donorRef.startsWith('imp:')) {
    const id = donorRef.slice(4);
    return id ? { kind: 'IMPORTED' as const, id } : null;
  }
  return null;
}
