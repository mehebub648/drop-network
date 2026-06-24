# Drop Network - Working Plan

This file is the live backlog for the project. Agents must read it before
starting work, remove items once they are completed, and append any new finding
that deserves tracking. See the "Plan File" section in `AGENTS.md` for the rules.

Status snapshot taken at version `0.0.30`. Items are grouped by how they can be
delivered.

---

## Bucket 1 - Fixable in-repo (no credentials, no external service)

### Security hardening (no external service required)

- [ ] **Review dependency audit advisories.** `npm install` reported 8
  vulnerabilities. Run `npm audit` and decide whether safe package updates are
  available without changing app behavior.

### Code quality / polish

- [ ] **Pervasive `any`, no tests, all UI in one large `App.tsx`.** Add focused
  types/tests and split shared UI only when touching those areas.
- [ ] **In-memory rate limits / runtime cache reset on restart** and are
  per-process; move to the datastore.

### Feature: rebuild `/profile` as a real multi-page area

Today `/profile` is a single `DonorProfile` component (`src/App.tsx`) doing only
blood group / location / availability, a "My Requests" list, and a "Past
Donations" log. A real profile should be a nested-route section with proper
account management. Most of this is in-repo frontend + simple API work; the
sub-items marked **(needs Bucket 2)** depend on external services.

- [ ] **Nested routes / tabbed layout** under `/profile` (e.g.
  `/profile/account`, `/profile/donor`, `/profile/requests`,
  `/profile/history`, `/profile/settings`) with a shared sidebar/tab nav.
  Requires a new `PATCH /api/me` update path and route nesting in `src/App.tsx`.
- [ ] **Account details page** - view/edit name, phone, profile photo/initials,
  joined date. Needs a `PATCH /api/me` endpoint.
- [ ] **Donor page** - current blood group / location / availability, plus
  donation-eligibility countdown derived from `last_donation_date` and an
  availability toggle with history.
- [ ] **My Requests page** - full list with status filters (Active / Fulfilled /
  Cancelled), inline status changes, and an empty state.
- [ ] **Donation history page** - add/edit/delete records, totals, and a simple
  timeline; validate dates.
- [ ] **Settings page** - notification preferences, privacy, language, and
  account deletion/export controls.
- [ ] **Change password** *(needs Bucket 2: real auth/hashing)* - requires the
  password-security work.
- [ ] **Notification preferences** *(needs Bucket 2: notifications infra)* - UI
  can be built now, but real delivery depends on push/email provider.

---

## Bucket 2 - Requires API keys / credentials / infra / a developer's hand

These cannot be finished by editing code alone.

- [ ] **Real OTP / phone verification** - SMS gateway account + API key (Twilio,
  Vonage, or a BD provider such as SSL Wireless / bulksmsbd). Replaces the local
  development-only OTP response. `server/server.ts`
- [ ] **Password security** - hashing (bcrypt/argon2) + a managed session/JWT
  secret. Currently plaintext. `server/server.ts`
- [ ] **Geocoding / maps** - Google Maps / Mapbox / OSM-Nominatim key to convert
  districts and GPS into real coordinates and render a map.
- [ ] **Browser geolocation** - HTTPS origin + permission flow wired into search.
- [ ] **Hosted, persistent database** - managed datastore + connection string;
  local `.lancedb/` plus in-memory cache won't survive multi-instance/redeploys.
- [ ] **Push / email notifications** ("someone needs your blood type") - FCM/APNs
  or SendGrid/SES + keys.
- [ ] **Production hosting & domain** - TLS, domain, deploy target; wire the real
  `APP_URL` (currently `MY_APP_URL` placeholder).
- [ ] **Donor verification / anti-abuse** - identity or moderation pipeline,
  possibly a captcha key. Currently `is_verified: true` set unconditionally.

---

## Bucket 3 - Test-only, must be removed or gated before production

No open items.

---

## Suggested order

1. Review dependency audit advisories and decide which updates are safe.
2. Provision Bucket 2 long-poles in parallel (SMS, hashing, hosted DB).
3. Rebuild `/profile` after auth/password direction is settled.
4. Add focused tests and type cleanup around touched areas.
