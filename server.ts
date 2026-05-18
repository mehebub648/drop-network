import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { syncDonorToPartition, getAllFromTable, saveToTable, getPartitionName, getDb } from './db';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

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

const BD_LOCATIONS = [
  { area: 'Dhaka', lat: 23.8103, lng: 90.4125 },
  { area: 'Chittagong', lat: 22.3569, lng: 91.7832 },
  { area: 'Sylhet', lat: 24.8949, lng: 91.8687 },
  { area: 'Rajshahi', lat: 24.3636, lng: 88.6241 },
  { area: 'Khulna', lat: 22.8456, lng: 89.5403 },
  { area: 'Barisal', lat: 22.7010, lng: 90.3535 },
  { area: 'Rangpur', lat: 25.7439, lng: 89.2752 },
  { area: 'Mymensingh', lat: 24.7471, lng: 90.4203 },
  { area: 'Comilla', lat: 23.4607, lng: 91.1809 },
  { area: 'Narayanganj', lat: 23.6337, lng: 90.5000 },
  { area: 'Gazipur', lat: 23.9999, lng: 90.4203 },
  { area: 'Bogra', lat: 24.8465, lng: 89.3778 },
  { area: 'Jessore', lat: 23.1634, lng: 89.2182 },
  { area: 'Dinajpur', lat: 25.6217, lng: 88.6355 },
  { area: 'Pabna', lat: 24.0044, lng: 89.2504 },
  { area: "Cox's Bazar", lat: 21.4272, lng: 92.0058 }
];

const generateDonors = () => {
  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const names = ['Rakib Hossain', 'Sumon Ali', 'Tariqur Rahman', 'Nusrat Jahan', 'Farhana Islam', 'Abdul Karim', 'Sajid Mahmud', 'Mehejabin Oyshee', 'Robiul Islam', 'Sharmin Akter'];
  const generated: User[] = [];
  
  for (let i = 0; i < 40; i++) {
    const loc = BD_LOCATIONS[Math.floor(Math.random() * BD_LOCATIONS.length)];
    const bg = bloodGroups[Math.floor(Math.random() * bloodGroups.length)];
    const name = names[Math.floor(Math.random() * names.length)] + ` (${i})`;
    const isAvailable = Math.random() > 0.3;
    
    generated.push({
      id: `donor-${i + 1}`,
      phone: `+88017${Math.floor(10000000 + Math.random() * 90000000)}`,
      name,
      password: 'password',
      is_verified: true,
      donor_profile: {
        blood_group: bg,
        last_donation_date: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
        location: { lat: loc.lat + (Math.random() * 0.05 - 0.025), lng: loc.lng + (Math.random() * 0.05 - 0.025), area_name: loc.area },
        availability_status: isAvailable ? 'AVAILABLE' : 'NOT_AVAILABLE',
        donation_history: Math.random() > 0.5 ? [
          { id: `don-${Math.random()}`, date: new Date(Date.now() - Math.random() * 5000000000).toISOString().slice(0,10), organization: 'Red Crescent Society' }
        ] : []
      }
    });
  }
  return generated;
};

// Seed Data
let users: User[] = [];
let requests: BloodRequest[] = [];

const generateRequests = () => {
  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const generated: BloodRequest[] = [];
  
  for (let i = 0; i < 20; i++) {
    const loc = BD_LOCATIONS[Math.floor(Math.random() * BD_LOCATIONS.length)];
    const hr = Math.floor(Math.random() * 72);
    generated.push({
        id: `req-${i}`,
        user_id: users[Math.floor(Math.random() * users.length)]?.id || 'sys',
        blood_group: bloodGroups[Math.floor(Math.random() * bloodGroups.length)],
        location: { lat: loc.lat, lng: loc.lng, area_name: loc.area },
        created_at: new Date(Date.now() - Math.random() * 100000000).toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        status: 'ACTIVE',
        patient_name: Math.random() > 0.5 ? 'Abdul Kuddus' : undefined,
        needed_by: new Date(Date.now() + hr * 3600000).toISOString(),
        contacts: [
          { name: 'Brother', phone: '+8801700000000', type: 'RELATIVE' },
          { name: 'City Hospital', phone: '+88028888888', type: 'HOSPITAL' }
        ],
        comments: [
          { id: uuidv4(), user_id: 'sys', user_name: 'Dr. Zaman', text: 'Please ensure donors have had breakfast.', created_at: new Date().toISOString() }
        ]
    });
  }
  return generated;
};

async function initDbData() {
  users = await getAllFromTable('common_users');
  requests = await getAllFromTable('common_requests');

  if (users.length === 0) {
    users = generateDonors();
    for (const u of users) {
      await saveToTable('common_users', u);
      if (u.donor_profile?.availability_status === 'AVAILABLE') {
         await syncDonorToPartition(u);
      }
    }
  }

  if (requests.length === 0) {
    requests = generateRequests();
    for (const r of requests) {
      await saveToTable('common_requests', r, [r.location.lng, r.location.lat]);
    }
  }
}

// Pseudo distance calculation (Euclidean for simplicity)
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  // Very rough approximation for UI purposes
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

// API Routes

// Mock OTP Store
const otpStore: Record<string, string> = {};

app.post('/api/auth/send-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });
  
  const otp = '123456'; // Mock OTP for development
  otpStore[phone] = otp;
  
  res.json({ success: true, message: 'OTP sent successfully (Use 123456)' });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { phone, otp } = req.body;
  if (otpStore[phone] === otp || otp === '123456') { // Allowing 123456 by default for ease
    delete otpStore[phone];
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid OTP code' });
  }
});

// Mock login
app.post('/api/auth/login', async (req, res) => {
  const { phone, password, fingerprint } = req.body;
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

  res.json({ token: user.id, user });
});

app.post('/api/auth/register', async (req, res) => {
  const { phone, name, password, fingerprint, blood_group, location } = req.body;
  
  if (users.find(u => u.phone === phone)) {
    return res.status(400).json({ error: 'Phone already registered' });
  }
  
  const user: User = {
    id: uuidv4(),
    phone,
    name: name || `User-${phone.slice(-4)}`,
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

  res.json({ token: user.id, user });
});

app.get('/api/me', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = users.find(u => u.id === token);
  if (user) {
    res.json(user);
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.get('/api/me/requests', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const userRequests = requests.filter(r => r.user_id === token);
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
  const token = req.headers.authorization?.split(' ')[1];
  const userIndex = users.findIndex(u => u.id === token);
  if (userIndex !== -1) {
    users[userIndex].donor_profile = { ...users[userIndex].donor_profile, ...req.body };
    await saveToTable('common_users', users[userIndex]);
    if (users[userIndex].donor_profile?.availability_status === 'AVAILABLE') {
      await syncDonorToPartition(users[userIndex]);
    }
    // Theoretically if user changes district/blood group, we should remove from old partition. 
    // This simple mock covers the basic update flow.
    res.json(users[userIndex]);
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// Create search request and return matches
app.post('/api/requests', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const fingerprint = req.headers['x-fingerprint'] as string;
  const user_id = (token && token !== 'undefined' && token !== 'anonymous') ? token : fingerprint;
  
  const { blood_group, location, needed_by } = req.body;
  
  const newRequest: BloodRequest = {
    id: uuidv4(),
    user_id: user_id || 'anonymous',
    blood_group,
    location,
    needed_by,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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
    .filter(u => u.id !== token)
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

app.get('/api/requests', (req, res) => {
  // Return requests with pseudo-contact info for the responding user to see
  const sortedRequests = [...requests].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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

app.get('/api/requests/:id', async (req, res) => {
  const { id } = req.params;
  const token = req.headers.authorization?.split(' ')[1] || 'anonymous';
  const request = requests.find(r => r.id === id);
  
  if (!request) {
    return res.status(404).json({ error: 'Not found' });
  }

  const requester = users.find(u => u.id === request.user_id);
  const enrichedRequest = {
    ...request,
    requester_name: request.requester_name || requester?.name || 'Anonymous',
    requester_phone: requester?.phone || '+8800000000'
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
    const { patient_name, requester_name, needed_by, contacts } = req.body;
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
  const token = req.headers.authorization?.split(' ')[1];
  const fingerprint = req.headers['x-fingerprint'] as string;
  const { text, anonymous_name } = req.body;

  const validToken = token && token !== 'undefined' && token !== 'anonymous';
  const user = validToken ? users.find(u => u.id === token) : null;
  const requestIndex = requests.findIndex(r => r.id === id);

  if (requestIndex === -1) {
    return res.status(404).json({ error: 'Request not found' });
  }

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
    text: text,
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
  const token = req.headers.authorization?.split(' ')[1];
  const fingerprint = req.headers['x-fingerprint'] as string;
  const userId = (token && token !== 'undefined' && token !== 'anonymous') ? token : fingerprint;

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
  const requestIndex = requests.findIndex(r => r.id === id);
  if (requestIndex !== -1) {
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
