export const AVAILABILITY_REASON_MAX_LENGTH = 240;
export const MEDICAL_CONDITIONS_MAX_LENGTH = 500;

export type RegistrationAvailability = 'AVAILABLE' | 'NOT_AVAILABLE';

export function parseAvailabilityReason(value: unknown): string | undefined | null {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length <= AVAILABILITY_REASON_MAX_LENGTH ? trimmed : null;
}

export function parseMedicalConditions(value: unknown): string | undefined | null {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length <= MEDICAL_CONDITIONS_MAX_LENGTH ? trimmed : null;
}

export function parseRegistrationAvailability(
  status: unknown,
  reason: unknown
): { value: { status: RegistrationAvailability; reason?: string } } | { error: string } {
  if (status !== 'AVAILABLE' && status !== 'NOT_AVAILABLE') {
    return { error: 'Choose whether you are available to donate' };
  }
  const parsedReason = parseAvailabilityReason(reason);
  if (parsedReason === null) {
    return { error: `Availability reason must be ${AVAILABILITY_REASON_MAX_LENGTH} characters or fewer` };
  }
  if (parsedReason && status === 'AVAILABLE') {
    return { error: 'Availability reason only applies when you are not available' };
  }
  return { value: { status, ...(parsedReason ? { reason: parsedReason } : {}) } };
}
