/**
 * Broad transfusion indications, ordered for Bangladesh requesters.
 *
 * The order starts with the most frequently reported indications in available
 * Bangladesh recipient studies. Labels stay broad: this is coordination data,
 * not a diagnosis or a clinical decision to transfuse.
 */
export const REQUEST_REASON_OPTIONS = [
  {
    value: 'ANAEMIA',
    label: 'Anaemia or low haemoglobin',
    keywords: 'anemia low hb haemoglobin hemoglobin low blood'
  },
  {
    value: 'CHILDBIRTH',
    label: 'Pregnancy or childbirth bleeding',
    keywords: 'pregnancy delivery childbirth obstetric postpartum pph maternity caesarean cesarean c-section'
  },
  {
    value: 'SURGERY',
    label: 'Surgery or operation',
    keywords: 'surgery operation surgical pre-op postoperative post-op'
  },
  {
    value: 'ACCIDENT_BLEEDING',
    label: 'Accident or trauma bleeding',
    keywords: 'accident trauma injury emergency blood loss bleeding'
  },
  {
    value: 'KIDNEY_DIALYSIS',
    label: 'Kidney disease or dialysis',
    keywords: 'kidney renal dialysis haemodialysis hemodialysis ckd'
  },
  {
    value: 'THALASSEMIA',
    label: 'Thalassemia',
    keywords: 'thalassaemia thalassemia regular transfusion hb e beta'
  },
  {
    value: 'CANCER_TREATMENT',
    label: 'Cancer treatment',
    keywords: 'cancer chemotherapy tumour tumor oncology malignancy'
  },
  {
    value: 'BLOOD_CANCER',
    label: 'Blood cancer or leukaemia',
    keywords: 'blood cancer leukemia leukaemia lymphoma myeloma aml all cml'
  },
  {
    value: 'GI_BLEEDING',
    label: 'Stomach or intestinal bleeding',
    keywords: 'gastrointestinal gi bleeding stomach intestinal bowel ulcer vomiting blood melena'
  },
  {
    value: 'BONE_MARROW_FAILURE',
    label: 'Bone marrow failure',
    keywords: 'aplastic anaemia anemia bone marrow failure pancytopenia'
  },
  {
    value: 'LIVER_CLOTTING',
    label: 'Liver disease or clotting problem',
    keywords: 'liver disease clotting coagulopathy plasma ffp bleeding disorder'
  },
  {
    value: 'OTHER',
    label: 'Other medical need',
    keywords: 'other not listed different'
  }
] as const;

export type RequestReason = (typeof REQUEST_REASON_OPTIONS)[number]['value'];

export const REQUEST_REASONS: readonly RequestReason[] = REQUEST_REASON_OPTIONS.map(option => option.value);

export function requestReasonLabel(value?: string | null) {
  return REQUEST_REASON_OPTIONS.find(option => option.value === value)?.label || '';
}

export function matchingRequestReasonOptions(query: string) {
  const terms = query.trim().toLocaleLowerCase('en').split(/\s+/).filter(Boolean);
  const other = REQUEST_REASON_OPTIONS[REQUEST_REASON_OPTIONS.length - 1];
  if (terms.length === 0) return [...REQUEST_REASON_OPTIONS];

  const matches = REQUEST_REASON_OPTIONS.slice(0, -1).filter(option => {
    const haystack = `${option.label} ${option.keywords}`.toLocaleLowerCase('en');
    return terms.every(term => haystack.includes(term));
  });
  return [...matches, other];
}
