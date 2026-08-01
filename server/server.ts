import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { syncDonorToPartition, getAllFromTable, saveToTable, getPartitionName, getDb, removeDonorFromAllPartitions, ensureImportedDonorTable, queryImportedDonors, queryImportedDonorsForRequest, countImportedDonors, getImportedDonor, replaceImportedDonor, addCallReports, queryCallReports } from './db';
import { evaluateClaim, maskPhone, toImportedDonorRow, toPublicImportedDonor, toRevealedImportedDonor, IMPORT_SOURCES, type ImportedDonor } from './importedDonors';
import { getLocationByName } from './locations';
import { getSmsProvider, isSmsConfigured } from './sms';
import { getUpazilaByName, getUpazilaVariants } from './upazilas';
import { BLOOD_GROUPS, COMPATIBLE_DONORS, type BloodGroup } from './blood';
import { parseCallOutcome, parseDonorReport, parseDonorRef, type CallReport } from './callReports';
import {
  AVAILABILITY_TTL_DAYS,
  DONATION_INTERVAL_DAYS,
  donorCanSeeRequest,
  donorEligibility,
  matchesUpazilaSearch,
  rankDonorResults
} from './donorSearch';
import { canAssignStaffRole, canEditMember, canManageMember, capabilitiesFor, hasCapability, isStaffRole, legacyStaffRole, type AdminCapability, type StaffRole } from './adminPolicy';
import {
  canonicalLastDonationDate,
  createPublicDonationSummary,
  parseDonationCount,
  parseLastDonationDeclaration,
  type LastDonationDeclaration,
  type PublicDonationSummary
} from './donation';
import {
  COMMUNITY_POST_STATUSES,
  COMMUNITY_POST_TYPES,
  countCommunityPosts,
  getCommunityPostById,
  getPublishedCommunityPostBySlug,
  markdownToPlainExcerpt,
  queryCommunityPosts,
  queryCommunityPostsByOwner,
  queryPublishedCommunityPosts,
  saveCommunityPost,
  toPublicCommunityPostDetail,
  toPublicCommunityPostSummary,
  validateCommunityPostInput,
  type CommunityPost,
  type CommunityPostStatus,
  type CommunityPostType
} from './communityPosts';
import {
  COMMUNITY_IMAGE_MIME_TYPES,
  MAX_COMMUNITY_IMAGE_BYTES,
  CommunityMediaError,
  deleteCommunityImage,
  readCommunityImage,
  saveCommunityImage
} from './communityMedia';
import { escapeHtml, renderCommunityPostHtml, renderPublicOriginHtml } from './communitySeo';

const app = express();
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const configuredPort = Number(process.env.PORT || process.env.PROD_PORT || 3000);
const PORT = Number.isFinite(configuredPort) ? configuredPort : 3000;
const DEFAULT_REQUEST_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_VERIFICATION_TTL_MS = 30 * 60 * 1000;
const MATCH_RADIUS_KM = Math.max(10, Number(process.env.MATCH_RADIUS_KM || 250));
const SESSION_COOKIE = 'drop_session';
// Anonymous fingerprints shorter than this are rejected so trivial values
// (e.g. "anon") can't collide with comment author ids or claim ownership.
const MIN_FINGERPRINT_LENGTH = 16;
const BCRYPT_ROUNDS = 10;
const PUBLIC_DONOR_SEARCH_LIMIT = 50;
const COMMUNITY_PAGE_SIZE = 12;
const COMMUNITY_EXPORT_PAGE_SIZE = 100;
const COMMUNITY_IMAGE_QUOTA_PER_MEMBER = 20;
const COMMUNITY_SITEMAP_CACHE_MS = 5 * 60_000;
const STARTED_AT = Date.now();
let isReady = false;
let communitySitemapCache: { origin: string; xml: string; expiresAt: number } | null = null;
const activeCommunityImageUploads = new Map<string, number>();
const REQUEST_STATUSES = ['DRAFT', 'PENDING_VERIFICATION', 'ACTIVE', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED', 'EXPIRED', 'REJECTED'] as const;
const AVAILABILITY_STATUSES = ['AVAILABLE', 'SICK', 'TRAVELING', 'NOT_AVAILABLE'] as const;
const CONTACT_TYPES = ['PATIENT', 'RELATIVE', 'HOSPITAL', 'OTHER'] as const;
const BLOOD_COMPONENTS = ['WHOLE_BLOOD', 'RED_CELLS', 'PLATELETS', 'PLASMA'] as const;
const REQUESTER_RELATIONSHIPS = ['SELF', 'FAMILY', 'FRIEND', 'HOSPITAL_STAFF', 'VOLUNTEER', 'OTHER'] as const;
const DEFERRAL_STATUSES = ['NONE', 'TEMPORARY', 'PERMANENT'] as const;
// SIGN_IN serves the blood request flow, where the requester gives a phone
// number without first saying whether they have an account. It is the only
// purpose that works for both an existing and a new account.
const OTP_PURPOSES = ['REGISTER', 'RESET_PASSWORD', 'CHANGE_PHONE', 'SIGN_IN'] as const;
const allowedCorsOrigins = new Set(
  (process.env.CORS_ORIGIN || process.env.APP_URL || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin && origin !== 'MY_APP_URL')
);
const configuredPublicOrigin = (() => {
  const configured = process.env.APP_URL?.trim();
  if (!configured || configured === 'MY_APP_URL') return '';
  try {
    const parsed = new URL(configured);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.origin : '';
  } catch {
    return '';
  }
})();

function publicOrigin(req: express.Request) {
  return configuredPublicOrigin || `${req.protocol}://${req.get('host')}`;
}

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

const communityImageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => getCurrentAuth(req)?.user.id || 'unauthenticated',
  message: { error: 'Too many image uploads; try again later' }
});

function asyncRoute(
  handler: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<unknown>
) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

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
  /** Structured self-report; legacy profiles may have only last_donation_date. */
  last_donation?: LastDonationDeclaration;
  last_donation_date?: string;
  /** Self-reported lifetime count. Never inferred from detailed history alone. */
  donation_count?: number;
  location: { lat: number, lng: number, area_name: string };
  /**
   * Upazila/thana within `location.area_name`. Optional because profiles
   * created before district+upazila search existed do not have one; those
   * donors simply do not appear in an upazila search until they set it.
   */
  upazila?: string;
  /**
   * Self-declared, and deliberately not an input to `donorEligibility`.
   * Treating them as a screen would imply a medical assessment this project
   * does not perform - the collection facility decides who may donate.
   */
  age?: number;
  weight_kg?: number;
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
  staff_role?: StaffRole;
  account_status?: 'ACTIVE' | 'SUSPENDED';
  suspension_reason?: string;
  suspended_at?: string;
  suspended_by?: string;
  blocked_user_ids?: string[];
  deleted_at?: string;
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
  user_agent?: string;
  ip?: string;
  last_seen_at?: string;
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
  moderation_status?: 'VISIBLE' | 'HIDDEN';
  moderation_reason?: string;
  moderated_at?: string;
  moderated_by?: string;
};

const REQUESTER_ROLES = ['PATIENT', 'RELATIVE', 'THIRD_PARTY'] as const;
const PATIENT_TITLES = ['MR', 'MST'] as const;
const CONTACT_OWNERS = ['PATIENT', 'RELATIVE'] as const;
// Coarse timing, because a requester in a corridor cannot give a timestamp but
// can say how soon. Mapped to a `needed_by` so urgency stays meaningful.
const NEEDED_WINDOWS = ['WITHIN_HOURS', 'TODAY', 'WITHIN_2_3_DAYS', 'PLANNED'] as const;
const NEEDED_WINDOW_HOURS: Record<(typeof NEEDED_WINDOWS)[number], number> = {
  WITHIN_HOURS: 6,
  TODAY: 24,
  WITHIN_2_3_DAYS: 72,
  PLANNED: 168
};

type BloodRequest = {
  id: string;
  user_id: string;
  blood_group: string;
  location: { lat: number, lng: number, area_name: string };
  /** Upazila searched for. Absent on requests published before search v1. */
  upazila?: string;
  patient_title?: (typeof PATIENT_TITLES)[number];
  patient_sex?: 'MALE' | 'FEMALE';
  patient_age?: number;
  requester_role?: (typeof REQUESTER_ROLES)[number];
  /** Free text, e.g. "brother". Private, like the rest of the patient block. */
  requester_relation?: string;
  contact_owner?: (typeof CONTACT_OWNERS)[number];
  needed_window?: (typeof NEEDED_WINDOWS)[number];
  collection_facility_code?: string;
  /** Marks rows created by the search flow rather than the legacy form. */
  flow_version?: 'SEARCH_V1';
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
  purpose: 'REGISTER' | 'RESET_PASSWORD' | 'CHANGE_PHONE' | 'SIGN_IN';
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
  target_type: 'REQUEST' | 'COMMENT' | 'USER' | 'POST';
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

type Organization = {
  id: string;
  owner_id: string;
  name: string;
  type: 'HOSPITAL' | 'BLOOD_BANK' | 'NGO';
  district: string;
  address: string;
  phone: string;
  website?: string;
  registration_reference: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  verification_note?: string;
  created_at: string;
  updated_at: string;
  campaigns?: Array<{ id: string; title: string; location: string; starts_at: string; ends_at: string; status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' }>;
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

/** `undefined` for an omitted value, `null` for one that is present but invalid. */
function parseOptionalEnum<T extends readonly string[]>(value: unknown, values: T) {
  if (value === undefined || value === null || value === '') return undefined;
  return isOneOf(value, values) ? value : null;
}

/** `undefined` for an omitted value, `null` for one that is present but invalid. */
function parseOptionalInteger(value: unknown, minimum: number, maximum: number) {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum ? number : null;
}

/**
 * Resolves an upazila against the district it is claimed to be in, returning
 * the canonical stored spelling. Districts own their upazila names, so this
 * also rejects a valid name paired with the wrong district.
 */
function parseUpazila(district: string, value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return null;
  return getUpazilaByName(district, value)?.value ?? null;
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

function latestDonationHistoryDate(records: DonationRecord[]) {
  return records.map(record => record.date).sort().pop();
}

/**
 * Reconciles the structured self-report, legacy eligibility date, lifetime
 * count, and private exact-date history into one internally consistent update.
 */
function resolveDonationDetails(
  body: Record<string, unknown>,
  existingProfile: DonorProfile | undefined,
  donationHistory: DonationRecord[],
  now = new Date()
): { value: Pick<DonorProfile, 'last_donation' | 'last_donation_date' | 'donation_count'> } | { error: string } {
  const parsedDeclaration = parseLastDonationDeclaration(body.last_donation, now);
  if (parsedDeclaration === null) return { error: 'Choose an exact date, an approximate time, or never donated' };

  const legacyInput = parseDate(body.last_donation_date);
  if (legacyInput === null || (legacyInput && new Date(legacyInput).getTime() > now.getTime())) {
    return { error: 'Last donation date must be valid and not in the future' };
  }

  let declaration = parsedDeclaration !== undefined
    ? parsedDeclaration
    : existingProfile?.last_donation;
  const legacyDate = legacyInput?.slice(0, 10) || existingProfile?.last_donation_date?.slice(0, 10);
  if (!declaration && legacyDate) {
    declaration = { kind: 'EXACT', date: legacyDate, reported_at: now.toISOString() };
  }

  const parsedCount = parseDonationCount(body.donation_count, declaration, donationHistory.length);
  if (parsedCount === null) {
    return { error: 'Donation count must match the donation timing and cannot be below saved history' };
  }
  let donationCount = parsedCount !== undefined ? parsedCount : existingProfile?.donation_count;

  if (declaration?.kind === 'NEVER') {
    if (donationHistory.length > 0) {
      return { error: 'Remove saved donation records before choosing never donated' };
    }
    donationCount = donationCount ?? 0;
  }

  if (parsedDeclaration && parsedDeclaration.kind !== 'NEVER' && donationCount === undefined) {
    return { error: 'Enter how many times you have donated' };
  }
  if (donationCount !== undefined && parseDonationCount(donationCount, declaration, donationHistory.length) === null) {
    return { error: 'Donation count must match the donation timing and cannot be below saved history' };
  }
  if (donationCount !== undefined && !declaration && !legacyDate && donationHistory.length === 0) {
    return { error: 'Choose when you last donated before entering a donation count' };
  }

  const historyDate = latestDonationHistoryDate(donationHistory);
  const declaredDate = canonicalLastDonationDate(declaration);
  if (historyDate) {
    if (declaration?.kind === 'NEVER') {
      return { error: 'Never donated cannot be combined with saved donation records' };
    }
    if (!declaredDate || historyDate > declaredDate) {
      declaration = { kind: 'EXACT', date: historyDate, reported_at: now.toISOString() };
    }
  }

  return {
    value: {
      last_donation: declaration,
      last_donation_date: canonicalLastDonationDate(declaration),
      donation_count: donationCount
    }
  };
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
let organizations: Organization[] = [];

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
  organizations = await getAllFromTable('common_organizations');
  const legacyStaffTokens = new Set(['ADMIN', 'MODERATOR', 'SUPPORT', 'VERIFIER']);
  for (const user of users) {
    const migratedStaffRole = user.staff_role || legacyStaffRole(user.roles);
    const migratedRoles = [...new Set((user.roles || ['MEMBER']).filter(role => !legacyStaffTokens.has(role)))];
    if (!migratedRoles.includes('MEMBER')) migratedRoles.unshift('MEMBER');
    if (user.staff_role !== migratedStaffRole || JSON.stringify(user.roles || []) !== JSON.stringify(migratedRoles)) {
      user.staff_role = migratedStaffRole;
      user.roles = migratedRoles;
      await saveToTable('common_users', user);
    }
  }
  const superadminPhone = normalizeBangladeshPhone(process.env.SUPERADMIN_PHONE || process.env.ADMIN_PHONE);
  if (superadminPhone) {
    const superadmin = users.find(user => user.phone === superadminPhone);
    if (superadmin && superadmin.staff_role !== 'SUPERADMIN') {
      superadmin.staff_role = 'SUPERADMIN';
      await saveToTable('common_users', superadmin);
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

function communityImageUrl(key: string) {
  return `/media/community/${encodeURIComponent(key)}`;
}

function communityAuthorName(authorId: string) {
  return users.find(user => user.id === authorId)?.name || 'Drop member';
}

function publicCommunitySummary(post: CommunityPost) {
  const projected = toPublicCommunityPostSummary(post, communityAuthorName(post.author_id));
  const { image, ...summary } = projected;
  return {
    ...summary,
    ...(image ? {
      image: {
        url: communityImageUrl(image.key),
        alt: image.alt,
        ...(image.width ? { width: image.width } : {}),
        ...(image.height ? { height: image.height } : {})
      }
    } : {})
  };
}

function publicCommunityDetail(post: CommunityPost) {
  const projected = toPublicCommunityPostDetail(post, communityAuthorName(post.author_id));
  const { image, ...detail } = projected;
  return {
    ...detail,
    ...(image ? {
      image: {
        url: communityImageUrl(image.key),
        alt: image.alt,
        ...(image.width ? { width: image.width } : {}),
        ...(image.height ? { height: image.height } : {})
      }
    } : {})
  };
}

function ownerCommunityPost(post: CommunityPost) {
  return {
    id: post.id,
    slug: post.slug,
    type: post.type,
    status: post.status,
    title: post.title,
    body_markdown: post.body_markdown,
    excerpt: post.excerpt,
    ...(post.image_key ? {
      image: {
        url: communityImageUrl(post.image_key),
        alt: post.image_alt || post.title,
        ...(post.image_width ? { width: post.image_width } : {}),
        ...(post.image_height ? { height: post.image_height } : {})
      }
    } : {}),
    created_at: post.created_at,
    updated_at: post.updated_at,
    published_at: post.published_at,
    moderation_reason: post.moderation_reason
  };
}

function adminCommunityPost(post: CommunityPost) {
  const author = users.find(user => user.id === post.author_id);
  return {
    ...ownerCommunityPost(post),
    author: {
      id: post.author_id,
      name: author?.name || 'Deleted member',
      account_status: author?.account_status || 'UNKNOWN'
    },
    moderated_by: post.moderated_by,
    moderated_at: post.moderated_at
  };
}

async function queryAllCommunityPostsByOwner(authorId: string, statuses?: CommunityPostStatus[]) {
  const posts: CommunityPost[] = [];
  let offset = 0;
  while (true) {
    const page = await queryCommunityPostsByOwner(authorId, {
      ...(statuses ? { statuses } : {}),
      limit: COMMUNITY_EXPORT_PAGE_SIZE,
      offset
    });
    posts.push(...page);
    if (page.length < COMMUNITY_EXPORT_PAGE_SIZE) break;
    offset += page.length;
  }
  return posts;
}

async function queryAllPublishedCommunityPosts(maximum = 50_000) {
  const posts: CommunityPost[] = [];
  let offset = 0;
  while (posts.length < maximum) {
    const page = await queryPublishedCommunityPosts({
      limit: Math.min(COMMUNITY_EXPORT_PAGE_SIZE, maximum - posts.length),
      offset
    });
    posts.push(...page);
    if (page.length < COMMUNITY_EXPORT_PAGE_SIZE) break;
    offset += page.length;
  }
  return posts;
}

function invalidateCommunitySitemap() {
  communitySitemapCache = null;
}

async function markCommunityPostDeleted(post: CommunityPost) {
  const imageKey = post.image_key;
  // Remove the private binary before erasing its durable reference. If the
  // filesystem refuses the delete, the post remains retryable and account
  // deletion cannot claim success while silently retaining the image.
  if (imageKey) await deleteCommunityImage(imageKey);
  return await saveCommunityPost({
    ...post,
    status: 'DELETED',
    title: 'Deleted community post',
    body_markdown: 'This community post was deleted by its author and is no longer available to the public.',
    image_key: undefined,
    image_alt: undefined,
    image_width: undefined,
    image_height: undefined,
    updated_at: new Date().toISOString()
  });
}

const communityImageBody = express.raw({
  type: () => true,
  limit: MAX_COMMUNITY_IMAGE_BYTES
});

function receiveCommunityImage(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  communityImageBody(req, res, error => {
    if (error) {
      res.status(413).json({ error: 'Image exceeds the 10 MB upload limit' });
      return;
    }
    next();
  });
}

function limitCommunityImageConcurrency(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Log in to upload a story image' });
  const active = activeCommunityImageUploads.get(auth.user.id) || 0;
  if (active >= 2) return res.status(429).json({ error: 'Wait for an existing image upload to finish' });
  activeCommunityImageUploads.set(auth.user.id, active + 1);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    const remaining = (activeCommunityImageUploads.get(auth.user.id) || 1) - 1;
    if (remaining > 0) activeCommunityImageUploads.set(auth.user.id, remaining);
    else activeCommunityImageUploads.delete(auth.user.id);
  };
  res.once('finish', release);
  res.once('close', release);
  next();
}

async function authorizeCommunityImageUpload(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const auth = getCurrentAuth(req);
    if (!auth) return res.status(401).json({ error: 'Log in to upload a story image' });
    const post = await getCommunityPostById(req.params.id);
    if (!post || post.author_id !== auth.user.id) return res.status(404).json({ error: 'Community post not found' });
    if (post.status !== 'DRAFT') return res.status(409).json({ error: 'Only a draft can receive a new image' });
    if (post.type !== 'DONATION_STORY') return validationError(res, 'Health suggestions cannot include an image');
    if (!post.image_key) {
      const imageCount = await countCommunityPosts({
        authorId: auth.user.id,
        statuses: ['DRAFT', 'PUBLISHED', 'HIDDEN'],
        hasImage: true
      });
      if (imageCount >= COMMUNITY_IMAGE_QUOTA_PER_MEMBER) {
        return res.status(409).json({ error: `Each member can retain up to ${COMMUNITY_IMAGE_QUOTA_PER_MEMBER} story images` });
      }
    }
    res.locals.communityImagePost = post;
    next();
  } catch (error) {
    next(error);
  }
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

async function enforceStaleAvailability() {
  const cutoff = Date.now() - AVAILABILITY_TTL_DAYS * 86_400_000;
  for (const user of users.filter(item => item.donor_profile?.availability_status === 'AVAILABLE')) {
    const confirmed = user.donor_profile?.availability_confirmed_at ? new Date(user.donor_profile.availability_confirmed_at).getTime() : 0;
    if (confirmed >= cutoff) continue;
    user.donor_profile!.availability_status = 'NOT_AVAILABLE';
    user.donor_profile!.availability_history = [...(user.donor_profile!.availability_history || []), { status: 'NOT_AVAILABLE', changed_at: new Date().toISOString() }];
    await saveToTable('common_users', user);
    await removeDonorFromAllPartitions(user.id);
    await notify(user.id, 'AVAILABILITY_EXPIRED', 'Availability paused', 'Reconfirm your availability before receiving new invitations.', '/profile/donor');
  }
}

type DonorRecord = Pick<User, 'id' | 'name' | 'phone' | 'is_verified' | 'blocked_user_ids' | 'account_status' | 'deleted_at'> & { donor_profile: DonorProfile };

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
    .filter(u => u.account_status !== 'SUSPENDED' && !u.deleted_at && u.is_verified)
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

// --- District and upazila donor search -----------------------------------
//
// The search a requester actually runs. It answers with masked numbers only:
// unmasking is a separate, recorded action that requires a published request,
// so browsing can never harvest contact details.

const SEARCH_RESULT_LIMIT = 24;

type DonorCard = {
  /** `reg:<user_id>` or `imp:<public_id>` - the token used to ask for a reveal. */
  donor_ref: string;
  donor_kind: 'REGISTERED' | 'IMPORTED';
  name: string;
  blood_group: string;
  /** False when the donor is compatible with the patient but not the same group. */
  is_exact_group: boolean;
  district: string;
  upazila: string;
  phone_masked: string;
  has_phone: boolean;
  is_verified?: boolean;
  availability_status?: string;
  /** Public, bounded self-report. Detailed history and organizations stay private. */
  donation_summary?: PublicDonationSummary;
  /** Attribution for an imported listing; absent for registered members. */
  source?: { organization: string; url: string };
};

export function registeredDonorRef(userId: string) {
  return `reg:${userId}`;
}

export function importedDonorRef(publicId: string) {
  return `imp:${publicId}`;
}

function registeredDonorCard(user: User, exactGroup: string): DonorCard {
  const profile = user.donor_profile!;
  const donationSummary = createPublicDonationSummary(
    profile.last_donation,
    profile.donation_count,
    profile.last_donation_date
  );
  return {
    donor_ref: registeredDonorRef(user.id),
    donor_kind: 'REGISTERED',
    name: user.name,
    blood_group: profile.blood_group,
    is_exact_group: profile.blood_group === exactGroup,
    district: profile.location.area_name,
    upazila: profile.upazila || '',
    phone_masked: maskPhone(user.phone),
    has_phone: Boolean(user.phone),
    is_verified: Boolean(user.is_verified),
    availability_status: profile.availability_status,
    ...(donationSummary ? { donation_summary: donationSummary } : {})
  };
}

function importedDonorCard(donor: ImportedDonor, exactGroup: string): DonorCard {
  const view = toPublicImportedDonor(donor);
  return {
    donor_ref: importedDonorRef(view.id),
    donor_kind: 'IMPORTED',
    name: view.name,
    blood_group: view.blood_group,
    is_exact_group: view.blood_group === exactGroup,
    district: view.district,
    upazila: view.upazila,
    phone_masked: view.phone_masked,
    has_phone: view.has_phone,
    // No availability status: nobody has asked these people whether they are
    // free, and inventing one would misrepresent a scraped listing.
    source: { organization: view.source.organization, url: view.source.url }
  };
}

/**
 * Registered members first, then public directory listings to fill the page.
 *
 * The two groups stay separate in the response because they mean different
 * things: a member opted in to be contacted here, while a directory listing was
 * published elsewhere by someone else. The interface has to say which is which.
 */
async function findRequestDonors(params: {
  bloodGroup: BloodGroup;
  district: string;
  upazila: string;
  excludeUserId?: string;
  limit?: number;
}) {
  const compatibleGroups = COMPATIBLE_DONORS[params.bloodGroup] || [params.bloodGroup];
  const upazilas = getUpazilaVariants(params.district, params.upazila);
  const limit = params.limit ?? SEARCH_RESULT_LIMIT;
  const requester = params.excludeUserId ? users.find(user => user.id === params.excludeUserId) : undefined;

  const registered = rankDonorResults(
    users
      .filter(user => user.id !== params.excludeUserId)
      .filter(user => user.account_status !== 'SUSPENDED' && !user.deleted_at && user.is_verified)
      .filter(user => !params.excludeUserId || !user.blocked_user_ids?.includes(params.excludeUserId))
      .filter(user => !requester?.blocked_user_ids?.includes(user.id))
      .filter(user => matchesUpazilaSearch(user.donor_profile, {
        compatibleGroups,
        district: params.district,
        upazilas
      }))
      .map(user => registeredDonorCard(user, params.bloodGroup)),
    params.bloodGroup
  );

  let directory: DonorCard[] = [];
  if (registered.length < limit) {
    try {
      const listings = await queryImportedDonorsForRequest({
        district: params.district,
        upazilas,
        bloodGroups: compatibleGroups,
        limit: limit - registered.length
      });
      directory = rankDonorResults(
        listings.map(listing => importedDonorCard(listing, params.bloodGroup)),
        params.bloodGroup
      );
    } catch {
      // The directory is a supplement. If it is unavailable the registered
      // results are still worth showing.
      directory = [];
    }
  }

  return { registered, directory, compatibleGroups, upazilas };
}

/** Shared by the search route and the reveal route's membership check. */
function parseUpazilaSearch(query: Record<string, unknown>) {
  const bloodGroup = query.blood_group;
  const districtName = cleanString(query.district, 80);
  const location = districtName ? getLocationByName(districtName) : null;
  if (!isOneOf(bloodGroup, BLOOD_GROUPS)) return { error: 'Valid blood group is required' } as const;
  if (!location) return { error: 'Valid Bangladesh district is required' } as const;
  const upazila = parseUpazila(location.area_name, query.upazila);
  if (!upazila) return { error: 'Choose an upazila that belongs to the selected district' } as const;
  return { value: { bloodGroup, location, upazila } } as const;
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
  return user && user.account_status !== 'SUSPENDED' && !user.deleted_at ? { user, session } : null;
}

function isOperator(user: User | undefined) {
  return hasCapability(user, 'DASHBOARD');
}

function requireStaffCapability(
  req: express.Request,
  res: express.Response,
  capability: AdminCapability
) {
  const auth = getCurrentAuth(req);
  if (!auth || !hasCapability(auth.user, capability)) {
    res.status(403).json({ error: 'Required staff capability is missing' });
    return null;
  }
  return auth;
}

function adminUserAuditSnapshot(user: User) {
  return {
    id: user.id,
    account_status: user.account_status || 'ACTIVE',
    staff_role: user.staff_role || null,
    suspension_reason: user.suspension_reason || null,
    suspended_at: user.suspended_at || null,
    suspended_by: user.suspended_by || null
  };
}

async function issueSession(userId: string, req: express.Request) {
  const now = Date.now();
  const session: AuthSession = {
    id: uuidv4(),
    token: uuidv4(),
    user_id: userId,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + SESSION_TTL_MS).toISOString(),
    user_agent: cleanString(req.get('user-agent'), 300) || 'Unknown device',
    ip: req.ip,
    last_seen_at: new Date(now).toISOString()
  };
  sessions.push(session);
  await saveToTable('common_sessions', session);
  return session.token;
}

/**
 * Moves anything an anonymous browser created onto the account that has just
 * proven it owns the phone number. Shared by every sign-in path so they cannot
 * drift apart.
 */
async function adoptFingerprintOwnership(fingerprint: string, user: User) {
  for (const request of requests) {
    let changed = false;
    if (request.user_id === fingerprint) {
      request.user_id = user.id;
      changed = true;
    }
    for (const comment of request.comments || []) {
      if (comment.user_id === fingerprint) {
        comment.user_id = user.id;
        comment.user_name = user.name;
        changed = true;
      }
    }
    if (changed) {
      await saveToTable('common_requests', request, [request.location.lng, request.location.lat]);
    }
  }
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

/**
 * The only shape a blood request may take on a public surface.
 *
 * Private fields are removed by naming them here, so **every new field on
 * `BloodRequest` is public by default**. Anything describing the patient or the
 * requester's relationship to them has to be added to this destructure, or it
 * publishes on the open `/api/requests` feed.
 */
function publicRequestPayload(request: BloodRequest) {
  const requester = users.find(u => u.id === request.user_id);
  const {
    contacts,
    comments,
    patient_name,
    patient_reference,
    patient_title,
    patient_sex,
    patient_age,
    requester_relation,
    contact_owner,
    timeline,
    ...safeRequest
  } = request;
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

app.get('/api/donors/search', async (req, res) => {
  const bloodGroup = req.query.blood_group;
  const location = parseLocation({
    lat: req.query.lat,
    lng: req.query.lng,
    area_name: req.query.area_name
  });
  if (!isOneOf(bloodGroup, BLOOD_GROUPS) || !location) {
    return validationError(res, 'Valid blood group, latitude, longitude, and area name are required');
  }

  const auth = getCurrentAuth(req);
  const matches = await findDonorMatches(location, bloodGroup, auth?.user.id || '', Boolean(auth));
  const donors = matches.slice(0, PUBLIC_DONOR_SEARCH_LIMIT).map(match => ({
    user_id: match.user_id,
    name: match.name,
    ...(auth ? { phone: match.phone } : {}),
    blood_group: match.blood_group,
    distance_km: match.distance_km,
    availability_status: match.availability_status,
    is_verified: match.is_verified
  }));

  res.json({
    donors,
    total: matches.length,
    contact_access: auth ? 'authenticated' : 'login_required',
    query: {
      blood_group: bloodGroup,
      area_name: location.area_name,
      radius_km: MATCH_RADIUS_KM
    }
  });
});

/**
 * The district and upazila donor search behind the blood request flow.
 *
 * Open to everyone and masked for everyone, including signed-in members: a
 * number is only unmasked through `POST /api/requests/:id/reveals`, which
 * requires a published request and is recorded.
 */
app.get('/api/search/donors', async (req, res) => {
  const parsed = parseUpazilaSearch(req.query as Record<string, unknown>);
  if ('error' in parsed) return validationError(res, parsed.error);

  const auth = getCurrentAuth(req);
  const { bloodGroup, location, upazila } = parsed.value;
  const { registered, directory, compatibleGroups } = await findRequestDonors({
    bloodGroup,
    district: location.area_name,
    upazila,
    excludeUserId: auth?.user.id
  });

  res.json({
    query: {
      blood_group: bloodGroup,
      district: location.area_name,
      upazila,
      compatible_groups: compatibleGroups
    },
    registered,
    directory,
    totals: { registered: registered.length, directory: directory.length },
    contact_access: 'masked'
  });
});

app.get('/health', (_req, res) => res.json({ status: 'ok', uptime_seconds: Math.floor((Date.now() - STARTED_AT) / 1000) }));
app.get('/ready', (_req, res) => res.status(isReady ? 200 : 503).json({ status: isReady ? 'ready' : 'starting' }));
app.get('/metrics', (_req, res) => {
  res.type('text/plain').send([
    '# HELP drop_users_total Registered user records', '# TYPE drop_users_total gauge', `drop_users_total ${users.length}`,
    '# HELP drop_active_requests Active public blood requests', '# TYPE drop_active_requests gauge', `drop_active_requests ${requests.filter(item => ['ACTIVE', 'PARTIALLY_FULFILLED'].includes(item.status)).length}`,
    '# HELP drop_open_reports Open moderation reports', '# TYPE drop_open_reports gauge', `drop_open_reports ${moderationReports.filter(item => item.status === 'OPEN').length}`,
    '# HELP drop_uptime_seconds Process uptime', '# TYPE drop_uptime_seconds gauge', `drop_uptime_seconds ${Math.floor((Date.now() - STARTED_AT) / 1000)}`
  ].join('\n') + '\n');
});

app.get('/robots.txt', (req, res) => {
  const origin = publicOrigin(req);
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /profile\nDisallow: /community/new\nDisallow: /directory/call/\nSitemap: ${origin}/sitemap.xml\n`);
});

app.get('/sitemap.xml', asyncRoute(async (req, res) => {
  const origin = publicOrigin(req);
  if (communitySitemapCache?.origin === origin && communitySitemapCache.expiresAt > Date.now()) {
    res.set('Cache-Control', 'public, max-age=300, must-revalidate');
    return res.type('application/xml').send(communitySitemapCache.xml);
  }
  const routes = ['', '/requests', '/register', '/directory', '/community', '/partners', '/about', '/contact', '/safety', '/privacy', '/terms'];
  let communityUrls = '';
  try {
    // A sitemap document may contain at most 50,000 URLs. Reserve room for
    // Drop's stable routes so the generated document always stays valid.
    const posts = await queryAllPublishedCommunityPosts(50_000 - routes.length);
    communityUrls = posts
      .filter(post => post.slug && post.published_at)
      .map(post => `<url><loc>${escapeHtml(`${origin}/community/${encodeURIComponent(post.slug!)}`)}</loc><lastmod>${escapeHtml(post.updated_at)}</lastmod></url>`)
      .join('');
  } catch (error) {
    console.error('community sitemap generation failed', error);
    return res.status(503).type('text/plain').send('Sitemap is temporarily unavailable');
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(route => `<url><loc>${escapeHtml(`${origin}${route}`)}</loc></url>`).join('')}${communityUrls}</urlset>`;
  communitySitemapCache = { origin, xml, expiresAt: Date.now() + COMMUNITY_SITEMAP_CACHE_MS };
  res.set('Cache-Control', 'public, max-age=300, must-revalidate');
  res.type('application/xml').send(xml);
}));

app.get('/api/community', asyncRoute(async (req, res) => {
  const rawPage = req.query.page;
  const page = rawPage === undefined ? 1 : parsePositiveInteger(rawPage, 10_000);
  const rawType = req.query.type;
  const type = rawType === undefined || rawType === ''
    ? undefined
    : isOneOf(rawType, COMMUNITY_POST_TYPES)
      ? rawType
      : null;
  if (!page) return validationError(res, 'Page must be a positive integer');
  if (type === null) return validationError(res, 'Post type must be a donation story or health suggestion');

  const query = { ...(type ? { type } : {}) };
  const [posts, total] = await Promise.all([
    queryPublishedCommunityPosts({ ...query, limit: COMMUNITY_PAGE_SIZE, offset: (page - 1) * COMMUNITY_PAGE_SIZE }),
    countCommunityPosts({ statuses: ['PUBLISHED'], ...query })
  ]);
  res.set('Cache-Control', 'public, max-age=60, must-revalidate');
  res.json({
    posts: posts.map(publicCommunitySummary),
    page,
    total,
    total_pages: Math.ceil(total / COMMUNITY_PAGE_SIZE)
  });
}));

app.get('/api/community/:slug', asyncRoute(async (req, res) => {
  const post = await getPublishedCommunityPostBySlug(req.params.slug);
  if (!post) return res.status(404).json({ error: 'Community post not found' });
  res.set('Cache-Control', 'public, max-age=60, must-revalidate');
  res.json(publicCommunityDetail(post));
}));

app.get('/api/me/community', asyncRoute(async (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const rawPage = req.query.page;
  const page = rawPage === undefined ? 1 : parsePositiveInteger(rawPage, 10_000);
  if (!page) return validationError(res, 'Page must be a positive integer');
  const visibleOwnerStatuses: CommunityPostStatus[] = ['DRAFT', 'PUBLISHED', 'HIDDEN'];
  const [posts, total] = await Promise.all([
    queryCommunityPostsByOwner(auth.user.id, {
      statuses: visibleOwnerStatuses,
      limit: COMMUNITY_PAGE_SIZE,
      offset: (page - 1) * COMMUNITY_PAGE_SIZE
    }),
    countCommunityPosts({ authorId: auth.user.id, statuses: visibleOwnerStatuses })
  ]);
  res.json({
    posts: posts.map(ownerCommunityPost),
    page,
    total,
    total_pages: Math.ceil(total / COMMUNITY_PAGE_SIZE)
  });
}));

app.post('/api/community', asyncRoute(async (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Log in to write a community post' });
  const validation = validateCommunityPostInput({
    type: req.body?.type,
    title: req.body?.title,
    body_markdown: req.body?.body_markdown
  });
  if (validation.ok === false) return validationError(res, validation.errors.join('. '));
  const now = new Date().toISOString();
  const post = await saveCommunityPost({
    id: uuidv4(),
    author_id: auth.user.id,
    status: 'DRAFT',
    ...validation.value,
    created_at: now,
    updated_at: now
  });
  await audit(auth.user.id, 'COMMUNITY_POST_DRAFTED', 'POST', post.id, { type: post.type });
  res.status(201).json(ownerCommunityPost(post));
}));

app.post(
  '/api/community/:id/image',
  authorizeCommunityImageUpload,
  communityImageLimiter,
  limitCommunityImageConcurrency,
  receiveCommunityImage,
  asyncRoute(async (req, res) => {
  const post = res.locals.communityImagePost as CommunityPost;

  const contentType = (req.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
  if (!COMMUNITY_IMAGE_MIME_TYPES.includes(contentType as typeof COMMUNITY_IMAGE_MIME_TYPES[number])) {
    return validationError(res, 'Only JPEG, PNG, and WebP images are supported');
  }
  const encodedAlt = req.get('x-image-alt') || '';
  let imageAlt = '';
  try {
    imageAlt = decodeURIComponent(encodedAlt).trim();
  } catch {
    return validationError(res, 'Image description is invalid');
  }
  if (!imageAlt || Array.from(imageAlt).length > 180) return validationError(res, 'Describe the image in 180 characters or fewer');
  if (!Buffer.isBuffer(req.body)) return validationError(res, 'Choose a valid image to upload');

  let stored: Awaited<ReturnType<typeof saveCommunityImage>>;
  try {
    stored = await saveCommunityImage(req.body, contentType);
  } catch (error) {
    if (error instanceof CommunityMediaError) return validationError(res, error.message);
    console.error('community image processing failed', error);
    return res.status(500).json({ error: 'The image could not be stored' });
  }

  try {
    const previousImageKey = post.image_key;
    if (previousImageKey && previousImageKey !== stored.key) {
      await deleteCommunityImage(previousImageKey);
    }
    const updated = await saveCommunityPost({
      ...post,
      image_key: stored.key,
      image_alt: imageAlt,
      image_width: stored.width,
      image_height: stored.height,
      updated_at: new Date().toISOString()
    });
    res.json(ownerCommunityPost(updated));
  } catch (error) {
    await deleteCommunityImage(stored.key).catch(() => undefined);
    const message = error instanceof Error ? error.message : '';
    if (message.includes('phone') || message.includes('Image')) return validationError(res, message);
    console.error('community image record update failed', error);
    res.status(500).json({ error: 'The image could not be attached to the story' });
  }
  })
);

app.post('/api/community/:id/publish', asyncRoute(async (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Log in to publish a community post' });
  if (!auth.user.is_verified) return res.status(403).json({ error: 'Verify your phone before publishing' });
  if (req.body?.consent !== true) return validationError(res, 'Confirm that you have permission to publish this content');
  const post = await getCommunityPostById(req.params.id);
  if (!post || post.author_id !== auth.user.id) return res.status(404).json({ error: 'Community post not found' });
  if (post.status !== 'DRAFT') return res.status(409).json({ error: 'Only a draft can be published' });
  const now = new Date().toISOString();
  const published = await saveCommunityPost({
    ...post,
    status: 'PUBLISHED',
    published_at: now,
    updated_at: now
  });
  invalidateCommunitySitemap();
  await audit(auth.user.id, 'COMMUNITY_POST_PUBLISHED', 'POST', post.id, { type: post.type, slug: published.slug });
  res.json(publicCommunityDetail(published));
}));

app.delete('/api/community/:id', asyncRoute(async (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const post = await getCommunityPostById(req.params.id);
  if (!post || post.author_id !== auth.user.id || post.status === 'DELETED') {
    return res.status(404).json({ error: 'Community post not found' });
  }
  await markCommunityPostDeleted(post);
  if (post.status === 'PUBLISHED') invalidateCommunitySitemap();
  await audit(auth.user.id, 'COMMUNITY_POST_DELETED', 'POST', post.id);
  res.json({ success: true });
}));

app.get('/media/community/:key', asyncRoute(async (req, res) => {
  const posts = await queryCommunityPosts({
    imageKey: req.params.key,
    limit: 1
  });
  if (posts.length === 0) return res.status(404).end();
  const post = posts[0];
  const auth = getCurrentAuth(req);
  const publiclyCacheable = post.status === 'PUBLISHED';
  const canReview = Boolean(auth && hasCapability(auth.user, 'MODERATE_CONTENT'));
  if (!publiclyCacheable && auth?.user.id !== post.author_id && !canReview) return res.status(404).end();
  let image: Buffer | null;
  try {
    image = await readCommunityImage(req.params.key);
  } catch {
    return res.status(404).end();
  }
  if (!image) return res.status(404).end();
  res.set({
    'Cache-Control': publiclyCacheable ? 'public, max-age=60, must-revalidate' : 'private, no-store',
    'Content-Type': 'image/webp'
  });
  res.send(image);
}));

app.post('/api/auth/otp/request', authLimiter, async (req, res) => {
  const phone = normalizeBangladeshPhone(req.body?.phone);
  const purpose = req.body?.purpose;
  if (!phone || !isOneOf(purpose, OTP_PURPOSES)) {
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
  // SIGN_IN takes neither branch on purpose. It has to work whether or not the
  // number has an account, and the answer is only disclosed once the caller has
  // entered the code sent to that number - so they learn about their own phone
  // and nobody else's.

  const recent = otpChallenges.find(challenge =>
    challenge.phone === phone && challenge.purpose === purpose &&
    new Date(challenge.expires_at).getTime() > Date.now() &&
    Date.now() - new Date(challenge.created_at).getTime() < 60_000
  );
  if (recent) return res.status(429).json({ error: 'Wait before requesting another code' });

  const code = String(randomInt(100000, 1_000_000));
  const now = Date.now();
  const challenge: OtpChallenge = {
    id: uuidv4(), phone, purpose,
    code_hash: await bcrypt.hash(code, BCRYPT_ROUNDS),
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + OTP_TTL_MS).toISOString(),
    attempts: 0
  };
  otpChallenges.push(challenge);
  try {
    await saveToTable('common_otps', challenge);
  } catch {
    otpChallenges = otpChallenges.filter(item => item.id !== challenge.id);
    challenge.expires_at = new Date(0).toISOString();
    try {
      await saveToTable('common_otps', challenge);
    } catch {
      // There is no in-memory cooldown even when persistence is unavailable.
    }
    return res.status(503).json({ error: 'Phone verification is temporarily unavailable' });
  }
  try {
    await provider.sendOtp(phone, code);
  } catch {
    otpChallenges = otpChallenges.filter(item => item.id !== challenge.id);
    challenge.expires_at = new Date(0).toISOString();
    challenge.verification_expires_at = new Date(0).toISOString();
    try {
      await saveToTable('common_otps', challenge);
    } catch {
      // The in-memory challenge is already gone. Avoid exposing datastore or
      // provider details while readiness monitoring reports persistent errors.
    }
    const status = provider.name === 'http' ? 502 : 503;
    return res.status(status).json({ error: 'Verification code delivery failed; please try again' });
  }
  res.json({ success: true, provider: provider.name });
});

app.post('/api/auth/otp/verify', authLimiter, async (req, res) => {
  const phone = normalizeBangladeshPhone(req.body?.phone);
  const purpose = req.body?.purpose;
  const code = cleanString(req.body?.code, 6);
  if (!phone || !code || !/^\d{6}$/.test(code) || !isOneOf(purpose, OTP_PURPOSES)) {
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

  // Only now, having proven control of the number, is the caller told whether
  // it already has an account - so the blood request flow can branch between
  // signing in and registering without ever becoming an enumeration oracle.
  if (purpose === 'SIGN_IN') {
    const existing = users.find(user => user.phone === phone && !user.deleted_at);
    return res.json({
      verification_token: challenge.verification_token,
      account_exists: Boolean(existing),
      name: existing?.name,
      has_password: Boolean(existing?.password)
    });
  }

  res.json({ verification_token: challenge.verification_token });
});

/**
 * Signs in with a verified `SIGN_IN` challenge instead of a password. The
 * password path below is unchanged and still offered; this exists so someone
 * arranging blood for a relative is not stopped by a password they set months
 * ago and cannot recall.
 */
app.post('/api/auth/otp/login', authLimiter, async (req, res) => {
  const phone = normalizeBangladeshPhone(req.body?.phone);
  const bodyFingerprint = normalizeFingerprint(req.body?.fingerprint);
  const fingerprint = bodyFingerprint && bodyFingerprint === getFingerprint(req) ? bodyFingerprint : '';
  if (!phone) return validationError(res, 'Valid Bangladesh phone is required');

  const challenge = verifiedChallenge(phone, 'SIGN_IN', req.body?.verification_token);
  if (!challenge) return res.status(403).json({ error: 'Verify this phone before signing in' });

  const user = users.find(item => item.phone === phone && !item.deleted_at);
  if (!user) return res.status(404).json({ error: 'No account exists for this number' });
  if (user.account_status === 'SUSPENDED') return res.status(403).json({ error: 'This account is suspended' });

  await consumeChallenge(challenge);
  if (fingerprint) await adoptFingerprintOwnership(fingerprint, user);

  const token = await issueSession(user.id, req);
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
  res.json({ user: sanitizeUser(user) });
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

  if (fingerprint) await adoptFingerprintOwnership(fingerprint, user);

  const token = await issueSession(user.id, req);
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
  // A SIGN_IN challenge is accepted too, so the blood request flow can send one
  // code and then branch into signing in or registering depending on what the
  // verification revealed.
  const challenge = phone
    ? verifiedChallenge(phone, 'REGISTER', req.body?.verification_token)
      || verifiedChallenge(phone, 'SIGN_IN', req.body?.verification_token)
    : null;
  const upazila = location ? parseUpazila(location.area_name, req.body?.upazila) : undefined;
  const age = parseOptionalInteger(req.body?.age, 16, 70);
  const weight_kg = parseOptionalInteger(req.body?.weight_kg, 30, 200);
  const donationDetails = resolveDonationDetails(
    isPlainObject(req.body) ? req.body : {},
    undefined,
    []
  );

  if (!phone || !name || !password) return validationError(res, 'Phone, name, and password are required');
  if (!challenge) return res.status(403).json({ error: 'Verify this phone before registering' });
  if (password.length < 8) return validationError(res, 'Password must be at least 8 characters');
  if (blood_group !== undefined && !isOneOf(blood_group, BLOOD_GROUPS)) return validationError(res, 'Valid blood group is required');
  if (req.body?.location !== undefined && !location) return validationError(res, 'Valid location is required');
  if ((blood_group && !location) || (!blood_group && location)) return validationError(res, 'Blood group and location must be provided together');
  if (upazila === null) return validationError(res, 'Choose an upazila that belongs to the selected district');
  if (age === null) return validationError(res, 'Age must be between 16 and 70');
  if (weight_kg === null) return validationError(res, 'Weight must be between 30 and 200 kg');
  if ('error' in donationDetails) return validationError(res, donationDetails.error);
  const hasDonationInput = ['last_donation', 'last_donation_date', 'donation_count']
    .some(field => req.body?.[field] !== undefined && req.body?.[field] !== '');
  if (hasDonationInput && !blood_group) return validationError(res, 'Donation details require a donor blood group');

  if (users.find(u => u.phone === phone)) {
    return res.status(400).json({ error: 'Phone already registered' });
  }
  
  const user: User = {
    id: uuidv4(),
    phone,
    name,
    password: await bcrypt.hash(password, BCRYPT_ROUNDS),
    // Registration only reaches this point after a purpose-bound OTP challenge
    // has verified control of the submitted phone number.
    is_verified: true,
    phone_verified_at: new Date().toISOString(),
    roles: ['MEMBER'],
    created_at: new Date().toISOString(),
  };

  if (blood_group && location) {
    // A new profile always starts unavailable. Giving a blood group while
    // arranging blood for someone else is not the same as volunteering to be
    // called, so the donor opts in separately from /profile/donor.
    user.donor_profile = {
      blood_group,
      location,
      ...(upazila ? { upazila } : {}),
      ...(age ? { age } : {}),
      ...(weight_kg ? { weight_kg } : {}),
      ...(donationDetails.value.last_donation ? { last_donation: donationDetails.value.last_donation } : {}),
      ...(donationDetails.value.last_donation_date ? { last_donation_date: donationDetails.value.last_donation_date } : {}),
      ...(donationDetails.value.donation_count !== undefined ? { donation_count: donationDetails.value.donation_count } : {}),
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
  
  if (fingerprint) await adoptFingerprintOwnership(fingerprint, user);

  const token = await issueSession(user.id, req);
  await consumeChallenge(challenge);
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
  res.json({ user: sanitizeUser(user) });
});

app.post('/api/auth/logout', async (req, res) => {
  await revokeSession(req);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ success: true });
});

app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  const phone = normalizeBangladeshPhone(req.body?.phone);
  const newPassword = cleanString(req.body?.new_password, 128);
  if (!phone || !newPassword || newPassword.length < 8) return validationError(res, 'Valid phone and password of at least 8 characters are required');
  const challenge = verifiedChallenge(phone, 'RESET_PASSWORD', req.body?.verification_token);
  if (!challenge) return res.status(403).json({ error: 'Verify the phone before resetting the password' });
  const user = users.find(item => item.phone === phone && !item.deleted_at);
  if (!user) return validationError(res, 'Password could not be reset');
  user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await saveToTable('common_users', user);
  const now = new Date().toISOString();
  for (const session of sessions.filter(item => item.user_id === user.id && !item.revoked_at)) {
    session.revoked_at = now;
    await saveToTable('common_sessions', session);
  }
  await consumeChallenge(challenge);
  await audit(user.id, 'PASSWORD_RESET', 'USER', user.id);
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

app.get('/api/me/sessions', (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  res.json(sessions.filter(item => item.user_id === auth.user.id && !item.revoked_at && new Date(item.expires_at).getTime() > Date.now()).map(item => ({
    id: item.id, created_at: item.created_at, expires_at: item.expires_at, last_seen_at: item.last_seen_at,
    user_agent: item.user_agent || 'Unknown device', ip: item.ip, current: item.id === auth.session.id
  })));
});

app.delete('/api/me/sessions/:id', async (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const session = sessions.find(item => item.id === req.params.id && item.user_id === auth.user.id && !item.revoked_at);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  session.revoked_at = new Date().toISOString();
  await saveToTable('common_sessions', session);
  await audit(auth.user.id, 'SESSION_REVOKED', 'SESSION', session.id);
  if (session.id === auth.session.id) res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ success: true, current: session.id === auth.session.id });
});

app.post('/api/me/logout-all', async (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const now = new Date().toISOString();
  for (const session of sessions.filter(item => item.user_id === auth.user.id && !item.revoked_at)) {
    session.revoked_at = now; await saveToTable('common_sessions', session);
  }
  await audit(auth.user.id, 'ALL_SESSIONS_REVOKED', 'USER', auth.user.id);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ success: true });
});

app.get('/api/me/export', asyncRoute(async (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const userId = auth.user.id;
  const communityPosts = await queryAllCommunityPostsByOwner(userId);
  const exportedCommunityPosts = await Promise.all(communityPosts.map(async post => {
    const projected = ownerCommunityPost(post);
    if (!post.image_key) return projected;
    const image = await readCommunityImage(post.image_key).catch(() => null);
    return {
      ...projected,
      ...(image ? {
        image_export: {
          mime_type: 'image/webp',
          data_base64: image.toString('base64')
        }
      } : {})
    };
  }));
  res.json({
    exported_at: new Date().toISOString(),
    account: sanitizeUser(auth.user),
    requests: requests.filter(item => item.user_id === userId),
    responses: donorResponses.filter(item => item.donor_id === userId || item.requester_id === userId),
    notifications: notifications.filter(item => item.user_id === userId),
    reports: moderationReports.filter(item => item.reporter_id === userId),
    community_posts: exportedCommunityPosts
  });
}));

app.delete('/api/me', asyncRoute(async (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const password = cleanString(req.body?.password, 128);
  if (!password || !auth.user.password || !(await bcrypt.compare(password, auth.user.password))) return res.status(403).json({ error: 'Current password is required' });
  const now = new Date().toISOString();
  for (const request of requests.filter(item => item.user_id === auth.user.id)) {
    if (['DRAFT', 'PENDING_VERIFICATION', 'ACTIVE', 'PARTIALLY_FULFILLED'].includes(request.status)) request.status = 'CANCELLED';
    request.patient_name = undefined; request.patient_reference = undefined; request.contacts = [];
    request.requester_name = 'Deleted member';
    await saveToTable('common_requests', request, [request.location.lng, request.location.lat]);
  }
  for (const request of requests) {
    let changed = false;
    request.comments = request.comments?.map(comment => {
      if (comment.user_id !== auth.user.id) return comment;
      changed = true; return { ...comment, user_name: 'Deleted member' };
    });
    if (changed) await saveToTable('common_requests', request, [request.location.lng, request.location.lat]);
  }
  const communityPosts = await queryAllCommunityPostsByOwner(auth.user.id, ['DRAFT', 'PUBLISHED', 'HIDDEN']);
  for (const post of communityPosts) {
    await markCommunityPostDeleted(post);
    if (post.status === 'PUBLISHED') invalidateCommunitySitemap();
  }
  await removeDonorFromAllPartitions(auth.user.id);
  auth.user.name = 'Deleted member'; auth.user.phone = `deleted-${auth.user.id}`; auth.user.password = undefined;
  auth.user.is_verified = false; auth.user.donor_profile = undefined; auth.user.recipient_profile = undefined;
  auth.user.blocked_user_ids = []; auth.user.account_status = 'SUSPENDED'; auth.user.deleted_at = now;
  await saveToTable('common_users', auth.user);
  for (const session of sessions.filter(item => item.user_id === auth.user.id && !item.revoked_at)) { session.revoked_at = now; await saveToTable('common_sessions', session); }
  await audit(auth.user.id, 'ACCOUNT_ANONYMIZED', 'USER', auth.user.id, {
    deleted_community_posts: communityPosts.length
  });
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ success: true });
}));

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
  const donation_history = parseDonationHistory(req.body?.donation_history);
  const deferral_status = req.body?.deferral_status || 'NONE';
  const deferred_until = parseDate(req.body?.deferred_until);
  const upazila = location ? parseUpazila(location.area_name, req.body?.upazila) : undefined;
  const age = parseOptionalInteger(req.body?.age, 16, 70);
  const weight_kg = parseOptionalInteger(req.body?.weight_kg, 30, 200);
  const existingProfile = auth.user.donor_profile;
  const resolvedHistory = donation_history || existingProfile?.donation_history || [];
  const donationDetails = resolveDonationDetails(
    isPlainObject(req.body) ? req.body : {},
    existingProfile,
    resolvedHistory
  );

  if (!isOneOf(blood_group, BLOOD_GROUPS)) return validationError(res, 'Valid blood group is required');
  if (!isOneOf(availability_status, AVAILABILITY_STATUSES)) return validationError(res, 'Valid availability status is required');
  if (!location) return validationError(res, 'Valid location is required');
  if (upazila === null) return validationError(res, 'Choose an upazila that belongs to the selected district');
  if (age === null) return validationError(res, 'Age must be between 16 and 70');
  if (weight_kg === null) return validationError(res, 'Weight must be between 30 and 200 kg');
  if (donation_history === null) return validationError(res, 'Valid donation history is required');
  if ('error' in donationDetails) return validationError(res, donationDetails.error);
  if (!isOneOf(deferral_status, DEFERRAL_STATUSES)) return validationError(res, 'Valid deferral status is required');
  if (deferred_until === null || (deferral_status === 'TEMPORARY' && !deferred_until)) return validationError(res, 'Temporary deferral needs an end date');

  const userIndex = users.findIndex(u => u.id === auth.user.id);
  if (userIndex !== -1) {
    // An upazila only means anything inside its own district, so moving
    // district drops a stale one rather than carrying it across.
    const keptUpazila = existingProfile?.location.area_name === location.area_name
      ? existingProfile?.upazila
      : undefined;
    const availabilityHistory = [...(existingProfile?.availability_history || [])];
    if (!existingProfile || existingProfile.availability_status !== availability_status) {
      availabilityHistory.push({ status: availability_status, changed_at: new Date().toISOString() });
    }
    users[userIndex].donor_profile = {
      ...existingProfile,
      blood_group,
      availability_status,
      location,
      upazila: upazila ?? keptUpazila,
      age: age ?? existingProfile?.age,
      weight_kg: weight_kg ?? existingProfile?.weight_kg,
      last_donation: donationDetails.value.last_donation,
      last_donation_date: donationDetails.value.last_donation_date,
      donation_count: donationDetails.value.donation_count,
      deferral_status,
      deferred_until,
      availability_confirmed_at: availability_status === 'AVAILABLE' ? new Date().toISOString() : existingProfile?.availability_confirmed_at,
      donation_history: resolvedHistory,
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

const REQUESTER_ROLE_RELATIONSHIPS: Record<(typeof REQUESTER_ROLES)[number], (typeof REQUESTER_RELATIONSHIPS)[number]> = {
  PATIENT: 'SELF',
  RELATIVE: 'FAMILY',
  THIRD_PARTY: 'VOLUNTEER'
};

/**
 * Parses the shorter form the search flow collects.
 *
 * `parseCompleteRequest` above is deliberately left alone: it still guards
 * `POST /api/requests`, whose output feeds the detail editor and the admin
 * surfaces, and loosening it would degrade those records to serve a different
 * flow. What the search flow does not ask for is derived here, with a reason:
 *
 *   blood_component  WHOLE_BLOOD - volunteers calling donors are not making a
 *                    component decision, and this flow never asks a clinician.
 *   units_required   1 - one donor per call; progress accounting needs a number.
 *   needed_by        from the optional timing question, or absent for "now".
 *   hospital_address,
 *   patient_reference  not collected; both are optional on the record.
 *
 * The requester's own phone is taken from their verified account rather than
 * from the request body, so the number attached to a request is always one
 * somebody proved they control.
 */
function parseSearchRequest(body: Record<string, unknown>, requesterPhone: string) {
  const blood_group = body.blood_group;
  const districtName = cleanString(body.district, 80);
  const location = districtName ? getLocationByName(districtName) : null;
  const requester_role = body.requester_role;
  const patient_title = body.patient_title;
  const patient_name = cleanString(body.patient_name, 120);
  const patient_age = parseOptionalInteger(body.patient_age, 0, 120);
  const collection_facility = cleanString(body.collection_facility, 160);
  const collection_facility_code = optionalCleanString(body.collection_facility_code, 40);
  const requester_name = optionalCleanString(body.requester_name, 120);
  const requester_relation = optionalCleanString(body.requester_relation, 60);
  const contact_owner = parseOptionalEnum(body.contact_owner, CONTACT_OWNERS);
  const contact_name = optionalCleanString(body.contact_name, 80);
  const contact_phone = body.contact_phone === undefined || body.contact_phone === ''
    ? undefined
    : normalizeBangladeshPhone(body.contact_phone);
  const needed_window = parseOptionalEnum(body.needed_window, NEEDED_WINDOWS);

  if (!isOneOf(blood_group, BLOOD_GROUPS)) return { error: 'Valid blood group is required' } as const;
  if (!location) return { error: 'Valid Bangladesh district is required' } as const;
  const upazila = parseUpazila(location.area_name, body.upazila);
  if (!upazila) return { error: 'Choose an upazila that belongs to the selected district' } as const;
  if (!collection_facility) return { error: 'Where the blood will be collected is required' } as const;
  if (!isOneOf(requester_role, REQUESTER_ROLES)) return { error: 'Say whether you are the patient, a relative, or a volunteer' } as const;
  if (!isOneOf(patient_title, PATIENT_TITLES)) return { error: 'Patient title is required' } as const;
  if (!patient_name) return { error: "The patient's name is required" } as const;
  if (!patient_age) return { error: "The patient's age must be between 1 and 120" } as const;
  if (needed_window === null) return { error: 'Choose a valid time frame' } as const;
  if (contact_owner === null) return { error: "Say whose number this is: the patient's or a relative's" } as const;
  if (body.consent !== true) return { error: 'Explicit publication consent is required' } as const;

  const contacts: ContactDetail[] = [];
  let resolvedRequesterName = requester_name;

  if (requester_role === 'PATIENT') {
    resolvedRequesterName = patient_name;
    contacts.push({ name: patient_name, phone: requesterPhone, type: 'PATIENT' });
  } else if (requester_role === 'RELATIVE') {
    if (!requester_name) return { error: 'Your name is required' } as const;
    if (!requester_relation) return { error: 'Your relationship to the patient is required' } as const;
    contacts.push({ name: requester_name, phone: requesterPhone, type: 'RELATIVE' });
  } else {
    if (!requester_name) return { error: 'Your name is required' } as const;
    if (!contact_owner) return { error: "Say whose number this is: the patient's or a relative's" } as const;
    if (!contact_phone) return { error: 'A valid Bangladesh contact number is required' } as const;
    if (contact_owner === 'RELATIVE' && (!contact_name || !requester_relation)) {
      return { error: "The relative's name and relationship to the patient are required" } as const;
    }
    // The volunteer's own number first, then the number that belongs to the
    // patient's side. A donor calling back should reach either.
    contacts.push({ name: requester_name, phone: requesterPhone, type: 'OTHER' });
    contacts.push({
      name: contact_owner === 'PATIENT' ? patient_name : contact_name!,
      phone: contact_phone,
      type: contact_owner
    });
  }

  return {
    value: {
      blood_group,
      location,
      upazila,
      blood_component: 'WHOLE_BLOOD' as const,
      units_required: 1,
      hospital_name: collection_facility,
      collection_facility_code,
      patient_title,
      patient_sex: patient_title === 'MR' ? ('MALE' as const) : ('FEMALE' as const),
      patient_name,
      patient_age,
      requester_role,
      requester_name: resolvedRequesterName!,
      requester_relationship: REQUESTER_ROLE_RELATIONSHIPS[requester_role],
      requester_relation,
      contact_owner: requester_role === 'THIRD_PARTY' ? contact_owner : undefined,
      needed_window,
      needed_by: needed_window
        ? new Date(Date.now() + NEEDED_WINDOW_HOURS[needed_window] * 3_600_000).toISOString()
        : undefined,
      contacts
    }
  } as const;
}

/**
 * Creates and publishes in one step, because the search flow has a single
 * submit: the requester has already reviewed every field on the way here, and a
 * separate draft stage would strand a half-finished request.
 */
app.post('/api/search/requests', async (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Log in to publish a request' });
  if (!auth.user.is_verified) return res.status(403).json({ error: 'Verify your phone before creating a request' });

  const parsed = parseSearchRequest(req.body || {}, auth.user.phone);
  if ('error' in parsed) return validationError(res, parsed.error);

  // Re-searching after a dead-end call is not a mistake to error at, so a
  // repeat for the same patient need returns the request already in flight
  // instead of the 409 the older, reference-keyed flow raises.
  const recent = requests.find(request =>
    request.user_id === auth.user.id &&
    ['DRAFT', 'ACTIVE', 'PARTIALLY_FULFILLED'].includes(request.status) &&
    request.blood_group === parsed.value.blood_group &&
    request.upazila === parsed.value.upazila &&
    Date.now() - new Date(request.created_at).getTime() < 6 * 3_600_000
  );
  if (recent) return res.json({ request: recent, reused: true });

  const now = new Date().toISOString();
  const request: BloodRequest = {
    id: uuidv4(),
    user_id: auth.user.id,
    ...parsed.value,
    flow_version: 'SEARCH_V1',
    created_at: now,
    expires_at: new Date(Math.max(
      Date.now() + DEFAULT_REQUEST_TTL_MS,
      parsed.value.needed_by ? new Date(parsed.value.needed_by).getTime() + 6 * 3_600_000 : 0
    )).toISOString(),
    status: 'ACTIVE',
    consent_at: now,
    published_at: now,
    units_pledged: 0,
    units_confirmed: 0,
    comments: [],
    timeline: [{ id: uuidv4(), type: 'SEARCH_REQUEST_PUBLISHED', actor_id: auth.user.id, created_at: now }]
  };
  requests.push(request);
  await saveToTable('common_requests', request, [request.location.lng, request.location.lat]);
  res.status(201).json({ request, reused: false });
});

// A reveal is a targeted lookup, not browsing, so it gets its own budget. The
// shared /api limiter would let a long calling session throttle the same
// person's ordinary use of the site.
const revealLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many contact reveals, please try again later' }
});

/** How wide the membership re-check looks; a superset of one result page. */
const REVEAL_MATCH_LIMIT = 200;
/** A reveal is only "unreported" once the caller has had time to dial. */
const REVEAL_REPORT_GRACE_MS = 60_000;

async function requestCallReports(requestId: string, actorId?: string) {
  return await queryCallReports<CallReport>({ requestId, actorId, limit: 1_000 });
}

function unansweredReveals(reports: CallReport[]) {
  const answered = new Set(
    reports.filter(report => report.kind === 'CALL_OUTCOME').map(report => report.reveal_id)
  );
  return reports
    .filter(report => report.kind === 'REVEAL' && !answered.has(report.id))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

/**
 * The reveal a requester owes an answer for. The grace period keeps the prompt
 * from appearing while they are still on the call page having just opened it.
 */
function pendingReveal(reports: CallReport[], now = Date.now()) {
  return unansweredReveals(reports)
    .find(report => now - new Date(report.created_at).getTime() > REVEAL_REPORT_GRACE_MS) || null;
}

/**
 * Unmasks one donor's number for the owner of a published request.
 *
 * The check that matters is that `donor_ref` is still in the request's own
 * freshly recomputed results. Without it a single published request would be a
 * bulk lookup oracle for the whole imported directory.
 */
app.post('/api/requests/:id/reveals', revealLimiter, async (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Log in to see contact details' });
  if (!auth.user.is_verified) return res.status(403).json({ error: 'Verify your phone before contacting donors' });

  const request = requests.find(item => item.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.user_id !== auth.user.id) return res.status(403).json({ error: 'Only the requester can see these contacts' });
  if (!['ACTIVE', 'PARTIALLY_FULFILLED'].includes(request.status)) {
    return res.status(409).json({ error: 'This request is no longer active' });
  }
  if (!request.upazila) {
    return res.status(409).json({ error: 'This request predates upazila search; publish a new one to use it' });
  }

  const donorRef = cleanString(req.body?.donor_ref, 120);
  const reference = donorRef ? parseDonorRef(donorRef) : null;
  if (!donorRef || !reference) return validationError(res, 'A donor reference is required');

  // One open call at a time. Leaving the call page without answering does not
  // skip the question, it defers it - and this is what makes that true.
  const reports = await requestCallReports(request.id, auth.user.id);
  const pending = pendingReveal(reports);
  if (pending && pending.donor_ref !== donorRef) {
    return res.status(409).json({
      error: 'Report how your last call went before asking for another number',
      pending_reveal_id: pending.id,
      pending_donor_ref: pending.donor_ref
    });
  }

  // Reopening the same donor - going back to finish a call - must reuse the
  // open reveal. Writing a second one would leave the first unanswered, and the
  // requester would then be blocked by a reveal they can no longer report on.
  const openForDonor = unansweredReveals(reports).find(report => report.donor_ref === donorRef);

  const { registered, directory } = await findRequestDonors({
    bloodGroup: request.blood_group as BloodGroup,
    district: request.location.area_name,
    upazila: request.upazila,
    excludeUserId: auth.user.id,
    limit: REVEAL_MATCH_LIMIT
  });
  const card = [...registered, ...directory].find(item => item.donor_ref === donorRef);
  if (!card) return res.status(409).json({ error: 'That donor is no longer among this request\'s matches' });

  let phone = '';
  if (reference.kind === 'REGISTERED') {
    const donor = users.find(user => user.id === reference.id);
    if (!donor?.phone) return res.status(409).json({ error: 'That donor is no longer reachable' });
    phone = donor.phone;
    // A registered donor gets a real invitation, so the contact appears in
    // their own responses instead of arriving as an unexplained phone call.
    await inviteDonorToRequest(request, donor.id);
  } else {
    const listing = await getImportedDonor(reference.id);
    if (!listing || listing.claim_status !== 'UNCLAIMED') {
      return res.status(409).json({ error: 'That listing is no longer available' });
    }
    phone = toRevealedImportedDonor(listing).phone;
    if (!phone) return res.status(409).json({ error: 'That listing has no published number' });
  }

  const reveal: CallReport = openForDonor || {
    id: uuidv4(),
    kind: 'REVEAL',
    request_id: request.id,
    actor_id: auth.user.id,
    donor_ref: donorRef,
    donor_kind: card.donor_kind,
    created_at: new Date().toISOString()
  };
  if (!openForDonor) await addCallReports([reveal]);

  // One audit row per request, not per reveal. `common_audit_events` is loaded
  // into memory at boot with a 10,000-row ceiling, and a row per reveal would
  // silently truncate the moderation trail. The complete per-reveal history
  // lives in common_call_reports, which is queried on demand.
  if (!reports.some(report => report.kind === 'REVEAL')) {
    await audit(auth.user.id, 'REQUEST_CONTACTS_REVEALED', 'REQUEST', request.id, {
      blood_group: request.blood_group,
      district: request.location.area_name,
      upazila: request.upazila
    });
  }

  res.json({
    reveal_id: reveal.id,
    donor_ref: donorRef,
    donor_kind: card.donor_kind,
    name: card.name,
    blood_group: card.blood_group,
    district: card.district,
    upazila: card.upazila,
    source: card.source,
    phone
  });
});

/** The reveal the requester still owes an answer for, if any. */
app.get('/api/requests/:id/reveals/pending', async (req, res) => {
  const auth = getCurrentAuth(req);
  const request = requests.find(item => item.id === req.params.id);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.user_id !== auth.user.id) return res.status(403).json({ error: 'Only the requester can see these contacts' });

  const pending = pendingReveal(await requestCallReports(request.id, auth.user.id));
  res.json({
    pending: pending
      ? { reveal_id: pending.id, donor_ref: pending.donor_ref, created_at: pending.created_at }
      : null
  });
});

/**
 * The answer to "what happened when you called".
 *
 * Nothing here changes the donor's own record. "Recently donated" and "is ill"
 * are unverified third-party claims, and acting on them would let any requester
 * mark any donor unavailable. They are recorded for staff to aggregate instead.
 */
app.post('/api/requests/:id/call-reports', async (req, res) => {
  const auth = getCurrentAuth(req);
  const request = requests.find(item => item.id === req.params.id);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.user_id !== auth.user.id) return res.status(403).json({ error: 'Only the requester can report a call' });

  const parsed = parseCallOutcome(req.body || {});
  if ('error' in parsed) return validationError(res, parsed.error);

  const revealId = cleanString(req.body?.reveal_id, 80);
  if (!revealId) return validationError(res, 'A reveal reference is required');

  const reports = await requestCallReports(request.id, auth.user.id);
  const reveal = reports.find(report => report.kind === 'REVEAL' && report.id === revealId);
  if (!reveal) return res.status(404).json({ error: 'That call was not started from this request' });
  if (reports.some(report => report.kind === 'CALL_OUTCOME' && report.reveal_id === revealId)) {
    return res.status(409).json({ error: 'This call has already been reported' });
  }

  const report: CallReport = {
    id: uuidv4(),
    kind: 'CALL_OUTCOME',
    request_id: request.id,
    actor_id: auth.user.id,
    donor_ref: reveal.donor_ref,
    donor_kind: reveal.donor_kind,
    reveal_id: revealId,
    outcome: parsed.value.outcome,
    reason: 'reason' in parsed.value ? parsed.value.reason : undefined,
    detail: 'detail' in parsed.value ? parsed.value.detail : undefined,
    note: parsed.value.note,
    created_at: new Date().toISOString()
  };
  await addCallReports([report]);

  // A registered donor already has a response record for this request, so a
  // declined call is reflected there too rather than leaving them "invited"
  // forever. Imported listings have no record to update.
  const reference = parseDonorRef(reveal.donor_ref);
  if (reference?.kind === 'REGISTERED') {
    const response = donorResponses.find(item =>
      item.request_id === request.id && item.donor_id === reference.id && item.status === 'INVITED'
    );
    if (response && ['WRONG_NUMBER', 'DECLINED'].includes(parsed.value.outcome)) {
      response.status = 'DECLINED';
      response.updated_at = new Date().toISOString();
      await saveToTable('common_responses', response);
    }
  }

  res.status(201).json({ report_id: report.id });
});

/** Requests a signed-in donor could answer, with the requester's number masked. */
app.get('/api/me/donor-requests', async (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  if (!auth.user.donor_profile) return res.status(403).json({ error: 'Add a donor profile to see nearby requests' });
  await enforceExpiredRequests();

  const profile = auth.user.donor_profile;
  const items = requests
    .filter(request => ['ACTIVE', 'PARTIALLY_FULFILLED'].includes(request.status))
    .filter(request => request.user_id !== auth.user.id)
    .filter(request => donorCanSeeRequest(profile, request))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 50)
    .map(request => {
      const requester = users.find(user => user.id === request.user_id);
      const response = donorResponses.find(item =>
        item.request_id === request.id && item.donor_id === auth.user.id
      );
      return {
        ...publicRequestPayload(request),
        // Masked until the donor says they can help, mirroring how the donor's
        // own number is treated on the requester's side.
        requester_phone_masked: maskPhone(requester?.phone || ''),
        my_response_status: response?.status || null,
        contacts: response && ['ACCEPTED', 'ARRIVED', 'DONATED'].includes(response.status)
          ? request.contacts || []
          : undefined
      };
    });

  res.json({ items, donor: { blood_group: profile.blood_group, district: profile.location.area_name, upazila: profile.upazila || null } });
});

/**
 * A donor's answer to a request they were shown. Their own report may change
 * their own record - unlike a requester's report about them.
 */
app.post('/api/requests/:id/donor-reports', async (req, res) => {
  const auth = getCurrentAuth(req);
  const request = requests.find(item => item.id === req.params.id);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  if (!auth.user.donor_profile) return res.status(403).json({ error: 'Add a donor profile before responding' });
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.user_id === auth.user.id) return res.status(403).json({ error: 'This is your own request' });
  if (!donorCanSeeRequest(auth.user.donor_profile, request)) {
    return res.status(403).json({ error: 'This request is not in your area or blood group' });
  }

  const parsed = parseDonorReport(req.body || {});
  if ('error' in parsed) return validationError(res, parsed.error);
  const { outcome, note } = parsed.value;

  const response = await inviteDonorToRequest(request, auth.user.id);
  const now = new Date().toISOString();
  response.status = outcome === 'CAN_DONATE' ? 'ACCEPTED' : outcome === 'NEED_MORE_INFO' ? 'QUESTION' : 'DECLINED';
  response.message = note || response.message;
  response.updated_at = now;
  await saveToTable('common_responses', response);
  await recomputeRequestProgress(request);

  await addCallReports([{
    id: uuidv4(),
    kind: 'DONOR_REPORT',
    request_id: request.id,
    actor_id: auth.user.id,
    donor_ref: registeredDonorRef(auth.user.id),
    donor_kind: 'REGISTERED',
    outcome,
    note,
    created_at: now
  } satisfies CallReport]);

  // Self-declared, so acting on it is legitimate here in a way it never is on
  // the requester's side.
  if (outcome === 'NOT_ELIGIBLE_RECENT_DONATION' && req.body?.donated_on) {
    const donatedOn = parseDate(req.body.donated_on);
    if (donatedOn === null || (donatedOn && new Date(donatedOn).getTime() > Date.now())) {
      return validationError(res, 'Valid last donation date is required');
    }
    if (donatedOn) {
      const date = donatedOn.slice(0, 10);
      auth.user.donor_profile.last_donation = { kind: 'EXACT', date, reported_at: now };
      auth.user.donor_profile.last_donation_date = date;
      if (auth.user.donor_profile.donation_count === undefined) {
        auth.user.donor_profile.donation_count = Math.max(1, auth.user.donor_profile.donation_history?.length || 0);
      }
      await saveToTable('common_users', auth.user);
      await removeDonorFromAllPartitions(auth.user.id);
    }
  }
  if (outcome === 'NOT_ELIGIBLE_HEALTH' && req.body?.pause_availability === true) {
    auth.user.donor_profile.availability_status = 'SICK';
    auth.user.donor_profile.availability_history = [
      ...(auth.user.donor_profile.availability_history || []),
      { status: 'SICK' as const, changed_at: now }
    ].slice(-50);
    await saveToTable('common_users', auth.user);
    await removeDonorFromAllPartitions(auth.user.id);
  }

  if (outcome === 'SUSPECTED_MISUSE') {
    const report: ModerationReport = {
      id: uuidv4(), reporter_id: auth.user.id, target_type: 'REQUEST', target_id: request.id,
      reason: 'FRAUD', details: note, status: 'OPEN',
      created_at: now, updated_at: now
    };
    moderationReports.push(report);
    await saveToTable('common_reports', report);
  }

  await notify(
    request.user_id,
    'DONOR_RESPONSE',
    outcome === 'CAN_DONATE' ? 'A donor can help' : 'A donor responded',
    `${auth.user.name} responded to your ${request.blood_group} request.`,
    `/request/${request.id}`
  );

  res.json({
    response: responsePayload(response, auth.user.id),
    contacts: response.status === 'ACCEPTED' ? request.contacts || [] : undefined
  });
});

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

/**
 * Records an invitation and notifies the donor. Returns the existing response
 * when one is already open, so revealing the same number twice does not create
 * a second invitation or a second notification.
 */
async function inviteDonorToRequest(request: BloodRequest, donorId: string) {
  const existing = donorResponses.find(response =>
    response.request_id === request.id &&
    response.donor_id === donorId &&
    !['DECLINED', 'CANCELLED', 'NO_SHOW'].includes(response.status)
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const response: DonorResponse = {
    id: uuidv4(), request_id: request.id, donor_id: donorId, requester_id: request.user_id,
    status: 'INVITED', units: 1, created_at: now, updated_at: now
  };
  donorResponses.push(response);
  await saveToTable('common_responses', response);
  await notify(donorId, 'DONOR_INVITATION', `Blood request near ${request.location.area_name}`, `${request.blood_group} ${request.blood_component?.replaceAll('_', ' ').toLowerCase()} is needed at ${request.hospital_name}.`, `/profile/invitations`);
  return response;
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
  const response = await inviteDonorToRequest(request, donorId);
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
      const previousHistory = donor.donor_profile.donation_history || [];
      donor.donor_profile.last_donation = {
        kind: 'EXACT', date, reported_at: response.requester_confirmed_at
      };
      donor.donor_profile.last_donation_date = date;
      donor.donor_profile.availability_status = 'NOT_AVAILABLE';
      donor.donor_profile.donation_history = [...previousHistory, {
        id: response.id, date, organization: request.hospital_name || 'Receiving hospital'
      }];
      donor.donor_profile.donation_count = donor.donor_profile.donation_count === undefined
        ? donor.donor_profile.donation_history.length
        : Math.max(donor.donor_profile.donation_count + 1, donor.donor_profile.donation_history.length);
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

app.post('/api/reports', asyncRoute(async (req, res) => {
  const auth = getCurrentAuth(req);
  const target_type = req.body?.target_type;
  const target_id = cleanString(req.body?.target_id, 100);
  const reason = req.body?.reason;
  const details = optionalCleanString(req.body?.details, 1000);
  if (!auth) return res.status(401).json({ error: 'Log in to report abuse' });
  if (!isOneOf(target_type, ['REQUEST', 'COMMENT', 'USER', 'POST'] as const) || !target_id) return validationError(res, 'Valid report target is required');
  if (!isOneOf(reason, ['SPAM', 'FRAUD', 'PAYMENT_REQUEST', 'HARASSMENT', 'PRIVACY', 'OTHER'] as const)) return validationError(res, 'Valid report reason is required');
  const reportedPost = target_type === 'POST' ? await getCommunityPostById(target_id) : null;
  const targetExists = target_type === 'REQUEST'
    ? requests.some(item => item.id === target_id)
    : target_type === 'USER'
      ? users.some(item => item.id === target_id)
      : target_type === 'POST'
        ? reportedPost?.status === 'PUBLISHED'
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
}));

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

app.get('/api/admin/overview', async (req, res) => {
  const auth = requireStaffCapability(req, res, 'DASHBOARD');
  if (!auth) return;

  let pendingDirectoryClaims: number | null = null;
  if (hasCapability(auth.user, 'MODERATE_CONTENT')) {
    try {
      pendingDirectoryClaims = await Promise.race([
        countImportedDonors({ claimStatus: 'PENDING_REVIEW' }),
        new Promise<null>(resolve => {
          const timer = setTimeout(() => resolve(null), 2_000);
          timer.unref();
        })
      ]);
    } catch {
      pendingDirectoryClaims = null;
    }
  }

  let publishedCommunityPosts: number | null = null;
  let hiddenCommunityPosts: number | null = null;
  try {
    [publishedCommunityPosts, hiddenCommunityPosts] = await Promise.all([
      countCommunityPosts({ statuses: ['PUBLISHED'] }),
      countCommunityPosts({ statuses: ['HIDDEN'] })
    ]);
  } catch {
    publishedCommunityPosts = null;
    hiddenCommunityPosts = null;
  }

  res.json({
    viewer: {
      staff_role: auth.user.staff_role,
      capabilities: capabilitiesFor(auth.user.staff_role)
    },
    counts: {
      users: users.length,
      verified_users: users.filter(user => user.is_verified).length,
      suspended_users: users.filter(user => user.account_status === 'SUSPENDED').length,
      staff_users: users.filter(user => user.staff_role).length,
      registered_donors: users.filter(user => user.donor_profile).length,
      available_donors: users.filter(user =>
        user.account_status !== 'SUSPENDED' &&
        !user.deleted_at &&
        user.is_verified &&
        user.donor_profile?.availability_status === 'AVAILABLE' &&
        donorEligibility(user.donor_profile).eligible
      ).length,
      active_requests: requests.filter(request => ['ACTIVE', 'PARTIALLY_FULFILLED'].includes(request.status)).length,
      open_reports: moderationReports.filter(report => report.status === 'OPEN').length,
      open_tickets: supportTickets.filter(ticket => ticket.status !== 'CLOSED').length,
      pending_directory_claims: pendingDirectoryClaims,
      confirmed_donations: donorResponses.filter(response => response.status === 'DONATED' && response.donor_confirmed_at && response.requester_confirmed_at).length,
      pending_organizations: organizations.filter(item => item.status === 'PENDING').length,
      verified_organizations: organizations.filter(item => item.status === 'VERIFIED').length,
      published_community_posts: publishedCommunityPosts,
      hidden_community_posts: hiddenCommunityPosts
    },
    reports: hasCapability(auth.user, 'MODERATE_CONTENT')
      ? [...moderationReports].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 100)
      : [],
    tickets: hasCapability(auth.user, 'MANAGE_SUPPORT')
      ? [...supportTickets].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 100)
      : [],
    system: {
      readiness: isReady ? 'ready' : 'starting',
      environment: IS_PRODUCTION ? 'production' : 'development',
      uptime_seconds: Math.floor((Date.now() - STARTED_AT) / 1000),
      sms_configured: isSmsConfigured(),
      storage: 'lancedb',
      donation_interval_days: DONATION_INTERVAL_DAYS,
      availability_ttl_days: AVAILABILITY_TTL_DAYS,
      match_radius_km: MATCH_RADIUS_KM
    }
  });
});

app.get('/api/admin/users', (req, res) => {
  const auth = requireStaffCapability(req, res, 'VIEW_USERS');
  if (!auth) return;
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
  res.json(users.filter(user => !search || user.name.toLowerCase().includes(search) || user.phone.includes(search)).slice(0, 200).map(sanitizeUser));
});

app.patch('/api/admin/users/:id', async (req, res) => {
  const auth = requireStaffCapability(req, res, 'VIEW_USERS');
  if (!auth) return;
  const target = users.find(user => user.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const accountStatus = req.body?.account_status;
  const reason = optionalCleanString(req.body?.reason, 500);
  const suspensionReason = optionalCleanString(req.body?.suspension_reason, 500);
  const staffRoleProvided = Object.prototype.hasOwnProperty.call(req.body || {}, 'staff_role');
  const requestedStaffRole = req.body?.staff_role;
  const nextStaffRole = requestedStaffRole === null || requestedStaffRole === ''
    ? undefined
    : requestedStaffRole;

  if (accountStatus !== undefined && !isOneOf(accountStatus, ['ACTIVE', 'SUSPENDED'] as const)) {
    return validationError(res, 'Valid account status is required');
  }
  if (req.body?.reason !== undefined && !reason) return validationError(res, 'Valid reason is required');
  if (req.body?.suspension_reason !== undefined && !suspensionReason) return validationError(res, 'Valid suspension reason is required');
  if (staffRoleProvided && nextStaffRole !== undefined && !isStaffRole(nextStaffRole)) {
    return validationError(res, 'Valid staff role is required');
  }

  const currentStatus = target.account_status || 'ACTIVE';
  const statusChanged = accountStatus !== undefined && accountStatus !== currentStatus;
  const suspensionReasonChanged = req.body?.suspension_reason !== undefined && suspensionReason !== target.suspension_reason;
  const staffRoleChanged = staffRoleProvided && nextStaffRole !== target.staff_role;
  if (!statusChanged && !suspensionReasonChanged && !staffRoleChanged) {
    return res.json(sanitizeUser(target));
  }

  if (statusChanged && !canManageMember(auth.user, target)) {
    return res.status(403).json({ error: 'You cannot change this account status' });
  }
  if (suspensionReasonChanged && !canManageMember(auth.user, target) && !canEditMember(auth.user, target)) {
    return res.status(403).json({ error: 'You cannot edit this member' });
  }

  const activeSuperadmins = users.filter(user =>
    user.staff_role === 'SUPERADMIN' && user.account_status !== 'SUSPENDED' && !user.deleted_at
  ).length;
  if (
    staffRoleChanged &&
    target.staff_role === 'SUPERADMIN' &&
    nextStaffRole !== 'SUPERADMIN' &&
    activeSuperadmins <= 1
  ) {
    return res.status(409).json({ error: 'The last active superadmin cannot be demoted' });
  }
  if (staffRoleChanged && !canAssignStaffRole(auth.user, target, nextStaffRole, activeSuperadmins)) {
    return res.status(403).json({ error: 'You cannot assign this staff role' });
  }
  if (
    statusChanged &&
    accountStatus === 'SUSPENDED' &&
    target.staff_role === 'SUPERADMIN' &&
    activeSuperadmins <= 1
  ) {
    return res.status(409).json({ error: 'The last active superadmin cannot be suspended' });
  }
  if ((statusChanged || staffRoleChanged || suspensionReasonChanged) && !reason) {
    return validationError(res, 'A reason is required for account and staff changes');
  }

  const resultingStatus = accountStatus || currentStatus;
  if (suspensionReasonChanged && resultingStatus !== 'SUSPENDED') {
    return validationError(res, 'Suspension reason is only valid for a suspended account');
  }

  const before = adminUserAuditSnapshot(target);
  const now = new Date().toISOString();
  let revokedSessions = 0;

  if (accountStatus !== undefined) {
    target.account_status = accountStatus;
    if (accountStatus === 'SUSPENDED') {
      target.suspension_reason = suspensionReason || reason || target.suspension_reason;
      target.suspended_at = statusChanged ? now : target.suspended_at;
      target.suspended_by = auth.user.id;
    } else {
      target.suspension_reason = undefined;
      target.suspended_at = undefined;
      target.suspended_by = undefined;
    }
  } else if (suspensionReasonChanged) {
    target.suspension_reason = suspensionReason;
  }
  if (staffRoleChanged) target.staff_role = nextStaffRole;

  await saveToTable('common_users', target);
  if (statusChanged && target.account_status === 'SUSPENDED') {
    for (const session of sessions.filter(item => item.user_id === target.id && !item.revoked_at)) {
      session.revoked_at = now;
      await saveToTable('common_sessions', session);
      revokedSessions += 1;
    }
    await removeDonorFromAllPartitions(target.id);
  }

  await audit(auth.user.id, 'USER_ADMIN_UPDATED', 'USER', target.id, {
    reason,
    before,
    after: adminUserAuditSnapshot(target),
    revoked_sessions: revokedSessions
  });
  res.json(sanitizeUser(target));
});

app.post('/api/admin/users/:id/revoke-sessions', async (req, res) => {
  const auth = requireStaffCapability(req, res, 'REVOKE_SESSIONS');
  if (!auth) return;
  const target = users.find(user => user.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (!canEditMember(auth.user, target)) {
    return res.status(403).json({ error: 'You cannot revoke sessions for this member' });
  }
  const reason = cleanString(req.body?.reason, 500);
  if (!reason) return validationError(res, 'A reason is required to revoke sessions');

  const now = new Date().toISOString();
  let revokedSessions = 0;
  for (const session of sessions.filter(item => item.user_id === target.id && !item.revoked_at)) {
    session.revoked_at = now;
    await saveToTable('common_sessions', session);
    revokedSessions += 1;
  }
  await audit(auth.user.id, 'USER_SESSIONS_REVOKED', 'USER', target.id, {
    reason,
    revoked_sessions: revokedSessions
  });
  res.json({ success: true, revoked_sessions: revokedSessions });
});

app.get('/api/admin/requests', (req, res) => {
  const auth = requireStaffCapability(req, res, 'MODERATE_CONTENT');
  if (!auth) return;
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  res.json(requests.filter(request => !status || request.status === status).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 200));
});

app.patch('/api/admin/requests/:id', async (req, res) => {
  const auth = requireStaffCapability(req, res, 'MODERATE_CONTENT');
  if (!auth) return;
  const request = requests.find(item => item.id === req.params.id);
  const status = req.body?.status;
  const note = optionalCleanString(req.body?.note, 500);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (!isOneOf(status, ['ACTIVE', 'REJECTED', 'CANCELLED'] as const)) return validationError(res, 'Valid moderation status is required');
  request.status = status;
  request.timeline = [...(request.timeline || []), { id: uuidv4(), type: `MODERATION_${status}`, actor_id: auth.user.id, created_at: new Date().toISOString(), note }];
  await saveToTable('common_requests', request, [request.location.lng, request.location.lat]);
  await audit(auth.user.id, 'REQUEST_MODERATED', 'REQUEST', request.id, { status, note });
  await notify(request.user_id, 'REQUEST_MODERATION', `Request ${status.toLowerCase()}`, note || 'An operator reviewed your request.', `/request/${request.id}`);
  res.json(request);
});

app.get('/api/admin/community', asyncRoute(async (req, res) => {
  const auth = requireStaffCapability(req, res, 'MODERATE_CONTENT');
  if (!auth) return;
  const rawStatus = req.query.status;
  const status = rawStatus === undefined || rawStatus === ''
    ? undefined
    : isOneOf(rawStatus, COMMUNITY_POST_STATUSES)
      ? rawStatus
      : null;
  const rawType = req.query.type;
  const type = rawType === undefined || rawType === ''
    ? undefined
    : isOneOf(rawType, COMMUNITY_POST_TYPES)
      ? rawType
      : null;
  if (status === null || type === null) return validationError(res, 'Valid community filters are required');
  const posts = await queryCommunityPosts({
    ...(status ? { statuses: [status] } : {}),
    ...(type ? { type } : {}),
    limit: 100
  });
  res.json(posts.map(adminCommunityPost));
}));

app.get('/api/admin/community/:id', asyncRoute(async (req, res) => {
  const auth = requireStaffCapability(req, res, 'MODERATE_CONTENT');
  if (!auth) return;
  const post = await getCommunityPostById(req.params.id);
  if (!post || post.status === 'DELETED') return res.status(404).json({ error: 'Community post not found' });
  res.json(adminCommunityPost(post));
}));

app.patch('/api/admin/community/:id', asyncRoute(async (req, res) => {
  const auth = requireStaffCapability(req, res, 'MODERATE_CONTENT');
  if (!auth) return;
  const post = await getCommunityPostById(req.params.id);
  const status = req.body?.status;
  const reason = cleanString(req.body?.reason, 1_000);
  if (!post || post.status === 'DELETED') return res.status(404).json({ error: 'Community post not found' });
  if (!isOneOf(status, ['HIDDEN', 'PUBLISHED'] as const)) return validationError(res, 'Choose hide or restore');
  if (!reason) return validationError(res, 'A moderation reason is required');
  if (status === 'HIDDEN' && post.status !== 'PUBLISHED') {
    return res.status(409).json({ error: 'Only a published post can be hidden' });
  }
  if (status === 'PUBLISHED' && post.status !== 'HIDDEN') {
    return res.status(409).json({ error: 'Only a hidden post can be restored' });
  }
  const now = new Date().toISOString();
  const updated = await saveCommunityPost({
    ...post,
    status,
    moderated_by: auth.user.id,
    moderated_at: now,
    moderation_reason: reason,
    updated_at: now
  });
  invalidateCommunitySitemap();
  await audit(auth.user.id, `COMMUNITY_POST_${status}`, 'POST', post.id, { reason });
  await notify(
    post.author_id,
    'COMMUNITY_MODERATION',
    status === 'HIDDEN' ? 'Community post hidden' : 'Community post restored',
    reason,
    post.slug ? `/community/${post.slug}` : '/community'
  );
  res.json(adminCommunityPost(updated));
}));

app.get('/api/admin/reports', (req, res) => {
  const auth = requireStaffCapability(req, res, 'MODERATE_CONTENT');
  if (!auth) return;
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  res.json(moderationReports
    .filter(report => !status || report.status === status)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 200));
});

app.patch('/api/admin/reports/:id', async (req, res) => {
  const auth = requireStaffCapability(req, res, 'MODERATE_CONTENT');
  if (!auth) return;
  const report = moderationReports.find(item => item.id === req.params.id);
  const status = req.body?.status;
  const note = optionalCleanString(req.body?.resolution_note, 1000);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  if (!isOneOf(status, ['REVIEWING', 'RESOLVED', 'DISMISSED'] as const)) return validationError(res, 'Valid report status is required');
  report.status = status; report.assigned_to = auth.user.id; report.resolution_note = note; report.updated_at = new Date().toISOString();
  await saveToTable('common_reports', report);
  await audit(auth.user.id, 'REPORT_UPDATED', 'REPORT', report.id, { status, note });
  res.json(report);
});

app.get('/api/admin/tickets', (req, res) => {
  const auth = requireStaffCapability(req, res, 'MANAGE_SUPPORT');
  if (!auth) return;
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  res.json(supportTickets
    .filter(ticket => !status || ticket.status === status)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 200));
});

app.patch('/api/admin/tickets/:id', async (req, res) => {
  const auth = requireStaffCapability(req, res, 'MANAGE_SUPPORT');
  if (!auth) return;
  const ticket = supportTickets.find(item => item.id === req.params.id);
  const status = req.body?.status;
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (!isOneOf(status, ['OPEN', 'IN_PROGRESS', 'CLOSED'] as const)) return validationError(res, 'Valid ticket status is required');
  ticket.status = status; ticket.owner_id = auth.user.id; ticket.updated_at = new Date().toISOString();
  await saveToTable('common_support_tickets', ticket);
  await audit(auth.user.id, 'SUPPORT_TICKET_UPDATED', 'SUPPORT_TICKET', ticket.id, { status });
  res.json(ticket);
});

/**
 * The full reveal and call-outcome trail. It lives here rather than in the
 * audit log because it is far too high-volume for a table that is loaded into
 * memory at boot; `common_call_reports` is queried on demand instead.
 */
app.get('/api/admin/call-reports', async (req, res) => {
  const auth = requireStaffCapability(req, res, 'MODERATE_CONTENT');
  if (!auth) return;
  const requestId = optionalCleanString(req.query.request_id, 80);
  const donorRef = optionalCleanString(req.query.donor_ref, 120);
  const kind = optionalCleanString(req.query.kind, 20);
  try {
    const reports = await queryCallReports<CallReport>({
      requestId: requestId || undefined,
      donorRef: donorRef || undefined,
      kind: kind || undefined,
      limit: 500
    });
    res.json({
      items: reports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    });
  } catch {
    res.status(503).json({ error: 'Call reports are temporarily unavailable' });
  }
});

app.get('/api/admin/audit', (req, res) => {
  const auth = requireStaffCapability(req, res, 'VIEW_AUDIT');
  if (!auth) return;
  res.json([...auditEvents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 500));
});

app.get('/api/organizations', (_req, res) => {
  res.json(organizations.filter(item => item.status === 'VERIFIED').map(item => ({
    id: item.id, name: item.name, type: item.type, district: item.district, address: item.address,
    phone: item.phone, website: item.website,
    campaigns: (item.campaigns || []).filter(campaign => campaign.status === 'PUBLISHED' && new Date(campaign.ends_at).getTime() >= Date.now())
  })));
});

app.post('/api/organizations', async (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth || !auth.user.is_verified) return res.status(403).json({ error: 'Verified account required' });
  if (organizations.some(item => item.owner_id === auth.user.id && ['PENDING', 'VERIFIED'].includes(item.status))) return res.status(409).json({ error: 'You already have an active organization application' });
  const name = cleanString(req.body?.name, 160);
  const type = req.body?.type;
  const district = cleanString(req.body?.district, 100);
  const address = cleanString(req.body?.address, 300);
  const phone = normalizeBangladeshPhone(req.body?.phone);
  const website = optionalCleanString(req.body?.website, 300) || undefined;
  const registration_reference = cleanString(req.body?.registration_reference, 160);
  if (!name || !district || !address || !phone || !registration_reference || !isOneOf(type, ['HOSPITAL', 'BLOOD_BANK', 'NGO'] as const)) return validationError(res, 'Complete valid organization details are required');
  const now = new Date().toISOString();
  const organization: Organization = { id: uuidv4(), owner_id: auth.user.id, name, type, district, address, phone, website, registration_reference, status: 'PENDING', created_at: now, updated_at: now, campaigns: [] };
  organizations.push(organization); await saveToTable('common_organizations', organization);
  await audit(auth.user.id, 'ORGANIZATION_APPLIED', 'ORGANIZATION', organization.id);
  res.status(201).json(organization);
});

app.get('/api/admin/organizations', (req, res) => {
  const auth = requireStaffCapability(req, res, 'MANAGE_ORGANIZATIONS');
  if (!auth) return;
  res.json(organizations);
});

app.patch('/api/admin/organizations/:id', async (req, res) => {
  const auth = requireStaffCapability(req, res, 'MANAGE_ORGANIZATIONS');
  if (!auth) return;
  const organization = organizations.find(item => item.id === req.params.id);
  const status = req.body?.status;
  if (!organization) return res.status(404).json({ error: 'Organization not found' });
  if (!isOneOf(status, ['VERIFIED', 'REJECTED', 'SUSPENDED'] as const)) return validationError(res, 'Valid organization status required');
  organization.status = status; organization.verification_note = optionalCleanString(req.body?.note, 500) || undefined; organization.updated_at = new Date().toISOString();
  await saveToTable('common_organizations', organization);
  const owner = users.find(item => item.id === organization.owner_id);
  if (owner) {
    const roles = new Set(owner.roles || ['MEMBER']);
    if (status === 'VERIFIED') roles.add('ORGANIZATION_OPERATOR'); else roles.delete('ORGANIZATION_OPERATOR');
    owner.roles = [...roles]; await saveToTable('common_users', owner);
    await notify(owner.id, 'ORGANIZATION_REVIEWED', `Organization ${status.toLowerCase()}`, organization.verification_note || `${organization.name} was reviewed.`, '/partners');
  }
  await audit(auth.user.id, 'ORGANIZATION_REVIEWED', 'ORGANIZATION', organization.id, { status });
  res.json(organization);
});

app.post('/api/organizations/:id/campaigns', async (req, res) => {
  const auth = getCurrentAuth(req);
  const organization = organizations.find(item => item.id === req.params.id && item.status === 'VERIFIED');
  if (!auth || !organization || (organization.owner_id !== auth.user.id && !hasCapability(auth.user, 'MANAGE_ORGANIZATIONS'))) return res.status(403).json({ error: 'Verified organization operator required' });
  const title = cleanString(req.body?.title, 160); const location = cleanString(req.body?.location, 200);
  const starts_at = req.body?.starts_at; const ends_at = req.body?.ends_at;
  if (!title || !location || !starts_at || !ends_at || new Date(ends_at).getTime() <= new Date(starts_at).getTime()) return validationError(res, 'Valid campaign details and date range are required');
  const campaign = { id: uuidv4(), title, location, starts_at: new Date(starts_at).toISOString(), ends_at: new Date(ends_at).toISOString(), status: 'PUBLISHED' as const };
  organization.campaigns = [...(organization.campaigns || []), campaign]; organization.updated_at = new Date().toISOString();
  await saveToTable('common_organizations', organization); await audit(auth.user.id, 'CAMPAIGN_PUBLISHED', 'ORGANIZATION', organization.id, { campaign_id: campaign.id });
  res.status(201).json(campaign);
});

// --- Imported donor directory -------------------------------------------
//
// Profiles imported from other organisations' public donor listings. These
// people never registered here, so the directory is intentionally weaker than
// the live donor index: contact numbers are always masked, entries are never
// matched to requests automatically, and a record only becomes a usable donor
// profile once its owner claims it.

const DIRECTORY_PAGE_SIZE = 24;

async function loadImportedDonor(id: string): Promise<ImportedDonor | null> {
  const value = cleanString(id, 200);
  return value ? await getImportedDonor(value) : null;
}

app.get('/api/directory', async (req, res) => {
  const group = typeof req.query.blood_group === 'string' && BLOOD_GROUPS.includes(req.query.blood_group as BloodGroup)
    ? req.query.blood_group
    : '';
  const district = cleanString(req.query.district, 100) || '';
  const sourceId = cleanString(req.query.source, 60) || '';
  const search = cleanString(req.query.q, 60) || '';
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  // Only unclaimed rows are browsable: once a profile is claimed its owner
  // shows up in the real donor index instead.
  const query = {
    bloodGroups: group ? [group] : undefined,
    district: district || undefined,
    sourceId: sourceId || undefined,
    claimStatus: 'UNCLAIMED',
    search: search || undefined,
    limit: DIRECTORY_PAGE_SIZE,
    offset: (page - 1) * DIRECTORY_PAGE_SIZE
  };

  try {
    const [donors, total] = await Promise.all([queryImportedDonors(query), countImportedDonors(query)]);
    res.json({
      donors: donors.map(toPublicImportedDonor),
      total,
      page,
      page_size: DIRECTORY_PAGE_SIZE
    });
  } catch {
    res.status(503).json({ error: 'Directory is unavailable' });
  }
});

// Attribution for every listing that has been imported, so a donor can see
// where their details were published and go back to the original.
app.get('/api/directory/sources', async (_req, res) => {
  try {
    const summaries = await Promise.all(IMPORT_SOURCES.map(async source => ({
      ...source,
      total: await countImportedDonors({ sourceId: source.id }),
      unclaimed: await countImportedDonors({ sourceId: source.id, claimStatus: 'UNCLAIMED' })
    })));
    res.json({ sources: summaries.filter(source => source.total > 0) });
  } catch {
    res.status(503).json({ error: 'Directory is unavailable' });
  }
});

app.get('/api/directory/:id', async (req, res) => {
  const donor = await loadImportedDonor(req.params.id);
  if (!donor) return res.status(404).json({ error: 'Profile not found' });
  if (donor.claim_status !== 'UNCLAIMED') {
    const auth = getCurrentAuth(req);
    const canViewClaim = Boolean(auth && (donor.claimed_by === auth.user.id || isOperator(auth.user)));
    if (!canViewClaim) return res.status(404).json({ error: 'Profile not found' });
  }
  res.json(toPublicImportedDonor(donor));
});

// Claiming turns an imported stub into the caller's own donor profile. It is
// auto-approved only when the caller's verified phone is the number the source
// published; anything else waits for a moderator, because nothing else in the
// imported data proves ownership.
app.post('/api/directory/:id/claim', async (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  if (!auth.user.phone_verified_at) return res.status(403).json({ error: 'Verify your phone number before claiming a profile' });

  const donor = await loadImportedDonor(req.params.id);
  if (!donor) return res.status(404).json({ error: 'Profile not found' });

  const name = optionalCleanString(req.body?.name, 100);
  if (name === null) return validationError(res, 'Valid name is required');
  const blood_group = req.body?.blood_group;
  if (blood_group !== undefined && !isOneOf(blood_group, BLOOD_GROUPS)) return validationError(res, 'Valid blood group is required');
  const location = req.body?.location === undefined ? undefined : parseLocation(req.body.location);
  if (req.body?.location !== undefined && !location) return validationError(res, 'Valid location is required');

  const decision = evaluateClaim(
    donor,
    { name, blood_group, district: location?.area_name },
    auth.user.phone
  );
  if ('error' in decision) return validationError(res, decision.error);

  // A district with no coordinates cannot be turned into a donor profile, so
  // the claim form has to send a resolved location for those records.
  const resolvedLocation = location || donor.location;
  if (!resolvedLocation) return validationError(res, 'Valid location is required');

  donor.claim_status = decision.status;
  donor.claimed_by = auth.user.id;
  donor.claimed_at = new Date().toISOString();
  donor.claim_note = decision.reason;
  donor.name = decision.resolved.name;
  donor.blood_group = decision.resolved.blood_group;
  donor.district = resolvedLocation.area_name;
  donor.location = resolvedLocation;
  await replaceImportedDonor(toImportedDonorRow(donor));

  if (decision.status === 'CLAIMED') {
    await applyClaimToProfile(auth.user, decision.resolved.blood_group, resolvedLocation);
  }

  await audit(auth.user.id, decision.status === 'CLAIMED' ? 'DIRECTORY_CLAIM_APPROVED' : 'DIRECTORY_CLAIM_SUBMITTED', 'IMPORTED_DONOR', donor.id, {
    source_id: donor.source.id,
    reason: decision.reason
  });

  res.json({ status: decision.status, reason: decision.reason, donor: toPublicImportedDonor(donor) });
});

/**
 * Writes a claimed record onto the user's donor profile. Availability is left
 * off deliberately: being listed by another organisation is not consent to be
 * called by this one, so the donor has to opt in themselves.
 */
async function applyClaimToProfile(user: User, bloodGroup: string, location: { lat: number; lng: number; area_name: string }) {
  const existing = user.donor_profile;
  user.donor_profile = {
    ...existing,
    blood_group: bloodGroup,
    location,
    availability_status: existing?.availability_status || 'NOT_AVAILABLE',
    deferral_status: existing?.deferral_status || 'NONE',
    availability_history: existing?.availability_history || [{ status: 'NOT_AVAILABLE', changed_at: new Date().toISOString() }]
  };
  await saveToTable('common_users', user);
  if (user.donor_profile.availability_status === 'AVAILABLE') {
    await syncDonorToPartition(user);
  }
}

// Claims that could not be verified automatically wait here for staff.
app.get('/api/admin/directory/claims', async (req, res) => {
  const auth = requireStaffCapability(req, res, 'MODERATE_CONTENT');
  if (!auth) return;
  try {
    const donors: ImportedDonor[] = await queryImportedDonors({ claimStatus: 'PENDING_REVIEW', limit: 100 });
    res.json({
      claims: donors.map(donor => ({
        ...toPublicImportedDonor(donor),
        claimed_by: donor.claimed_by,
        claimed_at: donor.claimed_at,
        claim_note: donor.claim_note,
        claimant: (() => {
          const claimant = users.find(item => item.id === donor.claimed_by);
          return claimant ? { id: claimant.id, name: claimant.name, phone: claimant.phone } : null;
        })()
      }))
    });
  } catch {
    res.status(503).json({ error: 'Directory is unavailable' });
  }
});

app.patch('/api/admin/directory/claims/:id', async (req, res) => {
  const auth = requireStaffCapability(req, res, 'MODERATE_CONTENT');
  if (!auth) return;
  const approve = req.body?.approve === true;

  const donor = await loadImportedDonor(req.params.id);
  if (!donor || donor.claim_status !== 'PENDING_REVIEW') return res.status(404).json({ error: 'Claim not found' });

  const claimant = users.find(item => item.id === donor.claimed_by);
  if (approve && !claimant) return validationError(res, 'Claimant account no longer exists');

  if (approve) {
    donor.claim_status = 'CLAIMED';
    if (donor.location) await applyClaimToProfile(claimant!, donor.blood_group, donor.location);
    await notify(claimant!.id, 'DIRECTORY_CLAIM', 'Profile claim approved', 'Your imported donor profile is now yours.', '/profile');
  } else {
    // Rejecting releases the record so someone else can claim it.
    donor.claim_status = 'UNCLAIMED';
    if (claimant) await notify(claimant.id, 'DIRECTORY_CLAIM', 'Profile claim declined', 'We could not verify your claim on that imported profile.', '/directory');
    donor.claimed_by = undefined;
    donor.claimed_at = undefined;
  }
  donor.claim_note = cleanString(req.body?.note, 200) || donor.claim_note;
  await replaceImportedDonor(toImportedDonorRow(donor));
  await audit(auth.user.id, approve ? 'DIRECTORY_CLAIM_APPROVED' : 'DIRECTORY_CLAIM_REJECTED', 'IMPORTED_DONOR', donor.id);

  res.json({ status: donor.claim_status });
});

// Public network stats for the landing page.
//
// `donors` is the headline: everyone findable here, which is the registered
// members with a donor profile plus the unclaimed imported listings. Claimed
// listings are excluded because their owner is already counted as registered.
// A directory read failure leaves the headline null rather than reporting the
// registered count alone, which would understate the network by six figures.
app.get('/api/stats', async (req, res) => {
  await enforceExpiredRequests();
  const registeredDonors = users.filter(u => u.donor_profile).length;
  let directoryDonors: number | null = null;
  try {
    directoryDonors = await countImportedDonors({ claimStatus: 'UNCLAIMED' });
  } catch {
    directoryDonors = null;
  }
  res.json({
    donors: directoryDonors === null ? null : registeredDonors + directoryDonors,
    directory_donors: directoryDonors,
    registered_donors: registeredDonors,
    available_donors: users.filter(u => u.donor_profile?.availability_status === 'AVAILABLE').length,
    active_requests: requests.filter(r => r.status === 'ACTIVE' || r.status === 'PARTIALLY_FULFILLED').length,
    fulfilled_requests: requests.filter(r => r.status === 'FULFILLED').length
  });
});

app.get('/api/requests', async (req, res) => {
  await enforceExpiredRequests();
  const group = typeof req.query.blood_group === 'string' && BLOOD_GROUPS.includes(req.query.blood_group as BloodGroup) ? req.query.blood_group : '';
  const district = cleanString(req.query.district, 100) || '';
  const urgentOnly = req.query.urgent === 'true';
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  const limit = Math.min(50, Math.max(1, Math.floor(Number(req.query.limit) || 20)));
  const sortedRequests = requests
    .filter(r => r.status === 'ACTIVE' || r.status === 'PARTIALLY_FULFILLED')
    .filter(r => !group || r.blood_group === group)
    .filter(r => !district || r.location.area_name === district)
    .filter(r => !urgentOnly || !r.needed_by || new Date(r.needed_by).getTime() - Date.now() <= 72 * 3_600_000)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const total = sortedRequests.length;
  const items = sortedRequests.slice((page - 1) * limit, page * limit).map(publicRequestPayload);
  res.json({ items, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
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

// Keep unknown server namespaces from falling through to the production SPA
// shell, where callers would otherwise receive a misleading 200 HTML response.
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));
app.use('/media', (_req, res) => res.status(404).end());

async function startServer() {
  await initDbData();
  await enforceExpiredRequests();
  await enforceStaleAvailability();
  // Prepare the imported directory before reporting ready. It is otherwise
  // prepared lazily on first access, and after a schema change that means the
  // first donor search blocks behind a full-table migration while /ready has
  // already said the instance is good to serve. Failing here is survivable -
  // the directory only supplements registered donors - so readiness is not
  // held hostage to it.
  try {
    await ensureImportedDonorTable();
  } catch (error) {
    console.error('imported_donors: preparation failed, directory results will be unavailable', error);
  }
  isReady = true;
  const maintenanceTimer = setInterval(() => {
    void enforceExpiredRequests();
    void enforceStaleAvailability();
  }, 5 * 60_000);
  maintenanceTimer.unref();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const indexTemplate = await readFile(path.join(distPath, 'index.html'), 'utf8');
    app.use(express.static(distPath, { index: false }));
    app.get('/community/:slug', async (req, res, next) => {
      if (req.params.slug === 'new') {
        res.set('X-Robots-Tag', 'noindex, nofollow');
        return res.type('html').send(renderPublicOriginHtml(indexTemplate, publicOrigin(req)));
      }
      try {
        const post = await getPublishedCommunityPostBySlug(req.params.slug);
        if (!post || !post.slug || !post.published_at) {
          return res.status(404).type('html').send('Community post not found');
        }
        const publicPost = publicCommunityDetail(post);
        const html = renderCommunityPostHtml(indexTemplate, {
          slug: post.slug,
          type: post.type,
          title: post.title,
          excerpt: post.excerpt,
          body_text: markdownToPlainExcerpt(post.body_markdown, 12_000),
          author_name: publicPost.author.name,
          published_at: post.published_at,
          updated_at: post.updated_at,
          ...(post.image_key ? {
            image_url: communityImageUrl(post.image_key),
            image_alt: post.image_alt || post.title
          } : {})
        }, publicOrigin(req));
        res.set('Cache-Control', 'public, max-age=60, must-revalidate');
        return res.type('html').send(html);
      } catch (error) {
        next(error);
      }
    });
    app.get('*', (req, res, next) => {
      if (path.extname(req.path)) return next();
      res.type('html').send(renderPublicOriginHtml(indexTemplate, publicOrigin(req)));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
