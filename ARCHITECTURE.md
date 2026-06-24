# Drop Network Architecture

Current application version: `0.0.4`

## Overview

Drop Network is a single Node.js application for urgent blood donation matching. It combines:

- A React 19 single-page frontend in `src/`.
- An Express API in `server.ts`.
- A local LanceDB data store in `.lancedb/`.
- Vite middleware in development and static `dist/` serving in production.
- Docker targets for development, build, and production runtime.

The app is currently self-contained. There is no external auth provider, SMS gateway, or hosted database integration.

## Runtime Flow

1. The server starts from `server.ts`.
2. `initDbData()` loads users and blood requests from LanceDB tables.
3. If no saved data exists, the server seeds sample Bangladesh donors and requests.
4. In development, Express mounts Vite middleware for the React app.
5. In production, Express serves the built frontend from `dist/`.
6. The frontend talks to the backend through relative `/api` routes.

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

Client state:

- Auth token is stored in `localStorage` as `auth_token`.
- Anonymous ownership is tracked with `drop_fingerprint`.
- `globalToken` in `src/App.tsx` mirrors the current token for API calls.

## Backend

`server.ts` owns the API, in-memory runtime cache, sample seed data, and static serving.

Main data types:

- `User`
- `DonorProfile`
- `RecipientProfile`
- `BloodRequest`
- `Comment`
- `ContactDetail`

API routes:

- `POST /api/auth/send-otp` returns a mock OTP flow using `123456`.
- `POST /api/auth/verify-otp` verifies the mock OTP.
- `POST /api/auth/login` authenticates by phone and password.
- `POST /api/auth/register` creates a verified user and optional donor profile.
- `GET /api/me` returns the authenticated user.
- `GET /api/me/requests` returns requests owned by the current user.
- `POST /api/me/donor-profile` updates donor profile data.
- `POST /api/requests` creates a blood request and returns matching donors.
- `GET /api/requests` lists all blood requests.
- `GET /api/requests/:id` returns request details and donor matches.
- `PATCH /api/requests/:id/details` updates patient, requester, date, and contacts.
- `POST /api/requests/:id/comments` adds a comment with anonymous rate limits.
- `DELETE /api/requests/:id/comments/:commentId` lets the request owner delete comments.
- `PATCH /api/requests/:id/status` updates request status.

## Data Storage

`db.ts` wraps LanceDB access.

Tables:

- `common_users` stores user documents.
- `common_requests` stores blood request documents.
- `donors_<district>_<blood_group>` stores searchable donor partitions.

Records are stored as JSON strings in a `doc` field. LanceDB vectors use `[lng, lat]` so donor/request records can be searched by location.

Important helpers:

- `getDb()` opens the `.lancedb` connection.
- `ensureTable()` creates a table with a temporary schema row if missing.
- `getPartitionName()` builds donor partition table names.
- `syncDonorToPartition()` inserts or replaces an available donor in the correct partition.
- `getAllFromTable()` loads saved JSON documents.
- `saveToTable()` replaces a document by `id`.

## Matching Logic

Donor search is partitioned by district and blood group. Request creation and request detail views:

1. Build a donor partition name from `location.area_name` and `blood_group`.
2. Search LanceDB near the request coordinates.
3. Parse matched donor documents.
4. Remove the requester/self match.
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

Persistent Docker volumes:

- `drop_lancedb`
- `drop_lancedb_dev`
- `drop_node_modules`

## Current Constraints

- OTP is mocked and always accepts `123456`.
- Passwords are stored directly in local records.
- Authentication uses the user ID as a bearer token.
- User and request data are cached in server memory after startup.
- Donor removal from old LanceDB partitions is not complete when a donor changes district or blood group.
- Anonymous comment rate limits are in memory and reset on server restart.
- Most UI logic is concentrated in `src/App.tsx`.

## Change Rules

When changing behavior or structure:

1. Read this file first.
2. Update this file if the architecture, routes, data model, deployment, or constraints change.
3. Update other affected documentation.
4. Bump the app version everywhere it appears.
5. Add a new changelog file in `changelog/` named `v<old-version>-<new-version>-changelog.md`.
