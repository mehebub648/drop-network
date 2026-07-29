// Bangladesh Scouts publishes its blood-donor register at
// https://service.scouts.gov.bd/blood-donation/1 as an open search form: pick a
// division/district/upazila and a blood group and the server renders name,
// membership id, mobile number and address.
//
// The result page is hard-capped at 500 rows regardless of the path segment
// (the segment looks like a page number but is ignored), so the only way to
// read the whole register is to make the query narrow enough that each
// combination stays under the cap: every upazila/thana crossed with every
// blood group.

import { descriptorFor, type DonorSource, type ScrapedDonor } from '../types';
import { cleanText, fetchJson, fetchText, mapPool, normalizeBloodGroup, normalizePhone } from '../util';

const BASE = 'https://service.scouts.gov.bd';
/** The server truncates any single search at this many rows. */
const RESULT_CAP = 500;
// The register answers a search in roughly 25 seconds and starts returning
// 504s well before it saturates: at 16 concurrent searches it fell over. Four
// is what it sustains, and `fetchText` pauses every worker if it starts
// failing anyway. A full run takes hours; that is the host's limit, not ours
// to optimise away.
const REQUEST_CONCURRENCY = 4;
/** Upazilas per batch. Smaller batches flush results to disk more often. */
const UPAZILA_BATCH = 8;

// The public form exposes blood groups as 1-8 in ABO/Rh order.
const BLOOD_GROUP_IDS: Array<[string, string]> = [
  ['1', 'A+'], ['2', 'A-'], ['3', 'B+'], ['4', 'B-'],
  ['5', 'AB+'], ['6', 'AB-'], ['7', 'O+'], ['8', 'O-']
];

// District ids come from the form's own <select>. Names are the canonical
// spellings used by src/lib/locations.ts so imported rows land on a known
// district centroid.
const DISTRICTS: Record<string, string> = {
  '1': 'Dhaka', '2': 'Faridpur', '3': 'Gazipur', '4': 'Gopalganj', '5': 'Jamalpur',
  '6': 'Kishoreganj', '7': 'Madaripur', '8': 'Manikganj', '9': 'Munshiganj', '10': 'Mymensingh',
  '11': 'Narayanganj', '12': 'Narsingdi', '13': 'Netrokona', '14': 'Rajbari', '15': 'Shariatpur',
  '16': 'Sherpur', '17': 'Tangail', '18': 'Brahmanbaria', '19': 'Cumilla', '20': 'Chandpur',
  '21': 'Lakshmipur', '22': 'Noakhali', '23': 'Feni', '24': 'Chattogram', '25': 'Khagrachhari',
  '26': 'Rangamati', '27': 'Bandarban', '28': "Cox's Bazar", '29': 'Joypurhat', '30': 'Bogura',
  '31': 'Naogaon', '32': 'Natore', '33': 'Chapainawabganj', '34': 'Pabna', '35': 'Rajshahi',
  '36': 'Sirajganj', '37': 'Habiganj', '38': 'Moulvibazar', '39': 'Sunamganj', '40': 'Sylhet',
  '41': 'Bagerhat', '42': 'Chuadanga', '43': 'Jashore', '44': 'Jhenaidah', '45': 'Khulna',
  '46': 'Kushtia', '47': 'Magura', '48': 'Meherpur', '49': 'Narail', '50': 'Satkhira',
  '51': 'Rangpur', '52': 'Dinajpur', '53': 'Kurigram', '54': 'Gaibandha', '55': 'Nilphamari',
  '56': 'Panchagarh', '57': 'Thakurgaon', '58': 'Lalmonirhat', '59': 'Barishal', '60': 'Barguna',
  '61': 'Bhola', '62': 'Jhalokati', '63': 'Patuakhali', '64': 'Pirojpur'
};

// One `<div class="row single_search">` per donor. The markup is stable but
// loosely formatted, so each field is pulled out on its own rather than with a
// single brittle whole-block pattern.
const CARD_PATTERN = /<div class="row single_search"[\s\S]*?<\/div>\s*<\/div>/g;
const MEMBER_PATTERN = /margin-left:\s*15px;">([^<]*)</;
const NAME_PATTERN = /<h6><b>([\s\S]*?)<\/b><\/h6>/;
const PHONE_PATTERN = /মোবাইল:\s*([^<]*)</;
const ADDRESS_PATTERN = /ঠিকানা\s*:\s*([^<]*)</;

function parseCards(html: string) {
  const rows: Array<{ memberId: string; name: string; phone: string; address: string }> = [];
  for (const [card] of html.matchAll(CARD_PATTERN)) {
    const name = cleanText(card.match(NAME_PATTERN)?.[1] || '');
    if (!name) continue;
    rows.push({
      memberId: cleanText(card.match(MEMBER_PATTERN)?.[1] || ''),
      name,
      phone: normalizePhone(card.match(PHONE_PATTERN)?.[1] || ''),
      address: cleanText(card.match(ADDRESS_PATTERN)?.[1] || '').replace(/^[,\s]+|[,\s]+$/g, '')
    });
  }
  return rows;
}

async function fetchUpazilas(districtId: string) {
  const map = await fetchJson<Record<string, string>>(`${BASE}/site/ajax_get_upa_tha_by_dis/${districtId}`);
  if (!map) return [];
  // Key "0" is the "select an upazila" placeholder option.
  return Object.entries(map)
    .filter(([id]) => id !== '0')
    .map(([id, name]) => ({ id, name: cleanText(name) }));
}

export const bdScouts: DonorSource = {
  descriptor: descriptorFor('bd-scouts'),

  async *collect({ limit, onProgress }) {
    const seen = new Set<string>();
    let emitted = 0;

    for (const [districtId, districtName] of Object.entries(DISTRICTS)) {
      if (emitted >= limit) return;
      const upazilas = await fetchUpazilas(districtId);
      if (upazilas.length === 0) {
        onProgress(`${districtName}: no upazila list returned, skipping`);
        continue;
      }

      // Every upazila x blood-group combination in the district. Batched so a
      // long run keeps flushing records to disk instead of holding a whole
      // district in memory until it finishes.
      let districtCount = 0;
      for (let start = 0; start < upazilas.length; start += UPAZILA_BATCH) {
        if (emitted >= limit) return;
        const batch = upazilas.slice(start, start + UPAZILA_BATCH);
        const combinations = batch.flatMap(upazila =>
          BLOOD_GROUP_IDS.map(([groupId, bloodGroup]) => ({ upazila, groupId, bloodGroup }))
        );

        const pages = await mapPool(combinations, REQUEST_CONCURRENCY, async ({ upazila, groupId, bloodGroup }) => {
          const query = `bDivision=&bDistrict=${districtId}&bUpaThana=${upazila.id}&bg=${groupId}`;
          const html = await fetchText(`${BASE}/blood-donation/1?${query}`);
          if (!html) return { upazila, bloodGroup, rows: [] as ReturnType<typeof parseCards> };
          return { upazila, bloodGroup, rows: parseCards(html) };
        });

        for (const page of pages) {
          if (page.rows.length >= RESULT_CAP) {
            // Nothing narrower than upazila+group is exposed, so record the
            // truncation instead of silently losing the tail.
            onProgress(`TRUNCATED ${districtName}/${page.upazila.name} ${page.bloodGroup}: hit the ${RESULT_CAP}-row cap`);
          }
          for (const row of page.rows) {
            if (emitted >= limit) return;
            const sourceRef = row.memberId || `${page.upazila.id}-${row.phone || row.name}`;
            if (seen.has(sourceRef)) continue;
            seen.add(sourceRef);

            const donor: ScrapedDonor = {
              source_ref: sourceRef,
              name: row.name,
              phone: row.phone,
              blood_group: normalizeBloodGroup(page.bloodGroup),
              district: districtName,
              upazila: page.upazila.name,
              extra: {
                membership_id: row.memberId,
                ...(row.address ? { address: row.address } : {})
              }
            };
            emitted += 1;
            districtCount += 1;
            yield donor;
          }
        }
        onProgress(`${districtName}: ${Math.min(start + UPAZILA_BATCH, upazilas.length)}/${upazilas.length} upazilas, ${districtCount} donors (${emitted} total)`);
      }
    }
  }
};
