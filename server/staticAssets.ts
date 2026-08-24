import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const CRITICAL_STATIC_ASSET_PATHS = [
  '/index.html',
  '/sw.js',
  '/drop-icon.svg',
  '/manifest.webmanifest',
  '/images/doodles/community-doodle.webp',
  '/images/doodles/privacy-doodle.webp',
  '/images/doodles/facility-doodle.webp'
] as const;

export type StaticAssetFailure = {
  path: string;
  reason: 'empty' | 'invalid_path' | 'missing_or_unreadable';
};

export type StaticAssetHealth = {
  status: 'ok' | 'failed';
  checked: string[];
  failures: StaticAssetFailure[];
};

type AssetReadResult = {
  path: string;
  content?: Buffer;
  failure?: StaticAssetFailure;
};

function filePathForPublicAsset(distPath: string, publicPath: string) {
  const root = path.resolve(distPath);
  const resolved = path.resolve(root, publicPath.replace(/^\/+/, ''));
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return null;
  return resolved;
}

async function readAsset(distPath: string, publicPath: string): Promise<AssetReadResult> {
  const filePath = filePathForPublicAsset(distPath, publicPath);
  if (!filePath) return { path: publicPath, failure: { path: publicPath, reason: 'invalid_path' } };

  try {
    const content = await readFile(filePath);
    if (content.length === 0) return { path: publicPath, failure: { path: publicPath, reason: 'empty' } };
    return { path: publicPath, content };
  } catch {
    return { path: publicPath, failure: { path: publicPath, reason: 'missing_or_unreadable' } };
  }
}

export function referencedBuildAssets(indexHtml: string) {
  const paths = new Set<string>();
  const referencePattern = /\b(?:href|src)=["'](\/assets\/[^"'?#]+)(?:[?#][^"']*)?["']/g;
  for (const match of indexHtml.matchAll(referencePattern)) paths.add(match[1]);
  return [...paths];
}

export async function inspectStaticAssets(distPath: string): Promise<StaticAssetHealth> {
  const indexResult = await readAsset(distPath, '/index.html');
  const referencedPaths = indexResult.content
    ? referencedBuildAssets(indexResult.content.toString('utf8'))
    : [];
  const remainingPaths = [...new Set([
    ...CRITICAL_STATIC_ASSET_PATHS.filter(assetPath => assetPath !== '/index.html'),
    ...referencedPaths
  ])];
  const results = [indexResult, ...(await Promise.all(remainingPaths.map(assetPath => readAsset(distPath, assetPath))))];
  const failures = results.flatMap(result => result.failure ? [result.failure] : []);

  return {
    status: failures.length === 0 ? 'ok' : 'failed',
    checked: results.map(result => result.path),
    failures
  };
}
