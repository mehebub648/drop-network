const API_BASE = '/api';

// Create or retrieve browser fingerprint. The server rejects fingerprints
// shorter than 16 characters, so regenerate any legacy short value.
function generateFingerprint() {
  let value = '';
  while (value.length < 24) {
    value += Math.random().toString(36).substring(2, 15);
  }
  return value;
}

let BROWSER_FINGERPRINT = localStorage.getItem('drop_fingerprint');
if (!BROWSER_FINGERPRINT || BROWSER_FINGERPRINT.length < 16) {
  BROWSER_FINGERPRINT = generateFingerprint();
  localStorage.setItem('drop_fingerprint', BROWSER_FINGERPRINT);
}

// Auth uses an httpOnly session cookie set by the server; same-origin fetches
// send it automatically, so no Authorization header is needed.
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'x-fingerprint': BROWSER_FINGERPRINT!
});

export { BROWSER_FINGERPRINT };

async function readJsonOrThrow(res: Response, fallbackMessage: string) {
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(result.error || fallbackMessage);
  return result;
}

export const api = {
  async login(phone: string, password?: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ phone, password, fingerprint: BROWSER_FINGERPRINT })
    });
    return readJsonOrThrow(res, 'Failed to login');
  },

  async logout() {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: getHeaders()
    });
    return readJsonOrThrow(res, 'Failed to logout');
  },

  async requestOtp(phone: string, purpose: 'REGISTER' | 'RESET_PASSWORD' | 'CHANGE_PHONE') {
    const res = await fetch(`${API_BASE}/auth/otp/request`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ phone, purpose })
    });
    return readJsonOrThrow(res, 'Failed to send verification code');
  },

  async verifyOtp(phone: string, purpose: 'REGISTER' | 'RESET_PASSWORD' | 'CHANGE_PHONE', code: string) {
    const res = await fetch(`${API_BASE}/auth/otp/verify`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ phone, purpose, code })
    });
    return readJsonOrThrow(res, 'Failed to verify code');
  },

  async getPublicConfig() {
    const res = await fetch(`${API_BASE}/config/public`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load configuration');
  },

  async register(phone: string, name: string, password: string, verificationToken: string, blood_group?: string, location?: { lat: number; lng: number; area_name: string }) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ phone, name, password, verification_token: verificationToken, blood_group, location, fingerprint: BROWSER_FINGERPRINT })
    });
    return readJsonOrThrow(res, 'Failed to register');
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/me`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Unauthorized');
    return res.json();
  },

  async updateMe(data: { name?: string; phone?: string }) {
    const res = await fetch(`${API_BASE}/me`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return readJsonOrThrow(res, 'Failed to update account');
  },

  async changePassword(currentPassword: string, newPassword: string) {
    const res = await fetch(`${API_BASE}/me/change-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
    });
    return readJsonOrThrow(res, 'Failed to change password');
  },

  async resetPassword(phone: string, newPassword: string, verificationToken: string) {
    const res = await fetch(`${API_BASE}/auth/reset-password`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ phone, new_password: newPassword, verification_token: verificationToken }) });
    return readJsonOrThrow(res, 'Failed to reset password');
  },

  async getSessions() {
    const res = await fetch(`${API_BASE}/me/sessions`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load sessions');
  },

  async revokeSession(id: string) {
    const res = await fetch(`${API_BASE}/me/sessions/${id}`, { method: 'DELETE', headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to revoke session');
  },

  async logoutAll() {
    const res = await fetch(`${API_BASE}/me/logout-all`, { method: 'POST', headers: getHeaders(), body: '{}' });
    return readJsonOrThrow(res, 'Failed to log out devices');
  },

  async exportAccount() {
    const res = await fetch(`${API_BASE}/me/export`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to export account');
  },

  async deleteAccount(password: string) {
    const res = await fetch(`${API_BASE}/me`, { method: 'DELETE', headers: getHeaders(), body: JSON.stringify({ password }) });
    return readJsonOrThrow(res, 'Failed to delete account');
  },

  async updateDonorProfile(profile: any) {
    const res = await fetch(`${API_BASE}/me/donor-profile`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(profile)
    });
    return readJsonOrThrow(res, 'Failed to update donor profile');
  },

  async requestBlood(requestData: any) {
    const res = await fetch(`${API_BASE}/requests`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(requestData)
    });
    return readJsonOrThrow(res, 'Failed to create request');
  },

  async publishRequest(id: string) {
    const res = await fetch(`${API_BASE}/requests/${id}/publish`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ consent: true })
    });
    return readJsonOrThrow(res, 'Failed to publish request');
  },

  async inviteDonor(requestId: string, donorId: string) {
    const res = await fetch(`${API_BASE}/requests/${requestId}/invitations`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ donor_id: donorId })
    });
    return readJsonOrThrow(res, 'Failed to invite donor');
  },

  async getInvitations() {
    const res = await fetch(`${API_BASE}/me/invitations`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load donor responses');
  },

  async updateDonorResponse(id: string, status: string, message?: string) {
    const res = await fetch(`${API_BASE}/responses/${id}`, {
      method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ status, message })
    });
    return readJsonOrThrow(res, 'Failed to update donor response');
  },

  async confirmDonation(id: string) {
    const res = await fetch(`${API_BASE}/responses/${id}/confirm-donation`, {
      method: 'POST', headers: getHeaders(), body: '{}'
    });
    return readJsonOrThrow(res, 'Failed to confirm donation');
  },

  async getNotifications() {
    const res = await fetch(`${API_BASE}/me/notifications`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load notifications');
  },

  async markNotificationRead(id: string) {
    const res = await fetch(`${API_BASE}/me/notifications/${id}/read`, { method: 'PATCH', headers: getHeaders(), body: '{}' });
    return readJsonOrThrow(res, 'Failed to mark notification read');
  },

  async report(targetType: 'REQUEST' | 'COMMENT' | 'USER', targetId: string, reason: string, details?: string) {
    const res = await fetch(`${API_BASE}/reports`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ target_type: targetType, target_id: targetId, reason, details })
    });
    return readJsonOrThrow(res, 'Failed to submit report');
  },

  async blockUser(userId: string) {
    const res = await fetch(`${API_BASE}/me/blocks/${userId}`, { method: 'POST', headers: getHeaders(), body: '{}' });
    return readJsonOrThrow(res, 'Failed to block user');
  },

  async createSupportTicket(data: { name: string; email?: string; phone?: string; category: string; message: string }) {
    const res = await fetch(`${API_BASE}/support/tickets`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) });
    return readJsonOrThrow(res, 'Failed to send support request');
  },

  async getAdminOverview() {
    const res = await fetch(`${API_BASE}/admin/overview`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load admin overview');
  },

  async getAdminUsers(search = '') {
    const res = await fetch(`${API_BASE}/admin/users?search=${encodeURIComponent(search)}`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load users');
  },

  async updateAdminUser(id: string, data: any) {
    const res = await fetch(`${API_BASE}/admin/users/${id}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify(data) });
    return readJsonOrThrow(res, 'Failed to update user');
  },

  async revokeAdminUserSessions(id: string, reason: string) {
    const res = await fetch(`${API_BASE}/admin/users/${id}/revoke-sessions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason })
    });
    return readJsonOrThrow(res, 'Failed to revoke member sessions');
  },

  async getAdminRequests() {
    const res = await fetch(`${API_BASE}/admin/requests`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load requests');
  },

  async moderateRequest(id: string, status: string, note?: string) {
    const res = await fetch(`${API_BASE}/admin/requests/${id}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ status, note }) });
    return readJsonOrThrow(res, 'Failed to moderate request');
  },

  async updateReport(id: string, status: string, resolutionNote?: string) {
    const res = await fetch(`${API_BASE}/admin/reports/${id}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ status, resolution_note: resolutionNote }) });
    return readJsonOrThrow(res, 'Failed to update report');
  },

  async updateTicket(id: string, status: string) {
    const res = await fetch(`${API_BASE}/admin/tickets/${id}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ status }) });
    return readJsonOrThrow(res, 'Failed to update ticket');
  },

  async getAuditLog() {
    const res = await fetch(`${API_BASE}/admin/audit`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load audit log');
  },

  async getMyRequests() {
    const res = await fetch(`${API_BASE}/me/requests`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load requests');
  },

  async getRequests(params: { blood_group?: string; district?: string; urgent?: boolean; page?: number; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (params.blood_group) query.set('blood_group', params.blood_group);
    if (params.district) query.set('district', params.district);
    if (params.urgent) query.set('urgent', 'true');
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    const res = await fetch(`${API_BASE}/requests?${query}`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load requests');
  },

  async searchDonors(params: {
    blood_group: string;
    location: { lat: number; lng: number; area_name: string };
  }) {
    const query = new URLSearchParams({
      blood_group: params.blood_group,
      lat: String(params.location.lat),
      lng: String(params.location.lng),
      area_name: params.location.area_name
    });
    const res = await fetch(`${API_BASE}/donors/search?${query}`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to search available donors');
  },

  // Imported archive. Contact numbers stay masked for every caller; claiming
  // verifies ownership but does not turn third-party publication into consent.
  async getDirectory(params: { blood_group?: string; district?: string; source?: string; q?: string; page?: number } = {}) {
    const query = new URLSearchParams();
    if (params.blood_group) query.set('blood_group', params.blood_group);
    if (params.district) query.set('district', params.district);
    if (params.source) query.set('source', params.source);
    if (params.q) query.set('q', params.q);
    if (params.page) query.set('page', String(params.page));
    const res = await fetch(`${API_BASE}/directory?${query}`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load the donor directory');
  },

  async getDirectorySources() {
    const res = await fetch(`${API_BASE}/directory/sources`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load directory sources');
  },

  async getDirectoryProfile(id: string) {
    const res = await fetch(`${API_BASE}/directory/${encodeURIComponent(id)}`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load that profile');
  },

  async claimDirectoryProfile(id: string, body: { name?: string; blood_group?: string; location?: { lat: number; lng: number; area_name: string } }) {
    const res = await fetch(`${API_BASE}/directory/${encodeURIComponent(id)}/claim`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(body)
    });
    return readJsonOrThrow(res, 'Failed to claim that profile');
  },

  async getDirectoryClaims() {
    const res = await fetch(`${API_BASE}/admin/directory/claims`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load directory claims');
  },

  async reviewDirectoryClaim(id: string, approve: boolean, note?: string) {
    const res = await fetch(`${API_BASE}/admin/directory/claims/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ approve, note })
    });
    return readJsonOrThrow(res, 'Failed to review that claim');
  },

  async getStats() {
    const res = await fetch(`${API_BASE}/stats`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load stats');
  },

  async getRequestDetails(id: string) {
    const res = await fetch(`${API_BASE}/requests/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Not found');
    return res.json();
  },

  async updateRequestStatus(id: string, status: string) {
    const res = await fetch(`${API_BASE}/requests/${id}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status })
    });
    return readJsonOrThrow(res, 'Failed to update request status');
  },

  async updateRequestDetails(id: string, data: any) {
    const res = await fetch(`${API_BASE}/requests/${id}/details`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return readJsonOrThrow(res, 'Failed to update request details');
  },

  async addComment(id: string, text: string, anonymousName?: string) {
    const res = await fetch(`${API_BASE}/requests/${id}/comments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ text, anonymous_name: anonymousName })
    });
    return readJsonOrThrow(res, 'Failed to submit comment');
  },

  async deleteComment(id: string, commentId: string) {
    const res = await fetch(`${API_BASE}/requests/${id}/comments/${commentId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return readJsonOrThrow(res, 'Failed to delete comment');
  },

  async getOrganizations() {
    const res = await fetch(`${API_BASE}/organizations`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load organizations');
  },

  async applyOrganization(data: any) {
    const res = await fetch(`${API_BASE}/organizations`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) });
    return readJsonOrThrow(res, 'Failed to submit organization application');
  },

  async getAdminOrganizations() {
    const res = await fetch(`${API_BASE}/admin/organizations`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load organization applications');
  },

  async reviewOrganization(id: string, status: string, note?: string) {
    const res = await fetch(`${API_BASE}/admin/organizations/${id}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ status, note }) });
    return readJsonOrThrow(res, 'Failed to review organization');
  },

  async createCampaign(id: string, data: any) {
    const res = await fetch(`${API_BASE}/organizations/${id}/campaigns`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) });
    return readJsonOrThrow(res, 'Failed to publish campaign');
  }
};
