# Drop Network Architecture

Current application version: `0.0.41`

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
- `src/App.tsx` owns application auth state and wires the route tree.
- `src/pages/` contains route-level screens; each existing public, auth,
  request, and profile screen lives in its own module.
- `src/pages/profile/` contains the shared member-area layout plus account,
  donor, request, donation-history, security, and settings screens.
- `src/components/` contains shared layout, error-boundary, and status UI.
- The shared layout supplies the site header and institutional footer. The
  footer links product, company, legal, and safety routes.
- `src/lib/locations.ts`, `src/lib/urgency.ts`, and `src/lib/utils.ts` contain
  shared frontend constants and utilities.
- `src/lib/api.ts` wraps all fetch calls to `/api`.
- `src/lib/blood.ts` holds blood-domain helpers: the compatibility maps,
  urgency derivation from the needed-by date, and the configurable donor
  eligibility calculation. The compatibility map mirrors the server's.
- `src/index.css` contains global styles and Tailwind CSS usage.

Routes:

- `/` shows the landing and blood request flow, plus live network stats, a
  blood-compatibility chart, and a donor-eligibility FAQ.
- `/requests` lists bounded pages of public blood requests with server-side
  blood-group/district/urgency filters persisted in the URL.
- `/request/:id` shows one request, donor matches, patient/contact details, and comments.
- `/login` logs in an existing user.
- `/register` verifies a Bangladesh mobile by OTP before creating an account.
- `/request/new` keeps an offline-safe local form draft, presents a review
  step, then creates a private server draft and explicitly publishes it.
- `/profile` redirects authenticated members to `/profile/donor`.
- `/profile/account` edits the member name and phone and shows joined and
  verification information.
- `/profile/donor` manages blood group, district, availability, eligibility,
  and recent availability history.
- `/profile/requests` filters and updates requests owned by the member.
- `/profile/invitations` manages private invitations, donor responses, mutual
  donation confirmation, purpose-limited contacts, and in-app notifications.
- `/profile/history` adds, edits, and deletes validated donation records.
- `/profile/security` changes the password and manages signed-in devices.
- `/profile/settings` stores device-local preferences, downloads the complete
  server-side account export, and starts password-confirmed anonymization.
- `/forgot-password` resets a password after registered-phone OTP verification.
- `/about` explains the service mission, matching model, and limitations.
- `/contact` submits validated support, privacy, safety, and partnership
  tickets to the protected operations queue.
- `/admin` gives authorized support, moderator, verifier, and administrator
  roles an operational dashboard for reports, tickets, and request review.
- `/privacy` documents current data collection, visibility, storage, cookies,
  local ownership fingerprints, and verification limitations.
- `/terms` sets the acceptable-use and service-disclaimer draft.
- `/safety` gives clinical-setting, anti-payment, screening, and aftercare
  guidance.
- `*` shows a not-found view.

Client state:

- The session lives in an httpOnly `drop_session` cookie set by the server;
  JavaScript never sees the token, and same-origin fetches send it
  automatically.
- A legacy `drop_fingerprint` remains for old comment attribution and ownership
  migration. New blood requests require a verified account.
- Auth state is derived from whether `GET /api/me` succeeds.
- Account and donor-match UI shows phone verification state. Production
  registration stays closed unless an HTTP SMS gateway is configured.
- A React error boundary displays a fallback if a route render fails.
- `LocaleProvider` persists English/Bangla selection and translates the shared
  navigation shell. Detailed page/form copy remains an explicit localization
  follow-up.
- `RouteMetadata` updates route titles, descriptions, canonical URLs, and Open
  Graph fields. The public manifest and service worker provide an installable,
  cache-first fallback shell without caching API responses.

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
- `DonorProfile`, including donation and availability history
- `RecipientProfile`
- `BloodRequest`
- `Comment`
- `ContactDetail`
- `AuthSession`
- `DonorResponse` and `AppNotification`
- `ModerationReport`, `SupportTicket`, and `AuditEvent`

API routes:

- `POST /api/auth/login` authenticates by phone and password, sets the
  `drop_session` cookie, and returns the sanitized user.
- `POST /api/auth/otp/request` and `/api/auth/otp/verify` create purpose-bound,
  expiring phone-verification tokens through the configured SMS provider.
- `POST /api/auth/register` consumes a registration token, creates a verified
  user, and starts an optional donor profile as unavailable.
- `POST /api/auth/logout` revokes the current session and clears the cookie.
- `POST /api/auth/reset-password` consumes a verified recovery challenge,
  changes the password, and revokes every existing session.
- `GET /api/me` returns the authenticated user.
- `PATCH /api/me` validates and updates the authenticated user's name and
  phone, rejects duplicate phone numbers, and refreshes donor partitions.
- `POST /api/me/change-password` verifies the current password and stores a
  bcrypt hash of the new password (minimum 8 characters).
- `GET/DELETE /api/me/sessions` and `POST /api/me/logout-all` expose and revoke
  device sessions without disclosing opaque tokens.
- `GET /api/me/export` returns the member's account, requests, responses,
  notifications, and reports. `DELETE /api/me` requires the current password,
  removes donor/private patient data, cancels active requests, revokes sessions,
  and anonymizes records retained for coordination and safety auditing.
- `GET /api/me/requests` returns requests owned by the current user.
- `POST /api/me/donor-profile` updates donor profile and donation-history
  data, rejects future donation dates, records availability changes, and
  refreshes donor partitions.
- `POST /api/requests` creates a complete private draft for a verified owner;
  `POST /api/requests/:id/publish` records consent and activates it.
- `POST /api/requests/:id/invitations` privately invites a currently eligible
  matched donor without disclosing either party's phone.
- `GET /api/me/invitations`, `PATCH /api/responses/:id`, and
  `POST /api/responses/:id/confirm-donation` coordinate acceptance, arrival,
  mutual confirmation, partial fulfillment, and donation history.
- `GET /api/me/notifications` and its read endpoint provide persisted in-app
  delivery; external SMS/push delivery remains provider work.
- `POST /api/reports`, `POST /api/me/blocks/:userId`, and
  `POST /api/support/tickets` provide member safety and public support entry
  points. Admin routes under `/api/admin` expose role-gated overview, user,
  request, report, ticket, and immutable audit operations.
- `GET /api/stats` returns public network counts (registered/available donors,
  active/fulfilled requests) for the landing page.
- `GET /api/requests` lists active, non-expired public blood requests without
  requester phone or contact details and returns bounded pagination metadata.
- `GET /api/requests/:id` returns request details and donor matches. Contact
  details and donor phone numbers are included only for authenticated users or
  the request owner; `requester_phone` stays owner-only. Donor match records
  also expose each account's non-sensitive `is_verified` flag.
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
- `common_otps` stores expiring hashed verification challenges.
- `common_responses` stores private donor invitations and response state.
- `common_notifications` stores per-user in-app notifications.
- `common_reports`, `common_support_tickets`, and `common_audit_events` store
  moderation operations and their audit trail.
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
2. Read current donor safety and availability state from authoritative user
   records, allowing nearby cross-district matching.
3. Exclude deferred donors, incomplete donation intervals, and stale
   availability confirmations.
4. Remove the requester/self match using the authenticated user ID or anonymous fingerprint.
5. Keep only `AVAILABLE` donors.
6. Calculate display distance with the Haversine formula.
7. Keep donors inside the configured radius and sort nearest first.

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
- `ADMIN_PHONE` bootstraps the first verified administrator by normalized
  Bangladesh phone; further role changes require an administrator.

Persistent Docker volumes:

- `drop_lancedb` mounted at `/data/lancedb` for the production service.
- `drop_lancedb_dev` mounted at `/data/lancedb` for the development service.
- `drop_node_modules` holds development dependencies.

The production image runs as the unprivileged `node` user and owns
`/data/lancedb`.

Operational endpoints and jobs:

- `/health` reports process liveness, `/ready` reports completed datastore
  initialization, and `/metrics` exposes low-cardinality Prometheus gauges.
- A five-minute background job expires overdue requests and automatically
  pauses stale donor availability while creating an in-app reconfirmation notice.
- `.github/workflows/ci.yml` runs Docker-based type checking, tests, bundle
  creation, dependency audit, and secret scanning.
- `/robots.txt` and `/sitemap.xml` are generated from the deployed request
  origin so production never publishes a placeholder hostname.

## Current Constraints

- Production registration requires `SMS_PROVIDER=http`, `SMS_HTTP_ENDPOINT`,
  and `SMS_HTTP_TOKEN`. The console provider is development-only.
- Notification choices are currently device-local preferences; there is no
  push or email delivery provider.
- The following fingerprint limitation now applies only to legacy anonymous
  comments and ownership migration; new requests require verified accounts.
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
- Frontend route modules still use broad `any` types and do not yet have
  focused component tests.

## Change Rules

When changing behavior or structure:

1. Read this file first.
2. Update this file if the architecture, routes, data model, deployment, or constraints change.
3. Update other affected documentation.
4. Bump the app version everywhere it appears.
5. Add a new changelog file in `changelog/` named `v<old-version>-<new-version>-changelog.md`.
