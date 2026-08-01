import assert from 'node:assert/strict';
import test from 'node:test';
import {
  UPAZILAS_BY_DISTRICT,
  UPAZILA_DISTRICTS,
  getUpazilaByName,
  getUpazilaVariants,
  getUpazilasForDistrict,
  isValidUpazila
} from './upazilas';

test('districts resolve to their own upazilas', () => {
  const dhaka = getUpazilasForDistrict('Dhaka').map(item => item.value);
  assert.ok(dhaka.includes('Banani'));
  assert.ok(dhaka.includes('Savar'));
  assert.equal(getUpazilasForDistrict('Nowhere').length, 0);
  // Upazilas are district-scoped: Bagmara is in Rajshahi, not Dhaka.
  assert.equal(isValidUpazila('Rajshahi', 'Bagmara'), true);
  assert.equal(isValidUpazila('Dhaka', 'Bagmara'), false);
});

test('lookup folds case and punctuation and resolves merged spellings', () => {
  assert.equal(getUpazilaByName('dhaka', '  banani ')?.value, 'Banani');
  // Reviewed merges: both stored spellings resolve to one entry, and both
  // remain queryable so no listing becomes unreachable.
  assert.equal(getUpazilaByName('Dhaka', 'South Keraniganj')?.value, 'Dakshin Keraniganj');
  assert.equal(getUpazilaByName('Dhaka', 'Chalk Bazar')?.value, 'Chackbazar Model');
  assert.deepEqual(
    getUpazilaVariants('Dhaka', 'Chackbazar Model').slice().sort(),
    ['Chackbazar Model', 'Chalk Bazar']
  );
  // Distinct thanas that share a prefix must not have been merged.
  assert.notEqual(getUpazilaByName('Dhaka', 'Uttara')?.value, getUpazilaByName('Dhaka', 'Uttara East')?.value);
  assert.notEqual(getUpazilaByName('Dhaka', 'Keraniganj')?.value, getUpazilaByName('Dhaka', 'Dakshin Keraniganj')?.value);
  // An unknown name still yields something searchable rather than nothing.
  assert.deepEqual(getUpazilaVariants('Dhaka', 'Not A Place'), ['Not A Place']);
});

test('every district is populated and Bengali-script entries carry English labels', () => {
  assert.equal(UPAZILA_DISTRICTS.length, 64);
  for (const district of UPAZILA_DISTRICTS) {
    assert.ok(UPAZILAS_BY_DISTRICT[district].length > 0, `${district} has no upazilas`);
  }
  // Barguna and Jhalokati are written entirely in Bengali in the source
  // register. Without a label override their dropdowns would be unreadable in
  // this English-only interface, so guard the override map from regressing.
  const bengali = /[ঀ-৿]/;
  for (const district of UPAZILA_DISTRICTS) {
    for (const upazila of UPAZILAS_BY_DISTRICT[district]) {
      if (!bengali.test(upazila.value)) continue;
      assert.ok(!bengali.test(upazila.label), `${district}/${upazila.value} has no English label`);
    }
  }
  assert.equal(getUpazilaByName('Barguna', 'বরগুনা সদর')?.label, 'Barguna Sadar');
});
