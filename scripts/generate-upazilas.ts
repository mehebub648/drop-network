// Generates `server/upazilas.ts` from the scraped Bangladesh Scouts register.
//
//   npm run generate-upazilas
//   npm run generate-upazilas -- --in=data/scraped/bd-scouts.ndjson --report
//
// The register is the only upazila/thana-level source in this project, and its
// spellings are the join key for every row in `imported_donors`. So the
// generated `value` is byte-identical to what the scraper stored: changing it
// would orphan the listings it is meant to find. Display names live in a
// separate `label` field.
//
// `data/` is gitignored, so the generated output is committed and this script
// only needs to run when the register is re-scraped.

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { getLocationByName } from '../src/lib/locations';

const DEFAULT_INPUT = 'data/scraped/bd-scouts.ndjson';
const OUTPUT = 'server/upazilas.ts';

/**
 * Different stored spellings of the same place. Left side is the spelling to
 * fold away, right side is the spelling to keep. Every entry is a reviewed
 * judgment, not the output of a similarity heuristic: `Uttara`, `Uttara East`
 * and `Uttara West` are three real thanas, as are `Keraniganj` and
 * `Dakshin Keraniganj`, and none of them belong here.
 *
 * Folding is lossless. Both spellings survive in the generated `variants`
 * list, so a database filter still matches rows stored under either one.
 */
const UPAZILA_ALIASES: Record<string, Record<string, string>> = {
  Dhaka: {
    // Chawkbazar Model Thana, spelled two ways by the register.
    'Chalk Bazar': 'Chackbazar Model',
    // "South" and "Dakshin" are the same word.
    'South Keraniganj': 'Dakshin Keraniganj'
  },
  Jashore: {
    // Benapole Port Thana.
    Benapole: 'Benapole PORT'
  },
  Barishal: {
    // Barishal Airport Thana, listed in both scripts.
    'Biman Bandar': 'বিমান বন্দর'
  }
};

/**
 * English display labels for the 35 register entries written in Bengali
 * script. Three districts depend on these: Barguna and Jhalokati have no Latin
 * spellings at all, and Barishal has exactly one, so without this map their
 * dropdowns would be unreadable to an English-only interface.
 *
 * These are transliterations of well-known upazila names, reviewed once. The
 * stored value is untouched.
 */
const UPAZILA_LABELS: Record<string, string> = {
  // Barishal
  'বরিশাল সদর': 'Barishal Sadar',
  'বাকেরগঞ্জ': 'Bakerganj',
  'গৌরনদী': 'Gournadi',
  'উজিরপুর': 'Ujirpur',
  'হিজলা': 'Hizla',
  'বাবুগঞ্জ': 'Babuganj',
  'মুলাদী': 'Muladi',
  'মেহেন্দিগঞ্জ': 'Mehendiganj',
  'বানারীপাড়া': 'Banaripara',
  'আগৈলঝাড়া': 'Agailjhara',
  'কতোয়ালী': 'Kotwali',
  'কাউনিয়া': 'Kaunia',
  'বিমান বন্দর': 'Biman Bandar',
  'বন্দর': 'Bandar',
  'কাজীর হাট': 'Kazir Hat',
  // Barguna
  'বরগুনা সদর': 'Barguna Sadar',
  'পাথরঘাটা': 'Patharghata',
  'আমতলী': 'Amtali',
  'তালতলী': 'Taltali',
  'বেতাগি': 'Betagi',
  'বামনা': 'Bamna',
  // Jhalokati
  'ঝালকাঠি সদর': 'Jhalokati Sadar',
  'কাঁঠালিয়া': 'Kathalia',
  'নলছিটি': 'Nalchity',
  'রাজাপুর': 'Rajapur',
  // Bhola
  'ভোলা সদর': 'Bhola Sadar',
  'চরফ্যাশন': 'Charfashion',
  'বোরহানউদ্দিন': 'Borhanuddin',
  'লালমোহন': 'Lalmohan',
  'দৌলতখান': 'Daulatkhan',
  'মনপুরা': 'Monpura',
  'তজমুদ্দিন': 'Tazumuddin',
  // Cumilla
  'লালমাই': 'Lalmai',
  // Chattogram
  'কর্ণফুলী': 'Karnaphuli',
  // Cox's Bazar
  'ঈদগাঁও': 'Eidgaon',
  // Dhaka - the alias target, so it needs a label of its own.
  'Chackbazar Model': 'Chawk Bazar',
  Benapole: 'Benapole Port',
  'Benapole PORT': 'Benapole Port'
};

// Nothing is excluded. Entries that look like noise at first glance are real
// places: `Dhaka Railway` and `Shahjalal Airport` are Dhaka Metropolitan
// thanas, and `Shasibussion` / `Dakshinaicha` are settlements in Bhola.
// Dropping any of them would make the donors listed there unreachable.

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (const entry of argv) {
    const match = entry.match(/^--([^=]+)=?(.*)$/);
    if (match) args.set(match[1], match[2]);
  }
  return args;
}

/** Case- and punctuation-insensitive key used to merge identical spellings. */
function foldKey(value: string) {
  return value.toLowerCase().replace(/[^\p{Letter}\p{Number}]/gu, '');
}

function cleanValue(raw: unknown) {
  if (typeof raw !== 'string') return '';
  return raw.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, 80);
}

type Bucket = { value: string; variants: Map<string, number> };

async function collect(file: string) {
  // district -> foldKey -> bucket
  const districts = new Map<string, Map<string, Bucket>>();
  const stats = { lines: 0, noDistrict: 0, noUpazila: 0 };

  const reader = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of reader) {
    if (!line.trim()) continue;
    stats.lines += 1;
    let parsed: any;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    // Resolve through the district table so legacy spellings collapse onto the
    // canonical name the rest of the app uses.
    const district = getLocationByName(cleanValue(parsed?.district))?.area_name;
    if (!district) {
      stats.noDistrict += 1;
      continue;
    }
    const upazila = cleanValue(parsed?.upazila);
    if (!upazila) {
      stats.noUpazila += 1;
      continue;
    }

    const aliased = UPAZILA_ALIASES[district]?.[upazila] || upazila;
    if (!districts.has(district)) districts.set(district, new Map());
    const buckets = districts.get(district)!;
    const key = foldKey(aliased);
    if (!buckets.has(key)) buckets.set(key, { value: aliased, variants: new Map() });
    const bucket = buckets.get(key)!;
    bucket.variants.set(upazila, (bucket.variants.get(upazila) || 0) + 1);
  }

  return { districts, stats };
}

function render(districts: Map<string, Map<string, Bucket>>, source: string, lines: number) {
  const entries: string[] = [];
  let pairCount = 0;

  for (const district of [...districts.keys()].sort()) {
    const buckets = [...districts.get(district)!.values()].map(bucket => {
      const variants = [...bucket.variants.entries()].sort((a, b) => b[1] - a[1]);
      // Alias targets can be absent from the raw data; fall back to the
      // most-used spelling that actually occurs.
      const value = bucket.variants.has(bucket.value) ? bucket.value : variants[0][0];
      return {
        value,
        label: UPAZILA_LABELS[value] || value,
        variants: variants.map(([spelling]) => spelling),
        donor_count: variants.reduce((sum, [, count]) => sum + count, 0)
      };
    });
    buckets.sort((a, b) => a.label.localeCompare(b.label, 'en'));
    pairCount += buckets.length;

    const rows = buckets
      .map(item => `    ${JSON.stringify(item)}`)
      .join(',\n');
    entries.push(`  ${JSON.stringify(district)}: [\n${rows}\n  ]`);
  }

  return `// GENERATED FILE - do not edit by hand.
//
// Source:    ${source}
// Rows read: ${lines.toLocaleString('en-US')}
// Pairs:     ${pairCount.toLocaleString('en-US')} across ${districts.size} districts
// Generated: ${new Date().toISOString().slice(0, 10)} by scripts/generate-upazilas.ts
//
// \`value\` is byte-identical to the spelling stored on imported donor records,
// because that string is the join key for a district+upazila search. \`label\`
// is the English display name; for the entries the source register wrote in
// Bengali script it is a reviewed transliteration. \`variants\` lists every
// stored spelling that means this place, so a query can match all of them.
//
// This module must have no imports: it is loaded by the Express server, which
// runs from a production image that contains only \`server/\` and \`dist/\`, and
// it is re-exported into the browser bundle through src/lib/upazilas.ts.

export type Upazila = {
  value: string;
  label: string;
  variants: string[];
  donor_count: number;
};

export const UPAZILAS_BY_DISTRICT: Record<string, Upazila[]> = {
${entries.join(',\n')}
};

export const UPAZILA_DISTRICTS = Object.keys(UPAZILAS_BY_DISTRICT);

function fold(value: string) {
  return value.normalize('NFC').toLowerCase().replace(/[^\\p{Letter}\\p{Number}]/gu, '');
}

const BY_DISTRICT_KEY = new Map(
  Object.entries(UPAZILAS_BY_DISTRICT).map(([district, list]) => [fold(district), list])
);

export function getUpazilasForDistrict(district: string): Upazila[] {
  if (typeof district !== 'string') return [];
  return BY_DISTRICT_KEY.get(fold(district)) || [];
}

/**
 * Resolves any stored spelling - canonical or variant, in either script - to
 * its entry. Matching is exact after folding; there are no upazila coordinates
 * in this project, so there is no distance-based fallback and none should be
 * invented.
 */
export function getUpazilaByName(district: string, name: string): Upazila | null {
  if (typeof name !== 'string' || !name.trim()) return null;
  const key = fold(name);
  return getUpazilasForDistrict(district).find(item =>
    fold(item.value) === key || item.variants.some(variant => fold(variant) === key)
  ) || null;
}

export function isValidUpazila(district: string, name: string): boolean {
  return getUpazilaByName(district, name) !== null;
}

/**
 * Every stored spelling for a place, for building an \`IN (...)\` filter. An
 * unknown name resolves to itself so a caller never silently searches nothing.
 */
export function getUpazilaVariants(district: string, name: string): string[] {
  const upazila = getUpazilaByName(district, name);
  return upazila ? upazila.variants : [name];
}
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = path.resolve(args.get('in') || DEFAULT_INPUT);

  if (!fs.existsSync(input)) {
    console.error(
      `No scraped register at ${input}.\n` +
      'Run "npm run scrape -- --source=bd-scouts" first; data/ is gitignored, so it is not in a fresh clone.'
    );
    process.exit(1);
  }

  const { districts, stats } = await collect(input);
  if (districts.size === 0) {
    console.error(`${input} produced no usable district/upazila pairs.`);
    process.exit(1);
  }

  const relativeSource = path.relative(process.cwd(), input).split(path.sep).join('/');
  const output = render(districts, relativeSource, stats.lines);
  fs.writeFileSync(path.resolve(OUTPUT), output, 'utf8');

  const pairs = [...districts.values()].reduce((sum, buckets) => sum + buckets.size, 0);
  console.log(
    `${stats.lines.toLocaleString('en-US')} lines -> ${pairs} upazilas across ${districts.size} districts\n` +
    `  ${stats.noDistrict} rows skipped for an unrecognised district, ${stats.noUpazila} for a blank upazila\n` +
    `  wrote ${OUTPUT}`
  );

  if (args.has('report')) {
    for (const district of [...districts.keys()].sort()) {
      for (const bucket of districts.get(district)!.values()) {
        if (bucket.variants.size > 1) {
          console.log(`  merged ${district}: ${[...bucket.variants.keys()].join(' | ')}`);
        }
      }
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
