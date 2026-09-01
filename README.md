<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

Current version: `0.0.116`

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

Refresh the district facility files from the public DGHS registry with:

`docker compose --profile development run --rm app-dev npm run generate-collection-facilities`

## Runtime Configuration

- `PORT` controls the Docker production host port.
- `DEV_PORT` controls the Docker development host port.
- `APP_URL` is the canonical public origin. Production defaults to the current
  hosted HTTPS address; future domain changes require configuration only.
- `CORS_ORIGIN` can list allowed cross-origin browser origins; same-origin
  production requests do not need it.
- `METRICS_TOKEN` must contain at least 32 random characters in production.
  Monitoring reads `/metrics` with that bearer token; public network counts
  remain available from `/api/stats`.
- `LANCEDB_PATH` is set inside Docker Compose to `/data/lancedb`, bind-mounted
  from `./data/lancedb` (production) or `./data/lancedb-dev` (development) on
  the host. The datastore is a plain directory you can back up or copy; it is
  git-ignored because it holds personal data.
- `COMMUNITY_MEDIA_PATH` is `/data/media/community` in both Compose services,
  bind-mounted from separate production and development host directories.
  Story uploads are normalized to metadata-free, bounded WebP files there.
- Registration requires a verified Bangladesh mobile and fails closed when no
  delivery provider is configured. Set `SMS_PROVIDER=messavo`, configure
  `SMS_API_BASE_URL`, and supply a private server-side `SMS_API_TOKEN` with
  `messages:send`, `messages:read`, and `messages:cancel` permissions. The
  canonical API base URL is `https://messavo.cloud`.
  Drop assigns every challenge a stable idempotency key, records the Messavo
  job ID, polls a safe delivery status without spending the authentication-
  attempt budget, stops polling after mobile-network handoff, and cancels unsent
  replaced or expired jobs. The former `woven` provider name is accepted as a
  compatibility alias; public responses consistently say `messavo`.
- Donation follow-ups use a separate automatic-send credential in
  `SMS_FOLLOWUP_API_TOKEN` and a separate 32+ character
  `FOLLOW_UP_LINK_SECRET`. A requester records the donor's SMS consent after
  the call; without consent the same follow-up remains in-app. Reminder links
  carry the private token only in the URL fragment and message text contains no
  patient, blood-group, hospital, or request details.
- The production origin publishes Android App Link ownership at
  `/.well-known/assetlinks.json` for the signed
  `com.mehebub.drop_network` release.
- A superadmin can turn on the persisted **OTP bypass test mode** outside
  production from
  **Operations → System**. While active, every phone-protected activity skips
  code delivery and verification, the whole site shows a warning banner, and
  enabling or disabling the mode requires a reason and creates an audit event.
  Production automatically disables a persisted bypass and refuses attempts to
  enable it. `/ready` also stays unavailable until SMS and metrics protection
  are configured.
- The complete donor search starts on `/`: blood group, district, upazila,
  collection facility, and requester role are asked one at a time and carry
  into `/directory`. The interface shows only the current question and answer,
  without stage labels, progress graphics, or repeated instructions.
  Phone-verified, opted-in donors are ranked first and explicitly labelled before
  attributed public listings. Requesters can sort by recommendation, recent
  confirmation, location fit, donation total, contact reliability, or name,
  and can limit results to the exact group or phone-verified profiles. Donors
  tied on every active priority field are shuffled using an opaque stable
  `order_seed`, avoiding repeated or missing results across pages; explicit
  name sorting remains alphabetical. Cards show the masked phone directly
  beneath the donor's name while full contact remains behind the recorded
  request-and-reveal flow. Cards also explain area, facility, or current-time preference matches without exposing
  a donor's stored schedule. Every result stays masked until the protected
  request and one-at-a-time reveal workflow opens a contact. Opening a contact
  displays a non-dismissible call-outcome dialog over the current page; the
  rest of Drop remains unavailable across navigation and reloads until that
  outcome is saved. Requesters can refine the same answers without leaving the
  result page. Results are paged in groups of 24. Each account and IP may use
  at most three districts, three blood groups, and nine unique searches per
  Dhaka day; paging an unchanged search does not consume another unique search,
  while the standard API rate limit still applies.
- Registered donors can self-report an exact last-donation date, an approximate
  number of days, months, or years ago, or that they have never donated, plus a
  lifetime donation count. Search cards show that bounded summary when present;
  detailed records and collection-organization names remain private.
- The redesigned member profile groups identity, activity, and preferences in
  one responsive workspace. Donors can keep an optional private note about a
  medical condition or current sickness; it is excluded from donor search and
  never treated as medical clearance.
- Donors can optionally add 10 preferred areas, 8 DGHS-registered collection
  facilities, home/preferred/district-wide travel willingness, and 3 recurring
  Asia/Dhaka contact or donation windows. A bounded coordination note stays in
  the account record only. These settings extend eligible search locations and
  create concise match reasons; raw preferences, windows, and the private note
  are never included in public result cards or donor partition copies.
- Every new account creates a donor profile with blood group, location, and an
  explicit availability choice. Members who choose “I’m not available to
  donate” stay off live search and may save a private optional reason.
- Creating a public request requires a verified account, the exact blood
  collection facility and address, patient-reference details, a future required
  time, a verified contact, and explicit review/consent before publication.
  The searchable facility picker loads only the selected district from a
  33,799-entry DGHS registry snapshot. Duplicate registry codes with the same
  canonical facility name and locality are consolidated for display while all
  source codes remain valid aliases and different branches stay separate. The snapshot excludes the two
  `Administration` functions plus `Administrative` and `Knowledge Management
  (Medical Library)`, while manual entry remains available. Registry inclusion
  is not proof that transfusion is currently available; requesters must confirm
  collection, screening, and transfusion arrangements directly.
- Active request pages publish the chosen patient-side contact so donors can
  call immediately, while donor search numbers remain masked and purpose-bound.
  Donors can accept, decline, and report arrival or donation. Every agreed donor receives one persisted follow-up timeline.
  Donor and requester report independently; matching donation answers confirm
  the record, conflicts become disputed, and requester-only answers never
  change another person's profile. The request owner sees masked contacted
  donors and next actions on the request page.
- Set `ADMIN_PHONE` to a verified member's normalized Bangladesh phone to
  bootstrap the first superadmin. `/admin` is a capability-aware workspace for
  member status and staff roles, request/report/support/partner/claim queues,
  audit history, safe system context, and session revocation. Hierarchy-sensitive
  actions require a reason and are audited.
- Members can recover passwords by verified SMS, inspect and revoke signed-in
  devices, download a server-side data export, and anonymize their account.
- Public requests use server-side filters and bounded pagination with URL-based
  filter state. `/health` and `/ready` verify the critical static files plus the
  hashed JavaScript/CSS referenced by the production shell, while
  bearer-protected Prometheus-format `/metrics` supports monitoring.
- The responsive interface uses a doodle-led cartoon system on a clean white
  canvas, with white surfaces, soft neutral boundaries, deep-red actions,
  semantic availability/success green, rounded typography, lightweight line
  art, and optimized editorial illustrations. One shared 92rem content rail
  plus consistent cards, controls, status UI, focus behavior, and reduced-motion
  support keeps search, request, contact, account, community, partner,
  information, and staff journeys visually connected from 320px mobile through
  large desktop layouts.
- Verified hospitals, blood banks, and NGOs can be reviewed by operators,
  listed in the public partner directory, and publish donation campaigns.
- `/community` publishes member donation stories and Markdown-formatted health
  suggestions. A story may carry one processed image; health suggestions are
  text-only. Every published post has a stable URL, safe Markdown rendering,
  article metadata, social share actions, and sitemap entry, while drafts and
  hidden posts are not indexed. Donation history uses a preserved pre-history
  baseline plus the number of detailed private records; an owner can prepare a
  reviewable story draft from one record without copying its private note,
  linked request, patient details, or contacts.

The datastore starts empty in every environment; no demo data is generated.

## Imported Donor Records

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

A valid Bangladesh mobile number is mandatory for an imported listing. Records
without one are rejected by the importer, and any stored before that rule are
deleted the first time the directory table is opened.

Imported people never registered here, so Drop provides no browsable donor
directory. Their masked records can appear only inside a blood-group, district,
and upazila search. The only way a listing's number is served in full is the
one-at-a-time reveal behind a published blood request in that person's own
upazila, which is recorded and refuses to open another number until the last
call is reported. Each record has a collision-checked 12-character owner link
at `/c/:slug`; older `/directory/imported/:id` and `/directory/:id` links
redirect to it. The owner can change the phone before requesting a purpose-
bound Messavo code, then must confirm name, blood group, district, upazila,
availability, and consent with no preselected defaults. A matching phone claims
the stub. A different unique phone creates or updates that person's own
passwordless profile and leaves the original listing unclaimed.
Search results show the imported-listing claim option only to guests; signed-in
members use their existing donor profile instead.
When a signed-in member's verified, available profile matches the searched
blood group and upazila, it appears first with a “Your profile” label. Its
action opens profile management instead of revealing or calling the member's
own phone number.

Anyone can use `/contribute` to create a private donor suggestion. It remains
unsearchable, sends no unsolicited SMS, and expires after 30 days unless the
phone owner opens the returned claim link, verifies, and consents. Intake uses
honeypot, IP, browser-fingerprint, and phone duplicate controls with neutral
responses. Import dry runs report preserved ownership state; real imports keep
claim links, claims, withdrawals, and contribution state by stable public ID.

Anyone listed can take their own number off at `/directory/remove` **without
creating an account** — the alternative would be signing up in order to leave.
The number is verified by SMS so only its owner can remove it, and the request
step answers identically whether or not the number is listed, so the page cannot
be used to test which numbers are in the directory. A withdrawn row is kept
rather than deleted: re-importing the same source carries the withdrawal
forward, so the removal is not undone by the next scrape. See
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the claim rules and how to
add a source.

After every recorded phone reveal, the requester reports whether the donor will
donate, asked for a later call, did not answer, was unreachable, had the wrong
number, declined with a structured reason, or was not called. Search cards show
non-accusatory counts from distinct verified requesters beginning with the first
report; notes and identities remain private. Three distinct wrong-number or
unreachable reports in 90 days temporarily suppress that donor from search.
Registered donors manage these warnings at `/profile/contact-reports`: phone
reverification and relevant profile corrections make older evidence stale,
while disputes enter the protected staff review queue. Evidence remains append-
only and staff suspension/restoration actions are audited.

## Validation

- Type check: `docker compose --profile development run --rm app-dev npm run lint`
- Unit tests: `docker compose --profile development run --rm app-dev npm test`
- Bundle: `docker compose --profile development run --rm app-dev npm run build`
