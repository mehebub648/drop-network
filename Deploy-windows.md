# Drop Deployment Guide for Windows

This document covers daily development with Docker Compose on Windows and the simplest path to run the app in a production-style container.

## 1. What You Are Running

This project uses one Node.js process:

- Express serves the API.
- Vite runs in middleware mode during development.
- The same server serves the built frontend from `dist/` in production.
- LanceDB stores local data inside `.lancedb`.

Development and production are exposed through Docker Compose:

- `app`: development service on `http://localhost:3000`
- `app-prod`: production-profile service on `http://localhost:3001`

## 2. Prerequisites

Install these before doing anything else:

1. Docker Desktop for Windows
2. WSL 2 backend enabled in Docker Desktop
3. Git

Recommended Docker Desktop settings:

1. Enable file sharing for the drive containing the project.
2. Keep Docker Desktop running before using Compose.
3. If file watching feels slow, keep the repository inside your home directory or WSL filesystem instead of a network-mounted folder.

## 3. First-Time Setup

Open Command Prompt or PowerShell in the project root and prepare the env file:

```powershell
Copy-Item .env.example .env
```

The default values are enough for local development. Update `APP_URL` only if you expose the app through another hostname or tunnel.

If `3000` or `3001` is already busy on your machine, change `DEV_PORT` or `PROD_PORT` in `.env` before starting Compose.

## 4. Development Mode

Build and start the dev container:

```powershell
docker compose up --build app
```

What this does:

1. Builds the `dev` target from the Dockerfile.
2. Mounts the repository into `/app`.
3. Stores container `node_modules` in a named volume so bind mounts do not wipe dependencies.
4. Stores LanceDB data in a named volume.
5. Runs `npm run dev`, which now uses `tsx watch server.ts`.

### Live Reload Expectations

You should not need to restart the container when changing:

1. React or CSS files under `src/`: Vite HMR should refresh the browser.
2. `server.ts` or `db.ts`: `tsx watch` should restart the backend process automatically.

Polling-based file watching is enabled for Docker development through:

```dotenv
CHOKIDAR_USE_POLLING=true
VITE_USE_POLLING=true
```

This is important on Windows bind mounts because native file events are often unreliable inside containers.

## 5. Useful Development Commands

Start in foreground:

```powershell
docker compose up app
```

Start in background:

```powershell
docker compose up --build -d app
```

View logs:

```powershell
docker compose logs -f app
```

Stop the dev service:

```powershell
docker compose stop app
```

Stop and remove containers:

```powershell
docker compose down
```

Rebuild after dependency or Dockerfile changes:

```powershell
docker compose up --build app
```

Open a shell inside the dev container:

```powershell
docker compose exec app sh
```

## 6. Managing Small Changes

Use this rule of thumb:

1. Changed app code only: do nothing except refresh the browser if needed.
2. Changed `package.json` or `package-lock.json`: rebuild the image.
3. Changed Dockerfile or `compose.yml`: rebuild and recreate the service.
4. Want a clean dependency install: run `docker compose down -v` and then `docker compose up --build app`.

If a code change is not reflected:

1. Check `docker compose logs -f app`.
2. Confirm the file is inside the bind-mounted project folder.
3. Restart only the service first: `docker compose restart app`.
4. If that still fails, rebuild: `docker compose up --build app`.

## 7. Data Management

LanceDB data is stored in named volumes, not in the container filesystem.

List volumes:

```powershell
docker volume ls
```

Remove all project containers and volumes:

```powershell
docker compose down -v
```

That resets:

1. The dev database volume
2. The production database volume
3. The `node_modules` volume used by development

## 8. Production-Style Run with Docker Compose

Build and start the production profile:

```powershell
docker compose --profile production up --build -d app-prod
```

Open the app at:

```text
http://localhost:3001
```

Useful production commands:

View logs:

```powershell
docker compose logs -f app-prod
```

Restart:

```powershell
docker compose restart app-prod
```

Stop:

```powershell
docker compose --profile production stop app-prod
```

Remove:

```powershell
docker compose --profile production down
```

## 9. Update Workflow in Production

When you ship new code:

1. Pull or copy the updated source.
2. Rebuild the production image.
3. Recreate the production container.

Command:

```powershell
docker compose --profile production up --build -d app-prod
```

## 10. Troubleshooting

### Docker says the daemon is not running

Start Docker Desktop and wait until it reports that the engine is running.

### Port 3000 or 3001 is already in use

Update `DEV_PORT` or `PROD_PORT` in `.env`, then recreate the affected service.

Example:

```dotenv
DEV_PORT="3100"
PROD_PORT="3101"
```

### Browser opens but API calls fail

Make sure you are using the same origin that serves the page:

1. Dev: `http://localhost:3000`
2. Production container: `http://localhost:3001`

### File changes are still not detected

Confirm that both polling variables are enabled in `compose.yml`. If necessary, fully recreate the container:

```powershell
docker compose down
docker compose up --build app
```