import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { readContributionFile, saveContributionFile } from './contributionFiles';

test('private contribution files are fingerprinted and read by opaque key', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'drop-invites-'));
  try {
    const bytes = Buffer.from('fixture only');
    const saved = await saveContributionFile(bytes, { directory });
    assert.equal((await readContributionFile(saved.key, { directory }))?.toString(), 'fixture only');
    await assert.rejects(saveContributionFile(bytes, { directory, expectedSha256: '0'.repeat(64) }), /FINGERPRINT_MISMATCH/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
