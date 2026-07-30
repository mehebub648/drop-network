<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

Current version: `0.0.50`

View your app in AI Studio: https://ai.studio/apps/a785fd25-9203-4a0a-badf-b124c492f4ee

## Documentation

- Architecture: [ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- Deployment: [Windows](./docs/Deploy-windows.md) · [Ubuntu](./docs/Deploy-ubuntu.md)
- Agent instructions: [AGENTS.md](./AGENTS.md)
- Plan / backlog: [PLAN.md](./docs/PLAN.md)
- Changelogs: [changelog/](./changelog/)

## Run With Docker

**Prerequisites:** Docker

1. Copy `.env.example` to `.env` and adjust values if needed.
2. Build and run the production-style container:
   `docker compose up --build`

The frontend is built from source inside Docker during the image build. Local
`node_modules/` and `dist/` are not required.

For live development:

`docker compose --profile development up --build app-dev`

The default app runs on `http://localhost:3000`; the dev profile runs on
`http://localhost:3001` unless you override `PORT` or `DEV_PORT`.

## Runtime Configuration

- `PORT` controls the Docker production host port.
- `DEV_PORT` controls the Docker development host port.
- `APP_URL` is the canonical public origin. Production defaults to
  `https://findadrop.org`; development uses its localhost origin.
- `CORS_ORIGIN` can list allowed cross-origin browser origins; same-origin
  production requests do not need it.
- `LANCEDB_PATH` is set inside Docker Compose to `/data/lancedb`, bind-mounted
  from `./data/lancedb` (production) or `./data/lancedb-dev` (development) on
  the host. The datastore is a plain directory you can back up or copy; it is
  git-ignored because it holds personal data.
- Registration requires a verified Bangladesh mobile. Outside production, an
  unconfigured OTP channel prints the code to protected server logs; production
  requires the complete provider-neutral HTTP SMS gateway settings documented
  in `.env.example` and never falls back to console delivery.
- `/directory` lets anyone search registered donors by blood group and district.
  Results include only verified, eligible members who explicitly marked
  themselves available. Guests never receive phone numbers; signed-in active
  members can view those opted-in donor contacts.
- Creating a public request requires a verified account, the exact blood
  collection facility and address, patient-reference details, a future required
  time, a verified contact, and explicit review/consent before publication.
  The form suggests 198 entries categorized as `Blood Bank` in the supplied
  DGHS facility export. Other facilities can still be entered manually, and
  every requester is warned to confirm current collection, screening, and
  transfusion arrangements directly.
- Requesters invite eligible donors privately. Donors can accept, decline,
  report arrival/donation, and reveal coordination contacts only after
  acceptance. A donation counts only after requester confirmation.
- Set `ADMIN_PHONE` to a verified member's normalized Bangladesh phone to
  bootstrap the first superadmin. `/admin` is a capability-aware workspace for
  member status and staff roles, request/report/support/partner/claim queues,
  audit history, safe system context, and session revocation. Hierarchy-sensitive
  actions require a reason and are audited.
- Members can recover passwords by verified SMS, inspect and revoke signed-in
  devices, download a server-side data export, and anonymize their account.
- Public requests use server-side filters and bounded pagination with URL-based
  filter state. `/health`, `/ready`, and Prometheus-format `/metrics` support
  production probes and monitoring.
- The responsive white-and-blood-red interface includes a public search-led
  landing page, mobile navigation, redesigned authentication and information
  screens, an installable offline shell, route-specific SEO/social metadata,
  accessible focus behavior, and consistent production English copy.
- Verified hospitals, blood banks, and NGOs can be reviewed by operators,
  listed in the public partner directory, and publish donation campaigns.

The datastore starts empty in every environment; no demo data is generated.

## Imported Donor Directory

Donor listings published openly by other Bangladesh organisations can be
imported as claimable stubs. Scraping and importing are two separate scripts,
both run through Docker Compose:

```
docker compose --profile development run --rm app-dev npm run scrape -- --source=all
docker compose --profile development run --rm app-dev npm run import-donors -- --in=data/scraped
```

`npm run scrape` writes NDJSON per source into `data/scraped/` (ignored by git);
`npm run import-donors` normalizes and loads it. Add `--dry-run` to see the
counts without writing, `--source=<id>` to run one listing, and `--limit=<n>` to
cap a run.

Imported people never registered here, so `/directory/imported` always serves
their phone numbers masked, including to signed-in members. Detail and claim
screens use `/directory/imported/:id` with opaque public IDs that contain no
phone or source key. A successful claim verifies ownership but starts the
registered donor profile unavailable; the owner must separately opt in before
appearing in live search. See
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the claim rules and how to
add a source.

## Validation

- Type check: `docker compose --profile development run --rm app-dev npm run lint`
- Unit tests: `docker compose --profile development run --rm app-dev npm test`
- Bundle: `docker compose --profile development run --rm app-dev npm run build`
