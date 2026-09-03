const PUBLIC_CONTACT_STATUSES = new Set(['ACTIVE', 'PARTIALLY_FULFILLED']);

export function shouldExposeRequestContacts(status: string, privilegedViewer = false) {
  return privilegedViewer || PUBLIC_CONTACT_STATUSES.has(status);
}

export function shouldExposeRequesterIdentity(flowVersion: string | undefined, privilegedViewer = false) {
  return privilegedViewer || flowVersion !== 'SEARCH_V1';
}
