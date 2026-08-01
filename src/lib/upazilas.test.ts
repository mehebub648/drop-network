import assert from 'node:assert/strict';
import test from 'node:test';
import { getLocationByName } from './locations';
import { UPAZILAS_BY_DISTRICT, UPAZILA_DISTRICTS, getUpazilasForDistrict } from './upazilas';

// This check can only live on the src side: `server/upazilas.ts` deliberately
// has no imports, so it cannot verify itself against the district table.
test('every generated district matches a district in the location table', () => {
  for (const district of UPAZILA_DISTRICTS) {
    assert.equal(getLocationByName(district)?.area_name, district, `${district} is not a canonical district`);
  }
});

test('the re-export exposes the same data the server uses', () => {
  assert.ok(UPAZILA_DISTRICTS.length > 0);
  const district = UPAZILA_DISTRICTS[0];
  assert.deepEqual(getUpazilasForDistrict(district), UPAZILAS_BY_DISTRICT[district]);
});
