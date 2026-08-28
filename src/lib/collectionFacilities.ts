import {
  facilityDisplayName,
  facilityLocalityKey,
  facilityNameKey
} from './facilityIdentity';

export type RegisteredCollectionFacility = {
  registryCode: string;
  registryCodes: string[];
  name: string;
  district: string;
  locality: string;
};

type CollectionFacilityRow = [registryCode: string, name: string, locality: string, registryCodes?: string[]];

export const COLLECTION_FACILITY_SOURCE_URL =
  'https://hrm.dghs.gov.bd/public/facility-registry';

export function collectionFacilityDistrictSlug(district: string) {
  return district
    .trim()
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function isCollectionFacilityRow(value: unknown): value is CollectionFacilityRow {
  return Array.isArray(value)
    && (value.length === 3 || value.length === 4)
    && value.slice(0, 3).every(item => typeof item === 'string')
    && (value[3] === undefined || (Array.isArray(value[3]) && value[3].every(item => typeof item === 'string')));
}

function displayScore(name: string) {
  const letters = name.replace(/[^A-Za-z]/g, '');
  const allUppercase = Boolean(letters) && letters === letters.toUpperCase();
  return (allUppercase ? 1000 : 0) + Math.abs(name.length - 45);
}

export function deduplicateRegisteredCollectionFacilities(
  facilities: RegisteredCollectionFacility[]
) {
  const localitiesByName = new Map<string, Map<string, string>>();
  for (const facility of facilities) {
    const nameKey = facilityNameKey(facility.name);
    const localityKey = facilityLocalityKey(facility.locality);
    if (!localityKey) continue;
    const localities = localitiesByName.get(nameKey) ?? new Map<string, string>();
    if (!localities.has(localityKey)) localities.set(localityKey, facility.locality.trim());
    localitiesByName.set(nameKey, localities);
  }

  const grouped = new Map<string, RegisteredCollectionFacility>();
  for (const facility of facilities) {
    const nameKey = facilityNameKey(facility.name);
    const knownLocalities = localitiesByName.get(nameKey);
    const inferredLocality = facility.locality.trim()
      || (knownLocalities?.size === 1 ? [...knownLocalities.values()][0] : '');
    const groupKey = `${nameKey}|${facilityLocalityKey(inferredLocality)}`;
    const registryCodes = [...new Set([facility.registryCode, ...facility.registryCodes])].sort();
    const existing = grouped.get(groupKey);
    const overrideName = facilityDisplayName(facility.name);

    if (!existing) {
      grouped.set(groupKey, {
        ...facility,
        registryCode: registryCodes[0],
        registryCodes,
        name: overrideName || facility.name.trim(),
        locality: inferredLocality
      });
      continue;
    }

    existing.registryCodes = [...new Set([...existing.registryCodes, ...registryCodes])].sort();
    existing.registryCode = existing.registryCodes[0];
    if (overrideName) existing.name = overrideName;
    else if (displayScore(facility.name) < displayScore(existing.name)) existing.name = facility.name.trim();
    if (!existing.locality && inferredLocality) existing.locality = inferredLocality;
  }

  return [...grouped.values()];
}

export async function loadRegisteredCollectionFacilities(
  district: string,
  signal?: AbortSignal
): Promise<RegisteredCollectionFacility[]> {
  if (!district.trim()) return [];

  const slug = collectionFacilityDistrictSlug(district);
  const response = await fetch(`/collection-facilities/${slug}.json`, { signal });
  if (!response.ok) {
    throw new Error(`Unable to load registered facilities for ${district}.`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error(`Invalid registered facility data for ${district}.`);
  }

  return deduplicateRegisteredCollectionFacilities(payload
    .filter(isCollectionFacilityRow)
    .map(([registryCode, name, locality, registryCodes]) => ({
      registryCode,
      registryCodes: registryCodes?.length ? registryCodes : [registryCode],
      name,
      district,
      locality
    })));
}
