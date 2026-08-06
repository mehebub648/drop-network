# Drop Network Architecture

Current application version: `0.0.60`

## Overview

Drop Network is a single Node.js application for urgent blood donation matching. It combines:

- A React 19 single-page frontend in `src/`.
- An Express API in `server/server.ts`.
- A LanceDB data store mounted at `/data/lancedb` inside Docker, bind-mounted
  from `./data/` on the host so the datastore is a directory you can back up,
  copy, or inspect directly.
- A separate `/data/media/community` bind mount for processed donation-story
  images; development and production use different host directories.
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
3. The first imported-directory access ensures the filterable columns exist
   (`public_id`, `upazila`, `row_version`), deletes any imported row without a
   phone number, and non-destructively backfills the remaining legacy rows in
   batches, preserving row identity and claim state. On a store that predates
   these columns this rewrites every row; progress is logged, `/ready` reports
   503 until it finishes, and an interrupted run resumes where it stopped rather
   than starting over. Each pass re-scans for rows still on an older
   `row_version`, so the batch size sets how many full scans a migration costs -
   it is 10,000, which is why a 129k-row store takes about a dozen passes rather
   than a hundred and thirty. A column whose correct value for every existing
   row is a constant, like `listing_state`, is filled by the column default and
   needs no pass at all.
4. Active requests with past `expires_at` timestamps are marked `CANCELLED`.
5. No data is seeded; the datastore starts empty and is populated only by real
   user activity.
6. In development, Express mounts Vite middleware for the React app.
7. In production, Express serves the built frontend from `dist/`.
8. Published community article requests receive server-injected canonical,
   social, and `BlogPosting` metadata before the React app hydrates.
9. The frontend talks to the backend through relative `/api` routes.

## Frontend

Entry points:

- `src/main.tsx` mounts React into `#root`.
- `src/App.tsx` owns application auth state and wires the route tree.
- `src/pages/` contains route-level screens, including `DonorSearchPage` (the
  combined donor search and blood request flow), `CallDonorPage`, and
  `AdminPage` for role-aware operations.
- `CommunityPage`, `CommunityPostPage`, and `CommunityEditorPage` provide the
  public feed, public article, and authenticated publishing flow.
- `src/components/community/` renders semantic post cards and Markdown through
  `react-markdown` and GFM without raw HTML or Markdown-provided images.
- `src/components/search/` holds the steps of that flow: the shared three-stage
  progress guide, the criteria form with its progressive reveal, the donor
  result card, and `RequestGate`, which carries the patient details and the
  inline sign-in.
- `src/pages/profile/` contains the shared member-area layout plus account,
  donor, request, donation-history, security, and settings screens.
- `src/components/DonationExperienceFields.tsx` and `src/lib/donation.ts` share
  the exact/approximate/never-donated form model between registration and donor
  profile editing. The server remains authoritative for dates and validation.
- `src/components/` contains shared layout, authentication shell,
  error-boundary, metadata, and status UI. `src/components/ui.tsx` supplies the
  reusable page heading, surface, status, notice, metric, and empty-state
  primitives used to keep public, member, and staff screens visually aligned.
- The shared layout supplies the site header and institutional footer. The
  footer links product, company, legal, and safety routes.
- `src/lib/urgency.ts` and `src/lib/utils.ts` contain shared frontend
  utilities. `src/lib/collectionFacilities.ts` contains the category-filtered
  DGHS collection-facility suggestions.
- `src/lib/api.ts` wraps all fetch calls to `/api`.
- `src/lib/searchDraft.ts` keeps the in-progress request in `localStorage`. The
  inline sign-in does not navigate, so this is not about surviving a route
  change: it is about the tab being killed while the requester is in their SMS
  app reading a code. Passwords and codes are never written to it.
- `src/lib/blood.ts`, `src/lib/locations.ts`, and `src/lib/upazilas.ts` are thin
  re-exports of `server/blood.ts`, `server/locations.ts`, and
  `server/upazilas.ts`. The data lives on the server side because the production
  image ships only `server/` and `dist/`, and the server has to validate against
  it; re-exporting means the API and the interface cannot disagree about blood
  compatibility or place names. `src/lib/blood.ts` still owns the frontend-only
  helpers: urgency derivation and the donor eligibility calculation.
- `src/index.css` defines the responsive warm-white-and-blood-red
  humanitarian-utility system, semantic success/availability color, focus and
  reduced-motion behavior, admin workspace layout, shared controls, and
  Tailwind CSS usage.

Routes:

- `/` is a search-led landing page with the complete blood group, district,
  upazila, collection-facility, and requester-role flow. It persists that
  guided draft into `/directory` and introduces the shared Search area ->
  Choose donor -> Confirm & call progress model, alongside network context,
  privacy explanations, request preparation, safety guidance, and FAQs.
- `/requests` lists bounded pages of public blood requests with server-side
  blood-group/district/urgency filters persisted in the URL and makes the
  collection facility visible on each request card.
- `/request/:id` shows one request, its collection facility and address, donor
  matches, patient/contact details, and comments. Owners can correct the
  collection location while a request is active.
- `/login` logs in an existing user.
- `/register` verifies a Bangladesh mobile by OTP before creating an account.
- `/request/new` no longer exists and redirects to `/directory`. Posting a blood
  request is not a separate form any more: searching for donors is how a request
  is created (see below).
- `/directory` is the combined search and request flow. It asks for blood group,
  district and upazila with nothing pre-selected - a wrong default silently
  searches the wrong place - then reveals the collection facility and "who are
  you?" questions once those three are answered. After a search, the page
  continues at the Choose donor stage with a compact summary of the carried
  criteria and an in-place refine panel instead of repeating the initial hero.
  A shared URL without request context opens that panel automatically before a
  contact can be requested. Results show every number masked. Asking for one
  number opens the patient-details gate, which also
  carries the explicit publication consent and the inline sign-in, and
  publishing the request is what unmasks the number. Facility suggestions come
  from the DGHS registry rows whose type is `Blood Bank`, ordered with the
  searched upazila first; manual entry remains available and registry inclusion
  is not proof of current service availability.
- `/directory/call/:requestId/:donorRef` shows one revealed number with a copy
  button and a `tel:` link, and requires the outcome of that call before another
  number can be opened. The page has no exit control, but the enforcement is on
  the server: leaving without answering defers the question rather than escaping
  it. A hard client-side lock is impossible - the tab can always be closed - so
  the page does not pretend otherwise. `beforeunload` is suppressed around the
  `tel:` tap, which would otherwise prompt on every call attempt on a phone.
- `/profile/donor-requests` is the donor's side: open requests their blood group
  can answer in their upazila, with the requester's number masked until they
  respond that they can help.
- `/profile` redirects authenticated members to `/profile/donor`.
- `/profile/account` edits the member name and phone and shows joined and
  verification information.
- `/profile/donor` manages blood group, district, upazila, availability,
  eligibility, recent availability history, and a self-reported donation
  summary: exact date, approximate days/months/years ago, or never donated,
  together with a lifetime count. Self-declared age and weight deliberately do
  not affect eligibility. Without an upazila a donor does not appear in upazila
  search, and the form says so.
- `/profile/requests` filters and updates requests owned by the member.
- `/profile/invitations` manages private invitations, donor responses, mutual
  donation confirmation, purpose-limited contacts, and in-app notifications.
- `/profile/history` adds, edits, and deletes validated donation records.
- `/profile/security` changes the password and manages signed-in devices.
- `/profile/settings` stores device-local preferences, downloads the complete
  server-side account export, and starts password-confirmed anonymization.
- `/forgot-password` resets a password after registered-phone OTP verification.
- `/directory/imported` browses the separately labelled archive of third-party
  public listings. Browsing never shows a number; see the reveal rules below.
- `/directory/imported/:id` shows and claims one imported record by opaque
  public ID. `/directory/:id` remains a compatibility alias.
- `/community` lists bounded pages of published donation stories and health
  suggestions. `/community/:slug` is a stable public article URL.
- `/community/new` lets an authenticated member publish a Markdown donation
  story with at most one image, or a text-only health suggestion.
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
- Donor search masks every phone number, for guests and signed-in members
  alike. A number is unmasked only by an explicit, recorded reveal against a
  published request, and only for a donor still in that request's own results.
  A call page carries a revealed number, so those routes are `noindex`.
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
- `DonorProfile`, including a structured last-donation declaration, lifetime
  donation count, private detailed donation history, and availability history
- `RecipientProfile`
- `BloodRequest`
- `Comment`
- `ContactDetail`
- `AuthSession`
- `DonorResponse` and `AppNotification`
- `ModerationReport`, `SupportTicket`, and `AuditEvent`
- `Organization`, including verification state and public campaigns
- `CommunityPost`, stored as a draft, published, hidden, or deleted document
  with an immutable public slug after first publication

API routes:

- `POST /api/auth/login` authenticates by phone and password, sets the
  `drop_session` cookie, and returns the sanitized user.
- `POST /api/auth/otp/request` and `/api/auth/otp/verify` create purpose-bound,
  expiring phone-verification tokens for `REGISTER`, `RESET_PASSWORD`,
  `CHANGE_PHONE`, and `SIGN_IN`. Non-production uses console delivery when
  no channel is configured; production and incomplete explicit HTTP settings
  fail closed. A failed send invalidates the new challenge so it creates no
  false cooldown.
- `SIGN_IN` exists for the blood request flow, where someone gives a phone
  number without first saying whether they have an account. It is the only
  purpose that works either way, and verification returns `account_exists` -
  after the caller has entered the code sent to that number, so they learn
  about their own phone and nobody else's. There is deliberately no endpoint
  that answers "is this number registered?" on its own.
- `POST /api/auth/otp/login` exchanges a verified `SIGN_IN` challenge for a
  session, so a requester is not blocked by a forgotten password. The password
  path is unchanged and still offered.
- `POST /api/auth/register` consumes a registration or `SIGN_IN` token, creates
  a verified user, and starts an optional donor profile as unavailable. Being
  listed is a separate opt-in from giving a blood group.
- `POST /api/auth/logout` revokes the current session and clears the cookie.
- `POST /api/auth/reset-password` consumes a verified recovery challenge,
  changes the password, and revokes every existing session.
- `GET /api/search/donors?blood_group&district&upazila` is the search behind the
  blood request flow. It is open to everyone and **masked for everyone**,
  including signed-in members. It returns `{ query, registered, directory,
  totals, contact_access: 'masked' }`: registered members who opted in, then
  public directory listings to fill the page. Compatible blood groups are
  included, with the patient's exact group ranked first and registered members
  ranked above listings. Result cards explicitly identify registered donors;
  imported cards retain their source attribution and state that they are not
  registered with Drop.
- `POST /api/search/requests` creates and publishes in one step, because the
  flow has a single submit. It requires explicit consent, resolves the district
  server-side rather than trusting client coordinates, and takes the requester's
  phone from their verified account. A repeat for the same group and upazila
  within six hours returns the request already in flight rather than a 409:
  re-searching after a dead-end call is not a mistake to error at.
- `POST /api/requests/:id/reveals` unmasks one donor's number. It requires a
  verified session, ownership of an active request, and - the check that matters
  - that the donor is still in that request's freshly recomputed results.
  Without that, one published request would be a bulk lookup oracle for the
  whole imported directory. It also refuses while an earlier reveal has no
  reported outcome, which is what actually enforces "answer before calling
  someone else". Rate-limited separately at 60 per 15 minutes.
- `POST /api/requests/:id/call-reports` records what happened on the call.
  Nothing there changes the donor's own record: a requester saying a donor is
  ill or recently donated is an unverified third-party claim, and acting on it
  would let anyone deactivate any donor with one click.
- `GET /api/me/donor-requests` and `POST /api/requests/:id/donor-reports` are
  the donor's half: requests their group can answer in their upazila, with the
  requester's number masked until they say they can help. A donor's report about
  themselves *may* update their own record, because it is self-declared.
- `GET /api/admin/call-reports` exposes the full reveal and outcome trail to
  staff with `MODERATE_CONTENT`.
- `GET /api/donors/search?blood_group&lat&lng&area_name` is the older radius
  search, still used by request publication and invitations. It returns
  `{ donors, total, contact_access, query }` and caps results at 50.
- `GET /api/me` returns the authenticated user.
- `PATCH /api/me` validates and updates the authenticated user's name and
  phone, rejects duplicate phone numbers, and refreshes donor partitions.
- `POST /api/me/change-password` verifies the current password and stores a
  bcrypt hash of the new password (minimum 8 characters).
- `GET/DELETE /api/me/sessions` and `POST /api/me/logout-all` expose and revoke
  device sessions without disclosing opaque tokens.
- `GET /api/me/export` returns the member's account, requests, responses,
  notifications, reports, and authored community posts. `DELETE /api/me`
  requires the current password, removes donor/private patient data and
  authored post content/images, cancels active requests, revokes sessions, and
  anonymizes records retained for coordination and safety auditing.
- `GET /api/me/requests` returns requests owned by the current user.
- `POST /api/me/donor-profile` updates donor profile and donation-history data,
  validates exact/approximate/never declarations and lifetime counts, derives a
  canonical eligibility date on the server, records availability changes, and
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
- Public `GET /api/community` and `GET /api/community/:slug` expose only
  published post projections. Authenticated create, image, publish, owner-list,
  and delete routes keep drafts private; staff moderation can hide or restore a
  post. `/media/community/:key` is public only while a published post references
  it; the author can preview an attached draft image through their own session.
- Public and protected `/api/organizations` routes support directory listing,
  applications, operator review, role assignment, and campaign publication.
- `GET /api/stats` returns public network counts for the landing page:
  `donors` (the headline: registered donor profiles plus unclaimed imported
  listings), its `directory_donors` and `registered_donors` components,
  available donors, and active/fulfilled requests. Claimed listings are counted
  once, as registered profiles. If the imported table cannot be read, `donors`
  and `directory_donors` are `null` and the landing page renders a dash rather
  than a count that omits the directory.
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
- `community_posts` stores posts on demand with real filter columns for ID,
  slug, author, type, status, publish/update times, and image key; it is never
  loaded into the boot-time cache.
- `donors_<district>_<blood_group>` stores searchable donor partitions.
- `imported_donors` stores claimable donor stubs imported from other
  organisations' public listings. Unlike every other table it is never loaded
  into the runtime cache, because it is orders of magnitude larger than the
  account tables. Its filter columns (`public_id`, `blood_group`, `district`,
  `upazila`, `phone`, `claim_status`, `source_id`, `search_text`) are stored as real
  columns so LanceDB can push predicates down; the full record still travels in
  `doc`. Internal row IDs are never exposed through the API. Every row carries a
  phone number; rows imported before that rule are deleted when the table is
  first opened. Existing tables receive new filter columns through schema
  evolution and a batched, non-destructive backfill that preserves row identity
  and claim state. The backfill tracks the rows it has rewritten, because a
  value can legitimately stay empty afterwards (a source that publishes no
  upazila) and would otherwise be re-selected forever.
- `common_call_reports` records every revealed contact and every reported call
  outcome. Like `imported_donors` it is queried on demand and never boot-loaded:
  one search can show fifty donors and each reveal is expected to produce an
  outcome, so this is the table that would reach the 10,000-row cache ceiling
  first. Filter columns are `kind`, `request_id`, `actor_id`, and `donor_ref`.
  It is append-only; there is no update path.

Records are stored as JSON strings in a `doc` field. LanceDB vectors use
`[lng, lat]` for donor/request location searching; community posts use
publication epoch days to return the newest public articles without boot-loading
the table.

Important helpers:

- `getDb()` opens the `.lancedb` connection.
- `ensureTable()` creates a table with a temporary schema row if missing.
- `getPartitionName()` builds donor partition table names.
- `syncDonorToPartition()` inserts or replaces an available donor in the correct partition.
- `removeDonorFromAllPartitions()` clears stale donor rows before profile resync.
- `getAllFromTable()` loads saved JSON documents.
- `saveToTable()` replaces a document by `id` using escaped ID filters.
- `ensureImportedDonorTable()`, `addImportedDonors()`, public/storage-specific
  deletion helpers, `queryImportedDonors()`, `queryImportedDonorsForRequest()`,
  `countImportedDonors()`, `getImportedDonor()`, and `replaceImportedDonor()`
  serve the imported archive without loading it into memory.
- `ensureCallReportTable()`, `addCallReports()`, `queryCallReports()`, and
  `countCallReports()` do the same for reveal and call-outcome records.
- `buildImportedFilter()` and `buildCallReportFilter()` are exported so the
  predicate strings, including quote escaping, can be unit-tested directly.

### Upazila reference data

`server/upazilas.ts` is generated by `scripts/generate-upazilas.ts` from the
scraped Bangladesh Scouts register and committed, because `data/` is gitignored.
It lives in `server/` rather than `src/lib/` because the production image
contains only `server/` and `dist/`; `src/lib/upazilas.ts` re-exports it into the
browser bundle, so there is one copy of the data. The module deliberately has no
imports.

Each entry carries a `value`, a `label`, and a `variants` list. The `value` is
byte-identical to the spelling stored on imported donor records, because that
string is the join key for a district and upazila search - changing it would
orphan the listings it is meant to find. The `label` is the English display
name; 35 entries that the source register wrote in Bengali script have a
reviewed transliteration, which is what makes Barguna and Jhalokati usable at
all, since they have no Latin spellings in the source. `variants` lists every
stored spelling of one place, so `getUpazilaVariants()` can build an `IN (...)`
filter that reaches rows written under either spelling. Upazilas have no
coordinates, so matching is string equality and there is no distance fallback.

Regenerate with:

```
docker compose --profile development run --rm app-dev npm run generate-upazilas
```

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
  LanceDB. A valid Bangladesh mobile number is mandatory: a listing nobody can
  call is not a usable donor, and the number is the dedupe key, so rows without
  one are rejected. Unrecognised blood groups and districts are blanked rather
  than guessed, which turns them into fields a claimant has to complete.

These people never registered here, so an imported record is a stub, not an
account:

- Phone numbers are served masked (`+88017••••••78`) everywhere except the
  phone-reveal route, which `toRevealedImportedDonor()` exists solely to serve.
  Browsing the directory never reveals a number.
- That reveal is the one place a scraped number is served in full, and it is
  narrow on purpose: a verified account, an active request the caller owns, a
  donor still in that request's own district and upazila, no unreported previous
  call, and a per-route rate limit. Each reveal is written to
  `common_call_reports`; the first one on a request also writes a
  `REQUEST_CONTACTS_REVEALED` audit event. Deliberately **one** audit row per
  request rather than per reveal, because `common_audit_events` is loaded into
  memory at boot with a 10,000-row ceiling and per-reveal rows would silently
  truncate the moderation trail.
- These people did not sign up here, which is a real asymmetry and not one the
  code can resolve on its own. What the code does do: label every imported
  result with the organisation that published it, say plainly on the call page
  that the person is not expecting the call, never show an invented availability
  status, and require an outcome for each call so wrong and dead numbers get
  found.
- **Anyone listed can remove themselves at `/directory/remove`, with no
  account.** Requiring one would mean signing up in order to leave. Control of
  the number is proved by SMS code (`REMOVE_LISTING`), and
  `POST /api/directory/removals/request` answers identically whether or not the
  number appears, so it cannot be used to test membership of the directory.
  Confirming withdraws every listing carrying that number.
- A withdrawn row is marked `listing_state = 'REMOVED'`, not deleted. Deleting
  would leave no evidence the request was honoured and would let the next
  re-import restore the person; `findRemovedListings()` is what
  `scripts/import-donors.ts` uses to carry a withdrawal across a re-scrape.
  Every read path excludes removed rows by default - `buildImportedFilter()`
  adds the clause unless a caller explicitly passes `includeRemoved`, and
  `getImportedDonor()` reports a withdrawn listing as missing, so search, the
  detail page, the claim flow, and the phone reveal all stop finding it.
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
field is present. Registered results can include the donor's bounded
self-reported last-donation summary and lifetime count; detailed records and
organization names are never projected into search. Request matching is
compatibility-aware: a request for group
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
- `COMMUNITY_MEDIA_PATH` sets the processed story-image directory. Compose sets
  it to `/data/media/community`.
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
- `./data/media/community` and `./data/media-dev/community` persist processed
  story images separately for production and development.
- `./data/scraped` holds the NDJSON produced by `npm run scrape`.
- `drop_node_modules` is the one remaining named volume; it holds development
  dependencies and must stay a volume so it does not shadow the host
  `node_modules`.

`./data/` is git-ignored: it is large and holds personal data.

The production image runs as the unprivileged `node` user and owns
`/data/lancedb` and `/data/media/community`.

Operational endpoints and jobs:

- `/health` reports process liveness, `/ready` reports completed datastore
  initialization, and `/metrics` exposes low-cardinality Prometheus gauges.
- A five-minute background job expires overdue requests and automatically
  pauses stale donor availability while creating an in-app reconfirmation notice.
- `.github/workflows/ci.yml` runs Docker-based type checking, tests, bundle
  creation, dependency audit, and secret scanning.
- `/robots.txt` and `/sitemap.xml` are generated from the deployed request
  origin. The sitemap includes each currently published community slug and its
  last-modified date; hidden and deleted posts are omitted.

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
