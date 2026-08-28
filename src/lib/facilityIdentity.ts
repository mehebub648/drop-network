const FACILITY_NAME_ALIASES: Record<string, string> = {
  'east west medical college': 'east west medical college hospital limited'
};

const FACILITY_DISPLAY_NAMES: Record<string, string> = {
  'east west medical college hospital limited': 'East-West Medical College & Hospital Limited'
};

function words(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/&/g, ' and ')
    .replace(/\bltd\b/g, ' limited ')
    .replace(/\bpvt\b/g, ' private ')
    .replace(/\bcentre\b/g, ' center ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\band\b/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function facilityNameKey(value: string) {
  const normalized = words(value);
  return FACILITY_NAME_ALIASES[normalized] ?? normalized;
}

export function facilityLocalityKey(value: string) {
  return words(value);
}

export function facilityDisplayName(value: string) {
  return FACILITY_DISPLAY_NAMES[facilityNameKey(value)];
}

export function sameFacilityName(left?: string, right?: string) {
  if (!left || !right) return false;
  return facilityNameKey(left) === facilityNameKey(right);
}
