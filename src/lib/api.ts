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

  async getMyRequests() {
    const res = await fetch(`${API_BASE}/me/requests`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load requests');
  },

  async getRequests() {
    const res = await fetch(`${API_BASE}/requests`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load requests');
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
  }
};
