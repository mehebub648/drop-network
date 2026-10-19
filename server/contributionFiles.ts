import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const STORAGE_KEY = /^[0-9a-f-]{36}$/;

export function contributionFilesDirectory(env: NodeJS.ProcessEnv = process.env) {
  const configured = env.INVITATION_MEDIA_PATH?.trim();
  if (configured) return path.resolve(configured);
  const community = env.COMMUNITY_MEDIA_PATH?.trim();
  // Reuse the existing private media bind mount. Community image reads accept
  // only bare UUID keys, so this subdirectory is never publicly addressable.
  if (community) return path.resolve(community, 'invitation-submissions');
  return path.resolve(path.join(process.cwd(), 'data', 'media', 'invitations'));
}

function resolveKey(key: string, directory: string) {
  if (!STORAGE_KEY.test(key)) throw new Error('INVALID_KEY');
  const target = path.resolve(directory, key);
  if (path.dirname(target) !== directory) throw new Error('INVALID_KEY');
  return target;
}

export async function saveContributionFile(bytes: Buffer, options: { directory?: string; expectedSha256?: string } = {}) {
  const directory = path.resolve(options.directory || contributionFilesDirectory());
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (options.expectedSha256 && sha256 !== options.expectedSha256.toLowerCase()) throw new Error('FINGERPRINT_MISMATCH');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const key = randomUUID();
  const target = resolveKey(key, directory);
  const temporary = `${target}.tmp`;
  await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
  await rename(temporary, target);
  return { key, sha256 };
}

export async function readContributionFile(key: string, options: { directory?: string } = {}) {
  const directory = path.resolve(options.directory || contributionFilesDirectory());
  const target = resolveKey(key, directory);
  try {
    const stats = await lstat(target);
    if (!stats.isFile() || stats.isSymbolicLink()) throw new Error('INVALID_FILE');
    return await readFile(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function deleteContributionFile(key: string, options: { directory?: string } = {}) {
  const directory = path.resolve(options.directory || contributionFilesDirectory());
  try { await unlink(resolveKey(key, directory)); return true; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}
