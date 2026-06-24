<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

Current version: `0.0.29`

View your app in AI Studio: https://ai.studio/apps/a785fd25-9203-4a0a-badf-b124c492f4ee

## Documentation

- Architecture: [ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- Deployment: [Windows](./docs/Deploy-windows.md) · [Ubuntu](./docs/Deploy-ubuntu.md)
- Agent instructions: [AGENTS.md](./AGENTS.md)
- Plan / backlog: [PLAN.md](./docs/PLAN.md)
- Changelogs: [changelog/](./changelog/)

## Run Locally

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

- `PORT` controls direct local server runs and the Docker production host port.
- `DEV_PORT` controls the Docker development host port.
- `CORS_ORIGIN` can list allowed cross-origin browser origins; same-origin
  production requests do not need it.
- `LANCEDB_PATH` sets the datastore directory. Docker uses `/data/lancedb`
  (a persistent volume); direct local runs fall back to `./.lancedb`.
- Development OTP responses include a one-time `dev_otp`; production still
  needs a real SMS provider before phone verification is useful.

The datastore starts empty in every environment; no demo data is generated.
