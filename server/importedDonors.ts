// Donor records imported from public listings published by other
// organisations (Bangladesh Scouts, Quantum, ...).
//
// These people never signed up here, so an imported record is deliberately a
// *stub*, not an account:
//   - it is stored in its own table and never joins the donor match partitions;
//   - it is served masked everywhere except one route (see below);
//   - it becomes a real donor profile only when someone claims it.
//
// The single exception is `toRevealedImportedDonor`, used by the phone-reveal
// route: a verified account that has published a blood request for this
// person's own district and upazila may read the number in order to call them
// once. Every reveal is recorded. There is no browsable directory, and a
// revealed number is not a licence to redistribute it.
//
// The short claim flow claims this stub only when the verified phone matches
// the source. A different verified phone gets its own account/profile and
// leaves this stub untouched. `evaluateClaim` below remains for the one-release
// legacy authenticated endpoint, where mismatches still enter staff review.

import { createHash } from 'node:crypto';

export const IMPORTED_DONORS_TABLE = 'imported_donors';

export const CLAIM_STATUSES = ['UNCLAIMED', 'PENDING_REVIEW', 'CLAIMED'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const LISTING_STATES = ['ACTIVE', 'REMOVED'] as const;
export type ListingState = (typeof LISTING_STATES)[number];

export const PUBLICATION_STATES = ['PUBLIC', 'PRIVATE_PENDING', 'EXPIRED'] as const;
export type PublicationState = (typeof PUBLICATION_STATES)[number];

export type ImportedDonorSource = {
  id: string;
  organization: string;
  url: string;
  scraped_at: string;
};

export type ImportSourceDescriptor = {
  id: string;
  organization: string;
  url: string;
  /** Why the listing is treated as public, shown as attribution in the UI. */
  notes: string;
};

/**
 * The registry of listings this project imports from. It is the single source
 * of truth: `scripts/scrape/sources/*` build on these descriptors and scoped
 * search results render them as attribution.
 */
export const IMPORT_SOURCES: ImportSourceDescriptor[] = [
  {
    id: 'bd-scouts',
    organization: 'Bangladesh Scouts',
    url: 'https://service.scouts.gov.bd/blood-donation/1',
    notes: 'Open government donor search published for the public to contact donors directly.'
  },
  {
    id: 'quantum-method',
    organization: 'Quantum Voluntary Blood Donation Program',
    url: 'https://blood.quantummethod.org.bd/en/donor-list/regular',
    notes: 'Public donor roll. Publishes names and donation counts only, never contact details.'
  }
];

export type ImportedDonor = {
  /** Internal LanceDB row id. This value is never serialized publicly. */
  id: string;
  /** Stable opaque id used by directory URLs and API lookups. */
  public_id: string;
  /** Stable 12-character owner-facing claim route identifier. */
  claim_slug: string;
  source: ImportedDonorSource;
  source_ref: string;
  name: string;
  /** Full E.164 number as published, or '' when the source publishes none. */
  phone: string;
  blood_group: string;
  district: string;
  upazila: string;
  /**
   * District centroid, resolved at import time. Carrying it on the record
   * means the server can build a donor profile from a claim without owning a
   * second copy of the district coordinate table.
   */
  location?: { lat: number; lng: number; area_name: string };
  extra?: Record<string, string | number>;
  claim_status: ClaimStatus;
  claimed_by?: string;
  claimed_at?: string;
  claim_note?: string;
  /**
   * `REMOVED` when the person on this listing asked to be taken off it. The
   * row is kept rather than deleted so a re-import cannot quietly resurrect
   * them and so the request stays auditable, but it is excluded from every
   * search, count, and reveal.
   */
  listing_state?: ListingState;
  removed_at?: string;
  /** Anonymous suggestions stay private until the phone owner verifies. */
  publication_state?: PublicationState;
  contributed_at?: string;
  contribution_expires_at?: string;
  contribution_fingerprint_hash?: string;
  /** Search suppression from independent verified connection-failure reports. */
  contact_state?: 'ACTIVE' | 'SUSPENDED';
  report_suspended_at?: string;
  report_suspension_count?: number;
  imported_at: string;
};

/** What a claimant must fill in because the source never published it. */
export const CLAIMABLE_FIELDS = ['name', 'phone', 'blood_group', 'district'] as const;
export type ClaimableField = (typeof CLAIMABLE_FIELDS)[number];

export type ScrapedRecordInput = {
  source_id: string;
  source_organization: string;
  source_url: string;
  scraped_at: string;
  source_ref: string;
  name: string;
  phone: string;
  blood_group: string;
  district: string;
  upazila: string;
  extra?: Record<string, string | number>;
};

/**
 * Identity used to collapse duplicates. A published phone number is the
 * strongest signal; otherwise the record is only unique within its source.
 */
export function dedupeKey(record: { phone: string; source_id: string; source_ref: string }) {
  return record.phone ? `phone:${record.phone}` : `${record.source_id}:${record.source_ref}`;
}

function sha256Identity(namespace: 'public' | 'storage', key: string) {
  return createHash('sha256')
    .update(`drop:imported-donor:${namespace}:v1\0${key}`, 'utf8')
    .digest('hex');
}

/**
 * Stable opaque public id. The full dedupe key must never be embedded in a URL:
 * phone-backed keys contain the donor's complete number.
 */
export function importedDonorId(key: string) {
  return `imp_${sha256Identity('public', key)}`;
}

/** Stable internal id for newly imported storage rows. */
export function importedDonorStorageId(key: string) {
  return `imp_row_${sha256Identity('storage', key)}`;
}

/**
 * Stable, URL-safe 12-character claim slug. `attempt` is used only if the
 * datastore collision check finds the extraordinarily unlikely same prefix.
 */
export function claimSlugForPublicId(publicId: string, attempt = 0) {
  return createHash('sha256')
    .update(`drop:claim-slug:v1\0${publicId}\0${attempt}`, 'utf8')
    .digest('base64url')
    .slice(0, 12);
}

/** Deterministically resolves any 12-character collision in a complete set. */
export function withCollisionCheckedClaimSlugs(donors: ImportedDonor[]) {
  const used = new Set<string>();
  const resolved = new Map<string, string>();
  for (const donor of [...donors].sort((left, right) =>
    left.imported_at.localeCompare(right.imported_at) || left.public_id.localeCompare(right.public_id)
  )) {
    let slug = donor.claim_slug || claimSlugForPublicId(donor.public_id);
    let attempt = 0;
    while (used.has(slug)) {
      attempt += 1;
      slug = claimSlugForPublicId(donor.public_id, attempt);
    }
    used.add(slug);
    resolved.set(donor.public_id, slug);
  }
  return donors.map(donor => {
    const slug = resolved.get(donor.public_id)!;
    return slug === donor.claim_slug ? donor : { ...donor, claim_slug: slug };
  });
}

type StoredImportedDonor = Omit<ImportedDonor, 'public_id' | 'claim_slug'> & {
  public_id?: string;
  claim_slug?: string;
};

export function publicIdForImportedDonor(
  donor: Pick<StoredImportedDonor, 'phone' | 'source' | 'source_ref' | 'public_id'>
) {
  if (donor.public_id && /^imp_[a-f0-9]{64}$/.test(donor.public_id)) return donor.public_id;
  return importedDonorId(dedupeKey({
    phone: donor.phone,
    source_id: donor.source.id,
    source_ref: donor.source_ref
  }));
}

/**
 * Hydrates legacy documents without changing their internal row id. This lets
 * old claims remain readable while the datastore gains a separate public id.
 */
export function withImportedDonorIdentity(donor: StoredImportedDonor, storageId = donor.id): ImportedDonor {
  const publicId = publicIdForImportedDonor(donor);
  return {
    ...donor,
    id: storageId,
    public_id: publicId,
    claim_slug: donor.claim_slug && /^[A-Za-z0-9_-]{12}$/.test(donor.claim_slug)
      ? donor.claim_slug
      : claimSlugForPublicId(publicId)
  };
}

export function toImportedDonor(
  record: ScrapedRecordInput,
  importedAt: string,
  resolveLocation?: (district: string) => { lat: number; lng: number; area_name: string } | null
): ImportedDonor {
  const key = dedupeKey(record);
  const location = record.district && resolveLocation ? resolveLocation(record.district) : null;
  const publicId = importedDonorId(key);
  return {
    id: importedDonorStorageId(key),
    public_id: publicId,
    claim_slug: claimSlugForPublicId(publicId),
    source: {
      id: record.source_id,
      organization: record.source_organization,
      url: record.source_url,
      scraped_at: record.scraped_at
    },
    source_ref: record.source_ref,
    name: record.name,
    phone: record.phone,
    blood_group: record.blood_group,
    district: record.district,
    upazila: record.upazila,
    ...(location ? { location } : {}),
    ...(record.extra && Object.keys(record.extra).length > 0 ? { extra: record.extra } : {}),
    claim_status: 'UNCLAIMED',
    publication_state: 'PUBLIC',
    imported_at: importedAt
  };
}

/**
 * Masked form served to anyone who has not claimed the record. Keeps enough
 * for the real owner to recognise their own number without publishing it.
 */
export function maskPhone(phone: string) {
  if (!phone) return '';
  const local = phone.replace(/^\+880/, '');
  if (local.length < 6) return '';
  return `+880${local.slice(0, 2)}${'•'.repeat(local.length - 4)}${local.slice(-2)}`;
}

export type PublicImportedDonor = {
  id: string;
  claim_path: string;
  name: string;
  blood_group: string;
  district: string;
  upazila: string;
  phone_masked: string;
  has_phone: boolean;
  claim_status: ClaimStatus;
  missing_fields: ClaimableField[];
  source: { organization: string; url: string; scraped_at: string };
};

/** Fields the source left empty, which a claimant has to supply. */
export function missingFields(donor: Pick<ImportedDonor, 'name' | 'phone' | 'blood_group' | 'district'>) {
  return CLAIMABLE_FIELDS.filter(field => !donor[field]);
}

export function toPublicImportedDonor(donor: ImportedDonor): PublicImportedDonor {
  return {
    id: publicIdForImportedDonor(donor),
    claim_path: `/c/${donor.claim_slug}`,
    name: donor.name,
    blood_group: donor.blood_group,
    district: donor.district,
    upazila: donor.upazila,
    phone_masked: maskPhone(donor.phone),
    has_phone: Boolean(donor.phone),
    claim_status: donor.claim_status,
    missing_fields: missingFields(donor),
    source: {
      organization: donor.source.organization,
      url: donor.source.url,
      scraped_at: donor.source.scraped_at
    }
  };
}

/**
 * Marks a listing as withdrawn at the request of the person on it.
 *
 * The row is kept, not deleted: re-importing the source would otherwise put
 * them straight back, and a deleted row leaves no evidence that the request was
 * honoured. Everything that reads listings filters removed rows out.
 */
export function withdrawImportedDonor(donor: ImportedDonor, removedAt = new Date().toISOString()): ImportedDonor {
  return { ...donor, listing_state: 'REMOVED', removed_at: removedAt };
}

export type RevealedImportedDonor = PublicImportedDonor & { phone: string };

/**
 * The one projection that carries a raw imported phone number.
 *
 * Call it only from the phone-reveal route, which is where the checks that
 * justify it live: a verified session, an owned and published request, and a
 * donor that the request's own search actually returned. It is built on top of
 * the public projection rather than replacing it so the two cannot drift and
 * `phone_masked` stays available for display.
 */
export function toRevealedImportedDonor(donor: ImportedDonor): RevealedImportedDonor {
  return { ...toPublicImportedDonor(donor), phone: donor.phone };
}

/**
 * Which set of filterable columns a stored row was written with.
 *
 * Bump this whenever a column is added, so the backfill can tell a row it has
 * already rewritten from one it has not. Testing the column value instead would
 * loop forever on rows whose value is legitimately empty - a source that
 * publishes no upazila, for instance.
 *
 *   1  id, public_id, blood_group, district, phone, claim_status, source_id
 *   2  adds upazila
 *   3  adds claim slug and anonymous-contribution publication state
 *   4  adds contact-report suspension state
 */
export const IMPORTED_ROW_VERSION = '4';

/**
 * Projection stored in LanceDB: filterable columns plus the whole record as
 * JSON. Geography is the vector, matching the live donor partitions; records
 * with no district sit at the origin and are only reachable by filter.
 */
export function toImportedDonorRow(donor: ImportedDonor) {
  const storedDonor = withImportedDonorIdentity(donor);
  return {
    vector: storedDonor.location ? [storedDonor.location.lng, storedDonor.location.lat] : [0, 0],
    id: storedDonor.id,
    row_version: IMPORTED_ROW_VERSION,
    listing_state: storedDonor.listing_state || 'ACTIVE',
    publication_state: storedDonor.publication_state || 'PUBLIC',
    contact_state: storedDonor.contact_state || 'ACTIVE',
    public_id: storedDonor.public_id,
    claim_slug: storedDonor.claim_slug,
    contribution_expires_at: storedDonor.contribution_expires_at || '',
    blood_group: storedDonor.blood_group,
    district: storedDonor.district,
    upazila: storedDonor.upazila,
    phone: storedDonor.phone,
    claim_status: storedDonor.claim_status,
    source_id: storedDonor.source.id,
    search_text: `${storedDonor.name} ${storedDonor.district} ${storedDonor.upazila}`.toLowerCase(),
    doc: JSON.stringify(storedDonor)
  };
}

export type ClaimInput = {
  name?: string;
  phone?: string;
  blood_group?: string;
  district?: string;
};

export type ClaimDecision =
  | { error: string }
  | {
      /** Values to write onto the claimant's profile, after merging. */
      resolved: { name: string; phone: string; blood_group: string; district: string };
      /** CLAIMED when the source's own phone proves ownership. */
      status: Extract<ClaimStatus, 'CLAIMED' | 'PENDING_REVIEW'>;
      reason: string;
    };

/**
 * Merges a claimant's submission with the imported record and decides whether
 * the claim can be trusted outright.
 *
 * `claimantPhone` is the phone on the (already phone-verified) account making
 * the claim, which is what makes an auto-approval meaningful.
 */
export function evaluateClaim(
  donor: Pick<ImportedDonor, 'name' | 'phone' | 'blood_group' | 'district' | 'claim_status'>,
  input: ClaimInput,
  claimantPhone: string
): ClaimDecision {
  if (donor.claim_status === 'CLAIMED') return { error: 'This profile has already been claimed' };
  if (donor.claim_status === 'PENDING_REVIEW') return { error: 'A claim on this profile is already under review' };
  if (!claimantPhone) return { error: 'A verified phone number is required to claim a profile' };

  const resolved = {
    name: (input.name || donor.name || '').trim(),
    phone: donor.phone || input.phone || claimantPhone,
    blood_group: input.blood_group || donor.blood_group || '',
    district: input.district || donor.district || ''
  };

  const stillMissing = CLAIMABLE_FIELDS.filter(field => !resolved[field]);
  if (stillMissing.length > 0) {
    return { error: `Complete the profile before claiming: ${stillMissing.join(', ')}` };
  }

  // The one case we can verify without a human: the source published a number
  // and the claimant has already proven they control it.
  if (donor.phone && donor.phone === claimantPhone) {
    return { resolved, status: 'CLAIMED', reason: 'Verified phone matches the published number' };
  }

  return {
    resolved: { ...resolved, phone: claimantPhone },
    status: 'PENDING_REVIEW',
    reason: donor.phone
      ? 'Claiming phone differs from the published number'
      : 'Source published no phone number to verify against'
  };
}
