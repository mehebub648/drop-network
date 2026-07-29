# Drop Network - Working Plan

This file is the live backlog for the project. Agents must read it before
starting work, remove items once they are completed, and append any new finding
that deserves tracking. See the "Plan File" section in `AGENTS.md` for the rules.

Status snapshot taken at version `0.0.44`. Items are grouped by how they can be
delivered.

---

## Bucket 1 - Fixable in-repo (no credentials, no external service)

### Code quality / polish

- [ ] **Rendered accessibility/browser audit.** Keyboard/focus and reduced
  motion foundations exist, but complete WCAG 2.2 AA review, screen-reader
  testing, target-size/contrast audit, and responsive browser matrix remain.

- [ ] **Pervasive `any` and limited focused tests.** Blood-domain unit coverage
  now exists; add API integration and browser coverage as workflows expand.
- [ ] **Seven truncated upazila/blood-group combinations.** The Bangladesh
  Scouts register caps every search at 500 rows. The 0.0.44 full run hit that
  cap in exactly seven places: Rajshahi/Bagmara (A+, B+, O+),
  Rajshahi/Godagari (B+), Rajshahi/Tanore (B+), and Kurigram/Ulipur (A+, B+).
  Roughly 1-3k donors sit behind those caps. Needs a narrower public filter
  than upazila+group, which the form does not currently expose.
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
- [ ] **In-memory rate limits / runtime cache reset on restart** and are
  per-process; move to a shared store (Redis or the datastore) once a real
  multi-instance deployment exists. Covers the auth/API limiters added in
  0.0.31 and the anonymous comment limiter.

---

## Bucket 2 - Requires API keys / credentials / infra / a developer's hand

These cannot be finished by editing code alone.

- [ ] **Production SMS gateway credentials** - point the provider-neutral HTTP
  adapter at a monitored Bangladesh SMS gateway. Production registration is
  intentionally unavailable until these values are configured.
- [ ] **Geocoding / maps** - Google Maps / Mapbox / OSM-Nominatim key to convert
  districts and GPS into real coordinates and render a map.
- [ ] **Browser geolocation** - HTTPS origin + permission flow wired into search.
- [ ] **Hosted, persistent database** - managed datastore + connection string;
  local `.lancedb/` plus in-memory cache won't survive multi-instance/redeploys.
- [ ] **External push / SMS / email notification delivery** - persisted in-app
  notifications and invitations exist; FCM/APNs or a transactional provider
  plus delivery receipts are still required for off-site alerts.
- [ ] **Partner operating agreements and clinical confirmation.** Organization
  applications, verification, directory listing, roles, and campaigns exist;
  real partners still need contracts, reviewer ownership, and a process for
  hospitals to confirm completed donations.
- [ ] **Production hosting & TLS** - provision the deploy target and a
  TLS-terminating reverse proxy for `findadrop.org`. The canonical `APP_URL` is
  configured, but the production session cookie requires a real HTTPS host.
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
