import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRequestFeedPage } from './requestFeed';

const request = (id: string, group: string, district: string, createdAt: string, neededBy = '2026-09-02T00:00:00.000Z') => ({
  id,
  blood_group: group,
  location: { area_name: district },
  needed_by: neededBy,
  created_at: createdAt
});

test('keeps exact matches primary, fills sparse filters with closest requests, and caps a page at 20', () => {
  const exact = request('exact', 'O+', 'Dhaka', '2026-08-01T00:00:00.000Z');
  const sameGroup = request('same-group', 'O+', 'Khulna', '2026-08-02T00:00:00.000Z');
  const sameDistrict = request('same-district', 'A+', 'Dhaka', '2026-07-01T00:00:00.000Z');
  const distant = Array.from({ length: 20 }, (_, index) => request(
    `other-${index}`,
    'B+',
    'Sylhet',
    `2026-08-${String(index + 3).padStart(2, '0')}T00:00:00.000Z`
  ));

  const page = buildRequestFeedPage(
    [sameDistrict, ...distant, exact, sameGroup],
    { bloodGroup: 'O+', district: 'Dhaka' },
    1,
    20,
    new Date('2026-09-01T00:00:00.000Z').getTime()
  );

  assert.deepEqual(page.items.map(item => item.id), ['exact']);
  assert.deepEqual(page.otherItems.slice(0, 2).map(item => item.id), ['same-group', 'same-district']);
  assert.equal(page.items.length + page.otherItems.length, 20);
  assert.equal(page.exactTotal, 1);
  assert.equal(page.pages, 2);
});

test('sorts unfiltered requests oldest first without a secondary section', () => {
  const page = buildRequestFeedPage([
    request('newer', 'A+', 'Dhaka', '2026-08-02T00:00:00.000Z'),
    request('older', 'B+', 'Khulna', '2026-08-01T00:00:00.000Z')
  ], {}, 1, 20);

  assert.deepEqual(page.items.map(item => item.id), ['older', 'newer']);
  assert.deepEqual(page.otherItems, []);
});

test('does not add secondary requests when ten exact matches exist', () => {
  const matches = Array.from({ length: 10 }, (_, index) => request(
    `match-${index}`,
    'O+',
    'Dhaka',
    `2026-08-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`
  ));
  const page = buildRequestFeedPage(
    [...matches, request('other', 'A+', 'Khulna', '2026-07-01T00:00:00.000Z')],
    { bloodGroup: 'O+', district: 'Dhaka' },
    1,
    20
  );

  assert.equal(page.items.length, 10);
  assert.deepEqual(page.otherItems, []);
  assert.equal(page.total, 10);
});
