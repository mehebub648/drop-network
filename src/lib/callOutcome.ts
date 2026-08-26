export const PENDING_CALL_CHANGED_EVENT = 'drop:pending-call-changed';
export const PENDING_CALL_STORAGE_KEY = 'drop_pending_call_changed';

export type RevealedCallContact = {
  reveal_id: string;
  donor_ref: string;
  donor_kind: 'REGISTERED' | 'IMPORTED';
  name: string;
  blood_group: string;
  district: string;
  upazila: string;
  phone: string;
  source?: { organization: string; url: string };
};

export type PendingCallChangedDetail = {
  requestId: string;
  reveal: RevealedCallContact;
};

export function announcePendingCall(detail?: PendingCallChangedDetail) {
  window.dispatchEvent(new CustomEvent<PendingCallChangedDetail | undefined>(PENDING_CALL_CHANGED_EVENT, { detail }));
  try {
    localStorage.setItem(PENDING_CALL_STORAGE_KEY, String(Date.now()));
  } catch {
    // The same-tab event still works when browser storage is unavailable.
  }
}
