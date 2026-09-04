import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMPTY_DRAFT,
  hasPatientDetails,
  hasPatientIdentity,
  hasPatientNeed,
  hasRequesterDetails,
  searchRequestPayload,
  startsAfterBloodGroup,
  type SearchDraft
} from './searchDraft';

const completeDraft = (patch: Partial<SearchDraft> = {}): SearchDraft => ({
  ...EMPTY_DRAFT,
  blood_group: 'B+',
  district: 'Meherpur',
  upazila: 'Meherpur Sadar',
  collection_facility: 'Meherpur General Hospital',
  requester_role: 'THIRD_PARTY',
  patient_sex: 'MALE',
  patient_name: 'Patient Name',
  patient_age: '32',
  blood_component: 'WHOLE_BLOOD',
  units_required: '2',
  request_reason: 'SURGERY',
  request_reason_details: '',
  requester_name: 'Volunteer Name',
  requester_phone: '01800000000',
  requester_relation: 'Brother',
  contact_owner: 'RELATIVE',
  contact_name: 'Relative Name',
  contact_phone: '01700000000',
  ...patch
});

test('a fresh app handoff skips the already selected blood group without stored state', () => {
  assert.equal(startsAfterBloodGroup(new URLSearchParams('blood_group=B%2B')), true);
  assert.equal(startsAfterBloodGroup(new URLSearchParams('blood_group=B%2B&native_start=1')), true);
  assert.equal(startsAfterBloodGroup(new URLSearchParams()), false);
  assert.equal(startsAfterBloodGroup(new URLSearchParams('blood_group=B%2B&district=Dhaka&upazila=Turag')), false);
});

test('completed patient and requester sections can be skipped when a draft is reopened', () => {
  assert.equal(hasPatientDetails(completeDraft()), true);
  assert.equal(hasPatientIdentity(completeDraft()), true);
  assert.equal(hasPatientNeed(completeDraft()), true);
  assert.equal(hasPatientIdentity(completeDraft({ patient_sex: '' })), false);
  assert.equal(hasPatientDetails(completeDraft({ patient_age: '0' })), false);
  assert.equal(hasPatientDetails(completeDraft({ patient_name: ' ' })), false);
  assert.equal(hasPatientDetails(completeDraft({ blood_component: '' })), false);
  assert.equal(hasPatientDetails(completeDraft({ blood_component: 'NOT_SURE' })), true);
  assert.equal(hasPatientDetails(completeDraft({ units_required: '0' })), false);
  assert.equal(hasPatientDetails(completeDraft({ units_required: '11' })), false);
  assert.equal(hasPatientDetails(completeDraft({ request_reason: '' })), false);

  assert.equal(hasRequesterDetails(completeDraft()), true);
  assert.equal(hasRequesterDetails(completeDraft({ requester_name: '', requester_phone: '' })), true);
  assert.equal(hasRequesterDetails(completeDraft({ contact_phone: '' })), false);
  assert.equal(hasRequesterDetails(completeDraft({ contact_owner: '' })), false);
  assert.equal(hasRequesterDetails(completeDraft({ contact_name: '' })), false);
  assert.equal(hasRequesterDetails(completeDraft({ requester_role: 'PATIENT' })), true);
  assert.equal(hasRequesterDetails(completeDraft({ requester_role: 'PATIENT', requester_phone: '' })), true);
  assert.equal(hasRequesterDetails(completeDraft({ requester_role: 'PATIENT', contact_phone: '' }), '01800000000'), false);
  assert.equal(hasRequesterDetails(completeDraft({ requester_role: 'RELATIVE', requester_relation: '' })), true);
});

test('self-patient payload uses the explicitly entered public contact, never the account phone', () => {
  const payload = searchRequestPayload(completeDraft({ requester_role: 'PATIENT' }));

  assert.equal('requester_name' in payload, false);
  assert.equal('requester_relation' in payload, false);
  assert.equal(payload.contact_owner, 'PATIENT');
  assert.equal('contact_name' in payload, false);
  assert.equal(payload.contact_phone, '01700000000');
  assert.equal('requester_phone' in payload, false);
  assert.equal(payload.blood_component, 'WHOLE_BLOOD');
  assert.equal(payload.units_required, 2);
  assert.equal(payload.patient_sex, 'MALE');
  assert.equal(payload.request_reason, 'SURGERY');
  assert.equal(payload.request_reason_details, undefined);
});

test('Other can carry an optional broad description without leaking stale text', () => {
  const other = searchRequestPayload(completeDraft({ request_reason: 'OTHER', request_reason_details: '  Rare medical need  ' }));
  assert.equal(other.request_reason_details, 'Rare medical need');

  const known = searchRequestPayload(completeDraft({ request_reason: 'ANAEMIA', request_reason_details: 'Stale text' }));
  assert.equal(known.request_reason_details, undefined);
});

test('request payload includes the public call contact but excludes private requester details', () => {
  const patientContact = searchRequestPayload(completeDraft({
    contact_owner: 'PATIENT'
  }));
  assert.equal('requester_name' in patientContact, false);
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
  assert.equal('requester_name' in relative, false);
  assert.equal('requester_relation' in relative, false);
  assert.equal('contact_owner' in relative, true);
  assert.equal('contact_name' in relative, true);
  assert.equal('contact_phone' in relative, true);
  if (!('contact_owner' in relative) || !('contact_name' in relative) || !('contact_phone' in relative)) {
    assert.fail('relative call contact fields were omitted');
  }
  assert.equal(relative.contact_owner, 'RELATIVE');
  assert.equal(relative.contact_name, 'Relative Name');
  assert.equal(relative.contact_phone, '01700000000');
  assert.equal('requester_phone' in relative, false);
});
