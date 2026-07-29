// Shared shapes for the donor scrapers. Each source module turns a public
// donor listing into `ScrapedDonor` records; `scripts/import-donors.ts` is the
// only thing that writes them into the datastore.

import { IMPORT_SOURCES, type ImportSourceDescriptor } from '../../server/importedDonors';

export type SourceDescriptor = ImportSourceDescriptor;

/** Looks a source up in the shared registry so ids can never drift apart. */
export function descriptorFor(id: string): SourceDescriptor {
  const descriptor = IMPORT_SOURCES.find(source => source.id === id);
  if (!descriptor) throw new Error(`Unknown import source "${id}". Add it to IMPORT_SOURCES first.`);
  return descriptor;
}

export type ScrapedDonor = {
  /** Identifier used by the source, unique within that source. */
  source_ref: string;
  name: string;
  /** Normalized to +8801XXXXXXXXX, or empty when the source publishes no phone. */
  phone: string;
  /** One of the eight ABO/Rh groups, or empty when the source does not say. */
  blood_group: string;
  /** Canonical Bangladesh district name from `src/lib/locations.ts`. */
  district: string;
  /** Free-text upazila/thana as published by the source. */
  upazila: string;
  /** Anything else worth keeping (donation counts, membership ids, ...). */
  extra?: Record<string, string | number>;
};

export type ScrapedRecord = ScrapedDonor & {
  source_id: string;
  source_organization: string;
  source_url: string;
  scraped_at: string;
};

export type DonorSource = {
  descriptor: SourceDescriptor;
  /** Yields donors as they are found so long runs can stream to disk. */
  collect(options: { limit: number; onProgress(message: string): void }): AsyncGenerator<ScrapedDonor>;
};
