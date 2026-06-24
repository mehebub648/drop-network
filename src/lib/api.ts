const API_BASE = '/api';

// Create or retrieve browser fingerprint
let BROWSER_FINGERPRINT = localStorage.getItem('drop_fingerprint');
if (!BROWSER_FINGERPRINT) {
  BROWSER_FINGERPRINT = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  localStorage.setItem('drop_fingerprint', BROWSER_FINGERPRINT);
}

const getHeaders = (token?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-fingerprint': BROWSER_FINGERPRINT!
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

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
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to login');
    }
    return res.json();
  },

  async logout(token: string) {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return readJsonOrThrow(res, 'Failed to logout');
  },

  async sendOtp(phone: string) {
    const res = await fetch(`${API_BASE}/auth/send-otp`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ phone })
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to send OTP');
    }
    return res.json();
  },

  async verifyOtp(phone: string, otp: string) {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ phone, otp })
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to verify OTP');
    }
    return res.json();
  },

  async register(phone: string, name: string, password?: string, blood_group?: string, location?: any) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ phone, name, password, blood_group, location, fingerprint: BROWSER_FINGERPRINT })
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to register');
    }
    return res.json();
  },
  
  async getMe(token: string) {
    const res = await fetch(`${API_BASE}/me`, {
      headers: getHeaders(token)
    });
    if (!res.ok) throw new Error('Unauthorized');
    return res.json();
  },

  async updateDonorProfile(token: string, profile: any) {
    const res = await fetch(`${API_BASE}/me/donor-profile`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(profile)
    });
    return readJsonOrThrow(res, 'Failed to update donor profile');
  },

  async requestBlood(token: string, requestData: any) {
    const res = await fetch(`${API_BASE}/requests`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(requestData)
    });
    return readJsonOrThrow(res, 'Failed to create request');
  },

  async getMyRequests(token: string) {
    const res = await fetch(`${API_BASE}/me/requests`, { headers: getHeaders(token) });
    return readJsonOrThrow(res, 'Failed to load requests');
  },

  async getRequests() {
    const res = await fetch(`${API_BASE}/requests`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load requests');
  },

  async getRequestDetails(id: string, token: string) {
    const res = await fetch(`${API_BASE}/requests/${id}`, { headers: getHeaders(token) });
    if (!res.ok) throw new Error('Not found');
    return res.json();
  },

  async updateRequestStatus(token: string, id: string, status: string) {
    const res = await fetch(`${API_BASE}/requests/${id}/status`, {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify({ status })
    });
    return readJsonOrThrow(res, 'Failed to update request status');
  },

  async updateRequestDetails(token: string, id: string, data: any) {
    const res = await fetch(`${API_BASE}/requests/${id}/details`, {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify(data)
    });
    return readJsonOrThrow(res, 'Failed to update request details');
  },

  async addComment(token: string, id: string, text: string, anonymousName?: string) {
    const res = await fetch(`${API_BASE}/requests/${id}/comments`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ text, anonymous_name: anonymousName })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to submit comment');
    return result;
  },

  async deleteComment(token: string, id: string, commentId: string) {
    const res = await fetch(`${API_BASE}/requests/${id}/comments/${commentId}`, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to delete comment');
    return result;
  }
};
