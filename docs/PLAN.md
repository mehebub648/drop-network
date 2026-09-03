# Drop Network - Working Plan

This file is the live backlog for the project. Agents must read it before
starting work, remove items once they are completed, and append any new finding
that deserves tracking. See the "Plan File" section in `AGENTS.md` for the rules.

Status snapshot taken at version `0.0.146`. Items are grouped by how they can be
delivered.

---

## Bucket 1 - Fixable in-repo (no credentials, no external service)

### Code quality / polish

- [ ] **Complete the native Android migration.** Inventory every app-visible
  route and API contract, publish the complete language-neutral v1 schema, then
  replace each remaining WebView handoff with a Flutter screen while preserving
  authentication, privacy gates, deep links, uploads, downloads, offline
  recovery, and the UX-001 through UX-016 workflow invariants.
- [ ] **Extract the browser frontend from the backend runtime.** Preserve public
  SEO and social metadata, proxy browser `/api` calls through the web origin,
  and remove Vite/static delivery from the API only after independent build and
  production checks exist.

- [ ] **Post-implementation accessibility validation.** UX-001 through UX-016
  from the 1.0.11 Android-first audit are implemented. Re-capture the affected
  journeys after release, complete a human TalkBack pass on physical hardware,
  and run the remaining keyboard, 200% text, contrast, and low-bandwidth checks
  recorded in `artifacts/ux-research/drop-ux-audit-v1.0.11-2026-09-03.html`.

- [ ] **Pervasive `any` and limited focused tests.** Blood-domain and privacy
  helper coverage now exists; add direct donor-search/admin API integration and
  focused component/browser coverage as workflows expand.
- [ ] **Seven truncated upazila/blood-group combinations.** The Bangladesh
  Scouts register caps every search at 500 rows. The 0.0.44 full run hit that
  cap in exactly seven places: Rajshahi/Bagmara (A+, B+, O+),
  Rajshahi/Godagari (B+), Rajshahi/Tanore (B+), and Kurigram/Ulipur (A+, B+).
  Roughly 1-3k donors sit behind those caps. Needs a narrower public filter
  than upazila+group, which the form does not currently expose.
- [ ] **Registered donors created before 0.0.52 have no upazila** and so never
  appear in upazila search. `/profile/donor` now asks for one, but nothing
  prompts existing donors to fill it in. Notify them once, rather than letting
  them quietly drop out of results.
- [ ] **Quantum donors are mostly unreachable.** Their API reports 58k+ regular
  donors but ignores every paging parameter, so only the ends of each rank list
  can be read (587 records captured). Revisit if they expose paging.
- [ ] **More donor listings.** `sandhani.org` and the medical-college unit sites
  (e.g. `sbmcu.com`) were unreachable while 0.0.44 was built; Badhan's directory
  is behind a login. Revisit and add sources to `IMPORT_SOURCES` when they are
  reachable and genuinely public.
- [ ] **Imported search paging is offset-by-overfetch.** `queryImportedDonors()` in
  `server/db.ts` fetches `offset + limit` rows and slices, because LanceDB has
  no OFFSET. Fine for shallow paging; revisit if deep paging is needed.
- [ ] **`GET /api/donors/search` is now legacy.** The upazila search at
  `/api/search/donors` replaced it for users; the radius version survives only
  because `findDonorMatches()` still backs request publication and invitations.
  Retire the route once those two call sites are migrated.
- [ ] **In-memory rate limits / runtime cache reset on restart** and are
  per-process; move to a shared store (Redis or the datastore) once a real
  multi-instance deployment exists. Covers the auth/API limiters added in
  0.0.31, the anonymous comment limiter, and the per-account/per-IP daily
  search budget added in 0.0.79.

---

## Bucket 2 - Requires API keys / credentials / infra / a developer's hand

These cannot be finished by editing code alone.

- [ ] **Geocoding / maps** - Google Maps / Mapbox / OSM-Nominatim key to convert
  districts and GPS into real coordinates and render a map.
- [ ] **Browser geolocation** - HTTPS origin + permission flow wired into search.
- [ ] **Hosted, persistent database** - managed datastore + connection string;
  the host-bound `./data/lancedb` directory survives ordinary container
  recreation, but the in-memory cache and local datastore are not suitable for
  multi-instance hosting.
- [ ] **Push / email notification delivery** - persisted in-app notifications,
  invitations, and consented Messavo donation follow-ups with delivery receipts
  exist; FCM/APNs and email remain future channels.
- [ ] **Partner operating agreements and clinical confirmation.** Organization
  applications, verification, directory listing, roles, and campaigns exist;
  real partners still need contracts, reviewer ownership, and a process for
  hospitals to confirm completed donations. The generated DGHS district
  suggestions also need a periodic registry refresh and facility-level
  confirmation before any current-service guarantee can be shown.
- [ ] **Production hosting & TLS** - provision the deploy target and a
  TLS-terminating reverse proxy for `findadrop.org`. The canonical `APP_URL` is
  configured, but the production session cookie requires a real HTTPS host.
- [ ] **21 donor accounts stranded in the previous datastore.** `data/lancedb`
  (the live store, started 2026-07-17) holds 1 user; `data/lancedb-legacy-prod`
  still holds 21 users, all with donor profiles, plus 11 `donors_*` partitions.
  Nothing mounts, migrates, or documents that directory. Migrating needs a
  decision first: those people registered under the earlier deployment, so
  re-listing them without notice is a consent question, not just a copy.
- [ ] **CAPTCHA / advanced fraud scoring** - reports, blocking, phone
  verification, moderation roles, and an audit trail now exist, but production
  needs a shared risk provider and operational review procedures.

---

## Bucket 3 - Test-only, must be removed or gated before production

No open items.

---

## Suggested order

1. Provision Bucket 2 long-poles in parallel (SMS, hosted DB, hosting/TLS).
2. Add focused tests and type cleanup around touched areas.
