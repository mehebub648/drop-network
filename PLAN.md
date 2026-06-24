# Drop Network — Working Plan

This file is the live backlog for the project. Agents must read it before
starting work, remove items once they are completed, and append any new finding
that deserves tracking. See the "Plan File" section in `AGENTS.md` for the rules.

Status snapshot taken at version `0.0.3`. Items are grouped by how they can be
delivered.

---

## Bucket 1 — Fixable in-repo (no credentials, no external service)

### Critical correctness bugs

- [ ] **Location hardcoded to Dhaka.** Landing-page search always sends
  `lat: 23.8103, lng: 90.4125` regardless of the chosen district; only
  `area_name` changes, so distance/matching is wrong everywhere except Dhaka.
  `src/App.tsx:556`
- [ ] **Only 4 cities have real coordinates.** Registration and donor-profile
  save map only Chittagong/Sylhet/Rajshahi to coords; every other district
  silently falls back to Dhaka. `src/App.tsx:137`, `src/App.tsx:312`
- [ ] **Inconsistent self-match filter.** `POST /api/requests` filters donors by
  `u.id !== token`, but anonymous requesters are stored under `fingerprint`, so
  an anonymous user can match themselves. `server.ts:392`
- [ ] **Stale donor partitions.** Changing a donor's district or blood group
  never deletes the old `donors_<district>_<group>` row, leaving duplicates.
  `server.ts:342`, `db.ts:37`
- [ ] **`expires_at` never enforced.** Requests are stamped with an expiry but it
  is never applied; the feed grows forever. `server.ts:365`

### Security hardening (no external service required)

- [ ] **No ownership checks on mutations.** `PATCH /requests/:id/status` and
  `PATCH /requests/:id/details` accept any caller — anyone can cancel, fulfill,
  or rewrite any request. `server.ts:487`, `server.ts:578`
- [ ] **Auth token == user ID.** Bearer token is literally `user.id`; seeded
  donors have guessable IDs and no password gate. Logout cannot revoke anything.
  `server.ts:249`, `server.ts:309`
- [ ] **Requester phone leaked publicly.** `GET /api/requests` returns
  `requester_phone` for every request before any reveal gate, contradicting the
  "masked until mutual acceptance" promise. `server.ts:425`
- [ ] **String-interpolated DB filters.** `id = '${...}'` is hand-built in delete
  calls; injection-prone as anonymous fingerprints/names enter records.
  `db.ts:44`, `db.ts:74`
- [ ] **No input validation** on any POST/PATCH body (type/length/schema).
- [ ] **CORS fully open** with no origin restriction. `server.ts:11`

### Code quality / polish

- [ ] **`PORT` hardcoded to 3000** in `server.ts:9`, ignoring the `PORT`/
  `PROD_PORT` env that Docker/compose advertise.
- [ ] **Wrong comment on `getDistance`** — says "Euclidean" but implements
  Haversine. `server.ts:178`
- [ ] **Dead reveal state in `RequestsPage`** (`revealedRequests` /
  `handleRespond`) now that cards just link out. `src/App.tsx:851`
- [ ] **HTML title still "My Google AI Studio App"**; `metadata.json` requests
  `geolocation` that the code never uses. `index.html:6`, `metadata.json:4`
- [ ] **`package.json` name is `react-example`** — generic scaffold leftover.
- [ ] **No 404 route, no error boundaries, no fetch-failure UI** (failures
  `console.error` then silently `navigate('/')`).
- [ ] **Pervasive `any`, no tests, all UI in one ~1450-line `App.tsx`.**
- [ ] **In-memory rate limits / runtime cache reset on restart** and are
  per-process; move to the datastore.

### Feature: rebuild `/profile` as a real multi-page area

Today `/profile` is a single `DonorProfile` component (`src/App.tsx:280`) doing
only blood group / location / availability, a "My Requests" list, and a "Past
Donations" log. A real profile should be a nested-route section with proper
account management. Most of this is in-repo frontend + simple API work; the
sub-items marked **(needs Bucket 2)** depend on external services.

- [ ] **Nested routes / tabbed layout** under `/profile` (e.g.
  `/profile/account`, `/profile/donor`, `/profile/requests`,
  `/profile/history`, `/profile/settings`) with a shared sidebar/tab nav.
  Requires a new `GET`/`PATCH /api/me` update path and route nesting in
  `src/App.tsx:1438`.
- [ ] **Account details page** — view/edit name, phone, profile photo/initials,
  joined date. Needs a `PATCH /api/me` endpoint (none exists today).
- [ ] **Donor page** — current blood group / location / availability, plus
  donation-eligibility countdown derived from `last_donation_date` (e.g. "next
  eligible in N days") and an availability toggle with history.
- [ ] **My Requests page** — full list with status filters (Active / Fulfilled /
  Cancelled), inline status changes, and an empty state (currently jammed into
  the single profile view).
- [ ] **Donation history page** — add/edit/delete records (only add exists now),
  totals, and a simple timeline; validate dates.
- [ ] **Settings page** — notification preferences, privacy (who can see phone),
  language, and account deletion/export controls.
- [ ] **Change password** *(needs Bucket 2: real auth/hashing)* — requires the
  password-security work; cannot ship meaningfully while passwords are plaintext
  and the token is the user id.
- [ ] **Notification preferences** *(needs Bucket 2: notifications infra)* — UI
  can be built now, but real delivery depends on push/email provider.
- [ ] **Replace `alert()` save/feedback** in the profile flows with inline toasts
  / form states (`src/App.tsx:325`).

---

## Bucket 2 — Requires API keys / credentials / infra / a developer's hand

These cannot be finished by editing code alone.

- [ ] **Real OTP / phone verification** — SMS gateway account + API key (Twilio,
  Vonage, or a BD provider such as SSL Wireless / bulksmsbd). Replaces the
  hardcoded `123456`. `server.ts:201`
- [ ] **Password security** — hashing (bcrypt/argon2) + a managed session/JWT
  secret. Currently plaintext. `server.ts:264`
- [ ] **Geocoding / maps** — Google Maps / Mapbox / OSM-Nominatim key to convert
  districts and GPS into real coordinates and render a map.
- [ ] **Browser geolocation** — HTTPS origin + permission flow wired into search
  (`metadata.json` already declares the permission).
- [ ] **Hosted, persistent database** — managed datastore + connection string;
  local `.lancedb/` plus in-memory cache won't survive multi-instance/redeploys.
- [ ] **Push / email notifications** ("someone needs your blood type") — FCM/APNs
  or SendGrid/SES + keys.
- [ ] **Production hosting & domain** — TLS, domain, deploy target; wire the
  real `APP_URL` (currently `MY_APP_URL` placeholder).
- [ ] **Donor verification / anti-abuse** — identity or moderation pipeline,
  possibly a captcha key. Currently `is_verified: true` set unconditionally.

---

## Bucket 3 — Test-only, must be removed or gated before production

- [ ] **Auto-seeded fake data** — 40 random donors + 20 random requests on empty
  DB. `server.ts:91`
- [ ] **Universal demo password** — every seeded donor has `password: 'password'`.
  `server.ts:106`
- [ ] **OTP bypass `123456`** and the on-screen "Use 123456 for testing" hint.
  `server.ts:209`, `src/App.tsx:200`
- [ ] **Fake vanity stats** — "12,000+ Active Donors", "4,500+ Lives Saved".
  `src/App.tsx:812`
- [ ] **Unsupported marketing copy** — "64 districts", "verified donors",
  "masked until mutual acceptance" (only 16 areas, no real verification, phones
  leak). `src/App.tsx:778`, `src/App.tsx:794`
- [ ] **`alert()`-based UX** for saves/errors. `src/App.tsx:325`

---

## Suggested order

1. Bucket 1 security (#ownership checks, token, phone leak) + remove Bucket 3
   demo backdoors (seed data, `123456`, demo passwords) — pure code, highest risk.
2. Bucket 1 location bugs — matching is the core value prop and is broken outside
   Dhaka.
3. Provision Bucket 2 long-poles in parallel (SMS, hashing, hosted DB).
4. Polish (titles, naming, error states, tests, splitting `App.tsx`).
