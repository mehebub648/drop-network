# Drop Network Architecture

Current application version: `0.0.32`

## Overview

Drop Network is a single Node.js application for urgent blood donation matching. It combines:

- A React 19 single-page frontend in `src/`.
- An Express API in `server/server.ts`.
- A LanceDB data store under `/data/lancedb` inside Docker, backed by persistent
  Docker volumes.
- Vite middleware in development and static `dist/` serving in production.
- Docker targets for development, build, and production runtime.

The app is currently self-contained. There is no external auth provider, SMS gateway, or hosted database integration.

## Runtime Flow

1. The server starts from `server/server.ts`.
2. `initDbData()` loads users, sessions, and blood requests from LanceDB tables.
3. Active requests with past `expires_at` timestamps are marked `CANCELLED`.
4. No data is seeded; the datastore starts empty and is populated only by real
   user activity.
5. In development, Express mounts Vite middleware for the React app.
6. In production, Express serves the built frontend from `dist/`.
7. The frontend talks to the backend through relative `/api` routes.

## Frontend

Entry points:

- `src/main.tsx` mounts React into `#root`.
- `src/App.tsx` contains the current route tree and most UI logic.
- `src/lib/api.ts` wraps all fetch calls to `/api`.
- `src/lib/blood.ts` holds blood-domain helpers: the compatibility maps,
  urgency derivation from the needed-by date, and the 90-day donor
  eligibility calculation. The compatibility map mirrors the server's.
- `src/index.css` contains global styles and Tailwind CSS usage.

Routes:

- `/` shows the landing and blood request flow, plus live network stats, a
  blood-compatibility chart, and a donor-eligibility FAQ.
- `/requests` lists public blood requests with blood-group/district/urgency
  filters, urgency badges, and urgent-first sorting.
- `/request/:id` shows one request, donor matches, patient/contact details, and comments.
- `/login` logs in an existing user.
- `/register` creates an account with phone, name, and password (no OTP step).
- `/profile` shows donor settings, donation history, and the user's requests.
- `*` shows a not-found view.

Client state:

- The session lives in an httpOnly `drop_session` cookie set by the server;
  JavaScript never sees the token, and same-origin fetches send it
  automatically.
- Anonymous ownership is tracked with `drop_fingerprint` in `localStorage`
  (minimum 16 characters; the server rejects shorter values).
- Auth state is derived from whether `GET /api/me` succeeds.
- A React error boundary displays a fallback if a route render fails.

## Backend

`server/server.ts` owns the API, an in-memory write-through runtime cache, session issuance, request validation, and static serving. `server/sms.ts` holds a dormant SMS provider abstraction for a future phone-verification flow.

Security middleware:

- `helmet` sets security headers; a strict CSP (`default-src 'self'`,
  inline styles allowed for Tailwind) is applied in production and disabled in
  development so Vite HMR works.
- `express-rate-limit` applies a general `/api` limiter (300 requests / 15 min
  per IP) and a strict limiter on login and register (10 / 15 min per IP).
  `trust proxy` is set to 1 for deployment behind a reverse proxy.
- Passwords are hashed with bcrypt (10 rounds). Legacy plaintext records are
  transparently re-hashed on the next successful login.
- Sessions are opaque UUID tokens delivered in an httpOnly, `SameSite=Lax`
  cookie (`Secure` in production) with a 7-day TTL. CSRF is mitigated by the
  Lax cookie, JSON-only request bodies, and locked-down CORS in production.
- API responses never include the `password` field (`sanitizeUser`).

Main data types:

- `User`
- `DonorProfile`
- `RecipientProfile`
- `BloodRequest`
- `Comment`
- `ContactDetail`
- `AuthSession`

API routes:

- `POST /api/auth/login` authenticates by phone and password, sets the
  `drop_session` cookie, and returns the sanitized user.
- `POST /api/auth/register` creates an unverified user (password min 8 chars,
  bcrypt-hashed), optional donor profile, sets the session cookie, and returns
  the sanitized user.
- `POST /api/auth/logout` revokes the current session and clears the cookie.
- `GET /api/me` returns the authenticated user.
- `GET /api/me/requests` returns requests owned by the current user.
- `POST /api/me/donor-profile` updates donor profile data.
- `POST /api/requests` creates a blood request and returns matching donors.
- `GET /api/stats` returns public network counts (registered/available donors,
  active/fulfilled requests) for the landing page.
- `GET /api/requests` lists active, non-expired public blood requests without requester phone or contact details.
- `GET /api/requests/:id` returns request details and donor matches. Contact
  details and donor phone numbers are included only for authenticated users or
  the request owner; `requester_phone` stays owner-only.
- `PATCH /api/requests/:id/details` lets the request owner update patient, requester, date, and contacts.
- `POST /api/requests/:id/comments` adds a comment with anonymous rate limits.
- `DELETE /api/requests/:id/comments/:commentId` lets the request owner delete comments.
- `PATCH /api/requests/:id/status` lets the request owner update request status.

## Data Storage

`server/db.ts` wraps LanceDB access.

Tables:

- `common_users` stores user documents.
- `common_requests` stores blood request documents.
- `common_sessions` stores opaque auth session documents.
- `donors_<district>_<blood_group>` stores searchable donor partitions.

Records are stored as JSON strings in a `doc` field. LanceDB vectors use `[lng, lat]` so donor/request records can be searched by location.

Important helpers:

- `getDb()` opens the `.lancedb` connection.
- `ensureTable()` creates a table with a temporary schema row if missing.
- `getPartitionName()` builds donor partition table names.
- `syncDonorToPartition()` inserts or replaces an available donor in the correct partition.
- `removeDonorFromAllPartitions()` clears stale donor rows before profile resync.
- `getAllFromTable()` loads saved JSON documents.
- `saveToTable()` replaces a document by `id` using escaped ID filters.

## Matching Logic

Donor search is partitioned by district and blood group, and is
compatibility-aware: a request for group G searches the partitions of every
donor group medically compatible with G (e.g. an A+ request also searches A-,
O+, and O- partitions). Request creation and request detail views:

1. Look up the compatible donor groups for the requested `blood_group`
   (`COMPATIBLE_DONORS` in `server/server.ts`, mirrored in `src/lib/blood.ts`).
2. For each compatible group, build the partition name from
   `location.area_name` and search LanceDB near the request coordinates.
3. Parse matched donor documents and de-duplicate by donor id.
4. Remove the requester/self match using the authenticated user ID or anonymous fingerprint.
5. Keep only `AVAILABLE` donors.
6. Calculate display distance with the Haversine formula.
7. Sort by nearest donor first.

## Deployment

Docker is the supported runtime path. Agents and developers should not run
Node, npm, Vite, or TSX directly on the host for this project; package scripts
are run inside Docker Compose services.

Files:

- `Dockerfile` defines `dev`, `build`, and `production` stages.
- `compose.yml` defines the default `app` service and optional `app-dev` profile.
- `README.md` gives the shortest run instructions.
- `docs/Deploy-windows.md` and `docs/Deploy-ubuntu.md` document platform-specific Docker setup.

Ports:

- Production-style app: container `3000`, host `${PORT:-3000}`.
- Development profile: container `3000`, host `${DEV_PORT:-3001}`.

Environment:

- `CORS_ORIGIN` optionally lists allowed cross-origin browser origins.
- `LANCEDB_PATH` sets the datastore directory inside the container. Docker
  Compose sets it to `/data/lancedb`.

Persistent Docker volumes:

- `drop_lancedb` mounted at `/data/lancedb` for the production service.
- `drop_lancedb_dev` mounted at `/data/lancedb` for the development service.
- `drop_node_modules` holds development dependencies.

The production image runs as the unprivileged `node` user and owns
`/data/lancedb`.

## Current Constraints

- Phone verification is disabled: there is no OTP flow and accounts start with
  `is_verified: false`. Re-enabling it requires a real SMS provider wired into
  `server/sms.ts` plus new OTP endpoints.
- There is no password-reset flow (previously impossible anyway without SMS);
  users who forget their password need manual help.
- Anonymous ownership relies on a client-generated fingerprint. The server
  requires ≥16 characters and only honors reassignment when the request body
  and `x-fingerprint` header agree, but a client that knows a fingerprint can
  still impersonate that anonymous owner. Residual risk accepted until real
  accounts are required for request creation.
- Rate limits (auth, general API, anonymous comments) are in memory, per
  process, and reset on restart.
- User and request data are held in a server-memory write-through cache that
  mirrors LanceDB; the cache is per-process and rebuilt from the datastore on
  startup, so this still assumes a single instance.
- The app terminates no TLS itself; production deployment must sit behind an
  HTTPS reverse proxy (the session cookie is `Secure` in production).
- Most UI logic is concentrated in `src/App.tsx`.

## Change Rules

When changing behavior or structure:

1. Read this file first.
2. Update this file if the architecture, routes, data model, deployment, or constraints change.
3. Update other affected documentation.
4. Bump the app version everywhere it appears.
5. Add a new changelog file in `changelog/` named `v<old-version>-<new-version>-changelog.md`.
