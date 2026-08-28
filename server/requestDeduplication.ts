export type DuplicateRequestInput = {
  user_id: string;
  status: string;
  blood_group: string;
  location: { area_name: string };
  upazila?: string;
  contacts?: Array<{ phone: string; type: string }>;
};

export const OPEN_DUPLICATE_STATUSES = ['DRAFT', 'PENDING_VERIFICATION', 'ACTIVE', 'PARTIALLY_FULFILLED'] as const;

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (/^01\d{9}$/.test(digits)) return `+88${digits}`;
  if (/^8801\d{9}$/.test(digits)) return `+${digits}`;
  return value.trim();
}

export function patientSidePhone(request: Pick<DuplicateRequestInput, 'contacts'>) {
  const phone = request.contacts?.find(item => item.type === 'PATIENT')?.phone
    || request.contacts?.find(item => item.type === 'RELATIVE')?.phone
    || null;
  return phone ? normalizePhone(phone) : null;
}

export function findDuplicateActiveRequest<T extends DuplicateRequestInput>(existing: T[], candidate: Omit<DuplicateRequestInput, 'user_id' | 'status'>) {
  const phone = patientSidePhone(candidate);
  if (!phone) return undefined;
  const same = (left?: string, right?: string) => (left || '').trim().toLowerCase() === (right || '').trim().toLowerCase();
  return existing.find(request =>
    (OPEN_DUPLICATE_STATUSES as readonly string[]).includes(request.status) &&
    patientSidePhone(request) === phone &&
    request.blood_group === candidate.blood_group &&
    same(request.location.area_name, candidate.location.area_name) &&
    same(request.upazila, candidate.upazila)
  );
}
