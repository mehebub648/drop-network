import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CRITICAL_STATIC_ASSET_PATHS, inspectStaticAssets, referencedBuildAssets } from './staticAssets';

async function createStaticTree() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'drop-static-assets-'));
  const files = new Map<string, string | Buffer>([
    ['/index.html', '<link rel="stylesheet" href="/assets/index-abc.css"><script src="/assets/index-def.js"></script>'],
    ['/sw.js', 'self.addEventListener("install", () => undefined);'],
    ['/drop-icon.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>'],
    ['/manifest.webmanifest', '{"name":"Drop"}'],
    ['/images/doodles/community-doodle.webp', Buffer.from([1])],
    ['/images/doodles/privacy-doodle.webp', Buffer.from([2])],
    ['/images/doodles/facility-doodle.webp', Buffer.from([3])],
    ['/assets/index-abc.css', 'body { color: #111; }'],
    ['/assets/index-def.js', 'console.log("drop");']
  ]);

  for (const [publicPath, content] of files) {
    const filePath = path.join(root, publicPath.replace(/^\/+/, ''));
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }
  return root;
}

test('extracts only Vite build assets from the production HTML', () => {
  assert.deepEqual(referencedBuildAssets([
    '<link href="/assets/app.css?v=1">',
    '<script src="/assets/app.js"></script>',
    '<link href="/manifest.webmanifest">'
  ].join('')), ['/assets/app.css', '/assets/app.js']);
});

test('checks critical public files and the hashed assets referenced by index.html', async t => {
  const root = await createStaticTree();
  t.after(() => rm(root, { recursive: true, force: true }));

  const result = await inspectStaticAssets(root);

  assert.equal(result.status, 'ok');
  assert.deepEqual(result.failures, []);
  assert.deepEqual(new Set(result.checked), new Set([
    ...CRITICAL_STATIC_ASSET_PATHS,
    '/assets/index-abc.css',
    '/assets/index-def.js'
  ]));
});

test('reports missing and empty static files as unhealthy', async t => {
  const root = await createStaticTree();
  t.after(() => rm(root, { recursive: true, force: true }));
  await rm(path.join(root, 'sw.js'));
  await writeFile(path.join(root, 'drop-icon.svg'), '');

  const result = await inspectStaticAssets(root);

  assert.equal(result.status, 'failed');
  assert.deepEqual(result.failures, [
    { path: '/sw.js', reason: 'missing_or_unreadable' },
    { path: '/drop-icon.svg', reason: 'empty' }
  ]);
});
