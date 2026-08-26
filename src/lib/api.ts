import type { LastDonationInput, PublicDonationSummary } from './donation';

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
  if (!res.ok) {
    const error = new Error(result.error || fallbackMessage) as Error & { status?: number; data?: any };
    error.status = res.status;
    error.data = result;
    throw error;
  }
  return result;
}

export type OtpPurpose = 'REGISTER' | 'RESET_PASSWORD' | 'CHANGE_PHONE' | 'SIGN_IN' | 'REMOVE_LISTING' | 'CLAIM_PROFILE';
export type OtpDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'canceled' | 'bypassed';
export type OtpDelivery = {
  challenge_id: string;
  delivery_status: OtpDeliveryStatus;
  expires_at: string;
};

export type SearchDonorCard = {
  donor_ref: string;
  donor_kind: 'REGISTERED' | 'IMPORTED';
  name: string;
  blood_group: string;
  is_exact_group: boolean;
  district: string;
  upazila: string;
  phone_masked: string;
  has_phone: boolean;
  is_verified?: boolean;
  availability_status?: string;
  donation_summary?: PublicDonationSummary;
  source?: { organization: string; url: string };
  contact_issues?: Partial<Record<'WRONG_NUMBER' | 'UNREACHABLE' | 'DECLINED' | 'RECENTLY_DONATED' | 'TOO_FAR' | 'HEALTH', number>>;
  claim_path?: string;
};

export type CommunityPostType = 'DONATION_STORY' | 'HEALTH_SUGGESTION';
export type CommunityPostStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'DELETED';

export type CommunityPostImage = {
  url: string;
  alt: string;
  width?: number;
  height?: number;
};

export type PublicCommunityPostSummary = {
  id: string;
  slug: string;
  type: CommunityPostType;
  title: string;
  excerpt: string;
  image?: CommunityPostImage;
  author: { name: string };
  published_at: string;
  updated_at: string;
};

export type PublicCommunityPostDetail = PublicCommunityPostSummary & {
  body_markdown: string;
};

export type CommunityOwnerPost = {
  id: string;
  slug?: string;
  type: CommunityPostType;
  status: CommunityPostStatus;
  title: string;
  body_markdown: string;
  excerpt: string;
  image?: CommunityPostImage;
  created_at: string;
  updated_at: string;
  published_at?: string;
  moderation_reason?: string;
};

export type AdminCommunityPost = CommunityOwnerPost & {
  author: {
    id: string;
    name: string;
    account_status?: string;
  };
};

export type CommunityPostListResponse<T> = {
  posts: T[];
  page: number;
  total: number;
  total_pages: number;
};

export type CommunityPostInput = {
  type: CommunityPostType;
  title: string;
  body_markdown: string;
};

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

  async requestOtp(phone: string, purpose: OtpPurpose) {
    const res = await fetch(`${API_BASE}/auth/otp/request`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ phone, purpose })
    });
    return readJsonOrThrow(res, 'Failed to send verification code');
  },

  async getOtpStatus(challengeId: string): Promise<OtpDelivery> {
    const res = await fetch(`${API_BASE}/auth/otp/${encodeURIComponent(challengeId)}/status`, {
      headers: getHeaders(),
      cache: 'no-store'
    });
    return readJsonOrThrow(res, 'Failed to check verification delivery');
  },

  async verifyOtp(phone: string, purpose: OtpPurpose, code: string) {
    const res = await fetch(`${API_BASE}/auth/otp/verify`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ phone, purpose, code })
    });
    return readJsonOrThrow(res, 'Failed to verify code');
  },

  // Signs in with a verified SIGN_IN code instead of a password, for the blood
  // request flow where someone may not remember a password they set long ago.
  async otpLogin(phone: string, verificationToken: string) {
    const res = await fetch(`${API_BASE}/auth/otp/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ phone, verification_token: verificationToken, fingerprint: BROWSER_FINGERPRINT })
    });
    return readJsonOrThrow(res, 'Failed to sign in');
  },

  async getPublicConfig() {
    const res = await fetch(`${API_BASE}/config/public`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load configuration');
  },

  async register(
    phone: string,
    name: string,
    password: string,
    verificationToken: string,
    blood_group: string,
    location: { lat: number; lng: number; area_name: string },
    donorDetails: {
      upazila?: string;
      age?: number;
      weight_kg?: number;
      last_donation?: LastDonationInput;
      donation_count?: number;
      availability_status: 'AVAILABLE' | 'NOT_AVAILABLE';
      availability_reason?: string;
    }
  ) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        phone, name, password, verification_token: verificationToken, blood_group, location,
        ...donorDetails,
        fingerprint: BROWSER_FINGERPRINT
      })
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

  async report(targetType: 'REQUEST' | 'COMMENT' | 'USER' | 'POST', targetId: string, reason: string, details?: string) {
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

  async updateOtpBypass(enabled: boolean, reason: string) {
    const res = await fetch(`${API_BASE}/admin/settings/otp-bypass`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ enabled, reason })
    });
    return readJsonOrThrow(res, 'Failed to update OTP bypass mode');
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

  async getAdminCommunityPosts(filters: { status?: CommunityPostStatus; type?: CommunityPostType } = {}): Promise<AdminCommunityPost[]> {
    const query = new URLSearchParams();
    if (filters.status) query.set('status', filters.status);
    if (filters.type) query.set('type', filters.type);
    const serialized = query.toString();
    const suffix = serialized ? `?${serialized}` : '';
    const res = await fetch(`${API_BASE}/admin/community${suffix}`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load community moderation posts');
  },

  async getAdminCommunityPost(id: string): Promise<AdminCommunityPost> {
    const res = await fetch(`${API_BASE}/admin/community/${encodeURIComponent(id)}`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load the community moderation post');
  },

  async moderateAdminCommunityPost(id: string, status: 'HIDDEN' | 'PUBLISHED', reason: string): Promise<AdminCommunityPost> {
    const res = await fetch(`${API_BASE}/admin/community/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status, reason })
    });
    return readJsonOrThrow(res, 'Failed to moderate community post');
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

  // Public community articles are indexable. Draft, image, publish and delete
  // operations remain tied to the authenticated owner's session.
  async getCommunityPosts(params: { type?: CommunityPostType; page?: number } = {}): Promise<CommunityPostListResponse<PublicCommunityPostSummary>> {
    const query = new URLSearchParams();
    if (params.type) query.set('type', params.type);
    if (params.page) query.set('page', String(params.page));
    const serialized = query.toString();
    const suffix = serialized ? `?${serialized}` : '';
    const res = await fetch(`${API_BASE}/community${suffix}`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load community posts');
  },

  async getCommunityPost(slug: string): Promise<PublicCommunityPostDetail> {
    const res = await fetch(`${API_BASE}/community/${encodeURIComponent(slug)}`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load that community post');
  },

  async createCommunityPost(input: CommunityPostInput): Promise<CommunityOwnerPost> {
    const res = await fetch(`${API_BASE}/community`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(input)
    });
    return readJsonOrThrow(res, 'Failed to save the community post draft');
  },

  async uploadCommunityPostImage(id: string, image: File, alt: string): Promise<CommunityOwnerPost> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) {
      throw new Error('Choose a JPEG, PNG, or WebP image.');
    }
    const res = await fetch(`${API_BASE}/community/${encodeURIComponent(id)}/image`, {
      method: 'POST',
      headers: {
        'Content-Type': image.type,
        'X-Image-Alt': encodeURIComponent(alt.trim()),
        'x-fingerprint': BROWSER_FINGERPRINT!
      },
      body: image
    });
    return readJsonOrThrow(res, 'Failed to upload the story image');
  },

  async publishCommunityPost(id: string): Promise<PublicCommunityPostDetail> {
    const res = await fetch(`${API_BASE}/community/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ consent: true })
    });
    return readJsonOrThrow(res, 'Failed to publish the community post');
  },

  async getMyCommunityPosts(page = 1): Promise<CommunityPostListResponse<CommunityOwnerPost>> {
    const query = new URLSearchParams({ page: String(Math.max(1, page)) });
    const res = await fetch(`${API_BASE}/me/community?${query.toString()}`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load your community posts');
  },

  async deleteCommunityPost(id: string) {
    const res = await fetch(`${API_BASE}/community/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return readJsonOrThrow(res, 'Failed to delete the community post');
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

  // --- Blood request search flow -----------------------------------------
  //
  // Searching is how a request is posted. Numbers come back masked for
  // everyone; unmasking one is a separate, recorded action that needs a
  // published request behind it.

  async searchDonorsByUpazila(params: { blood_group: string; district: string; upazila: string; page?: number }) {
    const query = new URLSearchParams({
      blood_group: params.blood_group,
      district: params.district,
      upazila: params.upazila
    });
    if (params.page && params.page > 1) query.set('page', String(params.page));
    const res = await fetch(`${API_BASE}/search/donors?${query}`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to search donors');
  },

  async getAdminCallReports() {
    const res = await fetch(`${API_BASE}/admin/call-reports`, { headers: getHeaders(), cache: 'no-store' });
    return readJsonOrThrow(res, 'Failed to load contact report evidence');
  },

  async moderateContactReports(body: { donor_ref: string; action: 'SUSPEND' | 'RESTORE' | 'RESOLVE_DISPUTE'; note: string; dispute_id?: string }) {
    const res = await fetch(`${API_BASE}/admin/contact-reports/actions`, {
      method: 'PATCH', headers: getHeaders(), body: JSON.stringify(body)
    });
    return readJsonOrThrow(res, 'Failed to update contact report state');
  },

  async getMyContactReports() {
    const res = await fetch(`${API_BASE}/me/contact-reports`, { headers: getHeaders(), cache: 'no-store' });
    return readJsonOrThrow(res, 'Failed to load contact reports');
  },

  async reverifyContactPhone(verificationToken: string) {
    const res = await fetch(`${API_BASE}/me/contact-reports/reverify-phone`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ verification_token: verificationToken })
    });
    return readJsonOrThrow(res, 'Failed to reverify the contact number');
  },

  async disputeContactReport(category: string, note: string) {
    const res = await fetch(`${API_BASE}/me/contact-reports/disputes`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ category, note })
    });
    return readJsonOrThrow(res, 'Failed to submit the dispute');
  },

  async createSearchRequest(body: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/search/requests`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ ...body, consent: true })
    });
    return readJsonOrThrow(res, 'Failed to publish your request');
  },

  async revealDonorPhone(requestId: string, donorRef: string) {
    const res = await fetch(`${API_BASE}/requests/${requestId}/reveals`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ donor_ref: donorRef })
    });
    return readJsonOrThrow(res, 'Failed to load the contact number');
  },

  async getPendingCallOutcome() {
    const res = await fetch(`${API_BASE}/me/reveals/pending`, { headers: getHeaders(), cache: 'no-store' });
    return readJsonOrThrow(res, 'Failed to check your last call');
  },

  async reportCall(requestId: string, body: { reveal_id: string; outcome: string; reason?: string; detail?: string; note?: string }) {
    const res = await fetch(`${API_BASE}/requests/${requestId}/call-reports`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(body)
    });
    return readJsonOrThrow(res, 'Failed to record how the call went');
  },

  async getDonorRequests() {
    const res = await fetch(`${API_BASE}/me/donor-requests`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load nearby requests');
  },

  async reportDonorOutcome(requestId: string, body: { outcome: string; note?: string; donated_on?: string; pause_availability?: boolean }) {
    const res = await fetch(`${API_BASE}/requests/${requestId}/donor-reports`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(body)
    });
    return readJsonOrThrow(res, 'Failed to send your response');
  },

  // Taking your own scraped listing down. No account involved: requiring one
  // would mean signing up in order to leave.
  async requestListingRemoval(phone: string) {
    const res = await fetch(`${API_BASE}/directory/removals/request`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ phone })
    });
    return readJsonOrThrow(res, 'Failed to send the verification code');
  },

  async confirmListingRemoval(phone: string, verificationToken: string) {
    const res = await fetch(`${API_BASE}/directory/removals/confirm`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ phone, verification_token: verificationToken })
    });
    return readJsonOrThrow(res, 'Failed to remove your listing');
  },

  // Opaque profile links remain for owners who need to claim an imported
  // record. There is intentionally no API client for browsing the collection.
  async getDirectoryProfile(id: string) {
    const res = await fetch(`${API_BASE}/directory/${encodeURIComponent(id)}`, { headers: getHeaders() });
    return readJsonOrThrow(res, 'Failed to load that profile');
  },

  async getClaimProfile(slug: string) {
    const res = await fetch(`${API_BASE}/claims/${encodeURIComponent(slug)}`, {
      headers: getHeaders(),
      cache: 'no-store'
    });
    return readJsonOrThrow(res, 'Failed to load that claim profile');
  },

  async completeClaimProfile(slug: string, body: {
    phone: string;
    verification_token: string;
    name: string;
    blood_group: string;
    district: string;
    upazila: string;
    availability_status: 'AVAILABLE' | 'NOT_AVAILABLE';
    availability_reason?: string;
    availability_consent: true;
  }) {
    const res = await fetch(`${API_BASE}/claims/${encodeURIComponent(slug)}/complete`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(body)
    });
    return readJsonOrThrow(res, 'Failed to complete that claim');
  },

  async contributeDonor(body: {
    name: string;
    phone: string;
    blood_group?: string;
    district?: string;
    upazila?: string;
    website?: string;
  }) {
    const res = await fetch(`${API_BASE}/contributions`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(body)
    });
    return readJsonOrThrow(res, 'Failed to create a private donor suggestion');
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
