// Blood group compatibility, owned by the server.
//
// This module lives in `server/` and has no imports, because the production
// image ships only `server/` and `dist/`. `src/lib/blood.ts` re-exports it, so
// the frontend and the API agree by construction instead of by a comment asking
// someone to keep two tables in sync.

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

/** For each recipient group, the donor groups whose blood they can receive. */
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

/**
 * For each donor group, the recipient groups they can give to. Derived from
 * `COMPATIBLE_DONORS` rather than written out, because the two tables are
 * inverses and a hand-typed inverse fails silently and plausibly - a donor
 * would simply never see requests they could actually answer.
 */
export const CAN_DONATE_TO: Record<BloodGroup, BloodGroup[]> = BLOOD_GROUPS.reduce((table, donor) => {
  table[donor] = BLOOD_GROUPS.filter(recipient => COMPATIBLE_DONORS[recipient].includes(donor));
  return table;
}, {} as Record<BloodGroup, BloodGroup[]>);

export function compatibleDonorsFor(group: string): BloodGroup[] {
  return COMPATIBLE_DONORS[group as BloodGroup] || [];
}

export function canDonateTo(group: string): BloodGroup[] {
  return CAN_DONATE_TO[group as BloodGroup] || [];
}
