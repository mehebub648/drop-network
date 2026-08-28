import assert from 'node:assert/strict';
import test from 'node:test';
import { findDuplicateActiveRequest, patientSidePhone } from './requestDeduplication';

const base = {
  user_id: 'owner-a', status: 'ACTIVE', blood_group: 'O+', location: { area_name: 'Dhaka' }, upazila: 'Savar',
  contacts: [{ phone: '+8801711111111', type: 'PATIENT' }]
};

test('matches normalized patient-side phone, blood group, district, and upazila', () => {
  assert.equal(findDuplicateActiveRequest([base], { ...base, contacts: [{ phone: '01711-111111', type: 'PATIENT' }] })?.user_id, 'owner-a');
  assert.equal(findDuplicateActiveRequest([base], { ...base, blood_group: 'A+' }), undefined);
});

test('closed requests do not block a new request', () => {
  assert.equal(findDuplicateActiveRequest([{ ...base, status: 'FULFILLED' }], base), undefined);
});

test('third-party volunteer phone is ignored in favor of patient or relative phone', () => {
  const request = { contacts: [
    { phone: '+8801999999999', type: 'OTHER' },
    { phone: '+8801888888888', type: 'RELATIVE' }
  ] };
  assert.equal(patientSidePhone(request), '+8801888888888');
});
