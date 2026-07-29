// Scrape runner.
//
//   npm run scrape -- --source=bd-scouts --limit=200000
//   npm run scrape -- --source=all --out=data/scraped
//   npm run scrape -- --source=bd-scouts --resume
//
// `--resume` appends to the existing NDJSON and skips records already in it,
// which matters because a full run takes hours against slow hosts.
//
// Each source streams NDJSON to `data/scraped/<source-id>.ndjson`. Nothing is
// written into the datastore here; `npm run import-donors` does that as a
// separate, reviewable step.

import fs from 'fs';
import path from 'path';
import type { DonorSource, ScrapedRecord } from './types';
import { bdScouts } from './sources/bdScouts';
import { quantumMethod } from './sources/quantumMethod';

const SOURCES: DonorSource[] = [bdScouts, quantumMethod];

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (const entry of argv) {
    const match = entry.match(/^--([^=]+)=?(.*)$/);
    if (match) args.set(match[1], match[2]);
  }
  return args;
}

/** Source refs already on disk, so a resumed run does not duplicate them. */
function existingRefs(outFile: string) {
  const refs = new Set<string>();
  if (!fs.existsSync(outFile)) return refs;
  for (const line of fs.readFileSync(outFile, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      refs.add(JSON.parse(line).source_ref);
    } catch {
      // A truncated final line from an interrupted run; ignore it.
    }
  }
  return refs;
}

async function runSource(source: DonorSource, limit: number, outDir: string, resume: boolean) {
  const outFile = path.join(outDir, `${source.descriptor.id}.ndjson`);
  // A full run takes hours against slow hosts, so an interrupted run must not
  // throw away what it already collected.
  const alreadyHave = resume ? existingRefs(outFile) : new Set<string>();
  const stream = fs.createWriteStream(outFile, { flags: resume ? 'a' : 'w' });
  const scrapedAt = new Date().toISOString();
  let count = alreadyHave.size;
  let withPhone = 0;
  if (resume && alreadyHave.size > 0) {
    console.log(`[${source.descriptor.id}] resuming with ${alreadyHave.size} records already on disk`);
  }

  const log = (message: string) => console.log(`[${source.descriptor.id}] ${message}`);
  log(`starting -> ${outFile}`);

  for await (const donor of source.collect({ limit, onProgress: log })) {
    if (alreadyHave.has(donor.source_ref)) continue;
    const record: ScrapedRecord = {
      ...donor,
      source_id: source.descriptor.id,
      source_organization: source.descriptor.organization,
      source_url: source.descriptor.url,
      scraped_at: scrapedAt
    };
    if (!stream.write(`${JSON.stringify(record)}\n`)) {
      await new Promise<void>(resolve => stream.once('drain', () => resolve()));
    }
    count += 1;
    if (record.phone) withPhone += 1;
  }

  await new Promise<void>(resolve => stream.end(resolve));
  log(`done: ${count} records (${withPhone} with a phone number)`);
  return { source: source.descriptor.id, count, withPhone, outFile };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const requested = args.get('source') || 'all';
  const limit = Number(args.get('limit') || 500_000);
  const outDir = path.resolve(args.get('out') || 'data/scraped');
  const resume = args.has('resume');

  const selected = requested === 'all' ? SOURCES : SOURCES.filter(s => s.descriptor.id === requested);
  if (selected.length === 0) {
    console.error(`Unknown source "${requested}". Known: ${SOURCES.map(s => s.descriptor.id).join(', ')}`);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const summary = [];
  for (const source of selected) {
    summary.push(await runSource(source, limit, outDir, resume));
  }

  console.log('\nSummary');
  for (const entry of summary) {
    console.log(`  ${entry.source}: ${entry.count} records, ${entry.withPhone} contactable -> ${entry.outFile}`);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
