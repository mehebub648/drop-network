# Drop Network Architecture

Current application version: `0.0.121`

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
hosted database integration. `server/sms.ts` can call Messavo's scoped
automation API or a provider-neutral HTTP SMS gateway. Missing or incomplete
delivery configuration fails closed in every environment, and codes are never
written to application logs.

## Runtime Flow

1. The server starts from `server/server.ts`.
2. `initDbData()` loads complete account-backed tables without a fixed row
   ceiling, indexes sessions by opaque token, and migrates legacy operational
   roles to the staff hierarchy. High-growth call reports and audit events are
   queried only when their protected interfaces request them.
3. The first imported-directory access ensures the filterable columns exist
   (`public_id`, `claim_slug`, `publication_state`, `upazila`, `row_version`), deletes any imported row without a
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
  combined donor search and blood request flow) and `AdminPage` for role-aware
  operations.
- `CommunityPage`, `CommunityPostPage`, and `CommunityEditorPage` provide the
  public feed, public article, and authenticated publishing flow.
- `src/components/community/` renders semantic post cards and Markdown through
  `react-markdown` and GFM without raw HTML or Markdown-provided images.
- `src/components/search/` holds the guided criteria form, combined district
  and upazila step, searchable facility combobox, shared requester-role picker,
  donor result card, and `RequestGate`. The gate reuses completed draft answers,
  summarizes them with explicit Change actions, and splits patient, contacts,
  review, verification, required donor-profile basics, and an explicit
  availability choice into short stages. Age, weight, and donation experience
  stay in the full donor-profile editor instead of blocking onboarding. When
  onboarding begins from search, the donor's district and upazila are prefilled
  from the patient search but remain editable as the donor's home location.
  Role-aware guidance identifies whose information belongs in every field, and
  review keeps the patient, request owner, and donor contact visibly separate.
  The patient stage requires a full patient name plus the blood component,
  units needed, and one broad public reason category; it does not collect a
  detailed diagnosis.
- `src/components/DonorPreferencesFields.tsx` manages bounded preferred areas,
  facilities, travel willingness, and recurring Asia/Dhaka windows. The
  facility picker uses the same generated DGHS snapshot as request search.
- `src/pages/profile/` contains the shared member-area layout plus account,
  donor, request, donation-history, security, and settings screens.
- `src/components/DonationExperienceFields.tsx` and `src/lib/donation.ts` share
  the exact/approximate/never-donated form model between registration and donor
  profile editing. The server remains authoritative for dates and validation.
- `src/components/CallOutcomeGate.tsx` is mounted once in the authenticated app
  shell. It checks for the account's oldest unanswered reveal on initial load,
  navigation, focus, visibility changes, and a bounded polling interval. While
  one exists, its portal renders a non-dismissible dialog and marks `#root`
  inert so pointer, keyboard, and assistive-technology interaction cannot reach
  the page behind it. The contact and required report form therefore follow the
  member across routes and reloads rather than living on a separate page.
- `src/components/` also contains shared layout, authentication shell,
  error-boundary, metadata, and status UI. `src/components/ui.tsx` supplies the
  reusable page heading, surface, status, notice, metric, and empty-state
  primitives used to keep public, member, and staff screens visually aligned.
  `ModalPortal.tsx` renders dialogs at the document root above the sticky site
  header, locks background scrolling, and centralizes Escape handling.
  `BloodBagDoodle.tsx` provides the reusable inline SVG line illustration used
  by the landing and authentication surfaces. Optimized transparent WebP
  doodles under `public/images/doodles/` support the landing sections and the
  shared footer without entering application or API data flow.
- The shared layout supplies the site header and institutional footer. Primary
  navigation is limited to Live requests, Community, and About; donor search,
  account, authentication, and staff tools remain contextual actions. The
  footer links product, company, legal, and safety routes.
- `src/lib/urgency.ts` and `src/lib/utils.ts` contain shared frontend
  utilities. `src/lib/collectionFacilities.ts` loads the selected district's
  generated DGHS facility file from `public/collection-facilities/`, merges
  duplicate registry rows by canonical name and locality, and retains every
  source code as an alias. Branches in different localities remain separate.
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
- `src/index.css` defines the responsive doodle-led cartoon system: a white
  canvas, white surfaces with soft neutral boundaries and shadows, lightweight
  decorative marks behind the shared layout, generated editorial illustrations,
  a shared 92rem content rail, deep-red actions, semantic success/availability
  color, focus and reduced-motion behavior, admin workspace layout, shared
  controls, and Tailwind CSS usage.

Routes:

- `/` is a search-led landing page with the complete blood group, location,
  collection-facility, and requester-role flow presented in short stages. The
  location stage keeps district and upazila together, with upazila enabled only
  after its district is known. Only the current stage, its answers, and
  Back/Search controls are visible. It persists that guided draft into `/directory`, alongside
  network context, privacy explanations, request preparation, safety guidance,
  and FAQs elsewhere on the page.
- `/requests` lists bounded pages of public blood requests with server-side
  blood-group/district/urgency filters persisted in the URL and makes the
  collection facility visible on each request card.
- `/request/:id` shows one request, its collection facility and address, donor
  matches, patient/contact details, and comments. Owners can correct the
  collection location while a request is active.
- `/login` logs in an existing user by password or a purpose-bound Messavo
  verification code, including passwordless accounts created by a claim.
- `/register` verifies a Bangladesh mobile by OTP before creating an account.
- `/request/new` no longer exists and redirects to `/directory`. Posting a blood
  request is not a separate form any more: searching for donors is how a request
  is created (see below).
- `/directory` is the combined search and request flow. It asks for blood group,
  district and upazila together, collection facility, and requester role in a
  guided sequence with nothing pre-selected - a wrong default silently searches the wrong
  place. No stage label or progress indicator surrounds those questions. After
  a search, the page continues with a compact summary of the carried
  criteria and an in-place refine panel instead of repeating the initial hero.
  A shared URL without request context opens that panel automatically before a
  contact can be requested. Results show the masked phone directly beneath
  each donor's name; the full number still requires the recorded reveal flow. The imported-
  listing claim option is shown only to guests, because signed-in members
  already have a donor profile. An eligible signed-in member's own donor
  profile appears first with “Your profile” and “Phone verified” labels; its
  action opens profile management rather than revealing the member's own
  number. Asking for another donor's number opens the patient-details gate.
  Previously completed search, role,
  patient, and contact answers are summarized rather than requested again and
  remain editable. Separate patient, contact, and review stages carry explicit
  publication consent before the inline sign-in; publishing the request is what
  unmasks the number. The keyboard-operable
  facility combobox preloads and searches only the selected district. The
  generated snapshot includes every DGHS registry function except the two
  `Administration` values, `Administrative`, and `Knowledge Management
  (Medical Library)`, consolidates duplicate codes for the same facility and
  locality, orders the selected upazila first, and retains manual
  entry when no suggestion matches. Registry inclusion is not proof of current
  service availability.
- Revealing a donor from `/directory` opens the global call-outcome dialog over
  the current page with copy and `tel:` controls. The page behind it is inert,
  the dialog cannot be dismissed, and navigation, reload, focus, or another
  open tab restores the same pending report until it is saved. The server also
  refuses another reveal while any request owned by the account has an
  unanswered one. `/directory/call/:requestId/:donorRef` is now only a private
  compatibility route that redirects old links to `/directory`.
- `/profile/donor-requests` is the donor's side: open requests their blood group
  can answer in their upazila, with the requester's number masked until they
  respond that they can help.
- `/profile` redirects authenticated members to `/profile/donor`.
- `/profile/account` edits the member name and phone and shows joined and
  verification information.
- `/profile/donor` manages blood group, district, upazila, availability,
  eligibility, recent availability history, and a self-reported donation
  summary: exact date, approximate days/months/years ago, or never donated,
  together with a lifetime count. Self-declared age, weight, and an optional
  private medical-condition or current-sickness note deliberately do not affect
  eligibility. That health note is not published in donor search; the
  collection facility makes the final decision. Without an upazila a donor
  does not appear in upazila search, and the form says so.
- `/profile/requests` filters and updates requests owned by the member.
- `/profile/responses` presents invitations and the persisted two-party
  donation follow-up timeline. `/profile/invitations` remains a compatible
  alias.
- `/follow-up` opens fragment-token reminder links without sending the token to
  the server during initial navigation. Registered donors authenticate normally
  or with `DONATION_FOLLOW_UP` OTP; imported donors verify the listed number and
  continue through the existing claim/create-account flow.
- `/profile/contact-reports` is the donor's private remediation inbox. It shows
  aggregate categories without reporter identities or notes, supports current-
  phone Messavo reverification, links to corrective profile actions, and accepts
  private disputes for staff review.
- `/profile/history` adds, edits, and deletes validated donation records.
- `/profile/security` changes the password and manages signed-in devices.
- `/profile/settings` stores device-local preferences, downloads the complete
  server-side account export, and starts password-confirmed anonymization.
- `/forgot-password` resets a password after registered-phone OTP verification.
- `/directory/imported` redirects to search; there is no browsable donor
  directory.
- `/c/:slug` is the short, masked, no-index owner claim flow. The owner may
  change the phone before OTP; a matching phone claims the imported stub while
  a different unique phone creates or updates a separate passwordless donor
  profile and leaves the stub unclaimed. `/directory/imported/:id` and
  `/directory/:id` redirect old opaque-ID links to the short route.
- `/contribute` accepts a private donor suggestion from any visitor and returns
  a 30-day claim link. It sends no SMS and the entry remains unsearchable until
  its phone owner verifies, reviews every field, and consents.
- `/community` lists bounded pages of published donation stories and health
  suggestions. `/community/:slug` is a stable public article URL.
- `/community/new` lets an authenticated member publish a Markdown donation
  story with at most one image, or a text-only health suggestion. A donor can
  start from `/profile/history`; Drop creates a private `DONATION_STORY` draft
  containing only the date, organization, lifetime total, original text, and
  optional image the donor explicitly selects before review and publication.
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
  The revealed contact is held in the global call-outcome dialog, not a route.
  Legacy call URLs remain `noindex` while they redirect to search.
- Account and donor-match UI shows phone verification state. Registration,
  recovery, request ownership, and listing removal display safe Messavo delivery
  progress and a resend action after failed or cancelled jobs. Client polling
  stops once Messavo hands the SMS to the mobile network.
- A React error boundary displays a fallback if a route render fails.
- The interface uses consistent English production copy; no translation
  provider or unfinished language control is exposed.
- `RouteMetadata` updates route titles, descriptions, canonical URLs, and Open
  Graph fields. The public manifest and service worker provide an installable,
  cache-first fallback shell without caching API responses.

## Backend

`server/server.ts` owns the API, an in-memory write-through runtime cache,
session issuance, request validation, capability enforcement, and static
serving. `server/sms.ts` resolves either Messavo automatic delivery or the
configured provider-neutral HTTP transport and never silently downgrades an
explicitly incomplete provider.

Security middleware:

- `helmet` sets security headers; a strict CSP (`default-src 'self'`,
  inline styles allowed for Tailwind) is applied in production and disabled in
  development so Vite HMR works.
- `express-rate-limit` applies a general `/api` limiter (300 requests / 15 min
  per IP) and a strict limiter on login and register (10 / 15 min per IP).
  `trust proxy` is set to 1 for deployment behind a reverse proxy.
- `DailySearchBudget` additionally limits donor discovery by both authenticated
  account and IP address to three districts, three blood groups, and nine unique
  blood-group/district/upazila searches per Dhaka day. Its fingerprint excludes
  `page`, so every page of an unchanged search is a continuation. This budget
  is in memory and per process; the general API limiter still applies to every
  page request.
- Passwords are hashed with bcrypt (10 rounds). Legacy plaintext records are
  transparently re-hashed on the next successful login.
- Sessions are opaque UUID tokens indexed by token and delivered in an
  httpOnly, `SameSite=Lax` cookie (`Secure` in production) with a 7-day TTL.
  Every cookie-authenticated mutation must also carry an `Origin` matching
  `APP_URL` or an explicitly allowed CORS origin.
- API responses never include the `password` field (`sanitizeUser`).
- Admin actions are capability-checked by `staff_role`. Member suspension,
  staff assignment, and session revocation enforce hierarchy and self/last-
  superadmin protections, require reasons, and write before/after audit context.

Main data types:

- `User`
- `DonorProfile`, including a structured last-donation declaration, a
  `donations_before_history + donation_history.length` lifetime total, private
  detailed records with optional owner note and confirmed-request link,
  availability history,
  preferred areas/facilities, travel willingness, recurring windows, and a
  private coordination note
- `RecipientProfile`
- `BloodRequest`
- `Comment`
- `ContactDetail`
- `AuthSession`
- `DonorResponse`, `DonationFollowUp`, `FollowUpDelivery`,
  `ContactedDonorSummary`, and `AppNotification`
- `ModerationReport`, `SupportTicket`, and `AuditEvent`
- `Organization`, including verification state and public campaigns
- `CommunityPost`, stored as a draft, published, hidden, or deleted document
  with an immutable public slug after first publication

API routes:

- `POST /api/auth/login` authenticates by phone and password, sets the
  `drop_session` cookie, and returns the sanitized user.
- `POST /api/auth/otp/request` and `/api/auth/otp/verify` create purpose-bound,
  expiring phone-verification tokens for `REGISTER`, `RESET_PASSWORD`,
  `CHANGE_PHONE`, `SIGN_IN`, and `REMOVE_LISTING`. The request response includes
  the challenge ID, delivery state, and expiry. `GET /api/auth/otp/:challengeId/status`
  polls an enumeration-safe state without returning the phone, purpose, code, or
  message. This read-only status route uses the global API budget rather than
  consuming the smaller authentication-attempt budget. Failed, cancelled, and
  expired deliveries invalidate the challenge;
  replaced and expired queued Messavo jobs are cancelled when possible.
- `SIGN_IN` exists for the blood request flow, where someone gives a phone
  number without first saying whether they have an account. It is the only
  purpose that works either way, and verification returns `account_exists` -
  after the caller has entered the code sent to that number, so they learn
  about their own phone and nobody else's. There is deliberately no endpoint
  that answers "is this number registered?" on its own.
- `POST /api/auth/otp/login` exchanges a verified `SIGN_IN` challenge for a
  session, so a requester is not blocked by a forgotten password. The password
  path is unchanged and still offered.
- `POST /api/auth/register` consumes a registration or `SIGN_IN` token and
  creates a verified user with a donor profile. Blood group, location, and an
  explicit available/not-available choice are required. An available choice
  receives a server timestamp and enters donor matching; an unavailable choice
  may include a private reason that is never projected into donor search.
- `POST /api/auth/logout` revokes the current session and clears the cookie.
- `POST /api/auth/reset-password` consumes a verified recovery challenge,
  changes the password, and revokes every existing session.
- `GET /api/search/donors?blood_group&district&upazila&page&sort&exact_group&phone_verified_only&order_seed`
  is the search behind the
  blood request flow. It is open to everyone and **masked for everyone**,
  including signed-in members. It returns `{ query, registered, directory,
  totals, pagination, contact_access: 'masked' }` in pages of 24: registered
  members who opted in, then attributed imported listings. Compatible blood
  groups are included. Priority is deterministic: phone-verified
  registered profiles, exact group, area/facility/current-time preference fit,
  recent availability confirmation, then fewer active contact issues. Donors
  tied on every active priority field use the returned opaque `order_seed`, so
  the shuffled order remains stable across pagination. Explicit name sorting
  stays alphabetical. Alternative sorts retain the verified-member tier. Optional collection
  facility context adds a safe match reason without returning raw preferences.
  Result cards show the masked phone beneath the donor name and keep separate
  “View profile” and “Request contact” actions. The search-scoped profile summary shows the masked number, safe
  donation summary, match reasons, attribution, and active contact summary
  without creating a browsable donor-profile route. Guests also see the short
  claim route for unclaimed imports; signed-in members do not. Authenticated searches include
  the requester's own profile when it is available, eligible, blood-compatible,
  and matched to the searched area. That card is pinned first and cannot start
  a self-contact reveal.
- `POST /api/search/requests` creates and publishes in one step, because the
  flow has a single submit. It requires explicit consent, resolves the district
  server-side rather than trusting client coordinates, and takes the requester's
  phone from their verified account. In the third-party coordinator flow, that
  verified account number is collected separately from the patient or relative
  number that donors may use for the request; the private account number is
  never accepted from the request payload. A repeat for the same group and upazila
  within six hours returns the request already in flight rather than a 409:
  re-searching after a dead-end call is not a mistake to error at.
- `POST /api/requests/:id/reveals` unmasks one donor's number. It requires a
  verified session, ownership of an active request, and - the check that matters
  - that the donor is still in that request's freshly recomputed results.
  Without that, one published request would be a bulk lookup oracle for the
  whole imported directory. It also refuses while any earlier reveal by the
  account, across all of its requests, has no reported outcome. This closes the
  separate-request loophole in "answer before calling someone else". The route
  is rate-limited separately at 60 per 15 minutes.
- `GET /api/me/reveals/pending` returns the oldest unanswered reveal across all
  requests owned by the authenticated account. `CallOutcomeGate` uses it to
  restore the blocking dialog after navigation, reload, focus, and cross-tab
  changes without putting the revealed phone number into the URL.
- `POST /api/requests/:id/call-reports` records what happened on the call.
  A single report never changes a donor's own record. Public summaries count a
  verified requester once per donor/category and begin at one; owner/staff
  resolutions make older evidence stale without deleting it. Three distinct
  wrong-number or unreachable reporters within 90 days temporarily suppress a
  donor from search.
- `GET /api/me/donor-requests` and `POST /api/requests/:id/donor-reports` are
  the donor's half: requests their group can answer in their upazila, with the
  requester's number masked until they say they can help. A donor's report about
  themselves *may* update their own record, because it is self-declared.
- `GET /api/admin/call-reports` exposes the full reveal/outcome trail, aggregate
  patterns, disputes, and suspension state to staff with `MODERATE_CONTENT`.
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
  canonical eligibility date on the server, stores an optional private reason
  for non-available states, records availability changes, and refreshes donor
  partitions. It also validates up to 10 canonical preferred areas, 8 facility
  codes against the generated DGHS registry, 3 recurring Asia/Dhaka windows,
  travel willingness, and a 500-character private coordination note.
- `POST /api/requests` creates a complete private draft for a verified owner;
  `POST /api/requests/:id/publish` records consent and activates it.
- Both request-creation paths deduplicate open requests by normalized
  patient-side phone, blood group, district, and upazila. Owners receive their
  existing request; another account receives only `DUPLICATE_ACTIVE_REQUEST`.
- `POST /api/requests/:id/invitations` privately invites a currently eligible
  matched donor without disclosing either party's phone.
- `GET /api/me/invitations`, `PATCH /api/responses/:id`, and
  `POST /api/responses/:id/confirm-donation` remain compatibility interfaces
  for acceptance, arrival, and mutual confirmation.
- `GET /api/requests/:id/contacted-donors` returns the owner's masked contact
  ledger. `POST /api/donation-follow-ups/open`, `/verify`, and
  `/:id/outcome` handle fragment tokens, purpose-bound OTP, and independent
  donor/requester outcomes.
- `POST /api/me/donations/:id/share-draft` creates or refreshes the private,
  deterministic story draft for an owned donation record. It ignores private
  notes and request data, and never publishes. `GET /api/me/community/:id`
  reopens that owner-only draft for explicit review, image choice, and consent.
- `GET /api/me/notifications` and its read endpoint provide persisted in-app
  delivery. Consented donation follow-ups use transactional SMS; push and email
  remain future provider work.
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
- `GET /api/requests/:id` publishes the chosen coordination contacts while a
  request is active or partially fulfilled, then removes them from public
  responses after fulfilment, cancellation, or expiry. Patient identity and
  internal references remain purpose-limited. Request owners receive a preview
  from the same registered-plus-imported upazila matcher used by donor search;
  public viewers are not shown a fabricated zero-match section.
- `PATCH /api/requests/:id/details` lets the request owner update patient, requester, date, and contacts.
- `POST /api/requests/:id/comments` adds a comment with anonymous rate limits.
- `DELETE /api/requests/:id/comments/:commentId` lets the request owner delete comments.
- `PATCH /api/requests/:id/status` lets the request owner update request status.
- `GET /api/directory` and `GET /api/directory/sources` return 404 so imported
  records cannot be enumerated outside scoped donor search.
  `GET /api/directory/:id` addresses one record by opaque `public_id` and always
  masks its phone. Claimed or pending records are readable only by the claimant
  or active staff.
- `GET /api/claims/:slug` returns one masked claim stub and
  `POST /api/claims/:slug/complete` accepts only a `CLAIM_PROFILE` verification
  token for the submitted phone. Knowing the slug is never authorization.
- `POST /api/contributions` stores an owner-unverified suggestion privately,
  collapses duplicate phones, and returns the same neutral response shape.
  Honeypot, IP, browser-fingerprint, and phone controls limit intake; it never
  sends an unsolicited message.
- `GET /api/me/contact-reports` returns only the owner's active aggregate
  categories and suspension state. Phone reverification and dispute endpoints
  append protected evidence; donor-profile corrections append category-specific
  resolutions automatically.
- `GET /api/admin/call-reports` returns paged operational evidence and
  aggregations to staff. The contact-report action endpoint supports audited
  suspension, restoration, and dispute resolution without deleting evidence.
- The legacy authenticated `POST /api/directory/:id/claim` and staff claim
  review routes remain compatible for one release.

## Data Storage

`server/db.ts` wraps LanceDB access.

Tables:

- `common_users` stores user documents.
- `common_requests` stores blood request documents.
- `common_sessions` stores opaque auth session documents.
- `common_otps` stores expiring hashed verification challenges.
- `common_responses` stores private donor invitations and response state.
- `common_notifications` stores per-user in-app notifications.
- `common_reports` and `common_support_tickets` store moderation operations.
  `common_audit_events` is append-only and queried on demand by the protected
  staff audit interface rather than loaded at startup.
- `common_organizations` stores partner applications, verification state, and
  campaign records.
- `community_posts` stores posts on demand with real filter columns for ID,
  slug, author, type, status, publish/update times, and image key; it is never
  loaded into the boot-time cache. A private `source_donation_id` in the JSON
  document makes donation-story draft creation idempotent and is never exposed
  by a public projection.
- `donors_<district>_<blood_group>` stores searchable donor partitions.
- `imported_donors` stores claimable donor stubs imported from other
  organisations' public listings. Unlike every other table it is never loaded
  into the runtime cache, because it is orders of magnitude larger than the
  account tables. Its filter columns (`public_id`, `claim_slug`,
  `publication_state`, `contact_state`, `contribution_expires_at`, `blood_group`, `district`,
  `upazila`, `phone`, `claim_status`, `source_id`, `search_text`) are stored as real
  columns so LanceDB can push predicates down; the full record still travels in
  `doc`. Internal row IDs are never exposed through the API. Every row carries a
  phone number; rows imported before that rule are deleted when the table is
  first opened. Existing tables receive new filter columns through schema
  evolution and a batched, non-destructive backfill that preserves row identity
  and claim state. Stable claim slugs are collision-checked across the table.
  The backfill tracks the rows it has rewritten, because a
  value can legitimately stay empty afterwards (a source that publishes no
  upazila) and would otherwise be re-selected forever.
- `common_call_reports` records every revealed contact and every reported call
  outcome. Like `imported_donors` it is queried on demand and never boot-loaded:
  one search can show fifty donors and each reveal is expected to produce an
  outcome. Filter columns are `kind`, `request_id`, `actor_id`, and `donor_ref`.
  It is append-only; there is no update path.

Records are stored as JSON strings in a `doc` field. LanceDB vectors use
`[lng, lat]` for donor/request location searching; community posts use
publication epoch days to return the newest public articles without boot-loading
the table.

Important helpers:

- `getDb()` opens the `.lancedb` connection.
- `ensureTable()` creates a table with a temporary schema row if missing.
- `getPartitionName()` builds donor partition table names.
- `syncDonorToPartition()` inserts or replaces an available donor in the correct
  partition while omitting password, private medical/coordination fields, raw
  preferred areas/facilities, and contact windows from the search copy;
  `common_users` remains the authoritative account record.
- `server/donorPreferences.ts` validates canonical areas, facility registry
  membership, schedule bounds, travel willingness, and private note length.
  `server/donorSearch.ts` owns preference-aware place eligibility, safe match
  reasons, deterministic priority fields, and the stable seeded tie-breaker.
- `removeDonorFromAllPartitions()` clears stale donor rows before profile resync.
- `getAllFromTable()` loads saved JSON documents.
- `saveToTable()` replaces a document by `id` using escaped ID filters.
- `ensureImportedDonorTable()`, `addImportedDonors()`, public/storage-specific
  deletion helpers, `queryImportedDonors()`, `queryImportedDonorsForRequest()`,
  `countImportedDonors()`, `getImportedDonor()`, and `replaceImportedDonor()`
  serve scoped search, ownership, removal, and moderation without loading the
  imported collection into memory.
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

## Imported Donor Records

Several Bangladesh organisations publish open donor listings. `scripts/scrape/`
reads those listings and `scripts/import-donors.ts` loads them into
`imported_donors`. Both are standalone scripts run through Docker Compose; the
server never scrapes anything at runtime.

- `server/importedDonors.ts` holds the shared registry (`IMPORT_SOURCES`), the
  record shape, dedupe keys, opaque SHA-256 public/storage identities, stable
  collision-checked 12-character claim slugs, publication state, phone masking,
  and claim decision logic. Public IDs and claim slugs contain neither raw nor
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
  A dry run reads existing rows and reports preserved claims, withdrawals, and
  private contributions without writing. A real import merges all ownership,
  removal, publication, and contribution fields by stable public ID before
  replacing rows, so refreshes do not undo owner actions.

These people never registered here, so an imported record is a stub, not an
account:

- Phone numbers are served masked (`+88017••••••78`) everywhere except the
  phone-reveal route, which `toRevealedImportedDonor()` exists solely to serve.
  There is no browsable donor directory; records are returned only by scoped
  search or an opaque ownership link.
- That reveal is the one place a scraped number is served in full, and it is
  narrow on purpose: a verified account, an active request the caller owns, a
  donor still in that request's own district and upazila, no unreported previous
  call, and a per-route rate limit. Each reveal is written to
  `common_call_reports`; the first one on a request also writes a
  `REQUEST_CONTACTS_REVEALED` audit event. Deliberately **one** audit row per
  request rather than per reveal so the moderation trail stays useful without
  multiplying routine contact events.
- These people did not sign up here, which is a real asymmetry and not one the
  code can resolve on its own. What the code does do: label every imported
  result with the organisation that published it, say plainly in the call-outcome
  dialog that the person is not expecting the call, never show an invented
  availability status, and require an outcome for each call so wrong and dead
  numbers get found.
- Active wrong-number, unreachable, declined, recently-donated, distance, and
  health-related counts appear from the first distinct verified requester.
  Notes and identities stay in protected staff evidence. Three independent
  connection failures in 90 days set `contact_state = 'SUSPENDED'`; search and
  reveal exclude the row, while its owner claim link remains available.
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
- A record becomes a real donor profile through `/c/:slug`. The claimant first
  chooses and verifies a phone through Messavo, then confirms name, blood group,
  district, upazila, availability, and explicit consent with no guessed default.
  If the number matches the imported phone the stub is claimed automatically.
  If it differs, Drop creates or updates the verified number's own profile and
  leaves the original stub unclaimed.
- `/contribute` writes a `PRIVATE_PENDING` stub with a 30-day expiry. It never
  enters search and never triggers SMS at intake. Only the phone owner's
  verified claim and availability consent create a searchable registered donor.
- The legacy 21-account datastore is deliberately not mounted or migrated; it
  remains restricted recovery evidence and cannot enter current search.

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
  defaults to the current hosted HTTPS address for the production Compose
  service. Domain replacement is configuration-only.
- `LANCEDB_PATH` sets the datastore directory inside the container. Docker
  Compose sets it to `/data/lancedb`.
- `COMMUNITY_MEDIA_PATH` sets the processed story-image directory. Compose sets
  it to `/data/media/community`.
- `ADMIN_PHONE` bootstraps the first verified administrator by normalized
  Bangladesh phone as `SUPERADMIN`; further staff changes require the
  `MANAGE_STAFF` capability.
- `METRICS_TOKEN` is a minimum 32-character bearer secret for the detailed
  production `/metrics` endpoint. `/api/stats` remains public and coarse.
- `SMS_PROVIDER` selects `messavo` or the legacy provider-neutral `http`.
  `woven` remains a compatibility alias for `messavo`; blank, incomplete, unknown,
  and `console` values fail closed.
- `SMS_API_BASE_URL` and `SMS_API_TOKEN` are both required when
  `SMS_PROVIDER=messavo`. The adapter appends `/api/v1/messages`, sends Messavo's
  `{to, message}` contract with a stable idempotency key, and requires a `202`
  queued response. An unexpected manual `pending_approval` result is rejected.
  The private key requires `messages:send`, `messages:read`, and
  `messages:cancel`; status and cancellation use the existing job routes. The
  canonical hosted API base URL is `https://messavo.cloud`.
- `SMS_HTTP_ENDPOINT` and `SMS_HTTP_TOKEN` are both required when
  `SMS_PROVIDER=http`; an incomplete explicit configuration fails closed.
- `common_app_settings` persists the superadmin-controlled OTP bypass switch.
  Bypass mode creates short-lived, purpose-bound bypass challenges without
  sending or accepting a code; registration, sign-in, password reset, phone
  changes, and imported-listing removal can then proceed for controlled tests.
  Bypass challenges become unusable as soon as the switch is disabled and do
  not revive after a later re-enable. The public config and every rendered page
  expose the active warning state, and each switch change is reason-gated and
  audited. Only the `MANAGE_SYSTEM` capability, held by superadmins, can change
  it. Production startup disables any persisted bypass and refuses attempts to
  turn it back on.

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

The production process runs as the unprivileged `node` user and owns
`/data/lancedb` and `/data/media/community`. The dependency tree remains
root-owned and read-only; the image build does not recursively rewrite
ownership for files the process never needs to modify. Package metadata,
server source, and the compiled `dist` tree are assigned to `node` as they are
copied. Static directories are normalized to mode `755` and files to `644`, so
restrictive source-archive modes cannot prevent the runtime from serving them.

Operational endpoints and jobs:

- `/health` and `/ready` read the critical production shell, service worker,
  manifest, icon, doodles, and hashed JavaScript/CSS files before reporting
  healthy. Production startup fails when that asset set is missing, empty, or
  unreadable, and the Compose health check calls `/health`. `/ready` also
  requires completed datastore initialization, configured OTP and follow-up
  SMS credentials, a dedicated follow-up link secret, disabled OTP bypass, and
  a protected metrics token. `/metrics` exposes low-cardinality
  Prometheus gauges only to a valid bearer token in production.
- A five-minute background job expires overdue requests, automatically pauses
  stale donor availability, and resumes persisted follow-up delivery after a
  restart. Follow-ups run outside 9 PM-8 AM Asia/Dhaka quiet hours, retry at
  most three times, and permit one donor-selected next-day reminder.
- `.github/workflows/ci.yml` runs Docker-based type checking, tests, bundle
  creation, dependency audit, and secret scanning.
- `/robots.txt` and `/sitemap.xml` are generated from the deployed request
  origin. The sitemap includes each currently published community slug and its
  last-modified date; hidden and deleted posts are omitted.

## Current Constraints

- Production registration requires either a complete Messavo API
  configuration (`SMS_PROVIDER=messavo`, `SMS_API_BASE_URL`, and a privately
  stored scoped `SMS_API_TOKEN`) or the legacy complete HTTP configuration.
- Production follow-ups additionally require a dedicated automatic-send
  `SMS_FOLLOWUP_API_TOKEN` and a separate 32+ character
  `FOLLOW_UP_LINK_SECRET`.
- OTP bypass is an explicit persisted non-production test setting, not an
  automatic fallback.
  It deliberately removes phone-ownership proof across all OTP-protected
  activities and must remain disabled outside controlled testing.
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
