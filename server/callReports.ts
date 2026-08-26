// What happened after a contact number was revealed.
//
// The requester's answer is a three-level tree - outcome, then why, then where -
// so it is validated here as a tree rather than flattened into the donor
// response status enum, which is load-bearing for units accounting and cannot
// represent an imported listing at all (those are not user accounts).
//
// A single report never changes a donor's own state. Public summaries count
// distinct verified requesters, owner corrections append resolution evidence,
// and only three independent recent connection failures suppress search.

export const CALL_OUTCOMES = [
  'WILL_DONATE',
  'CALL_BACK_LATER',
  'NOT_CALLED',
  'NO_ANSWER',
  'UNREACHABLE',
  'WRONG_NUMBER',
  'DECLINED'
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

/** Required when, and only when, the outcome is DECLINED. */
export const DECLINE_REASONS = [
  'RECENTLY_DONATED',
  'LOCATION_FAR',
  'DONOR_ILL',
  'UNAVAILABLE',
  'OTHER',
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

export const CONTACT_ISSUE_CATEGORIES = [
  'WRONG_NUMBER',
  'UNREACHABLE',
  'DECLINED',
  'RECENTLY_DONATED',
  'TOO_FAR',
  'HEALTH'
] as const;
export type ContactIssueCategory = (typeof CONTACT_ISSUE_CATEGORIES)[number];

export const CALL_REPORT_KINDS = [
  'REVEAL',
  'CALL_OUTCOME',
  'DONOR_REPORT',
  'OWNER_RESOLUTION',
  'DISPUTE',
  'STAFF_RESOLUTION'
] as const;

export type CallReport = {
  id: string;
  kind: (typeof CALL_REPORT_KINDS)[number];
  request_id: string;
  /** Requester for REVEAL and CALL_OUTCOME; donor for DONOR_REPORT. */
  actor_id: string;
  /** `reg:<user_id>` or `imp:<public_id>`. */
  donor_ref: string;
  donor_kind: 'REGISTERED' | 'IMPORTED';
  /** Snapshot set only by the verified call-report route. */
  actor_verified?: boolean;
  outcome?: string;
  reason?: string;
  detail?: string;
  note?: string;
  /** On a CALL_OUTCOME, the REVEAL it answers. */
  reveal_id?: string;
  /** Owner/staff remediation or dispute categories. */
  categories?: ContactIssueCategory[];
  resolution_kind?: string;
  created_at: string;
};

export type ContactIssueSummary = Partial<Record<ContactIssueCategory, number>>;

export function contactIssueCategories(report: Pick<CallReport, 'kind' | 'outcome' | 'reason'>) {
  if (report.kind !== 'CALL_OUTCOME') return [] as ContactIssueCategory[];
  if (report.outcome === 'WRONG_NUMBER') return ['WRONG_NUMBER'] as ContactIssueCategory[];
  if (report.outcome === 'NO_ANSWER' || report.outcome === 'UNREACHABLE') {
    return ['UNREACHABLE'] as ContactIssueCategory[];
  }
  if (report.outcome !== 'DECLINED') return [] as ContactIssueCategory[];
  const categories: ContactIssueCategory[] = ['DECLINED'];
  if (report.reason === 'RECENTLY_DONATED') categories.push('RECENTLY_DONATED');
  if (report.reason === 'LOCATION_FAR') categories.push('TOO_FAR');
  if (report.reason === 'DONOR_ILL') categories.push('HEALTH');
  return categories;
}

/**
 * Active public counts. A requester contributes at most one count per donor
 * category, and a later owner/staff resolution makes earlier evidence stale.
 */
export function aggregateContactIssues(reports: CallReport[]): ContactIssueSummary {
  const resolvedAfter = new Map<ContactIssueCategory, number>();
  for (const report of reports) {
    if (!['OWNER_RESOLUTION', 'STAFF_RESOLUTION'].includes(report.kind)) continue;
    const at = new Date(report.created_at).getTime();
    for (const category of report.categories || []) {
      resolvedAfter.set(category, Math.max(resolvedAfter.get(category) || 0, at));
    }
  }

  const actors = new Map<ContactIssueCategory, Set<string>>();
  for (const report of reports) {
    if (report.kind !== 'CALL_OUTCOME') continue;
    const at = new Date(report.created_at).getTime();
    for (const category of contactIssueCategories(report)) {
      if (at <= (resolvedAfter.get(category) || 0)) continue;
      const seen = actors.get(category) || new Set<string>();
      seen.add(report.actor_id);
      actors.set(category, seen);
    }
  }
  return Object.fromEntries(
    [...actors.entries()].filter(([, reporters]) => reporters.size > 0).map(([category, reporters]) => [category, reporters.size])
  ) as ContactIssueSummary;
}

/** Three independent verified requesters reporting connection failure in 90 days. */
export function recentConnectionFailureReporterCount(
  reports: CallReport[],
  now = Date.now(),
  days = 90
) {
  const cutoff = now - days * 86_400_000;
  let resolvedAfter = 0;
  for (const report of reports) {
    if (!['OWNER_RESOLUTION', 'STAFF_RESOLUTION'].includes(report.kind)) continue;
    if (!(report.categories || []).some(category => category === 'WRONG_NUMBER' || category === 'UNREACHABLE')) continue;
    resolvedAfter = Math.max(resolvedAfter, new Date(report.created_at).getTime());
  }
  const reporters = new Set<string>();
  for (const report of reports) {
    const reportedAt = new Date(report.created_at).getTime();
    if (reportedAt < cutoff || reportedAt <= resolvedAfter) continue;
    const categories = contactIssueCategories(report);
    if (categories.includes('WRONG_NUMBER') || categories.includes('UNREACHABLE')) {
      reporters.add(report.actor_id);
    }
  }
  return reporters.size;
}

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
