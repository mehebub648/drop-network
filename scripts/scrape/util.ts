// Helpers shared by the scrapers: polite HTTP, Bengali numeral handling and
// the phone/blood-group normalizers that keep scraped rows in the same shape
// the application already uses.

const BENGALI_ZERO = 0x09e6;

/** Converts Bengali-Indic digits (০-৯) to ASCII so phone numbers parse. */
export function toAsciiDigits(value: string) {
  return value.replace(/[০-৯]/g, char => String(char.codePointAt(0)! - BENGALI_ZERO));
}

/**
 * Same rules as the server's `normalizeBangladeshPhone`, duplicated here so the
 * scraper stays a standalone script with no server imports.
 */
export function normalizePhone(value: string | null | undefined) {
  if (!value) return '';
  const digits = toAsciiDigits(value).replace(/\D/g, '');
  const local = digits.startsWith('880') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
  return /^1[3-9]\d{8}$/.test(local) ? `+880${local}` : '';
}

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export function normalizeBloodGroup(value: string | null | undefined) {
  if (!value) return '';
  const compact = value.toUpperCase().replace(/\s|BLOOD|GROUP/g, '');
  const match = compact.match(/^(AB|A|B|O)(\+|-|POS|POSITIVE|NEG|NEGATIVE)?$/);
  if (!match) return '';
  const sign = match[2] || '';
  const rh = sign.startsWith('-') || sign.startsWith('NEG') ? '-' : '+';
  return `${match[1]}${rh}`;
}

export function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCodePoint(Number(code)));
}

export function cleanText(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export type FetchOptions = {
  retries?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

/**
 * Shared circuit breaker. These listings run on small, slow hosts - the
 * Bangladesh Scouts register in particular answers a search in ~25 seconds and
 * starts returning 504s if it is pushed. When a host starts failing, every
 * worker pauses, not just the one that saw the error, so the scraper backs off
 * as a whole instead of hammering a service that is already struggling.
 */
const HOST_COOLDOWNS = new Map<string, number>();
const COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 10 * 60_000;

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

async function waitForHost(host: string) {
  const until = HOST_COOLDOWNS.get(host) || 0;
  const remaining = until - Date.now();
  if (remaining > 0) await sleep(remaining);
}

/** Overload indicators: gateway errors and explicit throttling. */
function isOverloaded(status: number) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/**
 * GET with a timeout, bounded exponential backoff and a per-host cooldown.
 * Returns null instead of throwing so one bad district cannot abort a
 * multi-thousand-request run.
 */
export async function fetchText(url: string, options: FetchOptions = {}) {
  const { retries = 3, timeoutMs = 60_000, headers = {} } = options;
  const host = hostOf(url);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    await waitForHost(host);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'drop-network-donor-import/1.0 (+https://findadrop.org)', ...headers }
      });
      if (isOverloaded(response.status)) {
        // Back everyone off, doubling the pause each time the host keeps
        // failing, up to a ten-minute ceiling.
        const current = Math.max(0, (HOST_COOLDOWNS.get(host) || 0) - Date.now());
        const next = Math.min(MAX_COOLDOWN_MS, Math.max(COOLDOWN_MS, current * 2));
        HOST_COOLDOWNS.set(host, Date.now() + next);
        console.warn(`[backoff] ${host} returned ${response.status}; pausing ${Math.round(next / 1000)}s`);
        throw new Error(`HTTP ${response.status}`);
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.text();
      HOST_COOLDOWNS.delete(host);
      return body;
    } catch {
      if (attempt === retries) return null;
      await sleep(1_000 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T | null> {
  const body = await fetchText(url, options);
  if (!body) return null;
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

/** Runs `worker` over `items` with at most `concurrency` in flight. */
export async function mapPool<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}
