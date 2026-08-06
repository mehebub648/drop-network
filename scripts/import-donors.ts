// Loads scraped NDJSON into the `imported_donors` table.
//
//   npm run import-donors -- --in=data/scraped
//   npm run import-donors -- --in=data/scraped/bd-scouts.ndjson --dry-run
//
// Deliberately a separate step from scraping: the files can be inspected, and
// a bad run can be re-imported without re-hitting anyone's server.

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { getLocationByName } from '../src/lib/locations';
import { addImportedDonors, deleteImportedDonorsByPublicIds, ensureImportedDonorTable, findRemovedListings } from '../server/db';
import {
  dedupeKey,
  toImportedDonor,
  toImportedDonorRow,
  withdrawImportedDonor,
  type ImportedDonor,
  type ScrapedRecordInput
} from '../server/importedDonors';

const BLOOD_GROUPS = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);
const BATCH_SIZE = 1_000;

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (const entry of argv) {
    const match = entry.match(/^--([^=]+)=?(.*)$/);
    if (match) args.set(match[1], match[2]);
  }
  return args;
}

/**
 * Rejects rows that would pollute the directory. "Less is better than
 * incorrect": a row with no usable name is dropped, and an unrecognised blood
 * group or district is blanked rather than guessed, which turns it into a
 * field the claimant has to fill in.
 *
 * A phone number is mandatory rather than optional. A listing nobody can call
 * is not a usable donor, and the number is also the dedupe key, so a row
 * without one cannot be recognised as the same person across sources.
 */
export function sanitizeRecord(raw: unknown): ScrapedRecordInput | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;

  const name = String(record.name ?? '').trim().slice(0, 100);
  const sourceId = String(record.source_id ?? '').trim();
  const sourceRef = String(record.source_ref ?? '').trim();
  if (!name || name.length < 2 || !sourceId || !sourceRef) return null;

  const phone = String(record.phone ?? '').trim();
  if (!/^\+8801[3-9]\d{8}$/.test(phone)) return null;

  const bloodGroup = BLOOD_GROUPS.has(String(record.blood_group ?? '')) ? String(record.blood_group) : '';
  const districtName = String(record.district ?? '').trim();
  const district = districtName && getLocationByName(districtName) ? districtName : '';

  return {
    source_id: sourceId,
    source_organization: String(record.source_organization ?? sourceId).trim().slice(0, 120),
    source_url: String(record.source_url ?? '').trim().slice(0, 300),
    scraped_at: String(record.scraped_at ?? new Date().toISOString()),
    source_ref: sourceRef.slice(0, 80),
    name,
    phone,
    blood_group: bloodGroup,
    district,
    upazila: String(record.upazila ?? '').trim().slice(0, 80),
    extra: (record.extra && typeof record.extra === 'object' ? record.extra : undefined) as
      | Record<string, string | number>
      | undefined
  };
}

function inputFiles(target: string) {
  const resolved = path.resolve(target);
  if (!fs.existsSync(resolved)) return [];
  if (fs.statSync(resolved).isFile()) return [resolved];
  return fs
    .readdirSync(resolved)
    .filter(file => file.endsWith('.ndjson'))
    .map(file => path.join(resolved, file));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = args.get('in') || 'data/scraped';
  const dryRun = args.has('dry-run');
  const files = inputFiles(target);

  if (files.length === 0) {
    console.error(`No .ndjson input found at ${path.resolve(target)}. Run "npm run scrape" first.`);
    process.exit(1);
  }

  const importedAt = new Date().toISOString();
  // Deduping in memory keeps the last-seen version of each person; at a few
  // hundred thousand rows this is a few hundred MB at most.
  const byKey = new Map<string, ImportedDonor>();
  const stats = { read: 0, rejected: 0, duplicates: 0 };

  for (const file of files) {
    const reader = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
    for await (const line of reader) {
      if (!line.trim()) continue;
      stats.read += 1;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        stats.rejected += 1;
        continue;
      }
      const record = sanitizeRecord(parsed);
      if (!record) {
        stats.rejected += 1;
        continue;
      }
      const key = dedupeKey(record);
      if (byKey.has(key)) stats.duplicates += 1;
      byKey.set(key, toImportedDonor(record, importedAt, getLocationByName));
    }
    console.log(`read ${file}`);
  }

  const donors = [...byKey.values()];
  const placed = donors.filter(donor => donor.district && donor.blood_group).length;

  console.log(
    `\n${stats.read} lines -> ${donors.length} unique donors ` +
    `(${stats.rejected} rejected, ${stats.duplicates} duplicates merged)\n` +
    `  every imported donor has a phone number; rows without one are rejected\n` +
    `  ${placed} with both a district and a blood group`
  );

  if (dryRun) {
    console.log('\n--dry-run: nothing written.');
    return;
  }

  await ensureImportedDonorTable();
  let preserved = 0;
  for (let index = 0; index < donors.length; index += BATCH_SIZE) {
    const batch = donors.slice(index, index + BATCH_SIZE);
    // Someone who asked to be taken off the directory stays off it. The source
    // still publishes them, so without carrying the withdrawal forward this
    // import would undo their request.
    const removed = await findRemovedListings(batch.map(donor => donor.public_id));
    preserved += removed.size;
    // Public ids remain stable across the legacy and opaque storage-id formats,
    // so reimports replace old rows instead of leaving duplicates behind.
    await deleteImportedDonorsByPublicIds(batch.map(donor => donor.public_id));
    await addImportedDonors(batch.map(donor => {
      const removedAt = removed.get(donor.public_id);
      return toImportedDonorRow(removedAt ? withdrawImportedDonor(donor, removedAt) : donor);
    }));
    console.log(`imported ${Math.min(index + BATCH_SIZE, donors.length)}/${donors.length}`);
  }
  console.log(
    `\nImport complete.` +
    (preserved > 0 ? `\n  ${preserved} withdrawn listing(s) kept off the directory.` : '')
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
