// Quantum Voluntary Blood Donation Program publishes its donor roll at
// https://blood.quantummethod.org.bd/en/donor-list/regular. The page is an
// Angular app backed by an open JSON API:
//   GET /api/v5/blood-by-rank/{rank}?limit=&page=
//
// The listing is deliberately contact-free: it gives a name, a donation count
// and a lifelong donor id, but no phone number and no district. Those records
// are still worth importing as claimable stubs - the claimant supplies the
// missing contact details - but they can never be shown as "callable".

import { descriptorFor, type DonorSource, type ScrapedDonor } from '../types';
import { fetchJson, normalizeBloodGroup, sleep } from '../util';

const BASE = 'https://blood.quantummethod.org.bd/api/v5/blood-by-rank';
const RANKS = ['regular', 'silver', 'platinum'];
// The API accepts a `limit` but ignores every paging parameter, so a rank can
// only be read from its two ends: the default ordering and the reversed one.
// `total_count` reports the whole population (58k+ regular donors) but the
// listing itself never exposes more than this window.
const PAGE_SIZE = 99;

type RankResponse = {
  success: boolean;
  total_count?: number;
  data?: Array<{
    name?: string;
    rank?: string;
    donation_count?: number;
    blood_donor_id?: string;
    life_long_donor_id?: string;
  }>;
};

/**
 * Lifelong donor ids are prefixed with the ABO/Rh group: "ABPBL66030" is AB
 * positive, "OPGL73865" is O positive, "ANRS12345" is A negative. Anything the
 * prefix table does not cover is left blank rather than guessed.
 */
export function bloodGroupFromLifelongId(id: string | undefined) {
  if (!id) return '';
  const match = id.toUpperCase().match(/^(AB|A|B|O)(P|N)/);
  if (!match) return '';
  return normalizeBloodGroup(`${match[1]}${match[2] === 'P' ? '+' : '-'}`);
}

export const quantumMethod: DonorSource = {
  descriptor: descriptorFor('quantum-method'),

  async *collect({ limit, onProgress }) {
    const seen = new Set<string>();
    let emitted = 0;

    for (const rank of RANKS) {
      for (const reverse of [false, true]) {
        if (emitted >= limit) return;
        const response = await fetchJson<RankResponse>(
          `${BASE}/${rank}?limit=${PAGE_SIZE}${reverse ? '&reverse=true' : ''}`
        );
        const rows = response?.success ? response.data || [] : [];
        if (rows.length === 0) {
          onProgress(`${rank}${reverse ? ' (reversed)' : ''}: no rows returned`);
          continue;
        }

        for (const row of rows) {
          if (emitted >= limit) return;
          const sourceRef = row.blood_donor_id || row.life_long_donor_id || '';
          const name = (row.name || '').trim();
          if (!sourceRef || !name || seen.has(sourceRef)) continue;
          seen.add(sourceRef);

          const donor: ScrapedDonor = {
            source_ref: sourceRef,
            name,
            // The roll never publishes contact details.
            phone: '',
            blood_group: bloodGroupFromLifelongId(row.life_long_donor_id),
            district: '',
            upazila: '',
            extra: {
              rank: row.rank || rank,
              ...(row.donation_count ? { donation_count: row.donation_count } : {}),
              ...(row.life_long_donor_id ? { lifelong_donor_id: row.life_long_donor_id } : {})
            }
          };
          emitted += 1;
          yield donor;
        }

        await sleep(120);
      }
      onProgress(`${rank}: ${emitted} donors so far`);
    }
  }
};
