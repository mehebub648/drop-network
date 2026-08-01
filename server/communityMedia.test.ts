import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import sharp from 'sharp';
import {
  COMMUNITY_IMAGE_MIME_TYPES,
  MAX_COMMUNITY_IMAGE_BYTES,
  MAX_COMMUNITY_IMAGE_DIMENSION,
  MAX_COMMUNITY_IMAGE_PIXELS,
  CommunityMediaError,
  deleteCommunityImage,
  readCommunityImage,
  saveCommunityImage
} from './communityMedia';

async function temporaryMediaDirectory(t: TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'drop-community-media-'));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function expectMediaError(promise: Promise<unknown>, code: CommunityMediaError['code']) {
  await assert.rejects(promise, error => error instanceof CommunityMediaError && error.code === code);
}

test('a story image is auto-oriented, bounded, encoded as WebP, and stripped of metadata', async t => {
  const directory = await temporaryMediaDirectory(t);
  const source = await sharp({
    create: { width: 2_000, height: 1_000, channels: 3, background: '#b91c1c' }
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();

  const stored = await saveCommunityImage(source, 'image/jpeg', { directory });
  assert.match(stored.key, /^[0-9a-f-]{36}$/);
  assert.deepEqual({ width: stored.width, height: stored.height }, {
    width: 800,
    height: MAX_COMMUNITY_IMAGE_DIMENSION
  });

  const output = await readCommunityImage(stored.key, { directory });
  assert.ok(output);
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 800);
  assert.equal(metadata.height, MAX_COMMUNITY_IMAGE_DIMENSION);
  assert.equal(metadata.orientation, undefined);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.xmp, undefined);
});

test('small images are never enlarged', async t => {
  const directory = await temporaryMediaDirectory(t);
  const source = await sharp({
    create: { width: 48, height: 32, channels: 4, background: '#ffffff80' }
  }).png().toBuffer();

  const stored = await saveCommunityImage(source, 'image/png', { directory });
  assert.deepEqual({ width: stored.width, height: stored.height }, { width: 48, height: 32 });
});

test('unsupported, mismatched, empty, and oversized inputs are rejected before storage', async t => {
  const directory = await temporaryMediaDirectory(t);
  const png = await sharp({
    create: { width: 10, height: 10, channels: 3, background: '#ffffff' }
  }).png().toBuffer();

  assert.deepEqual(COMMUNITY_IMAGE_MIME_TYPES, ['image/jpeg', 'image/png', 'image/webp']);
  await expectMediaError(saveCommunityImage(png, 'image/gif', { directory }), 'UNSUPPORTED_MIME');
  await expectMediaError(saveCommunityImage(png, 'image/jpeg', { directory }), 'MIME_MISMATCH');
  await expectMediaError(saveCommunityImage(Buffer.alloc(0), 'image/png', { directory }), 'EMPTY_IMAGE');
  await expectMediaError(
    saveCommunityImage(Buffer.alloc(MAX_COMMUNITY_IMAGE_BYTES + 1), 'image/png', { directory }),
    'SOURCE_TOO_LARGE'
  );
});

test('decoded source dimensions cannot exceed the pixel budget', async t => {
  const directory = await temporaryMediaDirectory(t);
  const width = 6_001;
  const height = Math.floor(MAX_COMMUNITY_IMAGE_PIXELS / width) + 1;
  const source = await sharp({
    create: { width, height, channels: 3, background: '#ffffff' }
  }).png().toBuffer();

  await expectMediaError(saveCommunityImage(source, 'image/png', { directory }), 'TOO_MANY_PIXELS');
});

test('read and delete operations accept only safe generated keys', async t => {
  const directory = await temporaryMediaDirectory(t);
  const source = await sharp({
    create: { width: 24, height: 24, channels: 3, background: '#dc2626' }
  }).webp().toBuffer();
  const stored = await saveCommunityImage(source, 'image/webp', { directory });
  const outside = path.join(directory, '..', `outside-${Date.now()}.webp`);
  await writeFile(outside, Buffer.from('keep'));
  t.after(async () => rm(outside, { force: true }));

  await expectMediaError(readCommunityImage('../' + path.basename(outside), { directory }), 'INVALID_KEY');
  await expectMediaError(deleteCommunityImage('../' + path.basename(outside), { directory }), 'INVALID_KEY');
  assert.equal((await readCommunityImage(stored.key, { directory }))?.length! > 0, true);
  assert.equal(await deleteCommunityImage(stored.key, { directory }), true);
  assert.equal(await readCommunityImage(stored.key, { directory }), null);
  assert.equal(await deleteCommunityImage(stored.key, { directory }), false);
});
