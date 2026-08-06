import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  collectionFacilityDistrictSlug,
  loadRegisteredCollectionFacilities
} from './collectionFacilities';

test('builds stable district data paths', () => {
  assert.equal(collectionFacilityDistrictSlug("Cox's Bazar"), 'cox-s-bazar');
  assert.equal(collectionFacilityDistrictSlug('  Meherpur  '), 'meherpur');
});

test('loads and scopes generated facility rows to the requested district', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';

  globalThis.fetch = (async (input: string | URL | Request) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify([
      ['10001898', 'Meherpur 250 bed District Hospital', 'Meherpur Sadar']
    ]));
  }) as typeof fetch;

  try {
    const facilities = await loadRegisteredCollectionFacilities('Meherpur');
    assert.equal(requestedUrl, '/collection-facilities/meherpur.json');
    assert.deepEqual(facilities, [{
      registryCode: '10001898',
      name: 'Meherpur 250 bed District Hospital',
      district: 'Meherpur',
      locality: 'Meherpur Sadar'
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Meherpur data includes its district hospital and excludes a Dhaka registry code', async () => {
  const raw = await readFile('public/collection-facilities/meherpur.json', 'utf8');
  const rows = JSON.parse(raw) as string[][];

  assert.ok(rows.some(row => (
    row[0] === '10001898'
    && row[1] === 'Meherpur 250 bed District Hospital'
    && row[2] === 'Meherpur Sadar'
  )));
  assert.equal(rows.some(row => row[0] === '10027990'), false);
});
