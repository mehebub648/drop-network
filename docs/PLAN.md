# Drop Network - Working Plan

This file is the live backlog for the project. Agents must read it before
starting work, remove items once they are completed, and append any new finding
that deserves tracking. See the "Plan File" section in `AGENTS.md` for the rules.

Status snapshot taken at version `0.0.40`. Items are grouped by how they can be
delivered.

---

## Bucket 1 - Fixable in-repo (no credentials, no external service)

### Code quality / polish

- [ ] **Pervasive `any` and limited focused tests.** Blood-domain unit coverage
  now exists; add API integration and browser coverage as workflows expand.
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
- [ ] **Production hosting & domain** - TLS-terminating reverse proxy, domain,
  deploy target; wire the real `APP_URL` (currently `MY_APP_URL` placeholder).
  The session cookie is `Secure` in production, so HTTPS is required.
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
