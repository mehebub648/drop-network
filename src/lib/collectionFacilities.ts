export type RegisteredCollectionFacility = {
  registryCode: string;
  name: string;
  district: string;
  locality: string;
};

type CollectionFacilityRow = [registryCode: string, name: string, locality: string];

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
    && value.length === 3
    && value.every(item => typeof item === 'string');
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

  return payload
    .filter(isCollectionFacilityRow)
    .map(([registryCode, name, locality]) => ({
      registryCode,
      name,
      district,
      locality
    }));
}
