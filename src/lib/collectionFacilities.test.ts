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
      registryCodes: ['10001898'],
      name: 'Meherpur 250 bed District Hospital',
      district: 'Meherpur',
      locality: 'Meherpur Sadar'
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('merges duplicate registry rows while retaining every source code', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify([
    ['10017223', 'East West Medical College', ''],
    ['10031505', 'EAST- WEST MEDICAL COLLEGE & HOSPITAL LIMITED', 'Turag'],
    ['10028939', 'EAST-WEST MEDICAL COLLEGE & HOSPITAL LIMITED', 'Turag'],
    ['10031204', 'EAST-WEST MEDICAL COLLEGE & HOSPITAL LIMITED', 'Turag'],
    ['20000001', 'Example Hospital Ltd.', 'Turag'],
    ['20000002', 'EXAMPLE HOSPITAL LIMITED', 'Savar']
  ]))) as typeof fetch;

  try {
    const facilities = await loadRegisteredCollectionFacilities('Dhaka');
    assert.equal(facilities.length, 3);
    assert.deepEqual(facilities[0], {
      registryCode: '10017223',
      registryCodes: ['10017223', '10028939', '10031204', '10031505'],
      name: 'East-West Medical College & Hospital Limited',
      district: 'Dhaka',
      locality: 'Turag'
    });
    assert.deepEqual(facilities.slice(1).map(facility => facility.locality).sort(), ['Savar', 'Turag']);
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
