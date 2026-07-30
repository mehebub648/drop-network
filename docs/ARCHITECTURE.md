# Drop Network Architecture

Current application version: `0.0.50`

## Overview

Drop Network is a single Node.js application for urgent blood donation matching. It combines:

- A React 19 single-page frontend in `src/`.
- An Express API in `server/server.ts`.
- A LanceDB data store mounted at `/data/lancedb` inside Docker, bind-mounted
  from `./data/` on the host so the datastore is a directory you can back up,
  copy, or inspect directly.
- Vite middleware in development and static `dist/` serving in production.
- Docker targets for development, build, and production runtime.

The app is currently self-contained. There is no external auth provider or
hosted database integration. `server/sms.ts` can call a configured
provider-neutral HTTP SMS gateway; when no channel is configured, non-production
environments use console delivery while production fails closed.

## Runtime Flow

1. The server starts from `server/server.ts`.
2. `initDbData()` loads users, sessions, and blood requests from LanceDB tables
   and migrates legacy operational roles to the staff hierarchy.
3. The first imported-directory access ensures the `public_id` column exists
   and non-destructively backfills opaque IDs for legacy rows.
4. Active requests with past `expires_at` timestamps are marked `CANCELLED`.
5. No data is seeded; the datastore starts empty and is populated only by real
   user activity.
6. In development, Express mounts Vite middleware for the React app.
7. In production, Express serves the built frontend from `dist/`.
8. The frontend talks to the backend through relative `/api` routes.

## Frontend

Entry points:

- `src/main.tsx` mounts React into `#root`.
- `src/App.tsx` owns application auth state and wires the route tree.
- `src/pages/` contains route-level screens, including `DonorSearchPage` for
  public registered-donor discovery and `AdminPage` for role-aware operations.
- `src/pages/profile/` contains the shared member-area layout plus account,
  donor, request, donation-history, security, and settings screens.
- `src/components/` contains shared layout, authentication shell,
  error-boundary, metadata, and status UI.
- The shared layout supplies the site header and institutional footer. The
  footer links product, company, legal, and safety routes.
- `src/lib/locations.ts`, `src/lib/urgency.ts`, and `src/lib/utils.ts` contain
  shared frontend constants and utilities. `src/lib/collectionFacilities.ts`
  contains the category-filtered DGHS collection-facility suggestions.
- `src/lib/api.ts` wraps all fetch calls to `/api`.
- `src/lib/blood.ts` holds blood-domain helpers: the compatibility maps,
  urgency derivation from the needed-by date, and the configurable donor
  eligibility calculation. The compatibility map mirrors the server's.
- `src/index.css` defines the responsive white-and-blood-red component system,
  admin workspace layout, shared controls, and Tailwind CSS usage.

Routes:

- `/` is a search-led landing page with public donor filters, network context,
  privacy explanations, request preparation, safety guidance, and FAQs.
- `/requests` lists bounded pages of public blood requests with server-side
  blood-group/district/urgency filters persisted in the URL and makes the
  collection facility visible on each request card.
- `/request/:id` shows one request, its collection facility and address, donor
  matches, patient/contact details, and comments. Owners can correct the
  collection location while a request is active.
- `/login` logs in an existing user.
- `/register` verifies a Bangladesh mobile by OTP before creating an account.
- `/request/new` keeps an offline-safe local form draft, collects the exact
  collection facility/address, presents a review step, then creates a private
  server draft and explicitly publishes it. Suggestions are limited to the 198
  supplied DGHS registry rows whose facility type is `Blood Bank`; manual entry
  remains available and registry inclusion is not presented as proof of current
  service availability.
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
- `/directory` publicly searches opted-in, currently available registered
  donors. Guests can search and see non-contact result fields; signed-in active
  members can also receive participating donors' phone numbers.
- `/directory/imported` browses the separately labelled, always-masked archive
  of third-party public listings.
- `/directory/imported/:id` shows and claims one imported record by opaque
  public ID. `/directory/:id` remains a compatibility alias.
- `/about` explains the service mission, matching model, and limitations.
- `/contact` submits validated support, privacy, safety, and partnership
  tickets to the protected operations queue.
- `/admin` is a capability-aware operations workspace. Visible sections cover
  overview, members, requests, reports, support, partners, imported claims,
  audit history, and safe system context according to staff role.
- `/partners` lists verified hospitals, blood banks, NGOs, and current donation
  campaigns and accepts verified-member organization applications.
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
- Public donor discovery omits phone fields for guests and reveals them only
  after the caller has an active authenticated session. Imported contacts
  remain masked regardless of authentication.
- Account and donor-match UI shows phone verification state. Registration and
  recovery display a development-only notice when OTPs use console delivery;
  production stays closed unless an HTTP SMS gateway is configured.
- A React error boundary displays a fallback if a route render fails.
- The interface uses consistent English production copy; no translation
  provider or unfinished language control is exposed.
- `RouteMetadata` updates route titles, descriptions, canonical URLs, and Open
  Graph fields. The public manifest and service worker provide an installable,
  cache-first fallback shell without caching API responses.

## Backend

`server/server.ts` owns the API, an in-memory write-through runtime cache,
session issuance, request validation, capability enforcement, and static
serving. `server/sms.ts` resolves either the configured HTTP transport or the
non-production console transport and never silently downgrades an explicitly
incomplete provider.

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
- Admin actions are capability-checked by `staff_role`. Member suspension,
  staff assignment, and session revocation enforce hierarchy and self/last-
  superadmin protections, require reasons, and write before/after audit context.

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
- `Organization`, including verification state and public campaigns

API routes:

- `POST /api/auth/login` authenticates by phone and password, sets the
  `drop_session` cookie, and returns the sanitized user.
- `POST /api/auth/otp/request` and `/api/auth/otp/verify` create purpose-bound,
  expiring phone-verification tokens. Non-production uses console delivery when
  no channel is configured; production and incomplete explicit HTTP settings
  fail closed. A failed send invalidates the new challenge so it creates no
  false cooldown.
- `POST /api/auth/register` consumes a registration token, creates a verified
  user, and starts an optional donor profile as unavailable.
- `POST /api/auth/logout` revokes the current session and clears the cookie.
- `POST /api/auth/reset-password` consumes a verified recovery challenge,
  changes the password, and revokes every existing session.
- `GET /api/donors/search?blood_group&lat&lng&area_name` is optional-auth
  discovery for verified, eligible, currently available registered donors
  inside the configured radius. It returns `{ donors, total, contact_access,
  query }`, caps results at 50, and omits `phone` for guests.
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
  points. Admin routes under `/api/admin` expose capability-gated overview,
  users, status/staff updates, session revocation, request/report/ticket/
  organization/claim queues, immutable audit history, and secret-safe system
  information.
- Public and protected `/api/organizations` routes support directory listing,
  applications, operator review, role assignment, and campaign publication.
- `GET /api/stats` returns public network counts (registered/available donors,
  active/fulfilled requests) for the landing page.
- `GET /api/requests` lists active, non-expired public blood requests without
  requester phone or contact details and returns bounded pagination metadata.
- `GET /api/requests/:id` returns request details and donor matches. Contact
  details are purpose-limited to the request owner and donors who accepted an
  invitation; `requester_phone` stays owner-only. Donor match records expose
  each account's non-sensitive `is_verified` flag without making request
  contacts generally available to signed-in members.
- `PATCH /api/requests/:id/details` lets the request owner update patient, requester, date, and contacts.
- `POST /api/requests/:id/comments` adds a comment with anonymous rate limits.
- `DELETE /api/requests/:id/comments/:commentId` lets the request owner delete comments.
- `PATCH /api/requests/:id/status` lets the request owner update request status.
- `GET /api/directory` lists unclaimed imported donor stubs with masked phone
  numbers, filtered by blood group, district, source, and name.
  `GET /api/directory/sources` returns per-source attribution and counts, and
  `GET /api/directory/:id` addresses one record by opaque `public_id` and always
  masks its phone. Claimed or pending records are readable only by the claimant
  or active staff.
- `POST /api/directory/:id/claim` claims an imported profile for the
  authenticated, phone-verified caller. `GET`/`PATCH /api/admin/directory/claims`
  let operators approve or release claims that could not be auto-verified.

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
- `common_organizations` stores partner applications, verification state, and
  campaign records.
- `donors_<district>_<blood_group>` stores searchable donor partitions.
- `imported_donors` stores claimable donor stubs imported from other
  organisations' public listings. Unlike every other table it is never loaded
  into the runtime cache, because it is orders of magnitude larger than the
  account tables. Its filter columns (`public_id`, `blood_group`, `district`,
  `phone`, `claim_status`, `source_id`, `search_text`) are stored as real columns so
  LanceDB can push predicates down; the full record still travels in `doc`.
  Internal row IDs are never exposed through the API. Existing tables receive
  the `public_id` column through schema evolution and a batched, non-destructive
  backfill that preserves row identity and claim state.

Records are stored as JSON strings in a `doc` field. LanceDB vectors use `[lng, lat]` so donor/request records can be searched by location.

Important helpers:

- `getDb()` opens the `.lancedb` connection.
- `ensureTable()` creates a table with a temporary schema row if missing.
- `getPartitionName()` builds donor partition table names.
- `syncDonorToPartition()` inserts or replaces an available donor in the correct partition.
- `removeDonorFromAllPartitions()` clears stale donor rows before profile resync.
- `getAllFromTable()` loads saved JSON documents.
- `saveToTable()` replaces a document by `id` using escaped ID filters.
- `ensureImportedDonorTable()`, `addImportedDonors()`, public/storage-specific
  deletion helpers, `queryImportedDonors()`, `countImportedDonors()`,
  `getImportedDonor()`, and `replaceImportedDonor()` serve the imported archive
  without loading it into memory.

## Imported Donor Directory

Several Bangladesh organisations publish open donor listings. `scripts/scrape/`
reads those listings and `scripts/import-donors.ts` loads them into
`imported_donors`. Both are standalone scripts run through Docker Compose; the
server never scrapes anything at runtime.

- `server/importedDonors.ts` holds the shared registry (`IMPORT_SOURCES`), the
  record shape, dedupe keys, opaque SHA-256 public/storage identities, phone
  masking, and claim decision logic. Public IDs contain neither raw nor
  URI-encoded phone or source keys. The helpers are unit-tested.
- `scripts/scrape/sources/*.ts` implement one listing each and stream
  `ScrapedDonor` records; `scripts/scrape/index.ts` writes NDJSON per source to
  `data/scraped/`. Adding a source means adding a descriptor to
  `IMPORT_SOURCES` and a module that yields records.
- `scripts/import-donors.ts` normalizes, dedupes, and writes the NDJSON into
  LanceDB. Unrecognised blood groups and districts are blanked rather than
  guessed, which turns them into fields a claimant has to complete.

These people never registered here, so an imported record is a stub, not an
account:

- Phone numbers are only ever served masked (`+88017••••••78`).
- Imported records never enter the donor match partitions and are never
  invited to a request.
- A record becomes a real donor profile only through
  `POST /api/directory/:id/claim`. The claim is auto-approved only when the
  claimant's own verified phone equals the number the source published;
  everything else becomes `PENDING_REVIEW` for an operator, because nothing
  else in the imported data proves ownership.
- A claimed profile starts as `NOT_AVAILABLE`. Being listed by another
  organisation is not consent to be contacted here, so the donor has to opt in.

Commands:

```
docker compose --profile development run --rm app-dev npm run scrape -- --source=all
docker compose --profile development run --rm app-dev npm run import-donors -- --in=data/scraped
```

## Matching Logic

Public donor discovery and request matching share authoritative user safety
state. Public `/directory` discovery returns only eligible, opted-in,
`AVAILABLE` registered donors; the optional session controls whether the phone
field is present. Request matching is compatibility-aware: a request for group
G searches every donor group medically compatible with G (e.g. an A+ request
also searches A-, O+, and O- donors). Both flows:

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
- `APP_URL` sets the canonical public origin for generated public URLs and
  defaults to `https://findadrop.org` for the production Compose service.
- `LANCEDB_PATH` sets the datastore directory inside the container. Docker
  Compose sets it to `/data/lancedb`.
- `ADMIN_PHONE` bootstraps the first verified administrator by normalized
  Bangladesh phone as `SUPERADMIN`; further staff changes require the
  `MANAGE_STAFF` capability.
- `SMS_PROVIDER` selects `http` or the development-only `console` transport.
  A blank value automatically selects console only outside production.
- `SMS_HTTP_ENDPOINT` and `SMS_HTTP_TOKEN` are both required when
  `SMS_PROVIDER=http`; an incomplete explicit configuration fails closed.

Persistent storage:

- `./data/lancedb` is bind-mounted at `/data/lancedb` for the production
  service.
- `./data/lancedb-dev` is bind-mounted at `/data/lancedb` for the development
  service, so experiments never touch production data.
- `./data/scraped` holds the NDJSON produced by `npm run scrape`.
- `drop_node_modules` is the one remaining named volume; it holds development
  dependencies and must stay a volume so it does not shadow the host
  `node_modules`.

`./data/` is git-ignored: it is large and holds personal data.

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
  and `SMS_HTTP_TOKEN`. Blank-provider console fallback and an explicit console
  provider are non-production only.
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
