export {
  APPROXIMATE_DONATION_LIMITS,
  APPROXIMATE_DONATION_UNITS,
  MAX_DONATION_COUNT,
  canonicalLastDonationDate,
  type ApproximateDonationUnit,
  type LastDonationDeclaration,
  type PublicDonationSummary
} from '../../server/donation';

import {
  APPROXIMATE_DONATION_LIMITS,
  MAX_DONATION_COUNT,
  type ApproximateDonationUnit,
  type LastDonationDeclaration
} from '../../server/donation';

export type LastDonationInput =
  | { kind: 'EXACT'; date: string }
  | { kind: 'APPROXIMATE'; value: number; unit: ApproximateDonationUnit }
  | { kind: 'NEVER' };

export type DonationExperienceDraft = {
  kind: LastDonationDeclaration['kind'] | '';
  exactDate: string;
  approximateValue: string;
  approximateUnit: ApproximateDonationUnit;
  donationCount: string;
};

export type DonationExperiencePayload = {
  last_donation?: LastDonationInput;
  donation_count?: number;
};

export function donationExperienceDraft(
  declaration?: LastDonationDeclaration,
  legacyDate?: string,
  donationCount?: number
): DonationExperienceDraft {
  const kind = declaration?.kind || (legacyDate ? 'EXACT' : '');
  return {
    kind,
    exactDate: declaration?.kind === 'EXACT' ? declaration.date : declaration ? '' : legacyDate || '',
    approximateValue: declaration?.kind === 'APPROXIMATE' ? String(declaration.value) : '',
    approximateUnit: declaration?.kind === 'APPROXIMATE' ? declaration.unit : 'MONTHS',
    donationCount: donationCount === undefined ? '' : String(donationCount)
  };
}

export function validateDonationExperience(value: DonationExperienceDraft, minimumCount = 0) {
  if (!value.kind) return null;
  if (value.kind === 'NEVER' && minimumCount > 0) {
    return 'Remove your detailed donation records before choosing never donated.';
  }
  if (value.kind === 'EXACT' && !/^\d{4}-\d{2}-\d{2}$/.test(value.exactDate)) {
    return 'Enter the exact date of your last donation.';
  }
  if (value.kind === 'EXACT' && value.exactDate > new Date().toISOString().slice(0, 10)) {
    return 'The last donation date cannot be in the future.';
  }
  if (value.kind === 'APPROXIMATE') {
    const amount = Number(value.approximateValue);
    if (
      !Number.isInteger(amount) ||
      amount < 1 ||
      amount > APPROXIMATE_DONATION_LIMITS[value.approximateUnit]
    ) {
      return `Enter a whole number between 1 and ${APPROXIMATE_DONATION_LIMITS[value.approximateUnit].toLocaleString()}.`;
    }
  }
  if (value.kind !== 'NEVER') {
    const count = Number(value.donationCount);
    const minimum = Math.max(1, minimumCount);
    if (!Number.isInteger(count) || count < minimum || count > MAX_DONATION_COUNT) {
      return `Enter a lifetime donation count between ${minimum.toLocaleString()} and ${MAX_DONATION_COUNT.toLocaleString()}.`;
    }
  }
  return null;
}

export function donationExperiencePayload(value: DonationExperienceDraft): DonationExperiencePayload {
  if (!value.kind) return {};
  if (value.kind === 'NEVER') {
    return { last_donation: { kind: 'NEVER' }, donation_count: 0 };
  }

  const donation_count = Number(value.donationCount);
  if (value.kind === 'EXACT') {
    return {
      last_donation: { kind: 'EXACT', date: value.exactDate },
      donation_count
    };
  }
  return {
    last_donation: {
      kind: 'APPROXIMATE',
      value: Number(value.approximateValue),
      unit: value.approximateUnit
    },
    donation_count
  };
}
