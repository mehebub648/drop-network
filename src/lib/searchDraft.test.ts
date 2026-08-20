import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMPTY_DRAFT,
  hasPatientDetails,
  hasRequesterDetails,
  searchRequestPayload,
  type SearchDraft
} from './searchDraft';

const completeDraft = (patch: Partial<SearchDraft> = {}): SearchDraft => ({
  ...EMPTY_DRAFT,
  blood_group: 'B+',
  district: 'Meherpur',
  upazila: 'Meherpur Sadar',
  collection_facility: 'Meherpur General Hospital',
  requester_role: 'THIRD_PARTY',
  patient_title: 'MR',
  patient_name: 'Patient Name',
  patient_age: '32',
  requester_name: 'Volunteer Name',
  requester_phone: '01800000000',
  requester_relation: 'Brother',
  contact_owner: 'RELATIVE',
  contact_name: 'Relative Name',
  contact_phone: '01700000000',
  ...patch
});

test('completed patient and requester sections can be skipped when a draft is reopened', () => {
  assert.equal(hasPatientDetails(completeDraft()), true);
  assert.equal(hasPatientDetails(completeDraft({ patient_age: '0' })), false);
  assert.equal(hasPatientDetails(completeDraft({ patient_name: ' ' })), false);

  assert.equal(hasRequesterDetails(completeDraft()), true);
  assert.equal(hasRequesterDetails(completeDraft({ requester_phone: '' })), false);
  assert.equal(hasRequesterDetails(completeDraft({ requester_phone: '' }), '01800000000'), true);
  assert.equal(hasRequesterDetails(completeDraft({ contact_name: '' })), false);
  assert.equal(hasRequesterDetails(completeDraft({ requester_role: 'PATIENT' })), true);
  assert.equal(hasRequesterDetails(completeDraft({ requester_role: 'RELATIVE', requester_relation: '' })), false);
});

test('request payload omits stale contact fields after changing to patient', () => {
  const payload = searchRequestPayload(completeDraft({ requester_role: 'PATIENT' }));

  assert.equal('requester_name' in payload, false);
  assert.equal('requester_relation' in payload, false);
  assert.equal('contact_owner' in payload, false);
  assert.equal('contact_name' in payload, false);
  assert.equal('contact_phone' in payload, false);
  assert.equal('requester_phone' in payload, false);
});

test('request payload includes only fields relevant to the selected coordinator role', () => {
  const patientContact = searchRequestPayload(completeDraft({
    contact_owner: 'PATIENT'
  }));
  assert.equal(patientContact.requester_name, 'Volunteer Name');
  assert.equal('contact_owner' in patientContact, true);
  assert.equal('contact_phone' in patientContact, true);
  if (!('contact_owner' in patientContact) || !('contact_phone' in patientContact)) {
    assert.fail('third-party patient contact fields were omitted');
  }
  assert.equal(patientContact.contact_owner, 'PATIENT');
  assert.equal(patientContact.contact_phone, '01700000000');
  assert.equal('requester_phone' in patientContact, false);
  assert.equal('contact_name' in patientContact, false);
  assert.equal('requester_relation' in patientContact, false);

  const relative = searchRequestPayload(completeDraft({ requester_role: 'RELATIVE' }));
  assert.equal(relative.requester_name, 'Volunteer Name');
  assert.equal(relative.requester_relation, 'Brother');
  assert.equal('contact_owner' in relative, false);
  assert.equal('contact_phone' in relative, false);
  assert.equal('requester_phone' in relative, false);
});
