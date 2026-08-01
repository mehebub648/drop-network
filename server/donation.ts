export const APPROXIMATE_DONATION_UNITS = ['DAYS', 'MONTHS', 'YEARS'] as const;
export type ApproximateDonationUnit = (typeof APPROXIMATE_DONATION_UNITS)[number];

export const APPROXIMATE_DONATION_LIMITS: Record<ApproximateDonationUnit, number> = {
  DAYS: 36_500,
  MONTHS: 1_200,
  YEARS: 100
};

export const MAX_DONATION_COUNT = 10_000;

export type LastDonationDeclaration =
  | {
      kind: 'EXACT';
      date: string;
      reported_at: string;
    }
  | {
      kind: 'APPROXIMATE';
      value: number;
      unit: ApproximateDonationUnit;
      estimated_date: string;
      reported_at: string;
    }
  | {
      kind: 'NEVER';
      reported_at: string;
    };

export type PublicDonationSummary =
  | {
      kind: 'EXACT';
      date: string;
      donation_count?: number;
    }
  | {
      kind: 'APPROXIMATE';
      value: number;
      unit: ApproximateDonationUnit;
      estimated_date: string;
      donation_count?: number;
    }
  | {
      kind: 'NEVER';
      donation_count?: number;
    };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validNow(value: Date | number) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Strictly validates a calendar date rather than allowing JavaScript rollover. */
export function parseDonationDate(value: unknown, now: Date | number = Date.now()) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const reference = validNow(now);
  if (!reference) return null;

  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;

  const candidate = new Date(0);
  candidate.setUTCHours(0, 0, 0, 0);
  candidate.setUTCFullYear(year, month - 1, day);
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return value <= reference.toISOString().slice(0, 10) ? value : null;
}

function subtractCalendarMonths(reference: Date, months: number) {
  const targetMonth = new Date(Date.UTC(
    reference.getUTCFullYear(),
    reference.getUTCMonth() - months,
    1
  ));
  const lastDay = new Date(Date.UTC(
    targetMonth.getUTCFullYear(),
    targetMonth.getUTCMonth() + 1,
    0
  )).getUTCDate();
  targetMonth.setUTCDate(Math.min(reference.getUTCDate(), lastDay));
  return targetMonth;
}

function estimatedDate(reference: Date, value: number, unit: ApproximateDonationUnit) {
  if (unit === 'DAYS') {
    const date = new Date(Date.UTC(
      reference.getUTCFullYear(),
      reference.getUTCMonth(),
      reference.getUTCDate() - value
    ));
    return date.toISOString().slice(0, 10);
  }

  return subtractCalendarMonths(reference, unit === 'MONTHS' ? value : value * 12)
    .toISOString()
    .slice(0, 10);
}

/**
 * Parses an untrusted client declaration.
 *
 * `undefined`, `null`, and an empty string mean the field was omitted. Invalid
 * supplied values return `null`. `reported_at` and `estimated_date` always come
 * from the server clock; similarly named client properties are ignored.
 */
export function parseLastDonationDeclaration(
  value: unknown,
  now: Date | number = Date.now()
): LastDonationDeclaration | undefined | null {
  if (value === undefined || value === null || value === '') return undefined;
  if (!isPlainObject(value)) return null;

  const reference = validNow(now);
  if (!reference) return null;
  const reported_at = reference.toISOString();

  if (value.kind === 'NEVER') return { kind: 'NEVER', reported_at };

  if (value.kind === 'EXACT') {
    const date = parseDonationDate(value.date, reference);
    return date ? { kind: 'EXACT', date, reported_at } : null;
  }

  if (value.kind === 'APPROXIMATE') {
    const unit = value.unit;
    const amount = value.value;
    if (!APPROXIMATE_DONATION_UNITS.includes(unit as ApproximateDonationUnit)) return null;
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1) return null;
    if (amount > APPROXIMATE_DONATION_LIMITS[unit as ApproximateDonationUnit]) return null;

    return {
      kind: 'APPROXIMATE',
      value: amount,
      unit: unit as ApproximateDonationUnit,
      estimated_date: estimatedDate(reference, amount, unit as ApproximateDonationUnit),
      reported_at
    };
  }

  return null;
}

/** The exact or server-anchored estimated date used by eligibility checks. */
export function canonicalLastDonationDate(declaration: LastDonationDeclaration | undefined | null) {
  if (!declaration || declaration.kind === 'NEVER') return undefined;
  return declaration.kind === 'EXACT' ? declaration.date : declaration.estimated_date;
}

/**
 * Validates an optional self-declared lifetime donation count.
 *
 * The minimum lets callers enforce that the count is not below the number of
 * detailed records they already hold. Declaration-aware checks reject the
 * impossible combinations of NEVER with a positive count and a prior donation
 * with a zero count.
 */
export function parseDonationCount(
  value: unknown,
  declaration?: LastDonationDeclaration,
  minimum = 0
): number | undefined | null {
  if (value === undefined || value === null || value === '') return undefined;
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_DONATION_COUNT ||
    !Number.isInteger(minimum) ||
    minimum < 0 ||
    value < minimum
  ) {
    return null;
  }
  if (declaration?.kind === 'NEVER' && value !== 0) return null;
  if (declaration && declaration.kind !== 'NEVER' && value === 0) return null;
  return value;
}

function parseLegacyDonationDate(value: unknown, now: Date | number) {
  if (typeof value !== 'string') return null;
  const dateOnly = value.slice(0, 10);
  if (!parseDonationDate(dateOnly, now)) return null;
  if (value === dateOnly) return dateOnly;

  const instant = new Date(value);
  return !Number.isNaN(instant.getTime()) && instant.toISOString().slice(0, 10) === dateOnly
    ? dateOnly
    : null;
}

/**
 * Builds the only donation fields intended for a public donor card.
 *
 * A legacy `last_donation_date` becomes an exact summary only when no newer
 * declaration exists. A lifetime count is never inferred from detailed history.
 */
export function createPublicDonationSummary(
  declaration: LastDonationDeclaration | undefined | null,
  donationCount?: number,
  legacyLastDonationDate?: string,
  now: Date | number = Date.now()
): PublicDonationSummary | undefined {
  const legacyDate = !declaration
    ? parseLegacyDonationDate(legacyLastDonationDate, now)
    : null;
  const resolvedDeclaration: LastDonationDeclaration | undefined = declaration || (legacyDate ? {
    kind: 'EXACT',
    date: legacyDate,
    reported_at: validNow(now)?.toISOString() || ''
  } : undefined);
  if (!resolvedDeclaration) return undefined;

  const parsedCount = parseDonationCount(donationCount, resolvedDeclaration);
  const count = parsedCount === null || parsedCount === undefined
    ? {}
    : { donation_count: parsedCount };

  if (resolvedDeclaration.kind === 'NEVER') return { kind: 'NEVER', ...count };
  if (resolvedDeclaration.kind === 'EXACT') {
    return { kind: 'EXACT', date: resolvedDeclaration.date, ...count };
  }
  return {
    kind: 'APPROXIMATE',
    value: resolvedDeclaration.value,
    unit: resolvedDeclaration.unit,
    estimated_date: resolvedDeclaration.estimated_date,
    ...count
  };
}
