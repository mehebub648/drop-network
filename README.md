<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

Current version: `0.0.41`

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
- `CORS_ORIGIN` can list allowed cross-origin browser origins; same-origin
  production requests do not need it.
- `LANCEDB_PATH` is set inside Docker Compose to `/data/lancedb`, backed by a
  persistent Docker volume.
- Registration requires a verified Bangladesh mobile. Development can use
  `SMS_PROVIDER=console`; production requires the provider-neutral HTTP SMS
  gateway settings documented in `.env.example`.
- Creating a public request requires a verified account, complete hospital and
  patient-reference details, a future required time, a verified contact, and
  explicit review/consent before publication.
- Requesters invite eligible donors privately. Donors can accept, decline,
  report arrival/donation, and reveal coordination contacts only after
  acceptance. A donation counts only after requester confirmation.
- Set `ADMIN_PHONE` to a verified member's normalized Bangladesh phone to
  bootstrap the first administrator. Operators handle reports and support
  tickets at `/admin`; administrative actions are audited.
- Members can recover passwords by verified SMS, inspect and revoke signed-in
  devices, download a server-side data export, and anonymize their account.
- Public requests use server-side filters and bounded pagination with URL-based
  filter state. `/health`, `/ready`, and Prometheus-format `/metrics` support
  production probes and monitoring.
- The app ships an installable offline shell, route-specific SEO/social
  metadata, a generated sitemap/robots policy, accessible focus behavior, and
  a persistent English/Bangla shared-navigation switch.

The datastore starts empty in every environment; no demo data is generated.

## Validation

- Type check: `docker compose --profile development run --rm app-dev npm run lint`
- Unit tests: `docker compose --profile development run --rm app-dev npm test`
- Bundle: `docker compose --profile development run --rm app-dev npm run build`
