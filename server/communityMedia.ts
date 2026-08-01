import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp, { type Metadata } from 'sharp';

export const COMMUNITY_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type CommunityImageMimeType = (typeof COMMUNITY_IMAGE_MIME_TYPES)[number];

export const MAX_COMMUNITY_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_COMMUNITY_IMAGE_PIXELS = 24_000_000;
export const MAX_COMMUNITY_IMAGE_DIMENSION = 1_600;

const MIME_FORMATS: Record<CommunityImageMimeType, 'jpeg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp'
};
const COMMUNITY_MEDIA_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type StoredCommunityImage = {
  key: string;
  width: number;
  height: number;
};

export type CommunityMediaOptions = {
  /** Test/maintenance override. Runtime callers normally use the env-backed default. */
  directory?: string;
};

export type CommunityMediaErrorCode =
  | 'EMPTY_IMAGE'
  | 'SOURCE_TOO_LARGE'
  | 'UNSUPPORTED_MIME'
  | 'INVALID_IMAGE'
  | 'MIME_MISMATCH'
  | 'TOO_MANY_PIXELS'
  | 'ANIMATED_IMAGE'
  | 'INVALID_KEY';

export class CommunityMediaError extends Error {
  constructor(
    public readonly code: CommunityMediaErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'CommunityMediaError';
  }
}

/**
 * Uses explicit storage when configured. A configured LanceDB volume places
 * media beside that datastore (`/data/lancedb` -> `/data/media/community`);
 * local development otherwise stays in the ignored `.media/community` tree.
 */
export function getCommunityMediaPath(env: NodeJS.ProcessEnv = process.env) {
  const configured = env.COMMUNITY_MEDIA_PATH?.trim();
  if (configured) return path.resolve(configured);

  const datastore = env.LANCEDB_PATH?.trim();
  if (datastore) return path.join(path.dirname(path.resolve(datastore)), 'media', 'community');
  return path.join(process.cwd(), '.media', 'community');
}

function mediaDirectory(options: CommunityMediaOptions) {
  return path.resolve(options.directory || getCommunityMediaPath());
}

function mediaFilePath(key: string, options: CommunityMediaOptions) {
  if (!COMMUNITY_MEDIA_KEY.test(key)) {
    throw new CommunityMediaError('INVALID_KEY', 'Invalid community media key');
  }
  const directory = mediaDirectory(options);
  const resolved = path.resolve(directory, `${key}.webp`);
  if (path.dirname(resolved) !== directory) {
    throw new CommunityMediaError('INVALID_KEY', 'Invalid community media key');
  }
  return resolved;
}

function isSupportedMime(value: string): value is CommunityImageMimeType {
  return COMMUNITY_IMAGE_MIME_TYPES.includes(value as CommunityImageMimeType);
}

async function inspectSource(source: Buffer, mimeType: string) {
  if (source.length === 0) {
    throw new CommunityMediaError('EMPTY_IMAGE', 'Choose an image to upload');
  }
  if (source.length > MAX_COMMUNITY_IMAGE_BYTES) {
    throw new CommunityMediaError('SOURCE_TOO_LARGE', 'Image exceeds the 10 MB upload limit');
  }
  if (!isSupportedMime(mimeType)) {
    throw new CommunityMediaError('UNSUPPORTED_MIME', 'Only JPEG, PNG, and WebP images are supported');
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(source, {
      failOn: 'error',
      limitInputPixels: MAX_COMMUNITY_IMAGE_PIXELS
    }).metadata();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/pixel limit|input image exceeds/i.test(message)) {
      throw new CommunityMediaError('TOO_MANY_PIXELS', 'Image dimensions are too large');
    }
    throw new CommunityMediaError('INVALID_IMAGE', 'The uploaded file is not a readable image');
  }

  if (!metadata.width || !metadata.height) {
    throw new CommunityMediaError('INVALID_IMAGE', 'The uploaded image has no readable dimensions');
  }
  if (metadata.width * metadata.height > MAX_COMMUNITY_IMAGE_PIXELS) {
    throw new CommunityMediaError('TOO_MANY_PIXELS', 'Image dimensions are too large');
  }
  if (metadata.pages && metadata.pages > 1) {
    throw new CommunityMediaError('ANIMATED_IMAGE', 'Animated images are not supported');
  }
  if (metadata.format !== MIME_FORMATS[mimeType]) {
    throw new CommunityMediaError('MIME_MISMATCH', 'The image contents do not match its file type');
  }
}

/**
 * Normalizes one story image to a bounded WebP. Calling `rotate()` without an
 * angle applies EXIF orientation; Sharp strips EXIF and other metadata unless
 * metadata preservation is explicitly requested, which this pipeline never does.
 */
export async function saveCommunityImage(
  source: Buffer,
  mimeType: string,
  options: CommunityMediaOptions = {}
): Promise<StoredCommunityImage> {
  if (!Buffer.isBuffer(source)) {
    throw new CommunityMediaError('INVALID_IMAGE', 'The uploaded image is invalid');
  }
  await inspectSource(source, mimeType);

  const { data, info } = await sharp(source, {
    failOn: 'error',
    limitInputPixels: MAX_COMMUNITY_IMAGE_PIXELS
  })
    .rotate()
    .resize({
      width: MAX_COMMUNITY_IMAGE_DIMENSION,
      height: MAX_COMMUNITY_IMAGE_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  const directory = mediaDirectory(options);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const id = randomUUID();
  const key = id;
  const destination = mediaFilePath(key, { directory });
  const temporary = path.join(directory, `.${id}.${randomUUID()}.tmp`);

  try {
    await writeFile(temporary, data, { flag: 'wx', mode: 0o600 });
    await rename(temporary, destination);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }

  return { key, width: info.width, height: info.height };
}

/** Reads only UUID-named WebP objects from the configured media directory. */
export async function readCommunityImage(key: string, options: CommunityMediaOptions = {}) {
  const file = mediaFilePath(key, options);
  try {
    const stats = await lstat(file);
    if (!stats.isFile() || stats.isSymbolicLink()) return null;
    return await readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/** Deletes one UUID-named object. Missing objects are an idempotent no-op. */
export async function deleteCommunityImage(key: string, options: CommunityMediaOptions = {}) {
  const file = mediaFilePath(key, options);
  try {
    const stats = await lstat(file);
    if (!stats.isFile() && !stats.isSymbolicLink()) return false;
    await unlink(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}
