import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { getLocationByName } from './locations';
import { getUpazilaByName } from './upazilas';

export const TRAVEL_WILLINGNESS = ['HOME_ONLY', 'PREFERRED_AREAS', 'ANYWHERE_IN_DISTRICT'] as const;
export type TravelWillingness = (typeof TRAVEL_WILLINGNESS)[number];

export type PreferredDonationArea = {
  district: string;
  upazila: string;
};

export type PreferredCollectionFacility = {
  registry_code: string;
  name: string;
  district: string;
  locality: string;
};

export type RecurringContactWindow = {
  /** Sunday is 0, matching JavaScript's Date#getDay. */
  days: number[];
  start_time: string;
  end_time: string;
};

export type DonorPreferences = {
  preferred_areas?: PreferredDonationArea[];
  preferred_facilities?: PreferredCollectionFacility[];
  travel_willingness?: TravelWillingness;
  contact_windows?: RecurringContactWindow[];
  /** Private and never projected into search results or donor partitions. */
  private_coordination_note?: string;
};

type FacilityRow = [registryCode: string, name: string, locality: string];

const facilityCache = new Map<string, Promise<FacilityRow[]>>();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, maximum: number) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maximum ? trimmed : null;
}

function facilityDistrictSlug(district: string) {
  return district
    .trim()
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function registeredFacilities(district: string): Promise<FacilityRow[]> {
  const canonical = getLocationByName(district)?.area_name;
  if (!canonical) return [];
  const existing = facilityCache.get(canonical);
  if (existing) return existing;

  const loading = (async () => {
    const slug = facilityDistrictSlug(canonical);
    const candidates = [
      path.join(process.cwd(), 'dist', 'collection-facilities', `${slug}.json`),
      path.join(process.cwd(), 'public', 'collection-facilities', `${slug}.json`)
    ];
    for (const candidate of candidates) {
      try {
        const payload: unknown = JSON.parse(await readFile(candidate, 'utf8'));
        if (!Array.isArray(payload)) continue;
        return payload.filter((row): row is FacilityRow =>
          Array.isArray(row) && row.length === 3 && row.every(item => typeof item === 'string')
        );
      } catch {
        // Development and production keep the generated registry in different
        // roots. Try the other verified application path before failing.
      }
    }
    return [];
  })();
  facilityCache.set(canonical, loading);
  return loading;
}

function parseAreas(value: unknown): PreferredDonationArea[] | null {
  if (!Array.isArray(value) || value.length > 10) return null;
  const parsed: PreferredDonationArea[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isPlainObject(item)) return null;
    const district = cleanString(item.district, 80);
    const canonicalDistrict = district ? getLocationByName(district)?.area_name : undefined;
    const upazilaName = cleanString(item.upazila, 100);
    const upazila = canonicalDistrict && upazilaName
      ? getUpazilaByName(canonicalDistrict, upazilaName)
      : null;
    if (!canonicalDistrict || !upazila) return null;
    const key = `${canonicalDistrict}\u0000${upazila.value}`.toLocaleLowerCase('en');
    if (seen.has(key)) continue;
    seen.add(key);
    parsed.push({ district: canonicalDistrict, upazila: upazila.value });
  }
  return parsed;
}

async function parseFacilities(value: unknown): Promise<PreferredCollectionFacility[] | null> {
  if (!Array.isArray(value) || value.length > 8) return null;
  const parsed: PreferredCollectionFacility[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isPlainObject(item)) return null;
    const registryCode = cleanString(item.registry_code, 40);
    const district = cleanString(item.district, 80);
    const canonicalDistrict = district ? getLocationByName(district)?.area_name : undefined;
    if (!registryCode || !canonicalDistrict || seen.has(registryCode)) {
      if (registryCode && seen.has(registryCode)) continue;
      return null;
    }
    const rows = await registeredFacilities(canonicalDistrict);
    const registered = rows.find(row => row[0] === registryCode);
    if (!registered) return null;
    seen.add(registryCode);
    parsed.push({
      registry_code: registered[0],
      name: registered[1],
      district: canonicalDistrict,
      locality: registered[2]
    });
  }
  return parsed;
}

function parseWindows(value: unknown): RecurringContactWindow[] | null {
  if (!Array.isArray(value) || value.length > 3) return null;
  const parsed: RecurringContactWindow[] = [];
  const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  for (const item of value) {
    if (!isPlainObject(item) || !Array.isArray(item.days)) return null;
    const days = [...new Set(item.days)]
      .filter((day): day is number => typeof day === 'number' && Number.isInteger(day) && day >= 0 && day <= 6)
      .sort((a, b) => a - b);
    const startTime = cleanString(item.start_time, 5);
    const endTime = cleanString(item.end_time, 5);
    if (days.length === 0 || !startTime || !endTime || !timePattern.test(startTime) || !timePattern.test(endTime) || startTime === endTime) {
      return null;
    }
    parsed.push({ days, start_time: startTime, end_time: endTime });
  }
  return parsed;
}

export async function parseDonorPreferences(
  body: Record<string, unknown>,
  existing: DonorPreferences | undefined
): Promise<{ value: DonorPreferences } | { error: string }> {
  const preferredAreas = body.preferred_areas === undefined
    ? existing?.preferred_areas
    : parseAreas(body.preferred_areas);
  if (preferredAreas === null) return { error: 'Choose up to 10 valid preferred donation areas' };

  const preferredFacilities = body.preferred_facilities === undefined
    ? existing?.preferred_facilities
    : await parseFacilities(body.preferred_facilities);
  if (preferredFacilities === null) return { error: 'Choose up to 8 facilities from the registered facility list' };

  const travelWillingness = body.travel_willingness === undefined
    ? existing?.travel_willingness || 'HOME_ONLY'
    : typeof body.travel_willingness === 'string' && TRAVEL_WILLINGNESS.includes(body.travel_willingness as TravelWillingness)
      ? body.travel_willingness as TravelWillingness
      : null;
  if (!travelWillingness) return { error: 'Choose a valid travel preference' };

  const contactWindows = body.contact_windows === undefined
    ? existing?.contact_windows
    : parseWindows(body.contact_windows);
  if (contactWindows === null) return { error: 'Add up to 3 valid recurring contact windows' };

  let privateNote = existing?.private_coordination_note;
  if (body.private_coordination_note !== undefined) {
    if (typeof body.private_coordination_note === 'string' && body.private_coordination_note.trim() === '') privateNote = undefined;
    else {
      privateNote = cleanString(body.private_coordination_note, 500) || undefined;
      if (!privateNote) return { error: 'Private coordination note must be 500 characters or fewer' };
    }
  }

  return {
    value: {
      preferred_areas: preferredAreas || [],
      preferred_facilities: preferredFacilities || [],
      travel_willingness: travelWillingness,
      contact_windows: contactWindows || [],
      private_coordination_note: privateNote
    }
  };
}
