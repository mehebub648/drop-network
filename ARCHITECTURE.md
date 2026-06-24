# Drop Network Architecture

Current application version: `0.0.29`

## Overview

Drop Network is a single Node.js application for urgent blood donation matching. It combines:

- A React 19 single-page frontend in `src/`.
- An Express API in `server.ts`.
- A LanceDB data store whose location is set by `LANCEDB_PATH` (a persistent
  volume in Docker, or a local `.lancedb/` directory for direct runs).
- Vite middleware in development and static `dist/` serving in production.
- Docker targets for development, build, and production runtime.

The app is currently self-contained. There is no external auth provider, SMS gateway, or hosted database integration.

## Runtime Flow

1. The server starts from `server.ts`.
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
- `src/index.css` contains global styles and Tailwind CSS usage.

Routes:

- `/` shows the landing and blood request flow.
- `/requests` lists public blood requests.
- `/request/:id` shows one request, donor matches, patient/contact details, and comments.
- `/login` logs in an existing user.
- `/register` handles mock OTP and account creation.
- `/profile` shows donor settings, donation history, and the user's requests.
- `*` shows a not-found view.

Client state:

- An opaque session token is stored in `localStorage` as `auth_token`.
- Anonymous ownership is tracked with `drop_fingerprint`.
- `globalToken` in `src/App.tsx` mirrors the current token for API calls.
- A React error boundary displays a fallback if a route render fails.

## Backend

`server.ts` owns the API, an in-memory write-through runtime cache, session issuance, request validation, and static serving.

Main data types:

- `User`
- `DonorProfile`
- `RecipientProfile`
- `BloodRequest`
- `Comment`
- `ContactDetail`
- `AuthSession`

API routes:

- `POST /api/auth/send-otp` generates a short-lived OTP. Development responses include `dev_otp`; production needs an SMS provider.
- `POST /api/auth/verify-otp` verifies the generated OTP.
- `POST /api/auth/login` authenticates by phone and password and returns an opaque session token.
- `POST /api/auth/register` creates a verified user, optional donor profile, and session token.
- `POST /api/auth/logout` revokes the current session.
- `GET /api/me` returns the authenticated user.
- `GET /api/me/requests` returns requests owned by the current user.
- `POST /api/me/donor-profile` updates donor profile data.
- `POST /api/requests` creates a blood request and returns matching donors.
- `GET /api/requests` lists active, non-expired public blood requests without requester phone or contact details.
- `GET /api/requests/:id` returns request details and donor matches.
- `PATCH /api/requests/:id/details` lets the request owner update patient, requester, date, and contacts.
- `POST /api/requests/:id/comments` adds a comment with anonymous rate limits.
- `DELETE /api/requests/:id/comments/:commentId` lets the request owner delete comments.
- `PATCH /api/requests/:id/status` lets the request owner update request status.

## Data Storage

`db.ts` wraps LanceDB access.

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

Donor search is partitioned by district and blood group. Request creation and request detail views:

1. Build a donor partition name from `location.area_name` and `blood_group`.
2. Search LanceDB near the request coordinates.
3. Parse matched donor documents.
4. Remove the requester/self match using the authenticated user ID or anonymous fingerprint.
5. Keep only `AVAILABLE` donors.
6. Calculate display distance with the Haversine formula.
7. Sort by nearest donor first.

## Deployment

Docker is the primary runtime path.

Files:

- `Dockerfile` defines `dev`, `build`, and `production` stages.
- `compose.yml` defines the default `app` service and optional `app-dev` profile.
- `README.md` gives the shortest run instructions.
- `Deploy-windows.md` and `Depluy-ubuntu.md` document platform-specific Docker setup.

Ports:

- Production-style app: container `3000`, host `${PORT:-3000}`.
- Development profile: container `3000`, host `${DEV_PORT:-3001}`.
- Direct local server runs read `PORT` first, then `PROD_PORT`, then `3000`.

Environment:

- `CORS_ORIGIN` optionally lists allowed cross-origin browser origins.
- `LANCEDB_PATH` sets the datastore directory. Docker sets it to `/data/lancedb`;
  direct local runs fall back to `./.lancedb`.

Persistent Docker volumes:

- `drop_lancedb` mounted at `/data/lancedb` for the production service.
- `drop_lancedb_dev` mounted at `/data/lancedb` for the development service.
- `drop_node_modules` holds development dependencies.

The production image runs as the unprivileged `node` user and owns
`/data/lancedb`.

## Current Constraints

- Production OTP generation still needs an SMS provider; local development exposes `dev_otp` in the API response.
- Passwords are stored directly in local records.
- Session tokens are persisted, but this is still a lightweight local auth model.
- User and request data are held in a server-memory write-through cache that
  mirrors LanceDB; the cache is per-process and rebuilt from the datastore on
  startup, so this still assumes a single instance.
- Anonymous comment rate limits are in memory and reset on server restart.
- Most UI logic is concentrated in `src/App.tsx`.

## Change Rules

When changing behavior or structure:

1. Read this file first.
2. Update this file if the architecture, routes, data model, deployment, or constraints change.
3. Update other affected documentation.
4. Bump the app version everywhere it appears.
5. Add a new changelog file in `changelog/` named `v<old-version>-<new-version>-changelog.md`.
