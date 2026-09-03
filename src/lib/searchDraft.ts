// The blood request being assembled, kept in localStorage while the requester
// works through the flow.
//
// The inline sign-in step does not navigate, so in-memory state would usually
// survive it on its own. This exists for the case that actually loses people:
// leaving the browser to read an SMS code and coming back to a tab the phone
// killed in the meantime. Losing the patient's details at that moment, in an
// emergency, is the failure worth spending a few lines to prevent.
//
// A password or verification code is never written here.

import type { RequestReason } from './requestReasons';

export const SEARCH_DRAFT_KEY = 'drop_search_flow_v1';

export type RequesterRole = 'PATIENT' | 'RELATIVE' | 'THIRD_PARTY';
export type NeededWindow = 'WITHIN_HOURS' | 'TODAY' | 'WITHIN_2_3_DAYS' | 'PLANNED';
export type PatientSex = 'MALE' | 'FEMALE';
export type BloodComponent =
  | 'NOT_SURE'
  | 'WHOLE_BLOOD'
  | 'RED_CELLS'
  | 'PLATELETS'
  | 'PLASMA'
  | 'APHERESIS_PLATELETS'
  | 'CRYOPRECIPITATE'
  | 'WASHED_RED_CELLS'
  | 'IRRADIATED_RED_CELLS'
  | 'GRANULOCYTES'
  | 'OTHER_COMPONENT';

export type SearchDraft = {
  blood_group: string;
  district: string;
  upazila: string;
  collection_facility: string;
  collection_facility_code?: string;
  requester_role: RequesterRole | '';
  patient_sex: PatientSex | '';
  patient_name: string;
  patient_age: string;
  blood_component: BloodComponent | '';
  units_required: string;
  request_reason: RequestReason | '';
  request_reason_details: string;
  requester_name: string;
  /** The coordinator's private account/verification number. Never sent in the request body. */
  requester_phone: string;
  requester_relation: string;
  contact_owner: 'PATIENT' | 'RELATIVE' | '';
  contact_name: string;
  contact_phone: string;
  needed_window: NeededWindow | '';
  /** Set once the request is published, so a reload does not publish twice. */
  request_id?: string;
};

export const EMPTY_DRAFT: SearchDraft = {
  blood_group: '',
  district: '',
  upazila: '',
  collection_facility: '',
  requester_role: '',
  patient_sex: '',
  patient_name: '',
  patient_age: '',
  blood_component: 'NOT_SURE',
  units_required: '',
  request_reason: '',
  request_reason_details: '',
  requester_name: '',
  requester_phone: '',
  requester_relation: '',
  contact_owner: '',
  contact_name: '',
  contact_phone: '',
  needed_window: ''
};

export function readSearchDraft(): SearchDraft {
  try {
    const stored = localStorage.getItem(SEARCH_DRAFT_KEY);
    if (!stored) return { ...EMPTY_DRAFT };
    const parsed = JSON.parse(stored) as Partial<SearchDraft> & { patient_title?: string };
    const { patient_title: legacyPatientTitle, ...storedDraft } = parsed;
    const legacySex = legacyPatientTitle === 'MR'
      ? 'MALE'
      : legacyPatientTitle === 'MST'
        ? 'FEMALE'
        : '';
    // Merging onto the empty draft means a stored value from an older shape
    // loads with the missing fields blank instead of crashing the page. The
    // former honorific field is read once as gender so an interrupted request
    // survives this release without continuing to store titles.
    return {
      ...EMPTY_DRAFT,
      ...storedDraft,
      patient_sex: storedDraft.patient_sex || legacySex,
      blood_component: storedDraft.blood_component || 'NOT_SURE'
    };
  } catch {
    return { ...EMPTY_DRAFT };
  }
}

export function writeSearchDraft(draft: SearchDraft) {
  try {
    localStorage.setItem(SEARCH_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // A full or disabled storage is not a reason to interrupt the flow.
  }
}

export function clearSearchDraft() {
  try {
    localStorage.removeItem(SEARCH_DRAFT_KEY);
  } catch {
    // Ignored for the same reason.
  }
}

/** A blood-group-only link has already completed the first search question. */
export function startsAfterBloodGroup(params: URLSearchParams) {
  return Boolean(
    params.get('blood_group')
    && !params.get('district')
    && !params.get('upazila')
  );
}

export function hasPatientIdentity(draft: SearchDraft) {
  const age = Number(draft.patient_age);
  return Boolean(
    draft.patient_sex &&
    draft.patient_name.trim() &&
    Number.isInteger(age) &&
    age >= 1 &&
    age <= 120
  );
}

export function hasPatientNeed(draft: SearchDraft) {
  const units = Number(draft.units_required);
  return Boolean(
    draft.blood_component &&
    Number.isInteger(units) &&
    units >= 1 &&
    units <= 10 &&
    draft.request_reason
  );
}

export function hasPatientDetails(draft: SearchDraft) {
  return hasPatientIdentity(draft) && hasPatientNeed(draft);
}

export function hasRequesterDetails(draft: SearchDraft, verifiedRequesterPhone = '') {
  const requesterPhone = draft.requester_phone.trim() || verifiedRequesterPhone.trim();
  if (draft.requester_role === 'PATIENT') return Boolean(requesterPhone);
  if (draft.requester_role === 'RELATIVE') {
    return Boolean(draft.requester_name.trim() && requesterPhone);
  }
  if (draft.requester_role !== 'THIRD_PARTY') return false;
  if (!draft.requester_name.trim() || !requesterPhone || !draft.contact_owner || !draft.contact_phone.trim()) return false;
  if (draft.contact_owner === 'RELATIVE') {
    return Boolean(draft.contact_name.trim());
  }
  return true;
}

/** The body `POST /api/search/requests` expects. */
export function searchRequestPayload(draft: SearchDraft) {
  const requesterFields = draft.requester_role === 'RELATIVE'
    ? {
        requester_name: draft.requester_name || undefined
      }
    : draft.requester_role === 'THIRD_PARTY'
      ? {
          requester_name: draft.requester_name || undefined,
          contact_owner: draft.contact_owner || undefined,
          contact_phone: draft.contact_phone || undefined,
          ...(draft.contact_owner === 'RELATIVE'
            ? {
                contact_name: draft.contact_name || undefined
              }
            : {})
        }
      : {};

  return {
    blood_group: draft.blood_group,
    district: draft.district,
    upazila: draft.upazila,
    collection_facility: draft.collection_facility,
    collection_facility_code: draft.collection_facility_code,
    requester_role: draft.requester_role,
    patient_sex: draft.patient_sex,
    patient_name: draft.patient_name,
    patient_age: Number(draft.patient_age),
    blood_component: draft.blood_component,
    units_required: Number(draft.units_required),
    request_reason: draft.request_reason,
    request_reason_details: draft.request_reason === 'OTHER' ? draft.request_reason_details.trim() || undefined : undefined,
    ...requesterFields,
    needed_window: draft.needed_window || undefined
  };
}
