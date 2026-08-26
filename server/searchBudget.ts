export const DAILY_DISTRICT_LIMIT = 3;
export const DAILY_BLOOD_GROUP_LIMIT = 3;
export const DAILY_UNIQUE_SEARCH_LIMIT = 9;

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type SearchBudgetRecord = {
  day: string;
  districts: Set<string>;
  bloodGroups: Set<string>;
  searches: Set<string>;
};

export type DailySearchBudgetResult = {
  allowed: boolean;
  remaining: number;
  resetAt: string;
  error?: string;
};

function normalized(value: string) {
  return value.trim().toLocaleLowerCase('en-US');
}

export function dhakaDay(now: Date) {
  return new Date(now.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

export function nextDhakaDay(now: Date) {
  const shiftedDay = Math.floor((now.getTime() + DHAKA_OFFSET_MS) / DAY_MS);
  return new Date((shiftedDay + 1) * DAY_MS - DHAKA_OFFSET_MS).toISOString();
}

export function searchFingerprint(input: { bloodGroup: string; district: string; upazila: string }) {
  return [input.bloodGroup, input.district, input.upazila].map(normalized).join('|');
}

export class DailySearchBudget {
  private readonly records = new Map<string, SearchBudgetRecord>();

  consume(input: {
    identities: string[];
    bloodGroup: string;
    district: string;
    upazila: string;
    now?: Date;
  }): DailySearchBudgetResult {
    const now = input.now || new Date();
    const day = dhakaDay(now);
    const identities = [...new Set(input.identities.filter(Boolean))];
    const district = normalized(input.district);
    const bloodGroup = normalized(input.bloodGroup);
    const fingerprint = searchFingerprint(input);
    const records = identities.map(identity => this.recordFor(identity, day));
    const continuation = records.some(record => record.searches.has(fingerprint));

    if (!continuation) {
      for (const record of records) {
        if (!record.districts.has(district) && record.districts.size >= DAILY_DISTRICT_LIMIT) {
          return this.denied(now);
        }
        if (!record.bloodGroups.has(bloodGroup) && record.bloodGroups.size >= DAILY_BLOOD_GROUP_LIMIT) {
          return this.denied(now);
        }
        if (!record.searches.has(fingerprint) && record.searches.size >= DAILY_UNIQUE_SEARCH_LIMIT) {
          return this.denied(now);
        }
      }
    }

    // A known search remains pageable even after another identity (for example
    // a shared IP) reaches its daily ceiling. Add it to each identity only when
    // doing so still fits that identity's budget.
    for (const record of records) {
      const canAdd = record.searches.has(fingerprint) || (
        (record.districts.has(district) || record.districts.size < DAILY_DISTRICT_LIMIT) &&
        (record.bloodGroups.has(bloodGroup) || record.bloodGroups.size < DAILY_BLOOD_GROUP_LIMIT) &&
        record.searches.size < DAILY_UNIQUE_SEARCH_LIMIT
      );
      if (!canAdd) continue;
      record.districts.add(district);
      record.bloodGroups.add(bloodGroup);
      record.searches.add(fingerprint);
    }

    const remaining = records.length === 0
      ? DAILY_UNIQUE_SEARCH_LIMIT
      : Math.min(...records.map(record => Math.max(0, DAILY_UNIQUE_SEARCH_LIMIT - record.searches.size)));
    return { allowed: true, remaining, resetAt: nextDhakaDay(now) };
  }

  private recordFor(identity: string, day: string) {
    const existing = this.records.get(identity);
    if (existing?.day === day) return existing;
    const record: SearchBudgetRecord = {
      day,
      districts: new Set(),
      bloodGroups: new Set(),
      searches: new Set()
    };
    this.records.set(identity, record);
    if (this.records.size > 10_000) {
      for (const [key, value] of this.records) {
        if (value.day !== day) this.records.delete(key);
      }
    }
    return record;
  }

  private denied(now: Date): DailySearchBudgetResult {
    return {
      allowed: false,
      remaining: 0,
      resetAt: nextDhakaDay(now),
      error: 'Daily search limit reached. You can use up to 3 districts, 3 blood groups, and 9 unique searches per day.'
    };
  }
}
