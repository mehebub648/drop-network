# Drop Network - Working Plan

This file is the live backlog for the project. Agents must read it before
starting work, remove items once they are completed, and append any new finding
that deserves tracking. See the "Plan File" section in `AGENTS.md` for the rules.

Status snapshot taken at version `0.0.63`. Items are grouped by how they can be
delivered.

---

## Bucket 1 - Fixable in-repo (no credentials, no external service)

### Code quality / polish

- [ ] **Resolve current upstream dependency advisories.** `npm audit --omit=dev`
  flags the existing React Router RSC action advisory and PostCSS source-map
  file-read advisories. Drop does not use React Server Components or process
  user-supplied CSS, but compatible patched releases should replace the affected
  versions once available and then be verified through the Docker checks.
- [ ] **Rendered accessibility/browser audit.** Keyboard/focus and reduced
  motion foundations exist, but complete WCAG 2.2 AA review, screen-reader
  testing, target-size/contrast audit, and responsive browser matrix remain.

- [ ] **Pervasive `any` and limited focused tests.** Blood-domain and privacy
  helper coverage now exists; add direct donor-search/admin API integration and
  focused component/browser coverage as workflows expand.
- [ ] **Runtime cache has a 10,000-row load ceiling.** `getAllFromTable()` in
  `server/db.ts` caps account-backed tables at 10,000 rows. Remove or explicitly
  paginate this limit before registered donor volume can exceed it, otherwise
  startup state and public live search can be incomplete.
- [ ] **Continue route-level bundle splitting.** Community and Markdown routes
  now load separately, but the remaining production entry chunk is about 624 kB
  minified and still triggers Vite's 500 kB warning. Lazy-load another large
  route module, especially the administration workspace, before traffic grows.
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
- [ ] **Directory paging is offset-by-overfetch.** `queryImportedDonors()` in
  `server/db.ts` fetches `offset + limit` rows and slices, because LanceDB has
  no OFFSET. Fine for shallow paging; revisit if deep paging is needed.
- [ ] **A re-import resets claim state.** `scripts/import-donors.ts` replaces
  rows by public id, so a re-scrape drops `claim_status`, `claimed_by`, and
  `claim_note` back to unclaimed. Withdrawals are now carried forward through
  `findRemovedListings()`; claim state should be preserved the same way.
- [ ] **Repeatedly reported wrong numbers stay searchable.** Call outcomes are
  recorded in `common_call_reports` but nothing acts on them. Suppress an
  imported listing after N independent `WRONG_NUMBER` reports from different
  requesters, so the same dead number is not handed out repeatedly.
- [ ] **`common_audit_events` is boot-loaded through `getAllFromTable()`** and
  so inherits the 10,000-row ceiling. The reveal flow works around it by writing
  one audit row per request rather than per reveal, but the security log itself
  should move to on-demand querying like `imported_donors` and
  `common_call_reports`.
- [ ] **`GET /api/donors/search` is now legacy.** The upazila search at
  `/api/search/donors` replaced it for users; the radius version survives only
  because `findDonorMatches()` still backs request publication and invitations.
  Retire the route once those two call sites are migrated.
- [ ] **`getCurrentAuth()` linear-scans `sessions` on every request.** The
  search and call flow is the most request-dense in the app (a reveal plus a
  report per donor). Not a problem at current scale; index sessions by token
  before it is.
- [ ] **In-memory rate limits / runtime cache reset on restart** and are
  per-process; move to a shared store (Redis or the datastore) once a real
  multi-instance deployment exists. Covers the auth/API limiters added in
  0.0.31 and the anonymous comment limiter.

---

## Bucket 2 - Requires API keys / credentials / infra / a developer's hand

These cannot be finished by editing code alone.

- [ ] **Production SMS gateway credentials** - point the provider-neutral HTTP
  adapter at a monitored Bangladesh SMS gateway. Production registration is
  intentionally unavailable until these values are configured; the automatic
  console fallback is non-production development behavior only.
- [ ] **Geocoding / maps** - Google Maps / Mapbox / OSM-Nominatim key to convert
  districts and GPS into real coordinates and render a map.
- [ ] **Browser geolocation** - HTTPS origin + permission flow wired into search.
- [ ] **Hosted, persistent database** - managed datastore + connection string;
  the host-bound `./data/lancedb` directory survives ordinary container
  recreation, but the in-memory cache and local datastore are not suitable for
  multi-instance hosting.
- [ ] **External push / SMS / email notification delivery** - persisted in-app
  notifications and invitations exist; FCM/APNs or a transactional provider
  plus delivery receipts are still required for off-site alerts.
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
