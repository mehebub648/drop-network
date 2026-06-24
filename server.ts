import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { syncDonorToPartition, getAllFromTable, saveToTable, getPartitionName, getDb, removeDonorFromAllPartitions } from './db';

const app = express();
const configuredPort = Number(process.env.PORT || process.env.PROD_PORT || 3000);
const PORT = Number.isFinite(configuredPort) ? configuredPort : 3000;
const DEFAULT_REQUEST_TTL_MS = 24 * 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
const REQUEST_STATUSES = ['ACTIVE', 'FULFILLED', 'CANCELLED'] as const;
const AVAILABILITY_STATUSES = ['AVAILABLE', 'SICK', 'TRAVELING', 'NOT_AVAILABLE'] as const;
const CONTACT_TYPES = ['PATIENT', 'RELATIVE', 'HOSPITAL', 'OTHER'] as const;
const allowedCorsOrigins = new Set(
  (process.env.CORS_ORIGIN || process.env.APP_URL || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin && origin !== 'MY_APP_URL')
);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedCorsOrigins.size === 0) {
      return callback(null, process.env.NODE_ENV !== 'production');
    }
    return callback(null, allowedCorsOrigins.has(origin));
  }
}));
app.use(express.json({ limit: '32kb' }));

// IN-MEMORY DATABASE MOCK
type DonationRecord = {
  id: string;
  date: string;
  organization: string;
};

type DonorProfile = {
  blood_group: string;
  last_donation_date: string;
  location: { lat: number, lng: number, area_name: string };
  availability_status: 'AVAILABLE' | 'SICK' | 'TRAVELING' | 'NOT_AVAILABLE';
  donation_history?: DonationRecord[];
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
  status: 'ACTIVE' | 'FULFILLED' | 'CANCELLED';
  patient_name?: string;
  requester_name?: string;
  needed_by?: string;
  contacts?: ContactDetail[];
  comments?: Comment[];
};

type OtpEntry = {
  code: string;
  expires_at: number;
};

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

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

function parseDate(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
    const phone = cleanString(item.phone, 30);
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

async function initDbData() {
  users = await getAllFromTable('common_users');
  requests = await getAllFromTable('common_requests');
  sessions = await getAllFromTable('common_sessions');
  await enforceExpiredRequests();
}

async function enforceExpiredRequests() {
  const now = Date.now();
  const expiredRequests = requests.filter(r =>
    r.status === 'ACTIVE' &&
    r.expires_at &&
    new Date(r.expires_at).getTime() <= now
  );

  for (const request of expiredRequests) {
    request.status = 'CANCELLED';
    await saveToTable('common_requests', request, [request.location.lng, request.location.lat]);
  }
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

function getBearerToken(req: express.Request) {
  const token = req.headers.authorization?.split(' ')[1];
  return token && token !== 'undefined' && token !== 'anonymous' ? token : '';
}

function getFingerprint(req: express.Request) {
  return cleanString(req.headers['x-fingerprint'], 120) || '';
}

function getCurrentAuth(req: express.Request) {
  const token = getBearerToken(req);
  if (!token) return null;

  const now = Date.now();
  const session = sessions.find(s =>
    s.token === token &&
    !s.revoked_at &&
    new Date(s.expires_at).getTime() > now
  );
  if (!session) return null;

  const user = users.find(u => u.id === session.user_id);
  return user ? { user, session } : null;
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
  const { contacts, comments, ...safeRequest } = request;
  return {
    ...safeRequest,
    requester_name: request.requester_name || requester?.name || 'Anonymous',
    comment_count: comments?.length || 0
  };
}

// API Routes

// Mock OTP Store
const otpStore: Record<string, OtpEntry> = {};

app.post('/api/auth/send-otp', (req, res) => {
  const phone = cleanString(req.body?.phone, 30);
  if (!phone) return validationError(res, 'Valid phone number is required');
  
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  otpStore[phone] = {
    code: otp,
    expires_at: Date.now() + OTP_TTL_MS
  };
  
  res.json({
    success: true,
    message: 'OTP generated successfully',
    ...(process.env.NODE_ENV !== 'production' ? { dev_otp: otp } : {})
  });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const phone = cleanString(req.body?.phone, 30);
  const otp = cleanString(req.body?.otp, 6);
  if (!phone || !otp) return validationError(res, 'Phone and OTP are required');

  const storedOtp = otpStore[phone];
  if (storedOtp && storedOtp.code === otp && storedOtp.expires_at > Date.now()) {
    delete otpStore[phone];
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid OTP code' });
  }
});

// Mock login
app.post('/api/auth/login', async (req, res) => {
  const phone = cleanString(req.body?.phone, 30);
  const password = cleanString(req.body?.password, 128);
  const fingerprint = optionalCleanString(req.body?.fingerprint, 120);
  if (!phone || !password) return validationError(res, 'Phone and password are required');

  let user = users.find(u => u.phone === phone);
  
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
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
  res.json({ token, user });
});

app.post('/api/auth/register', async (req, res) => {
  const phone = cleanString(req.body?.phone, 30);
  const name = cleanString(req.body?.name, 100);
  const password = cleanString(req.body?.password, 128);
  const fingerprint = optionalCleanString(req.body?.fingerprint, 120);
  const blood_group = req.body?.blood_group;
  const location = req.body?.location === undefined ? undefined : parseLocation(req.body.location);

  if (!phone || !name || !password) return validationError(res, 'Phone, name, and password are required');
  if (password.length < 6) return validationError(res, 'Password must be at least 6 characters');
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
    password,
    is_verified: true,
  };

  if (blood_group && location) {
    user.donor_profile = {
      blood_group,
      location,
      last_donation_date: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      availability_status: 'AVAILABLE'
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
  res.json({ token, user });
});

app.post('/api/auth/logout', async (req, res) => {
  await revokeSession(req);
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  const auth = getCurrentAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  res.json(auth.user);
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

  if (!isOneOf(blood_group, BLOOD_GROUPS)) return validationError(res, 'Valid blood group is required');
  if (!isOneOf(availability_status, AVAILABILITY_STATUSES)) return validationError(res, 'Valid availability status is required');
  if (!location) return validationError(res, 'Valid location is required');
  if (!last_donation_date) return validationError(res, 'Valid last donation date is required');
  if (donation_history === null) return validationError(res, 'Valid donation history is required');

  const userIndex = users.findIndex(u => u.id === auth.user.id);
  if (userIndex !== -1) {
    users[userIndex].donor_profile = {
      ...users[userIndex].donor_profile,
      blood_group,
      availability_status,
      location,
      last_donation_date,
      donation_history: donation_history || users[userIndex].donor_profile?.donation_history || []
    };
    await saveToTable('common_users', users[userIndex]);
    await removeDonorFromAllPartitions(users[userIndex].id);
    if (users[userIndex].donor_profile?.availability_status === 'AVAILABLE') {
      await syncDonorToPartition(users[userIndex]);
    }
    res.json(users[userIndex]);
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// Create search request and return matches
app.post('/api/requests', async (req, res) => {
  const auth = getCurrentAuth(req);
  const fingerprint = getFingerprint(req);
  const user_id = auth?.user.id || fingerprint || 'anonymous';

  const blood_group = req.body?.blood_group;
  const location = parseLocation(req.body?.location);
  const needed_by = parseDate(req.body?.needed_by);

  if (!isOneOf(blood_group, BLOOD_GROUPS)) return validationError(res, 'Valid blood group is required');
  if (!location) return validationError(res, 'Valid location is required');
  if (needed_by === null) return validationError(res, 'Valid needed-by date is required');
  
  const newRequest: BloodRequest = {
    id: uuidv4(),
    user_id: user_id || 'anonymous',
    blood_group,
    location,
    needed_by,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + DEFAULT_REQUEST_TTL_MS).toISOString(),
    status: 'ACTIVE',
    contacts: [],
    comments: []
  };
  
  requests.push(newRequest);
  await saveToTable('common_requests', newRequest, [location.lng, location.lat]);
  
  // Find matching donors from specific District x Group partition
  let dbMatches: any[] = [];
  try {
    const pName = await getPartitionName(location.area_name, blood_group);
    const db = await getDb();
    const tables = await db.tableNames();
    if (tables.includes(pName)) {
      const table = await db.openTable(pName);
      // @ts-ignore
      const results = await table.search([location.lng, location.lat]).limit(50).toArray();
      dbMatches = results.map(r => JSON.parse(r.doc));
    }
  } catch(e) {
    console.error('LanceDB search error:', e);
  }

  // Filter out self and unavailable, map to UI schema
  const matches = dbMatches
    .filter(u => u.id !== user_id)
    .filter(u => u.donor_profile!.availability_status === 'AVAILABLE')
    .map(u => {
      const dist = getDistance(
        location.lat, location.lng,
        u.donor_profile!.location.lat, u.donor_profile!.location.lng
      );
      return {
        user_id: u.id,
        name: u.name,
        phone: u.phone,
        blood_group: u.donor_profile!.blood_group,
        distance_km: Math.round(dist * 10) / 10,
        availability_status: u.donor_profile!.availability_status,
        last_donation_date: u.donor_profile!.last_donation_date
      };
    })
    .sort((a, b) => a.distance_km - b.distance_km);

  // Return matches to create the illusion of search
  res.json({
    request: newRequest,
    matches
  });
});

app.get('/api/requests', async (req, res) => {
  await enforceExpiredRequests();
  const sortedRequests = requests
    .filter(r => r.status === 'ACTIVE')
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
  const enrichedRequest = {
    ...request,
    requester_name: request.requester_name || requester?.name || 'Anonymous',
    ...(requestOwner ? { requester_phone: requester?.phone || '+8800000000' } : {})
  };

  // Find matches from partition
  let dbMatches: any[] = [];
  try {
    const pName = await getPartitionName(request.location.area_name, request.blood_group);
    const db = await getDb();
    const tables = await db.tableNames();
    if (tables.includes(pName)) {
      const table = await db.openTable(pName);
      // @ts-ignore
      const results = await table.search([request.location.lng, request.location.lat]).limit(50).toArray();
      dbMatches = results.map(r => JSON.parse(r.doc));
    }
  } catch(e) {
    console.error('LanceDB details search error:', e);
  }

  const matches = dbMatches
    .filter(u => u.id !== request.user_id)
    .filter(u => u.donor_profile!.availability_status === 'AVAILABLE')
    .map(u => {
      const dist = getDistance(
        request.location.lat, request.location.lng,
        u.donor_profile!.location.lat, u.donor_profile!.location.lng
      );
      return {
        user_id: u.id,
        name: u.name,
        phone: u.phone,
        blood_group: u.donor_profile!.blood_group,
        distance_km: Math.round(dist * 10) / 10,
        availability_status: u.donor_profile!.availability_status,
        last_donation_date: u.donor_profile!.last_donation_date
      };
    })
    .sort((a, b) => a.distance_km - b.distance_km);

  res.json({ request: enrichedRequest, matches });
});

app.patch('/api/requests/:id/details', async (req, res) => {
  const { id } = req.params;
  const requestIndex = requests.findIndex(r => r.id === id);
  if (requestIndex !== -1) {
    if (!isRequestOwner(requests[requestIndex], req)) {
      return res.status(403).json({ error: 'Only the request owner can update details' });
    }

    const patient_name = optionalCleanString(req.body?.patient_name, 120);
    const requester_name = optionalCleanString(req.body?.requester_name, 120);
    const needed_by = parseDate(req.body?.needed_by);
    const contacts = parseContacts(req.body?.contacts);

    if (req.body?.patient_name !== undefined && patient_name === null) return validationError(res, 'Valid patient name is required');
    if (req.body?.requester_name !== undefined && requester_name === null) return validationError(res, 'Valid requester name is required');
    if (needed_by === null) return validationError(res, 'Valid needed-by date is required');
    if (contacts === null) return validationError(res, 'Valid contacts are required');

    requests[requestIndex] = {
      ...requests[requestIndex],
      patient_name: patient_name !== undefined ? patient_name : requests[requestIndex].patient_name,
      requester_name: requester_name !== undefined ? requester_name : requests[requestIndex].requester_name,
      needed_by: needed_by !== undefined ? needed_by : requests[requestIndex].needed_by,
      contacts: contacts || requests[requestIndex].contacts || []
    };
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

  // Only author of the blood request can delete comments
  if (request.user_id !== userId) {
    return res.status(403).json({ error: 'Only the author of this request can delete a comment' });
  }

  if (request.comments) {
    request.comments = request.comments.filter(c => c.id !== commentId);
    await saveToTable('common_requests', request, [request.location.lng, request.location.lat]);
  }

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
    requests[requestIndex].status = status;
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
