import { getDb } from './db';

export const COMMUNITY_POST_TABLE = 'community_posts';
export const COMMUNITY_POST_TYPES = ['DONATION_STORY', 'HEALTH_SUGGESTION'] as const;
export const COMMUNITY_POST_STATUSES = ['DRAFT', 'PUBLISHED', 'HIDDEN', 'DELETED'] as const;
export const COMMUNITY_TITLE_MIN_LENGTH = 8;
export const COMMUNITY_TITLE_MAX_LENGTH = 120;
export const COMMUNITY_BODY_MIN_LENGTH = 80;
export const COMMUNITY_BODY_MAX_LENGTH = 12_000;
export const COMMUNITY_EXCERPT_MAX_LENGTH = 180;

export type CommunityPostType = (typeof COMMUNITY_POST_TYPES)[number];
export type CommunityPostStatus = (typeof COMMUNITY_POST_STATUSES)[number];

export type CommunityPost = {
  id: string;
  slug?: string;
  author_id: string;
  type: CommunityPostType;
  status: CommunityPostStatus;
  title: string;
  body_markdown: string;
  excerpt: string;
  image_key?: string;
  image_alt?: string;
  image_width?: number;
  image_height?: number;
  created_at: string;
  updated_at: string;
  published_at?: string;
  moderated_by?: string;
  moderated_at?: string;
  moderation_reason?: string;
  /** Private owner/audit linkage. Never included in public projections. */
  source_donation_id?: string;
};

export type CommunityPostInput = {
  type?: unknown;
  title?: unknown;
  body_markdown?: unknown;
  image_key?: unknown;
  image_alt?: unknown;
  image_width?: unknown;
  image_height?: unknown;
};

export type ValidatedCommunityPostInput = Pick<CommunityPost, 'type' | 'title' | 'body_markdown' | 'excerpt'> &
  Partial<Pick<CommunityPost, 'image_key' | 'image_alt' | 'image_width' | 'image_height'>>;

export type CommunityPostValidation =
  | { ok: true; value: ValidatedCommunityPostInput }
  | { ok: false; errors: string[] };

export type CommunityPostQuery = {
  statuses?: CommunityPostStatus[];
  type?: CommunityPostType;
  authorId?: string;
  slug?: string;
  imageKey?: string;
  hasImage?: boolean;
  limit?: number;
  offset?: number;
  near?: Date | string | number;
};

export type PublicCommunityPostImage = {
  key: string;
  alt: string;
  width?: number;
  height?: number;
};

export type PublicCommunityPostSummary = {
  id: string;
  slug: string;
  type: CommunityPostType;
  title: string;
  excerpt: string;
  image?: PublicCommunityPostImage;
  author: { name: string };
  published_at: string;
  updated_at: string;
};

export type PublicCommunityPostDetail = PublicCommunityPostSummary & {
  body_markdown: string;
};

type CommunityPostRow = {
  vector: number[];
  id: string;
  slug: string;
  author_id: string;
  type: string;
  status: string;
  published_at: string;
  updated_at: string;
  image_key: string;
  doc: string;
};

const DAY_MS = 86_400_000;
const SAFE_IDENTIFIER = /^[A-Za-z0-9_-]{1,120}$/;
const SAFE_IMAGE_KEY = /^[A-Za-z0-9_-]{8,120}$/;
const DISALLOWED_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const BANGLADESH_PHONE = /(?:^|[^\d])(?:\+?880[\s\p{P}\p{S}]*|0[\s\p{P}\p{S}]*)?1[3-9](?:[\s\p{P}\p{S}]*\d){8}(?!\d)/u;

let communityTableReady: Promise<Awaited<ReturnType<typeof prepareCommunityPostTable>>> | null = null;

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

function codePointLength(value: string) {
  return Array.from(value).length;
}

function cleanText(value: unknown, minimum: number, maximum: number) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  const length = codePointLength(cleaned);
  if (length < minimum || length > maximum || DISALLOWED_CONTROL_CHARACTERS.test(cleaned)) return null;
  return cleaned;
}

function optionalText(value: unknown, maximum: number) {
  if (value === undefined || value === null || value === '') return undefined;
  return cleanText(value, 1, maximum);
}

function optionalPositiveInteger(value: unknown, maximum = 20_000) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : null;
}

function parseIsoDate(value: unknown, fieldName: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${fieldName} is required`);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`${fieldName} must be a valid date`);
  return new Date(timestamp).toISOString();
}

function stringLiteral(value: string) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function toEpochDays(value: Date | string | number) {
  const timestamp = value instanceof Date
    ? value.getTime()
    : typeof value === 'number'
      ? value
      : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp / DAY_MS : Date.now() / DAY_MS;
}

function rowVector(post: CommunityPost) {
  // Published posts use publication epoch days, so a search near today's epoch
  // naturally returns the newest rows first. Drafts have no publication date;
  // their update date keeps owner queries useful without boot-loading the table.
  return [toEpochDays(post.published_at || post.updated_at), 0];
}

function postFromRow(row: Record<string, unknown>): CommunityPost | null {
  try {
    const post = JSON.parse(String(row.doc || '{}')) as CommunityPost;
    return post && typeof post.id === 'string' ? post : null;
  } catch {
    return null;
  }
}

function comparePublishedNewest(first: CommunityPost, second: CommunityPost) {
  const publicationDifference = Date.parse(second.published_at || second.updated_at) - Date.parse(first.published_at || first.updated_at);
  if (publicationDifference !== 0) return publicationDifference;
  const updateDifference = Date.parse(second.updated_at) - Date.parse(first.updated_at);
  return updateDifference || first.id.localeCompare(second.id);
}

function publicAuthorName(value: unknown) {
  const name = cleanText(value, 1, 100);
  return name && !containsBangladeshPhone(name) ? name : 'Drop member';
}

function publicImage(post: CommunityPost): PublicCommunityPostImage | undefined {
  if (!post.image_key) return undefined;
  return {
    key: post.image_key,
    alt: post.image_alt || post.title,
    ...(post.image_width ? { width: post.image_width } : {}),
    ...(post.image_height ? { height: post.image_height } : {})
  };
}

async function prepareCommunityPostTable() {
  const connection = await getDb();
  const tableNames = await connection.tableNames();
  if (tableNames.includes(COMMUNITY_POST_TABLE)) return await connection.openTable(COMMUNITY_POST_TABLE);

  const table = await connection.createTable(COMMUNITY_POST_TABLE, [{
    vector: [0, 0],
    id: 'dummy',
    slug: '',
    author_id: '',
    type: 'DONATION_STORY',
    status: 'DRAFT',
    published_at: '',
    updated_at: '',
    image_key: '',
    doc: '{}'
  } satisfies CommunityPostRow]);
  await table.delete(`id = ${stringLiteral('dummy')}`);
  return table;
}

export async function ensureCommunityPostTable() {
  if (!communityTableReady) communityTableReady = prepareCommunityPostTable();
  try {
    return await communityTableReady;
  } catch (error) {
    communityTableReady = null;
    throw error;
  }
}

export function containsBangladeshPhone(value: string) {
  const normalizedDigits = String(value || '').replace(/[\u09e6-\u09ef\u0660-\u0669\u06f0-\u06f9\uff10-\uff19]/g, digit => {
    const code = digit.codePointAt(0) || 0;
    const zero = code >= 0xff10 ? 0xff10 : code >= 0x09e6 ? 0x09e6 : code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - zero);
  });
  return BANGLADESH_PHONE.test(normalizedDigits);
}

export function createCommunitySlug(title: string, id: string) {
  const suffix = id.normalize('NFKC').replace(/[^\p{Letter}\p{Number}\p{Mark}]/gu, '').toLocaleLowerCase('en').slice(-8);
  if (!suffix) throw new Error('A post id is required to create a slug');

  const normalized = title
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[\u2018\u2019']/g, '')
    .replace(/[^\p{Letter}\p{Number}\p{Mark}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  const base = Array.from(normalized || 'post').slice(0, 72).join('').replace(/-+$/g, '') || 'post';
  return `${base}-${suffix}`;
}

export function markdownToPlainExcerpt(markdown: string, maximum = COMMUNITY_EXCERPT_MAX_LENGTH) {
  const limit = Math.max(1, Math.floor(maximum));
  const plain = String(markdown || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/[`*_~]/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

  if (codePointLength(plain) <= limit) return plain;
  if (limit === 1) return '…';
  const candidate = Array.from(plain).slice(0, limit - 1).join('').trimEnd();
  const wordBoundary = candidate.lastIndexOf(' ');
  const shortened = wordBoundary >= Math.floor(limit * 0.6) ? candidate.slice(0, wordBoundary) : candidate;
  return `${shortened.trimEnd()}…`;
}

export function validateCommunityPostInput(input: CommunityPostInput): CommunityPostValidation {
  const errors: string[] = [];
  const type = isOneOf(input?.type, COMMUNITY_POST_TYPES) ? input.type : null;
  const title = cleanText(input?.title, COMMUNITY_TITLE_MIN_LENGTH, COMMUNITY_TITLE_MAX_LENGTH);
  const body = cleanText(input?.body_markdown, COMMUNITY_BODY_MIN_LENGTH, COMMUNITY_BODY_MAX_LENGTH);
  const imageKey = optionalText(input?.image_key, 120);
  const imageAlt = optionalText(input?.image_alt, 180);
  const imageWidth = optionalPositiveInteger(input?.image_width);
  const imageHeight = optionalPositiveInteger(input?.image_height);

  if (!type) errors.push('Post type must be a donation story or health suggestion');
  if (!title) errors.push(`Title must be ${COMMUNITY_TITLE_MIN_LENGTH}-${COMMUNITY_TITLE_MAX_LENGTH} characters`);
  if (!body) errors.push(`Body must be ${COMMUNITY_BODY_MIN_LENGTH}-${COMMUNITY_BODY_MAX_LENGTH} characters`);
  if (title && containsBangladeshPhone(title)) errors.push('Public posts cannot include Bangladesh phone numbers');
  if (body && containsBangladeshPhone(body)) errors.push('Public posts cannot include Bangladesh phone numbers');
  if (imageKey === null || (imageKey && !SAFE_IMAGE_KEY.test(imageKey))) errors.push('Image key is invalid');
  if (imageAlt === null) errors.push('Image alt text is invalid');
  if (imageWidth === null || imageHeight === null) errors.push('Image dimensions are invalid');
  if (imageAlt && containsBangladeshPhone(imageAlt)) errors.push('Public posts cannot include Bangladesh phone numbers');

  const carriesImage = Boolean(imageKey || imageAlt || imageWidth || imageHeight);
  if (type === 'HEALTH_SUGGESTION' && carriesImage) errors.push('Health suggestions cannot include an image');
  if (!imageKey && carriesImage) errors.push('Image metadata requires an image key');
  if (imageKey && !imageAlt) errors.push('Image alt text is required');

  if (errors.length > 0 || !type || !title || !body) return { ok: false, errors: [...new Set(errors)] };
  return {
    ok: true,
    value: {
      type,
      title,
      body_markdown: body,
      excerpt: markdownToPlainExcerpt(body),
      ...(imageKey ? { image_key: imageKey } : {}),
      ...(imageAlt ? { image_alt: imageAlt } : {}),
      ...(imageWidth ? { image_width: imageWidth } : {}),
      ...(imageHeight ? { image_height: imageHeight } : {})
    }
  };
}

export function buildCommunityPostFilter(query: Omit<CommunityPostQuery, 'limit' | 'offset' | 'near'> = {}) {
  const clauses: string[] = [];
  if (query.statuses?.length) {
    const statuses = [...new Set(query.statuses)].filter(status => isOneOf(status, COMMUNITY_POST_STATUSES));
    if (statuses.length) clauses.push(`status IN (${statuses.map(stringLiteral).join(', ')})`);
  }
  if (query.type && isOneOf(query.type, COMMUNITY_POST_TYPES)) clauses.push(`type = ${stringLiteral(query.type)}`);
  if (query.authorId) clauses.push(`author_id = ${stringLiteral(query.authorId)}`);
  if (query.slug) clauses.push(`slug = ${stringLiteral(query.slug)}`);
  if (query.imageKey) clauses.push(`image_key = ${stringLiteral(query.imageKey)}`);
  if (query.hasImage === true) clauses.push(`image_key <> ''`);
  if (query.hasImage === false) clauses.push(`image_key = ''`);
  return clauses.join(' AND ');
}

export async function getCommunityPostById(id: string) {
  if (!SAFE_IDENTIFIER.test(id)) return null;
  const table = await ensureCommunityPostTable();
  const rows = await table.query().where(`id = ${stringLiteral(id)}`).limit(1).toArray();
  return rows.length ? postFromRow(rows[0] as unknown as Record<string, unknown>) : null;
}

export async function getCommunityPostBySlug(slug: string, statuses?: CommunityPostStatus[]) {
  if (!slug || codePointLength(slug) > 120 || /[\s/\\]/u.test(slug)) return null;
  const table = await ensureCommunityPostTable();
  const filter = buildCommunityPostFilter({ slug, statuses });
  const rows = await table.query().where(filter).limit(1).toArray();
  return rows.length ? postFromRow(rows[0] as unknown as Record<string, unknown>) : null;
}

export async function queryCommunityPosts(query: CommunityPostQuery = {}) {
  const table = await ensureCommunityPostTable();
  const limit = Math.min(100, Math.max(1, Math.floor(query.limit ?? 20)));
  const offset = Math.max(0, Math.floor(query.offset ?? 0));
  const filter = buildCommunityPostFilter(query);
  let builder = table.search([toEpochDays(query.near ?? Date.now()), 0]).offset(offset).limit(limit);
  if (filter) builder = builder.where(filter);
  const rows = await builder.toArray();
  return (rows as unknown as Array<Record<string, unknown>>)
    .map(postFromRow)
    .filter((post): post is CommunityPost => Boolean(post))
    // Vector storage uses epoch days; this exact timestamp/id pass resolves
    // same-day ties deterministically for the returned page.
    .sort(comparePublishedNewest);
}

export async function countCommunityPosts(query: Omit<CommunityPostQuery, 'limit' | 'offset' | 'near'> = {}) {
  const table = await ensureCommunityPostTable();
  const filter = buildCommunityPostFilter(query);
  return await table.countRows(filter || undefined);
}

export async function queryCommunityPostsByOwner(
  authorId: string,
  query: Omit<CommunityPostQuery, 'authorId'> = {}
) {
  if (!SAFE_IDENTIFIER.test(authorId)) return [];
  return await queryCommunityPosts({ ...query, authorId });
}

export async function getPublishedCommunityPostBySlug(slug: string) {
  return await getCommunityPostBySlug(slug, ['PUBLISHED']);
}

export async function queryPublishedCommunityPosts(
  query: Omit<CommunityPostQuery, 'statuses' | 'authorId' | 'slug' | 'imageKey' | 'hasImage'> = {}
) {
  return await queryCommunityPosts({ ...query, statuses: ['PUBLISHED'] });
}

export function toPublicCommunityPostSummary(post: CommunityPost, authorName: string): PublicCommunityPostSummary {
  if (post.status !== 'PUBLISHED' || !post.slug || !post.published_at) {
    throw new Error('Only published posts can be projected publicly');
  }
  return {
    id: post.id,
    slug: post.slug,
    type: post.type,
    title: post.title,
    excerpt: post.excerpt,
    ...(post.image_key ? { image: publicImage(post) } : {}),
    author: { name: publicAuthorName(authorName) },
    published_at: post.published_at,
    updated_at: post.updated_at
  };
}

export function toPublicCommunityPostDetail(post: CommunityPost, authorName: string): PublicCommunityPostDetail {
  return {
    ...toPublicCommunityPostSummary(post, authorName),
    body_markdown: post.body_markdown
  };
}

export async function saveCommunityPost(post: Omit<CommunityPost, 'excerpt'> & { excerpt?: string }) {
  if (!SAFE_IDENTIFIER.test(post.id)) throw new Error('Post id is invalid');
  if (!SAFE_IDENTIFIER.test(post.author_id)) throw new Error('Author id is invalid');
  if (!isOneOf(post.status, COMMUNITY_POST_STATUSES)) throw new Error('Post status is invalid');

  const validation = validateCommunityPostInput(post);
  if (validation.ok === false) throw new Error(validation.errors.join('; '));

  const existing = await getCommunityPostById(post.id);
  const now = new Date().toISOString();
  const createdAt = existing?.created_at || parseIsoDate(post.created_at || now, 'created_at');
  const updatedAt = parseIsoDate(post.updated_at || now, 'updated_at');
  const wasPublished = Boolean(existing?.published_at);

  if (existing && existing.author_id !== post.author_id) throw new Error('Post author cannot be changed');
  if (wasPublished && post.slug && post.slug !== existing?.slug) throw new Error('Published post slug cannot be changed');
  if (wasPublished && post.status === 'DRAFT') throw new Error('A published post cannot return to draft status');
  if (existing?.status === 'DELETED' && post.status !== 'DELETED') throw new Error('A deleted post cannot be restored');

  let publishedAt = existing?.published_at;
  let slug = existing?.slug;
  if (!publishedAt && (post.status === 'PUBLISHED' || post.status === 'HIDDEN')) {
    publishedAt = parseIsoDate(post.published_at || now, 'published_at');
    slug = createCommunitySlug(validation.value.title, post.id);
  }

  const normalized: CommunityPost = {
    id: post.id,
    author_id: post.author_id,
    status: post.status,
    ...validation.value,
    created_at: createdAt,
    updated_at: updatedAt,
    ...(slug ? { slug } : {}),
    ...(publishedAt ? { published_at: publishedAt } : {}),
    ...(post.moderated_by ? { moderated_by: post.moderated_by } : {}),
    ...(post.moderated_at ? { moderated_at: parseIsoDate(post.moderated_at, 'moderated_at') } : {}),
    ...(post.moderation_reason ? { moderation_reason: cleanText(post.moderation_reason, 1, 1000) || undefined } : {}),
    ...(post.source_donation_id
      ? { source_donation_id: cleanText(post.source_donation_id, 1, 80) || undefined }
      : {})
  };

  const table = await ensureCommunityPostTable();
  const row = {
    vector: rowVector(normalized),
    id: normalized.id,
    slug: normalized.slug || '',
    author_id: normalized.author_id,
    type: normalized.type,
    status: normalized.status,
    published_at: normalized.published_at || '',
    updated_at: normalized.updated_at,
    image_key: normalized.image_key || '',
    doc: JSON.stringify(normalized)
  } satisfies CommunityPostRow;
  await table
    .mergeInsert('id')
    .whenMatchedUpdateAll()
    .whenNotMatchedInsertAll()
    .execute([row]);
  return normalized;
}
