import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BD_LOCATION_NAMES } from '../server/locations';

const REGISTRY_ENDPOINT =
  'https://hrm.dghs.gov.bd/index.php/public/facility-registry/facilities/datatable/json';
const REGISTRY_PAGE =
  'https://hrm.dghs.gov.bd/index.php/public/facility-registry';

// 11 and 14 are the two distinct DGHS Administration values. IDs 2 and 9
// are Administrative and Knowledge Management(Medical Library).
const EXCLUDED_FUNCTION_IDS = new Set(['2', '9', '11', '14']);
const OUTPUT_DIRECTORY = path.resolve('public/collection-facilities');

const DISTRICT_ALIASES: Record<string, string> = {
  Barisal: 'Barishal',
  Bogra: 'Bogura',
  Chittagong: 'Chattogram',
  Comilla: 'Cumilla',
  Jessore: 'Jashore',
  Jhalokathi: 'Jhalokati',
  Khagrachari: 'Khagrachhari',
  Maulvibazar: 'Moulvibazar',
  Netrakona: 'Netrokona'
};

// These DGHS records have a blank district even though the registered name
// identifies it. Keep the correction tied to the stable registry code.
const DISTRICT_BY_REGISTRY_CODE: Record<string, string> = {
  '10024239': 'Cumilla',
  '10036324': 'Dhaka',
  '10036325': 'Chattogram',
  '10036326': 'Mymensingh',
  '10036329': 'Dhaka',
  '10036330': 'Pabna',
  '10036331': 'Rajshahi',
  '10036332': 'Sylhet',
  '10036337': 'Khulna'
};

type RegistryRow = {
  id?: string;
  name?: string;
  code?: string;
  district_name?: string;
  upazila_name?: string;
};

type RegistryResponse = {
  data?: RegistryRow[];
  recordsFiltered?: number;
};

type CompactFacility = [registryCode: string, name: string, locality: string];

function districtSlug(district: string) {
  return district
    .trim()
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function plainText(value: string) {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x0*27;/gi, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function canonicalDistrict(value: string) {
  const district = plainText(value);
  return DISTRICT_ALIASES[district] ?? district;
}

async function fetchIncludedFunctionIds() {
  const response = await fetch(REGISTRY_PAGE, { headers: { accept: 'text/html' } });
  if (!response.ok) {
    throw new Error(`DGHS registry page request failed with ${response.status}.`);
  }

  const html = await response.text();
  const select = html.match(
    /<select[^>]*name=["']facility_function_id\[\]["'][\s\S]*?<\/select>/i
  )?.[0];
  if (!select) throw new Error('DGHS registry no longer exposes facility function filters.');

  const allIds = [...select.matchAll(/<option\s+value=["'](\d+)["']/gi)].map(match => match[1]);
  if (![...EXCLUDED_FUNCTION_IDS].every(id => allIds.includes(id))) {
    throw new Error('DGHS registry facility function IDs changed; review the exclusions.');
  }

  return allIds.filter(id => !EXCLUDED_FUNCTION_IDS.has(id));
}

async function fetchFacilities() {
  const functionIds = await fetchIncludedFunctionIds();
  const url = new URL(REGISTRY_ENDPOINT);
  url.searchParams.set('draw', '1');
  url.searchParams.set('start', '0');
  url.searchParams.set('length', '50000');
  for (const id of functionIds) {
    url.searchParams.append('facility_function_id[]', id);
  }

  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`DGHS registry request failed with ${response.status}.`);
  }

  const payload = await response.json() as RegistryResponse;
  if (!Array.isArray(payload.data)) {
    throw new Error('DGHS registry returned an invalid facility list.');
  }
  if (payload.recordsFiltered !== payload.data.length) {
    throw new Error(
      `DGHS registry returned ${payload.data.length} of ${payload.recordsFiltered ?? 'an unknown number of'} facilities.`
    );
  }

  return payload.data;
}

const facilities = await fetchFacilities();
const rowsByDistrict = new Map<string, CompactFacility[]>(
  BD_LOCATION_NAMES.map(district => [district, []])
);
let skipped = 0;
const skippedDistricts = new Map<string, number>();
const skippedFacilities: string[] = [];

for (const row of facilities) {
  const name = plainText(row.name ?? '');
  const registryCode = plainText(row.code ?? '') || plainText(row.id ?? '');
  const district = canonicalDistrict(row.district_name ?? '')
    || DISTRICT_BY_REGISTRY_CODE[registryCode]
    || '';
  const districtRows = rowsByDistrict.get(district);
  if (!districtRows || !name || !registryCode) {
    skipped += 1;
    const reason = district || '(blank district)';
    skippedDistricts.set(reason, (skippedDistricts.get(reason) ?? 0) + 1);
    if (skippedFacilities.length < 20) skippedFacilities.push(`${registryCode}: ${name || '(unnamed)'}`);
    continue;
  }

  districtRows.push([
    registryCode,
    name,
    plainText(row.upazila_name ?? '')
  ]);
}

await mkdir(OUTPUT_DIRECTORY, { recursive: true });

let written = 0;
for (const [district, rows] of rowsByDistrict) {
  rows.sort((a, b) => a[1].localeCompare(b[1], 'en') || a[0].localeCompare(b[0], 'en'));
  written += rows.length;
  await writeFile(
    path.join(OUTPUT_DIRECTORY, `${districtSlug(district)}.json`),
    `${JSON.stringify(rows)}\n`,
    'utf8'
  );
}

console.log(JSON.stringify({
  fetched: facilities.length,
  written,
  skipped,
  districts: rowsByDistrict.size,
  skippedDistricts: Object.fromEntries(
    [...skippedDistricts.entries()].sort((a, b) => b[1] - a[1])
  ),
  skippedFacilities
}));
