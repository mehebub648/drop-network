import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { syncDonorToPartition, getAllFromTable, saveToTable, getPartitionName, getDb, removeDonorFromAllPartitions } from './db';
import { getSmsProvider, isSmsConfigured } from './sms';

const app = express();
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const configuredPort = Number(process.env.PORT || process.env.PROD_PORT || 3000);
const PORT = Number.isFinite(configuredPort) ? configuredPort : 3000;
const DEFAULT_REQUEST_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_VERIFICATION_TTL_MS = 30 * 60 * 1000;
const DONATION_INTERVAL_DAYS = Math.max(1, Number(process.env.DONATION_INTERVAL_DAYS || 120));
const AVAILABILITY_TTL_DAYS = Math.max(1, Number(process.env.AVAILABILITY_TTL_DAYS || 14));
const MATCH_RADIUS_KM = Math.max(10, Number(process.env.MATCH_RADIUS_KM || 250));
const SESSION_COOKIE = 'drop_session';
// Anonymous fingerprints shorter than this are rejected so trivial values
// (e.g. "anon") can't collide with comment author ids or claim ownership.
const MIN_FINGERPRINT_LENGTH = 16;
const BCRYPT_ROUNDS = 10;
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
type BloodGroup = (typeof BLOOD_GROUPS)[number];
// For each recipient group, the donor groups whose blood they can receive.
// Kept in sync with src/lib/blood.ts.
const COMPATIBLE_DONORS: Record<BloodGroup, BloodGroup[]> = {
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'A-': ['A-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  'AB-': ['A-', 'B-', 'AB-', 'O-'],
  'O+': ['O+', 'O-'],
  'O-': ['O-']
};
const REQUEST_STATUSES = ['DRAFT', 'PENDING_VERIFICATION', 'ACTIVE', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED', 'EXPIRED', 'REJECTED'] as const;
const AVAILABILITY_STATUSES = ['AVAILABLE', 'SICK', 'TRAVELING', 'NOT_AVAILABLE'] as const;
const CONTACT_TYPES = ['PATIENT', 'RELATIVE', 'HOSPITAL', 'OTHER'] as const;
const BLOOD_COMPONENTS = ['WHOLE_BLOOD', 'RED_CELLS', 'PLATELETS', 'PLASMA'] as const;
const REQUESTER_RELATIONSHIPS = ['SELF', 'FAMILY', 'FRIEND', 'HOSPITAL_STAFF', 'VOLUNTEER', 'OTHER'] as const;
const DEFERRAL_STATUSES = ['NONE', 'TEMPORARY', 'PERMANENT'] as const;
const allowedCorsOrigins = new Set(
  (process.env.CORS_ORIGIN || process.env.APP_URL || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin && origin !== 'MY_APP_URL')
);

// Behind a TLS-terminating reverse proxy in production; needed so
// express-rate-limit sees the real client IP instead of the proxy's.
app.set('trust proxy', 1);

// CSP is disabled in development because Vite's middleware-mode HMR relies on
// inline scripts and websocket connections.
app.use(helmet({
  contentSecurityPolicy: IS_PRODUCTION
    ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"]
        }
      }
    : false
}));

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedCorsOrigins.size === 0) {
      return callback(null, !IS_PRODUCTION);
    }
    return callback(null, allowedCorsOrigins.has(origin));
  }
}));
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

app.use('/api', apiLimiter);

// IN-MEMORY DATABASE MOCK
type DonationRecord = {
  id: string;
  date: string;
  organization: string;
};

type AvailabilityHistoryEntry = {
  status: 'AVAILABLE' | 'SICK' | 'TRAVELING' | 'NOT_AVAILABLE';
  changed_at: string;
};

type DonorProfile = {
  blood_group: string;
  last_donation_date?: string;
  location: { lat: number, lng: number, area_name: string };
  availability_status: 'AVAILABLE' | 'SICK' | 'TRAVELING' | 'NOT_AVAILABLE';
  availability_confirmed_at?: string;
  deferral_status?: 'NONE' | 'TEMPORARY' | 'PERMANENT';
  deferred_until?: string;
  donation_history?: DonationRecord[];
  availability_history?: AvailabilityHistoryEntry[];
};

type RecipientProfile = {
  default_location: { lat: number, lng: number, area_name: string };
};

type User = {
  id: string;
  phone: string;
  name: string;
  password?: string;
  is_verified: boolean;
  phone_verified_at?: string;
  roles?: string[];
  account_status?: 'ACTIVE' | 'SUSPENDED';
  suspension_reason?: string;
  blocked_user_ids?: string[];
  created_at?: string;
  donor_profile?: DonorProfile;
  recipient_profile?: RecipientProfile;
};

type AuthSession = {
  id: string;
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  revoked_at?: string;
};

type ContactDetail = {
  name: string;
  phone: string;
  type: 'PATIENT' | 'RELATIVE' | 'HOSPITAL' | 'OTHER';
};

type Comment = {
  id: string;
  user_id: string;
  user_name: string;
  text: string;
  created_at: string;
};

type BloodRequest = {
  id: string;
  user_id: string;
  blood_group: string;
  location: { lat: number, lng: number, area_name: string };
  created_at: string;
  expires_at: string;
  status: (typeof REQUEST_STATUSES)[number];
  blood_component?: (typeof BLOOD_COMPONENTS)[number];
  units_required?: number;
  units_pledged?: number;
  units_confirmed?: number;
  hospital_name?: string;
  hospital_address?: string;
  ward?: string;
  patient_reference?: string;
  patient_name?: string;
  requester_name?: string;
  requester_relationship?: (typeof REQUESTER_RELATIONSHIPS)[number];
  needed_by?: string;
  consent_at?: string;
  published_at?: string;
  timeline?: Array<{ id: string; type: string; actor_id: string; created_at: string; note?: string }>;
  contacts?: ContactDetail[];
  comments?: Comment[];
};

type OtpChallenge = {
  id: string;
  phone: string;
  purpose: 'REGISTER' | 'RESET_PASSWORD' | 'CHANGE_PHONE';
  code_hash: string;
  created_at: string;
  expires_at: string;
  attempts: number;
  verified_at?: string;
  verification_token?: string;
  verification_expires_at?: string;
};

const RESPONSE_STATUSES = ['INVITED', 'ACCEPTED', 'DECLINED', 'QUESTION', 'ARRIVED', 'DONATED', 'CANCELLED', 'NO_SHOW'] as const;
type DonorResponse = {
  id: string;
  request_id: string;
  donor_id: string;
  requester_id: string;
  status: (typeof RESPONSE_STATUSES)[number];
  units: number;
  message?: string;
  created_at: string;
  updated_at: string;
  donor_confirmed_at?: string;
  requester_confirmed_at?: string;
};

type AppNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  created_at: string;
  read_at?: string;
};

type ModerationReport = {
  id: string;
  reporter_id: string;
  target_type: 'REQUEST' | 'COMMENT' | 'USER';
  target_id: string;
  reason: 'SPAM' | 'FRAUD' | 'PAYMENT_REQUEST' | 'HARASSMENT' | 'PRIVACY' | 'OTHER';
  details?: string;
  status: 'OPEN' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';
  created_at: string;
  updated_at: string;
  assigned_to?: string;
  resolution_note?: string;
};

type AuditEvent = {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata?: Record<string, unknown>;
  created_at: string;
};

type SupportTicket = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  category: 'SUPPORT' | 'SAFETY' | 'PRIVACY' | 'PARTNERSHIP';
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  created_at: string;
  updated_at: string;
  owner_id?: string;
};

type PublicUser = Omit<User, 'password'>;

// Never serialize the password hash to clients.
function sanitizeUser(user: User): PublicUser {
  const { password, ...publicUser } = user;
  return publicUser;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

function optionalCleanString(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === '') return undefined;
  return cleanString(value, maxLength);
}

function normalizeBangladeshPhone(value: unknown) {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '');
  const local = digits.startsWith('880') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
  if (!/^1[3-9]\d{8}$/.test(local)) return null;
  return `+880${local}`;
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

function parseDate(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parsePositiveInteger(value: unknown, maximum = 20) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= maximum ? number : null;
}

function parseLocation(value: unknown) {
  if (!isPlainObject(value)) return null;
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  const areaName = cleanString(value.area_name, 80);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !areaName) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng, area_name: areaName };
}

function parseContacts(value: unknown) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 8) return null;

  const contacts: ContactDetail[] = [];
  for (const item of value) {
    if (!isPlainObject(item)) return null;
    const name = cleanString(item.name, 80);
    const phone = normalizeBangladeshPhone(item.phone);
    if (!name || !phone || !isOneOf(item.type, CONTACT_TYPES)) return null;
    contacts.push({ name, phone, type: item.type });
  }
  return contacts;
}

function parseDonationHistory(value: unknown) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 100) return null;

  const records: DonationRecord[] = [];
  for (const item of value) {
    if (!isPlainObject(item)) return null;
    const id = optionalCleanString(item.id, 80) || uuidv4();
    const date = parseDate(item.date);
    const organization = cleanString(item.organization, 120);
    if (!date || !organization) return null;
    if (new Date(date).getTime() > Date.now()) return null;
    records.push({ id, date: date.slice(0, 10), organization });
  }
  return records;
}

function validationError(res: express.Response, message: string) {
  return res.status(400).json({ error: message });
}

// Runtime write-through cache. Data is loaded from LanceDB on startup and
// every mutation is persisted back to the datastore, so these arrays always
// mirror the persisted tables for the lifetime of the process.
let users: User[] = [];
let requests: BloodRequest[] = [];
let sessions: AuthSession[] = [];
let otpChallenges: OtpChallenge[] = [];
let donorResponses: DonorResponse[] = [];
let notifications: AppNotification[] = [];
let moderationReports: ModerationReport[] = [];
let auditEvents: AuditEvent[] = [];
let supportTickets: SupportTicket[] = [];

async function initDbData() {
  users = await getAllFromTable('common_users');
  requests = await getAllFromTable('common_requests');
  sessions = await getAllFromTable('common_sessions');
  otpChallenges = await getAllFromTable('common_otps');
  donorResponses = await getAllFromTable('common_responses');
  notifications = await getAllFromTable('common_notifications');
  moderationReports = await getAllFromTable('common_reports');
  auditEvents = await getAllFromTable('common_audit_events');
  supportTickets = await getAllFromTable('common_support_tickets');
  const adminPhone = normalizeBangladeshPhone(process.env.ADMIN_PHONE);
  if (adminPhone) {
    const admin = users.find(user => user.phone === adminPhone);
    if (admin && !admin.roles?.includes('ADMIN')) {
      admin.roles = [...new Set([...(admin.roles || ['MEMBER']), 'ADMIN'])];
      await saveToTable('common_users', admin);
    }
  }
  await enforceExpiredRequests();
}

async function audit(actorId: string, action: string, targetType: string, targetId: string, metadata?: Record<string, unknown>) {
  const event: AuditEvent = { id: uuidv4(), actor_id: actorId, action, target_type: targetType, target_id: targetId, metadata, created_at: new Date().toISOString() };
  auditEvents.push(event);
  await saveToTable('common_audit_events', event);
  return event;
}

async function notify(userId: string, type: string, title: string, body: string, href: string) {
  const notification: AppNotification = {
    id: uuidv4(), user_id: userId, type, title, body, href, created_at: new Date().toISOString()
  };
  notifications.push(notification);
  await saveToTable('common_notifications', notification);
  return notification;
}

async function enforceExpiredRequests() {
  const now = Date.now();
  const expiredRequests = requests.filter(r =>
    (r.status === 'ACTIVE' || r.status === 'PARTIALLY_FULFILLED') &&
    r.expires_at &&
    new Date(r.expires_at).getTime() <= now
  );

  for (const request of expiredRequests) {
    request.status = 'EXPIRED';
    request.timeline = [...(request.timeline || []), {
      id: uuidv4(), type: 'REQUEST_EXPIRED', actor_id: 'system', created_at: new Date().toISOString()
    }];
    await saveToTable('common_requests', request, [request.location.lng, request.location.lat]);
  }
}

type DonorRecord = Pick<User, 'id' | 'name' | 'phone' | 'is_verified' | 'blocked_user_ids'> & { donor_profile: DonorProfile };

type DonorMatch = {
  user_id: string;
  name: string;
  phone?: string;
  blood_group: string;
  distance_km: number;
  availability_status: DonorProfile['availability_status'];
  last_donation_date?: string;
  is_verified: boolean;
  availability_confirmed_at?: string;
};

function donorEligibility(profile: DonorProfile) {
  if (profile.deferral_status === 'PERMANENT') return { eligible: false, reason: 'Permanently deferred' };
  if (profile.deferral_status === 'TEMPORARY') {
    const until = profile.deferred_until ? new Date(profile.deferred_until).getTime() : Number.POSITIVE_INFINITY;
    if (until > Date.now()) return { eligible: false, reason: 'Temporarily deferred' };
  }
  if (profile.last_donation_date) {
    const next = new Date(profile.last_donation_date).getTime() + DONATION_INTERVAL_DAYS * 86_400_000;
    if (next > Date.now()) return { eligible: false, reason: 'Donation interval not complete' };
  }
  const confirmed = profile.availability_confirmed_at ? new Date(profile.availability_confirmed_at).getTime() : 0;
  if (confirmed + AVAILABILITY_TTL_DAYS * 86_400_000 < Date.now()) {
    return { eligible: false, reason: 'Availability confirmation expired' };
  }
  return { eligible: true, reason: null };
}

// Searches the District x Group partitions of every blood group that is
// medically compatible with the recipient's group (e.g. an A+ patient also
// matches A-, O+, and O- donors). Phone numbers are included only when
// `includePhone` is true (authenticated callers / request owners).
async function findDonorMatches(
  location: { lat: number; lng: number; area_name: string },
  bloodGroup: string,
  excludeUserId: string,
  includePhone: boolean
): Promise<DonorMatch[]> {
  const donorGroups = COMPATIBLE_DONORS[bloodGroup as BloodGroup] || [bloodGroup];
  // The user table is authoritative for safety state. Searching it also allows
  // legitimate nearby donors across district boundaries to be considered.
  const dbMatches = users.filter((user): user is DonorRecord => Boolean(user.donor_profile));
  const requester = users.find(user => user.id === excludeUserId);

  return dbMatches
    .filter(u => u.id !== excludeUserId)
    .filter(u => !u.blocked_user_ids?.includes(excludeUserId) && !requester?.blocked_user_ids?.includes(u.id))
    .filter(u => donorGroups.includes(u.donor_profile.blood_group as BloodGroup))
    .filter(u => u.donor_profile.availability_status === 'AVAILABLE')
    .filter(u => donorEligibility(u.donor_profile).eligible)
    .map(u => {
      const dist = getDistance(
        location.lat, location.lng,
        u.donor_profile.location.lat, u.donor_profile.location.lng
      );
      return {
        user_id: u.id,
        name: u.name,
        ...(includePhone ? { phone: u.phone } : {}),
        blood_group: u.donor_profile.blood_group,
        distance_km: Math.round(dist * 10) / 10,
        availability_status: u.donor_profile.availability_status,
        last_donation_date: u.donor_profile.last_donation_date,
        is_verified: Boolean(u.is_verified),
        availability_confirmed_at: u.donor_profile.availability_confirmed_at
      };
    })
    .filter(match => match.distance_km <= MATCH_RADIUS_KM)
    .sort((a, b) => a.distance_km - b.distance_km);
}

// Haversine distance calculation in kilometers.
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2-lat1) * Math.PI / 180;
  const dLon = (lon2-lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const commentTimestamps: Record<string, number[]> = {};

function getSessionToken(req: express.Request) {
  const token = req.cookies?.[SESSION_COOKIE];
  return typeof token === 'string' && token ? token : '';
}

function normalizeFingerprint(value: unknown) {
  const fingerprint = cleanString(value, 120);
  return fingerprint && fingerprint.length >= MIN_FINGERPRINT_LENGTH ? fingerprint : '';
}

function getFingerprint(req: express.Request) {
  return normalizeFingerprint(req.headers['x-fingerprint']);
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: IS_PRODUCTION,
    maxAge: SESSION_TTL_MS,
    path: '/'
  };
}

function getCurrentAuth(req: express.Request) {
  const token = getSessionToken(req);
  if (!token) return null;

  const now = Date.now();
  const session = sessions.find(s =>
    s.token === token &&
    !s.revoked_at &&
    new Date(s.expires_at).getTime() > now
  );
  if (!session) return null;

  const user = users.find(u => u.id === session.user_id);
  return user && user.account_status !== 'SUSPENDED' ? { user, session } : null;
}

function isOperator(user: User | undefined) {
  return Boolean(user?.roles?.some(role => ['ADMIN', 'MODERATOR', 'SUPPORT', 'VERIFIER'].includes(role)));
}

function isAdmin(user: User | undefined) {
  return Boolean(user?.roles?.includes('ADMIN'));
}

async function issueSession(userId: string) {
  const now = Date.now();
  const session: AuthSession = {
    id: uuidv4(),
    token: uuidv4(),
    user_id: userId,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + SESSION_TTL_MS).toISOString()
  };
  sessions.push(session);
  await saveToTable('common_sessions', session);
  return session.token;
}

async function revokeSession(req: express.Request) {
  const auth = getCurrentAuth(req);
  if (!auth) return;
  auth.session.revoked_at = new Date().toISOString();
  await saveToTable('common_sessions', auth.session);
}

function getActorId(req: express.Request) {
  const auth = getCurrentAuth(req);
  return auth?.user.id || getFingerprint(req) || '';
}

function isRequestOwner(request: BloodRequest, req: express.Request) {
  const actorId = getActorId(req);
  return Boolean(actorId && request.user_id === actorId);
}

function publicRequestPayload(request: BloodRequest) {
  const requester = users.find(u => u.id === request.user_id);
  const { contacts, comments, patient_name, patient_reference, timeline, ...safeRequest } = request;
  return {
    ...safeRequest,
    requester_name: request.requester_name || requester?.name || 'Anonymous',
    comment_count: comments?.length || 0
  };
}

function verifiedChallenge(phone: string, purpose: OtpChallenge['purpose'], token: unknown) {
  if (typeof token !== 'string' || !token) return null;
  return otpChallenges.find(challenge =>
    challenge.phone === phone &&
    challenge.purpose === purpose &&
    challenge.verification_token === token &&
    challenge.verification_expires_at &&
    new Date(challenge.verification_expires_at).getTime() > Date.now()
  ) || null;
}

async function consumeChallenge(challenge: OtpChallenge) {
  challenge.verification_expires_at = new Date(0).toISOString();
  await saveToTable('common_otps', challenge);
}

// API Routes

app.get('/api/config/public', (_req, res) => {
  res.json({
    sms_configured: isSmsConfigured(),
    donation_interval_days: DONATION_INTERVAL_DAYS,
    availability_ttl_days: AVAILABILITY_TTL_DAYS,
    match_radius_km: MATCH_RADIUS_KM
  });
});

app.post('/api/auth/otp/request', authLimiter, async (req, res) => {
  const phone = normalizeBangladeshPhone(req.body?.phone);
  const purpose = req.body?.purpose;
  if (!phone || !isOneOf(purpose, ['REGISTER', 'RESET_PASSWORD', 'CHANGE_PHONE'] as const)) {
    return validationError(res, 'Valid Bangladesh phone and purpose are required');
  }
  const provider = getSmsProvider();
  if (!provider) return res.status(503).json({ error: 'Phone verification is not configured' });
  if (purpose === 'REGISTER' && users.some(user => user.phone === phone)) {
    return res.status(409).json({ error: 'Phone already registered' });
  }
  if (purpose === 'RESET_PASSWORD' && !users.some(user => user.phone === phone)) {
    // Do not disclose account existence.
    return res.json({ success: true });
  }

  const recent = otpChallenges.find(challenge =>
    challenge.phone === phone && challenge.purpose === purpose &&
    Date.now() - new Date(challenge.created_at).getTime() < 60_000
  );
  if (recent) return res.status(429).json({ error: 'Wait before requesting another code' });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const now = Date.now();
  const challenge: OtpChallenge = {
    id: uuidv4(), phone, purpose,
    code_hash: await bcrypt.hash(code, BCRYPT_ROUNDS),
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + OTP_TTL_MS).toISOString(),
    attempts: 0
  };
  otpChallenges.push(challenge);
  await saveToTable('common_otps', challenge);
  await provider.sendOtp(phone, code);
  res.json({ success: true, provider: provider.name });
});

app.post('/api/auth/otp/verify', authLimiter, async (req, res) => {
  const phone = normalizeBangladeshPhone(req.body?.phone);
  const purpose = req.body?.purpose;
  const code = cleanString(req.body?.code, 6);
  if (!phone || !code || !/^\d{6}$/.test(code) || !isOneOf(purpose, ['REGISTER', 'RESET_PASSWORD', 'CHANGE_PHONE'] as const)) {
    return validationError(res, 'Valid phone, purpose, and six-digit code are required');
  }
  const challenge = [...otpChallenges].reverse().find(item =>
    item.phone === phone && item.purpose === purpose && !item.verified_at && new Date(item.expires_at).getTime() > Date.now()
  );
  if (!challenge || challenge.attempts >= 5) return res.status(400).json({ error: 'Code is invalid or expired' });
  challenge.attempts += 1;
  if (!(await bcrypt.compare(code, challenge.code_hash))) {
    await saveToTable('common_otps', challenge);
    return res.status(400).json({ error: 'Code is invalid or expired' });
  }
  challenge.verified_at = new Date().toISOString();
  challenge.verification_token = uuidv4();
  challenge.verification_expires_at = new Date(Date.now() + OTP_VERIFICATION_TTL_MS).toISOString();
  await saveToTable('common_otps', challenge);
  res.json({ verification_token: challenge.verification_token });
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const phone = normalizeBangladeshPhone(req.body?.phone);
  const password = cleanString(req.body?.password, 128);
  // Only honor a fingerprint the same client also presents as its own header;
  // stops replaying someone else's leaked fingerprint from a different client.
  const bodyFingerprint = normalizeFingerprint(req.body?.fingerprint);
  const fingerprint = bodyFingerprint && bodyFingerprint === getFingerprint(req) ? bodyFingerprint : '';
  if (!phone || !password) return validationError(res, 'Phone and password are required');

  let user = users.find(u => u.phone === phone);

  if (!user || !user.password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isBcryptHash = user.password.startsWith('$2');
  if (isBcryptHash) {
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
  } else {
    // Legacy record with a plaintext password: verify directly, then upgrade
    // the stored value to a bcrypt hash.
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    user.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await saveToTable('common_users', user);
  }

  // Reassign ownership from fingerprint to verified user
  if (fingerprint) {
    for (let r of requests) {
      let rChanged = false;
      if (r.user_id === fingerprint) {
        r.user_id = user!.id;
        rChanged = true;
      }
      if (r.comments) {
        r.comments.forEach(c => {
          if (c.user_id === fingerprint) {
            c.user_id = user!.id;
            c.user_name = user!.name;
            rChanged = true;
          }
        });
      }
      if (rChanged) {
        await saveToTable('common_requests', r, [r.location.lng, r.location.lat]);
      }
    }
  }

  const token = await issueSession(user.id);
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
  res.json({ user: sanitizeUser(user) });
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const phone = normalizeBangladeshPhone(req.body?.phone);
  const name = cleanString(req.body?.name, 100);
  const password = cleanString(req.body?.password, 128);
  const bodyFingerprint = normalizeFingerprint(req.body?.fingerprint);
  const fingerprint = bodyFingerprint && bodyFingerprint === getFingerprint(req) ? bodyFingerprint : '';
  const blood_group = req.body?.blood_group;
  const location = req.body?.location === undefined ? undefined : parseLocation(req.body.location);
  const challenge = phone ? verifiedChallenge(phone, 'REGISTER', req.body?.verification_token) : null;

  if (!phone || !name || !password) return validationError(res, 'Phone, name, and password are required');
  if (!challenge) return res.status(403).json({ error: 'Verify this phone before registering' });
  if (password.length < 8) return validationError(res, 'Password must be at least 8 characters');
  if (blood_group !== undefined && !isOneOf(blood_group, BLOOD_GROUPS)) return validationError(res, 'Valid blood group is required');
  if (req.body?.location !== undefined && !location) return validationError(res, 'Valid location is required');
  if ((blood_group && !location) || (!blood_group && location)) return validationError(res, 'Blood group and location must be provided together');
  
  if (users.find(u => u.phone === phone)) {
    return res.status(400).json({ error: 'Phone already registered' });
  }
  
  const user: User = {
    id: uuidv4(),
    phone,
    name,
    password: await bcrypt.hash(password, BCRYPT_ROUNDS),
    // Phone verification is not wired up yet (no SMS provider); accounts start
    // unverified until a real OTP flow exists.
    is_verified: true,
    phone_verified_at: new Date().toISOString(),
    roles: ['MEMBER'],
    created_at: new Date().toISOString(),
  };

  if (blood_group && location) {
    user.donor_profile = {
      blood_group,
      location,
      availability_status: 'NOT_AVAILABLE',
      deferral_status: 'NONE',
      availability_history: [{ status: 'NOT_AVAILABLE', changed_at: new Date().toISOString() }]
    };
  }

  users.push(user);
  await saveToTable('common_users', user);
  if (user.donor_profile?.availability_status === 'AVAILABLE') {
    await syncDonorToPartition(user);
  }
  
  // Reassign ownership from fingerprint to verified user
  if (fingerprint) {
    for (let r of requests) {
      let rChanged = false;
      if (r.user_id === fingerprint) {
        r.user_id = user!.id;
        rChanged = true;
      }
      if (r.comments) {
        r.comments.forEach(c => {
          if (c.user_id === fingerprint) {
            c.user_id = user!.id;
            c.user_name = user!.name;
            rChanged = true;
          }
        });
      }
      if (rChanged) {
        await saveToTable('common_requests', r, [r.location.lng, r.location.lat]);
      }
    }
  }

  const token = await issueSession(user.id);
  await consumeChallenge(challenge);
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
  res.json({ user: sanitizeUser(user) });
});

app.post('/api/auth/logout', async (req, res) => {
  await revokeSession(req);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  res.json(sanitizeUser(auth.user));
});

app.patch('/api/me', async (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const hasName = req.body?.name !== undefined;
  const hasPhone = req.body?.phone !== undefined;
  if (!hasName && !hasPhone) return validationError(res, 'Name or phone is required');

  const name = hasName ? cleanString(req.body.name, 100) : auth.user.name;
  const phone = hasPhone ? normalizeBangladeshPhone(req.body.phone) : auth.user.phone;
  if (!name || !phone) return validationError(res, 'Valid name and phone are required');

  const duplicate = users.find(user => user.id !== auth.user.id && user.phone === phone);
  if (duplicate) return res.status(409).json({ error: 'Phone already registered' });

  const userIndex = users.findIndex(user => user.id === auth.user.id);
  if (userIndex === -1) return res.status(401).json({ error: 'Unauthorized' });

  const phoneChanged = phone !== auth.user.phone;
  if (phoneChanged) {
    const challenge = verifiedChallenge(phone, 'CHANGE_PHONE', req.body?.verification_token);
    if (!challenge) return res.status(403).json({ error: 'Verify the new phone before saving it' });
    await consumeChallenge(challenge);
  }
  users[userIndex] = {
    ...users[userIndex], name, phone,
    ...(phoneChanged ? { is_verified: true, phone_verified_at: new Date().toISOString() } : {})
  };
  await saveToTable('common_users', users[userIndex]);

  if (users[userIndex].donor_profile) {
    await removeDonorFromAllPartitions(users[userIndex].id);
    if (users[userIndex].donor_profile?.availability_status === 'AVAILABLE') {
      await syncDonorToPartition(users[userIndex]);
    }
  }

  res.json(sanitizeUser(users[userIndex]));
});

app.post('/api/me/change-password', async (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const currentPassword = cleanString(req.body?.current_password, 128);
  const newPassword = cleanString(req.body?.new_password, 128);
  if (!currentPassword || !newPassword) return validationError(res, 'Current and new passwords are required');
  if (newPassword.length < 8) return validationError(res, 'New password must be at least 8 characters');
  if (!auth.user.password) return res.status(400).json({ error: 'Password login is not available for this account' });

  const matches = auth.user.password.startsWith('$2')
    ? await bcrypt.compare(currentPassword, auth.user.password)
    : currentPassword === auth.user.password;
  if (!matches) return res.status(400).json({ error: 'Current password is incorrect' });

  auth.user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await saveToTable('common_users', auth.user);
  res.json({ success: true });
});

app.get('/api/me/requests', async (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  await enforceExpiredRequests();
  const userRequests = requests.filter(r => r.user_id === auth.user.id);
  const sortedRequests = [...userRequests].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const enrichedRequests = sortedRequests.map(r => {
      const requester = users.find(u => u.id === r.user_id);
      return {
          ...r,
          requester_name: r.requester_name || requester?.name || 'Anonymous',
          requester_phone: requester?.phone || '+8800000000'
      };
  });
  res.json(enrichedRequests);
});

app.post('/api/me/donor-profile', async (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const blood_group = req.body?.blood_group;
  const availability_status = req.body?.availability_status;
  const location = parseLocation(req.body?.location);
  const last_donation_date = parseDate(req.body?.last_donation_date);
  const donation_history = parseDonationHistory(req.body?.donation_history);
  const deferral_status = req.body?.deferral_status || 'NONE';
  const deferred_until = parseDate(req.body?.deferred_until);

  if (!isOneOf(blood_group, BLOOD_GROUPS)) return validationError(res, 'Valid blood group is required');
  if (!isOneOf(availability_status, AVAILABILITY_STATUSES)) return validationError(res, 'Valid availability status is required');
  if (!location) return validationError(res, 'Valid location is required');
  if (last_donation_date === null) return validationError(res, 'Valid last donation date is required');
  if (last_donation_date && new Date(last_donation_date).getTime() > Date.now()) return validationError(res, 'Last donation date cannot be in the future');
  if (donation_history === null) return validationError(res, 'Valid donation history is required');
  if (!isOneOf(deferral_status, DEFERRAL_STATUSES)) return validationError(res, 'Valid deferral status is required');
  if (deferred_until === null || (deferral_status === 'TEMPORARY' && !deferred_until)) return validationError(res, 'Temporary deferral needs an end date');

  const userIndex = users.findIndex(u => u.id === auth.user.id);
  if (userIndex !== -1) {
    const existingProfile = users[userIndex].donor_profile;
    const availabilityHistory = [...(existingProfile?.availability_history || [])];
    if (!existingProfile || existingProfile.availability_status !== availability_status) {
      availabilityHistory.push({ status: availability_status, changed_at: new Date().toISOString() });
    }
    users[userIndex].donor_profile = {
      ...existingProfile,
      blood_group,
      availability_status,
      location,
      ...(last_donation_date ? { last_donation_date } : { last_donation_date: undefined }),
      deferral_status,
      deferred_until,
      availability_confirmed_at: availability_status === 'AVAILABLE' ? new Date().toISOString() : existingProfile?.availability_confirmed_at,
      donation_history: donation_history || existingProfile?.donation_history || [],
      availability_history: availabilityHistory.slice(-50)
    };
    await saveToTable('common_users', users[userIndex]);
    await removeDonorFromAllPartitions(users[userIndex].id);
    if (users[userIndex].donor_profile?.availability_status === 'AVAILABLE') {
      await syncDonorToPartition(users[userIndex]);
    }
    res.json(sanitizeUser(users[userIndex]));
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

function parseCompleteRequest(body: Record<string, unknown>) {
  const blood_group = body.blood_group;
  const blood_component = body.blood_component;
  const location = parseLocation(body.location);
  const needed_by = parseDate(body.needed_by);
  const contacts = parseContacts(body.contacts);
  const units_required = parsePositiveInteger(body.units_required);
  const hospital_name = cleanString(body.hospital_name, 160);
  const hospital_address = cleanString(body.hospital_address, 240);
  const ward = optionalCleanString(body.ward, 100);
  const patient_reference = cleanString(body.patient_reference, 100);
  const patient_name = cleanString(body.patient_name, 120);
  const requester_name = cleanString(body.requester_name, 120);
  const requester_relationship = body.requester_relationship;

  if (!isOneOf(blood_group, BLOOD_GROUPS)) return { error: 'Valid blood group is required' } as const;
  if (!isOneOf(blood_component, BLOOD_COMPONENTS)) return { error: 'Valid blood component is required' } as const;
  if (!location) return { error: 'Valid location is required' } as const;
  if (!needed_by || new Date(needed_by).getTime() <= Date.now()) return { error: 'Needed-by time must be in the future' } as const;
  if (!units_required) return { error: 'Units required must be between 1 and 20' } as const;
  if (!hospital_name || !hospital_address || !patient_reference || !patient_name || !requester_name) {
    return { error: 'Hospital, patient, reference, and requester details are required' } as const;
  }
  if (!isOneOf(requester_relationship, REQUESTER_RELATIONSHIPS)) return { error: 'Valid requester relationship is required' } as const;
  if (!contacts || contacts.length === 0) return { error: 'At least one verified Bangladesh contact is required' } as const;

  return {
    value: {
      blood_group, blood_component, location, needed_by, contacts, units_required,
      hospital_name, hospital_address, ward, patient_reference, patient_name,
      requester_name, requester_relationship
    }
  } as const;
}

// A draft is private and can only be created by a verified account. Publishing
// is a separate, explicit action so the requester can review the data first.
app.post('/api/requests', async (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Log in to create a request' });
  if (!auth.user.is_verified) return res.status(403).json({ error: 'Verify your phone before creating a request' });
  const parsed = parseCompleteRequest(req.body || {});
  if ('error' in parsed) return validationError(res, parsed.error);
  const duplicate = requests.find(request =>
    request.user_id === auth.user.id &&
    ['DRAFT', 'ACTIVE', 'PARTIALLY_FULFILLED'].includes(request.status) &&
    request.patient_reference?.toLowerCase() === parsed.value.patient_reference.toLowerCase() &&
    request.hospital_name?.toLowerCase() === parsed.value.hospital_name.toLowerCase()
  );
  if (duplicate) return res.status(409).json({ error: 'A request for this patient reference and hospital already exists', request_id: duplicate.id });

  const now = new Date().toISOString();
  const request: BloodRequest = {
    id: uuidv4(), user_id: auth.user.id, ...parsed.value,
    created_at: now,
    expires_at: new Date(Math.max(Date.now() + DEFAULT_REQUEST_TTL_MS, new Date(parsed.value.needed_by).getTime() + 6 * 3_600_000)).toISOString(),
    status: 'DRAFT', units_pledged: 0, units_confirmed: 0, comments: [],
    timeline: [{ id: uuidv4(), type: 'DRAFT_CREATED', actor_id: auth.user.id, created_at: now }]
  };
  requests.push(request);
  await saveToTable('common_requests', request, [request.location.lng, request.location.lat]);
  res.status(201).json(request);
});

app.post('/api/requests/:id/publish', async (req, res) => {
  const auth = getCurrentAuth(req);
  const request = requests.find(item => item.id === req.params.id);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.user_id !== auth.user.id) return res.status(403).json({ error: 'Only the request owner can publish it' });
  if (request.status !== 'DRAFT' && request.status !== 'PENDING_VERIFICATION') return res.status(409).json({ error: 'Only a draft can be published' });
  if (req.body?.consent !== true) return validationError(res, 'Explicit publication consent is required');

  const now = new Date().toISOString();
  request.status = 'ACTIVE';
  request.consent_at = now;
  request.published_at = now;
  request.timeline = [...(request.timeline || []), { id: uuidv4(), type: 'REQUEST_PUBLISHED', actor_id: auth.user.id, created_at: now }];
  await saveToTable('common_requests', request, [request.location.lng, request.location.lat]);
  res.json({ request, matches: await findDonorMatches(request.location, request.blood_group, request.user_id, false) });
});

function responsePayload(response: DonorResponse, viewerId: string) {
  const request = requests.find(item => item.id === response.request_id);
  const donor = users.find(user => user.id === response.donor_id);
  const requester = users.find(user => user.id === response.requester_id);
  const contactAllowed = ['ACCEPTED', 'ARRIVED', 'DONATED'].includes(response.status) &&
    (viewerId === response.donor_id || viewerId === response.requester_id);
  return {
    ...response,
    request: request ? {
      id: request.id, blood_group: request.blood_group, blood_component: request.blood_component,
      units_required: request.units_required, hospital_name: request.hospital_name,
      hospital_address: request.hospital_address, ward: request.ward,
      location: request.location, needed_by: request.needed_by, status: request.status
    } : null,
    donor: donor ? { id: donor.id, name: donor.name, blood_group: donor.donor_profile?.blood_group, is_verified: donor.is_verified } : null,
    requester: requester ? { id: requester.id, name: requester.name, is_verified: requester.is_verified } : null,
    ...(contactAllowed ? {
      donor_phone: donor?.phone,
      requester_contacts: request?.contacts || []
    } : {})
  };
}

async function recomputeRequestProgress(request: BloodRequest) {
  const related = donorResponses.filter(response => response.request_id === request.id);
  request.units_pledged = related
    .filter(response => ['ACCEPTED', 'ARRIVED', 'DONATED'].includes(response.status))
    .reduce((sum, response) => sum + response.units, 0);
  request.units_confirmed = related
    .filter(response => response.status === 'DONATED' && response.donor_confirmed_at && response.requester_confirmed_at)
    .reduce((sum, response) => sum + response.units, 0);
  if ((request.units_confirmed || 0) >= (request.units_required || 1)) request.status = 'FULFILLED';
  else if ((request.units_pledged || 0) > 0) request.status = 'PARTIALLY_FULFILLED';
  else if (!['CANCELLED', 'EXPIRED', 'REJECTED', 'DRAFT'].includes(request.status)) request.status = 'ACTIVE';
  await saveToTable('common_requests', request, [request.location.lng, request.location.lat]);
}

app.post('/api/requests/:id/invitations', async (req, res) => {
  const auth = getCurrentAuth(req);
  const request = requests.find(item => item.id === req.params.id);
  const donorId = cleanString(req.body?.donor_id, 80);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.user_id !== auth.user.id) return res.status(403).json({ error: 'Only the requester can invite donors' });
  if (!['ACTIVE', 'PARTIALLY_FULFILLED'].includes(request.status)) return res.status(409).json({ error: 'This request is not accepting responses' });
  if (!donorId) return validationError(res, 'Donor is required');
  if (donorResponses.some(response => response.request_id === request.id && response.donor_id === donorId && !['DECLINED', 'CANCELLED', 'NO_SHOW'].includes(response.status))) {
    return res.status(409).json({ error: 'This donor already has an active invitation' });
  }
  const matches = await findDonorMatches(request.location, request.blood_group, request.user_id, false);
  if (!matches.some(match => match.user_id === donorId)) return res.status(409).json({ error: 'Donor is no longer an eligible match' });
  const now = new Date().toISOString();
  const response: DonorResponse = {
    id: uuidv4(), request_id: request.id, donor_id: donorId, requester_id: request.user_id,
    status: 'INVITED', units: 1, created_at: now, updated_at: now
  };
  donorResponses.push(response);
  await saveToTable('common_responses', response);
  await notify(donorId, 'DONOR_INVITATION', `Blood request near ${request.location.area_name}`, `${request.blood_group} ${request.blood_component?.replaceAll('_', ' ').toLowerCase()} is needed at ${request.hospital_name}.`, `/profile/invitations`);
  res.status(201).json(responsePayload(response, auth.user.id));
});

app.get('/api/me/invitations', async (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const responses = donorResponses
    .filter(response => response.donor_id === auth.user.id || response.requester_id === auth.user.id)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  res.json(responses.map(response => responsePayload(response, auth.user.id)));
});

app.patch('/api/responses/:id', async (req, res) => {
  const auth = getCurrentAuth(req);
  const response = donorResponses.find(item => item.id === req.params.id);
  const status = req.body?.status;
  const message = optionalCleanString(req.body?.message, 500);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  if (!response) return res.status(404).json({ error: 'Response not found' });
  if (response.donor_id !== auth.user.id) return res.status(403).json({ error: 'Only the invited donor can respond' });
  if (!isOneOf(status, ['ACCEPTED', 'DECLINED', 'QUESTION', 'ARRIVED', 'DONATED', 'CANCELLED'] as const)) return validationError(res, 'Valid donor response is required');
  if (status === 'QUESTION' && !message) return validationError(res, 'A question is required');
  if (status === 'DONATED' && !['ACCEPTED', 'ARRIVED', 'DONATED'].includes(response.status)) return res.status(409).json({ error: 'Accept the request before reporting a donation' });
  response.status = status;
  response.message = message || response.message;
  response.updated_at = new Date().toISOString();
  if (status === 'DONATED') response.donor_confirmed_at = response.updated_at;
  await saveToTable('common_responses', response);
  const request = requests.find(item => item.id === response.request_id);
  if (request) await recomputeRequestProgress(request);
  await notify(response.requester_id, 'DONOR_RESPONSE', `Donor response: ${status.toLowerCase()}`, `${auth.user.name} updated their response.`, `/request/${response.request_id}`);
  res.json(responsePayload(response, auth.user.id));
});

app.post('/api/responses/:id/confirm-donation', async (req, res) => {
  const auth = getCurrentAuth(req);
  const response = donorResponses.find(item => item.id === req.params.id);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  if (!response) return res.status(404).json({ error: 'Response not found' });
  if (response.requester_id !== auth.user.id) return res.status(403).json({ error: 'Only the requester can confirm receipt' });
  if (!response.donor_confirmed_at) return res.status(409).json({ error: 'The donor must report the donation first' });
  if (!response.requester_confirmed_at) {
    response.requester_confirmed_at = new Date().toISOString();
    response.status = 'DONATED';
    response.updated_at = response.requester_confirmed_at;
    await saveToTable('common_responses', response);
    const donor = users.find(user => user.id === response.donor_id);
    const request = requests.find(item => item.id === response.request_id);
    if (donor?.donor_profile && request) {
      const date = response.requester_confirmed_at.slice(0, 10);
      donor.donor_profile.last_donation_date = date;
      donor.donor_profile.availability_status = 'NOT_AVAILABLE';
      donor.donor_profile.donation_history = [...(donor.donor_profile.donation_history || []), {
        id: response.id, date, organization: request.hospital_name || 'Receiving hospital'
      }];
      await saveToTable('common_users', donor);
      await removeDonorFromAllPartitions(donor.id);
      await recomputeRequestProgress(request);
      await notify(donor.id, 'DONATION_CONFIRMED', 'Donation confirmed', `Your donation at ${request.hospital_name} was confirmed.`, '/profile/history');
    }
  }
  res.json(responsePayload(response, auth.user.id));
});

app.get('/api/me/notifications', async (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  res.json(notifications.filter(item => item.user_id === auth.user.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 100));
});

app.patch('/api/me/notifications/:id/read', async (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const notification = notifications.find(item => item.id === req.params.id && item.user_id === auth.user.id);
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  notification.read_at = new Date().toISOString();
  await saveToTable('common_notifications', notification);
  res.json(notification);
});

app.post('/api/reports', async (req, res) => {
  const auth = getCurrentAuth(req);
  const target_type = req.body?.target_type;
  const target_id = cleanString(req.body?.target_id, 100);
  const reason = req.body?.reason;
  const details = optionalCleanString(req.body?.details, 1000);
  if (!auth) return res.status(401).json({ error: 'Log in to report abuse' });
  if (!isOneOf(target_type, ['REQUEST', 'COMMENT', 'USER'] as const) || !target_id) return validationError(res, 'Valid report target is required');
  if (!isOneOf(reason, ['SPAM', 'FRAUD', 'PAYMENT_REQUEST', 'HARASSMENT', 'PRIVACY', 'OTHER'] as const)) return validationError(res, 'Valid report reason is required');
  const targetExists = target_type === 'REQUEST'
    ? requests.some(item => item.id === target_id)
    : target_type === 'USER'
      ? users.some(item => item.id === target_id)
      : requests.some(item => item.comments?.some(comment => comment.id === target_id));
  if (!targetExists) return res.status(404).json({ error: 'Report target not found' });
  if (moderationReports.some(report => report.reporter_id === auth.user.id && report.target_type === target_type && report.target_id === target_id && report.status === 'OPEN')) {
    return res.status(409).json({ error: 'You already reported this item' });
  }
  const now = new Date().toISOString();
  const report: ModerationReport = { id: uuidv4(), reporter_id: auth.user.id, target_type, target_id, reason, details, status: 'OPEN', created_at: now, updated_at: now };
  moderationReports.push(report);
  await saveToTable('common_reports', report);
  await audit(auth.user.id, 'REPORT_CREATED', target_type, target_id, { reason });
  res.status(201).json(report);
});

app.post('/api/me/blocks/:userId', async (req, res) => {
  const auth = getCurrentAuth(req);
  const target = users.find(user => user.id === req.params.userId);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  if (!target || target.id === auth.user.id) return validationError(res, 'Valid user is required');
  auth.user.blocked_user_ids = [...new Set([...(auth.user.blocked_user_ids || []), target.id])];
  await saveToTable('common_users', auth.user);
  await audit(auth.user.id, 'USER_BLOCKED', 'USER', target.id);
  res.json({ success: true });
});

app.post('/api/support/tickets', async (req, res) => {
  const name = cleanString(req.body?.name, 100);
  const email = optionalCleanString(req.body?.email, 160);
  const phone = req.body?.phone ? normalizeBangladeshPhone(req.body.phone) : undefined;
  const category = req.body?.category;
  const message = cleanString(req.body?.message, 2000);
  if (!name || !message || !isOneOf(category, ['SUPPORT', 'SAFETY', 'PRIVACY', 'PARTNERSHIP'] as const)) return validationError(res, 'Name, category, and message are required');
  if (!email && !phone) return validationError(res, 'Email or Bangladesh phone is required');
  if (req.body?.phone && !phone) return validationError(res, 'Valid Bangladesh phone is required');
  const now = new Date().toISOString();
  const ticket: SupportTicket = { id: uuidv4(), name, email: email || undefined, phone, category, message, status: 'OPEN', created_at: now, updated_at: now };
  supportTickets.push(ticket);
  await saveToTable('common_support_tickets', ticket);
  res.status(201).json({ id: ticket.id, status: ticket.status });
});

app.get('/api/admin/overview', (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth || !isOperator(auth.user)) return res.status(403).json({ error: 'Operator access required' });
  res.json({
    counts: {
      users: users.length,
      verified_users: users.filter(user => user.is_verified).length,
      suspended_users: users.filter(user => user.account_status === 'SUSPENDED').length,
      active_requests: requests.filter(request => ['ACTIVE', 'PARTIALLY_FULFILLED'].includes(request.status)).length,
      open_reports: moderationReports.filter(report => report.status === 'OPEN').length,
      open_tickets: supportTickets.filter(ticket => ticket.status !== 'CLOSED').length,
      confirmed_donations: donorResponses.filter(response => response.status === 'DONATED' && response.donor_confirmed_at && response.requester_confirmed_at).length
    },
    reports: [...moderationReports].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 100),
    tickets: [...supportTickets].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 100)
  });
});

app.get('/api/admin/users', (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth || !isOperator(auth.user)) return res.status(403).json({ error: 'Operator access required' });
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
  res.json(users.filter(user => !search || user.name.toLowerCase().includes(search) || user.phone.includes(search)).slice(0, 200).map(sanitizeUser));
});

app.patch('/api/admin/users/:id', async (req, res) => {
  const auth = getCurrentAuth(req);
  const target = users.find(user => user.id === req.params.id);
  if (!auth || !isAdmin(auth.user)) return res.status(403).json({ error: 'Administrator access required' });
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === auth.user.id && req.body?.account_status === 'SUSPENDED') return res.status(409).json({ error: 'You cannot suspend your own account' });
  const accountStatus = req.body?.account_status;
  const roles = req.body?.roles;
  if (accountStatus !== undefined && !isOneOf(accountStatus, ['ACTIVE', 'SUSPENDED'] as const)) return validationError(res, 'Valid account status is required');
  if (roles !== undefined && (!Array.isArray(roles) || roles.some(role => !['MEMBER', 'SUPPORT', 'MODERATOR', 'VERIFIER', 'ADMIN'].includes(role)))) return validationError(res, 'Valid roles are required');
  if (accountStatus) target.account_status = accountStatus;
  if (req.body?.suspension_reason !== undefined) target.suspension_reason = optionalCleanString(req.body.suspension_reason, 500) || undefined;
  if (roles) target.roles = [...new Set(roles as string[])];
  await saveToTable('common_users', target);
  if (target.account_status === 'SUSPENDED') {
    for (const session of sessions.filter(item => item.user_id === target.id && !item.revoked_at)) {
      session.revoked_at = new Date().toISOString();
      await saveToTable('common_sessions', session);
    }
    await removeDonorFromAllPartitions(target.id);
  }
  await audit(auth.user.id, 'USER_ADMIN_UPDATED', 'USER', target.id, { account_status: target.account_status, roles: target.roles });
  res.json(sanitizeUser(target));
});

app.get('/api/admin/requests', (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth || !isOperator(auth.user)) return res.status(403).json({ error: 'Operator access required' });
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  res.json(requests.filter(request => !status || request.status === status).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 200));
});

app.patch('/api/admin/requests/:id', async (req, res) => {
  const auth = getCurrentAuth(req);
  const request = requests.find(item => item.id === req.params.id);
  const status = req.body?.status;
  const note = optionalCleanString(req.body?.note, 500);
  if (!auth || !isOperator(auth.user)) return res.status(403).json({ error: 'Operator access required' });
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (!isOneOf(status, ['ACTIVE', 'REJECTED', 'CANCELLED'] as const)) return validationError(res, 'Valid moderation status is required');
  request.status = status;
  request.timeline = [...(request.timeline || []), { id: uuidv4(), type: `MODERATION_${status}`, actor_id: auth.user.id, created_at: new Date().toISOString(), note }];
  await saveToTable('common_requests', request, [request.location.lng, request.location.lat]);
  await audit(auth.user.id, 'REQUEST_MODERATED', 'REQUEST', request.id, { status, note });
  await notify(request.user_id, 'REQUEST_MODERATION', `Request ${status.toLowerCase()}`, note || 'An operator reviewed your request.', `/request/${request.id}`);
  res.json(request);
});

app.patch('/api/admin/reports/:id', async (req, res) => {
  const auth = getCurrentAuth(req);
  const report = moderationReports.find(item => item.id === req.params.id);
  const status = req.body?.status;
  const note = optionalCleanString(req.body?.resolution_note, 1000);
  if (!auth || !isOperator(auth.user)) return res.status(403).json({ error: 'Operator access required' });
  if (!report) return res.status(404).json({ error: 'Report not found' });
  if (!isOneOf(status, ['REVIEWING', 'RESOLVED', 'DISMISSED'] as const)) return validationError(res, 'Valid report status is required');
  report.status = status; report.assigned_to = auth.user.id; report.resolution_note = note; report.updated_at = new Date().toISOString();
  await saveToTable('common_reports', report);
  await audit(auth.user.id, 'REPORT_UPDATED', 'REPORT', report.id, { status, note });
  res.json(report);
});

app.patch('/api/admin/tickets/:id', async (req, res) => {
  const auth = getCurrentAuth(req);
  const ticket = supportTickets.find(item => item.id === req.params.id);
  const status = req.body?.status;
  if (!auth || !isOperator(auth.user)) return res.status(403).json({ error: 'Operator access required' });
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (!isOneOf(status, ['OPEN', 'IN_PROGRESS', 'CLOSED'] as const)) return validationError(res, 'Valid ticket status is required');
  ticket.status = status; ticket.owner_id = auth.user.id; ticket.updated_at = new Date().toISOString();
  await saveToTable('common_support_tickets', ticket);
  await audit(auth.user.id, 'SUPPORT_TICKET_UPDATED', 'SUPPORT_TICKET', ticket.id, { status });
  res.json(ticket);
});

app.get('/api/admin/audit', (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth || !isAdmin(auth.user)) return res.status(403).json({ error: 'Administrator access required' });
  res.json([...auditEvents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 500));
});

// Public network stats for the landing page.
app.get('/api/stats', async (req, res) => {
  await enforceExpiredRequests();
  res.json({
    registered_donors: users.filter(u => u.donor_profile).length,
    available_donors: users.filter(u => u.donor_profile?.availability_status === 'AVAILABLE').length,
    active_requests: requests.filter(r => r.status === 'ACTIVE' || r.status === 'PARTIALLY_FULFILLED').length,
    fulfilled_requests: requests.filter(r => r.status === 'FULFILLED').length
  });
});

app.get('/api/requests', async (req, res) => {
  await enforceExpiredRequests();
  const sortedRequests = requests
    .filter(r => r.status === 'ACTIVE' || r.status === 'PARTIALLY_FULFILLED')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  res.json(sortedRequests.map(publicRequestPayload));
});

app.get('/api/requests/:id', async (req, res) => {
  const { id } = req.params;
  await enforceExpiredRequests();
  const request = requests.find(r => r.id === id);
  
  if (!request) {
    return res.status(404).json({ error: 'Not found' });
  }

  const requester = users.find(u => u.id === request.user_id);
  const requestOwner = isRequestOwner(request, req);
  const viewerId = getCurrentAuth(req)?.user.id || '';
  const viewerResponses = donorResponses.filter(response =>
    response.request_id === request.id && (response.requester_id === viewerId || response.donor_id === viewerId)
  );
  const acceptedParticipant = viewerResponses.some(response => ['ACCEPTED', 'ARRIVED', 'DONATED'].includes(response.status));
  if (!requestOwner && !['ACTIVE', 'PARTIALLY_FULFILLED', 'FULFILLED'].includes(request.status)) {
    return res.status(404).json({ error: 'Not found' });
  }
  // Patient identity, reference, contacts, and donor phones stay private until
  // the response workflow grants purpose-limited access.
  const { contacts, patient_name, patient_reference, ...safeRequest } = request;
  const enrichedRequest = {
    ...safeRequest,
    ...((requestOwner || acceptedParticipant) ? { contacts: contacts || [], patient_name, patient_reference, requester_phone: requester?.phone } : {}),
    requester_name: request.requester_name || requester?.name || 'Verified requester'
  };

  const matches = requestOwner ? await findDonorMatches(request.location, request.blood_group, request.user_id, false) : [];

  res.json({ request: enrichedRequest, matches, responses: viewerResponses.map(response => responsePayload(response, viewerId)) });
});

app.patch('/api/requests/:id/details', async (req, res) => {
  const { id } = req.params;
  const requestIndex = requests.findIndex(r => r.id === id);
  if (requestIndex !== -1) {
    if (!isRequestOwner(requests[requestIndex], req)) {
      return res.status(403).json({ error: 'Only the request owner can update details' });
    }

    const parsed = parseCompleteRequest({ ...requests[requestIndex], ...req.body });
    if ('error' in parsed) return validationError(res, parsed.error);
    requests[requestIndex] = { ...requests[requestIndex], ...parsed.value };
    requests[requestIndex].timeline = [...(requests[requestIndex].timeline || []), {
      id: uuidv4(), type: 'DETAILS_UPDATED', actor_id: requests[requestIndex].user_id, created_at: new Date().toISOString()
    }];
    await saveToTable('common_requests', requests[requestIndex], [requests[requestIndex].location.lng, requests[requestIndex].location.lat]);
    res.json(requests[requestIndex]);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.post('/api/requests/:id/comments', async (req, res) => {
  const { id } = req.params;
  const fingerprint = getFingerprint(req);
  const text = cleanString(req.body?.text, 1000);
  const anonymous_name = optionalCleanString(req.body?.anonymous_name, 80);

  if (!text) return validationError(res, 'Comment text is required');

  const auth = getCurrentAuth(req);
  const user = auth?.user || null;
  const requestIndex = requests.findIndex(r => r.id === id);

  if (requestIndex === -1) {
    return res.status(404).json({ error: 'Request not found' });
  }

  if (!user && !anonymous_name) return validationError(res, 'Anonymous name is required');

  // Rate Limiting for anonymous users
  if (!user && fingerprint) {
    const now = Date.now();
    let stamps = commentTimestamps[fingerprint] || [];
    stamps = stamps.filter(t => now - t < 30 * 86400 * 1000);
    
    const lastMin = stamps.filter(t => now - t < 60 * 1000).length;
    const lastHour = stamps.filter(t => now - t < 3600 * 1000).length;
    const lastDay = stamps.filter(t => now - t < 86400 * 1000).length;
    const lastMonth = stamps.length;

    if (lastMin >= 3) return res.status(429).json({ error: 'Rate limit: Max 3 comments per minute for anonymous users.' });
    if (lastHour >= 5) return res.status(429).json({ error: 'Rate limit: Max 5 comments per hour for anonymous users.' });
    if (lastDay >= 7) return res.status(429).json({ error: 'Rate limit: Max 7 comments per day for anonymous users.' });
    if (lastMonth >= 10) return res.status(429).json({ error: 'Rate limit: Max 10 comments per month for anonymous users.' });
    
    stamps.push(now);
    commentTimestamps[fingerprint] = stamps;
  }

  const newComment = {
    id: uuidv4(),
    user_id: user ? user.id : (fingerprint || 'anon'),
    user_name: user ? user.name : (anonymous_name || 'Anonymous'),
    text,
    created_at: new Date().toISOString()
  };
  
  requests[requestIndex].comments = [
    ...(requests[requestIndex].comments || []),
    newComment
  ];
  await saveToTable('common_requests', requests[requestIndex], [requests[requestIndex].location.lng, requests[requestIndex].location.lat]);
  res.json(newComment);
});

app.delete('/api/requests/:id/comments/:commentId', async (req, res) => {
  const { id, commentId } = req.params;
  const userId = getActorId(req);

  const request = requests.find(r => r.id === id);
  if (!request) return res.status(404).json({ error: 'Request not found' });

  const comment = request.comments?.find(item => item.id === commentId);
  const auth = getCurrentAuth(req);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (request.user_id !== userId && comment.user_id !== userId && !isOperator(auth?.user)) {
    return res.status(403).json({ error: 'Only the comment author, request owner, or moderator can delete it' });
  }

  if (request.comments) {
    request.comments = request.comments.filter(c => c.id !== commentId);
    await saveToTable('common_requests', request, [request.location.lng, request.location.lat]);
  }

  await audit(userId || auth?.user.id || 'anonymous', 'COMMENT_DELETED', 'COMMENT', commentId, { request_id: id });

  res.json({ success: true });
});

app.patch('/api/requests/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!isOneOf(status, REQUEST_STATUSES)) return validationError(res, 'Valid request status is required');

  const requestIndex = requests.findIndex(r => r.id === id);
  if (requestIndex !== -1) {
    if (!isRequestOwner(requests[requestIndex], req)) {
      return res.status(403).json({ error: 'Only the request owner can update status' });
    }
    const request = requests[requestIndex];
    if (status === 'FULFILLED' && (request.units_confirmed || 0) < (request.units_required || 1)) {
      return res.status(409).json({ error: 'Confirm all required units before marking fulfilled' });
    }
    const ownerStatuses = ['ACTIVE', 'CANCELLED', 'FULFILLED'];
    if (!ownerStatuses.includes(status)) return res.status(403).json({ error: 'This status is managed by verification or response workflow' });
    if (status === 'ACTIVE' && request.needed_by && new Date(request.needed_by).getTime() <= Date.now()) {
      return res.status(409).json({ error: 'Update the required date before reopening this request' });
    }
    requests[requestIndex].status = status;
    requests[requestIndex].timeline = [...(requests[requestIndex].timeline || []), {
      id: uuidv4(), type: `STATUS_${status}`, actor_id: requests[requestIndex].user_id, created_at: new Date().toISOString()
    }];
    await saveToTable('common_requests', requests[requestIndex], [requests[requestIndex].location.lng, requests[requestIndex].location.lat]);
    res.json(requests[requestIndex]);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

async function startServer() {
  await initDbData();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
