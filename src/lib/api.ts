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

  async register(phone: string, name: string, password?: string, blood_group?: string, location?: { lat: number; lng: number; area_name: string }) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ phone, name, password, blood_group, location, fingerprint: BROWSER_FINGERPRINT })
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
