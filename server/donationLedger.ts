export type DonationLedgerInput = {
  requestedTotal?: number;
  requestedBeforeHistory?: number;
  existingTotal?: number;
  existingBeforeHistory?: number;
  existingHistoryLength: number;
  nextHistoryLength: number;
};

export type DonationLedger = {
  donations_before_history: number;
  donation_count: number;
};

function wholeCount(value: number | undefined) {
  return value !== undefined && Number.isInteger(value) && value >= 0 ? value : undefined;
}

/**
 * Resolves the compatibility lifetime count into an additive ledger. A user
 * changing the lifetime total updates the pre-history baseline. A history-only
 * edit preserves that baseline, so each detailed record is counted exactly
 * once and deleting an erroneous record removes exactly one donation.
 */
export function resolveDonationLedger(input: DonationLedgerInput): DonationLedger | null {
  const requestedTotal = wholeCount(input.requestedTotal);
  const requestedBefore = wholeCount(input.requestedBeforeHistory);
  const existingTotal = wholeCount(input.existingTotal);
  const storedBefore = wholeCount(input.existingBeforeHistory);
  const migratedBefore = storedBefore ?? Math.max(0, (existingTotal ?? input.existingHistoryLength) - input.existingHistoryLength);
  const totalWasChanged = requestedTotal !== undefined && requestedTotal !== existingTotal;

  let beforeHistory: number;
  if (totalWasChanged || (existingTotal === undefined && requestedTotal !== undefined && storedBefore === undefined)) {
    if (requestedTotal! < input.nextHistoryLength) return null;
    beforeHistory = requestedTotal! - input.nextHistoryLength;
  } else {
    beforeHistory = requestedBefore ?? migratedBefore;
  }

  return {
    donations_before_history: beforeHistory,
    donation_count: beforeHistory + input.nextHistoryLength
  };
}

export function migrateDonationLedger(
  profile: { donation_count?: number; donations_before_history?: number; donation_history?: unknown[] }
): DonationLedger {
  const historyLength = Array.isArray(profile.donation_history) ? profile.donation_history.length : 0;
  const resolved = resolveDonationLedger({
    existingTotal: profile.donation_count,
    existingBeforeHistory: profile.donations_before_history,
    existingHistoryLength: historyLength,
    nextHistoryLength: historyLength
  });
  return resolved || { donations_before_history: 0, donation_count: historyLength };
}
