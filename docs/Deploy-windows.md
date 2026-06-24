# Drop Deployment Guide for Windows

This project runs as one Node.js server:

1. Express serves the API.
2. Vite runs in middleware mode during development.
3. Production serves Docker-built frontend files from `dist/`.
4. LanceDB data is stored in Docker named volumes.

## 1. Prerequisites

Install:

1. Docker Desktop for Windows
2. WSL 2 backend enabled in Docker Desktop
3. Git

## 2. First-Time Setup

Open PowerShell in the project root and create the env file:

```powershell
Copy-Item .env.example .env
```

If port `3000` or `3001` is already busy, set `PORT` or `DEV_PORT` in `.env`.
The datastore starts empty; no demo data is generated. Docker Compose stores
LanceDB in named volumes by default.

## 3. Default Docker Run

Build and run the app:

```powershell
docker compose up --build
```

This builds the `production` Docker target. The frontend is built from source inside Docker with `npm run build`; local `node_modules/` and `dist/` are not required or copied into the image.

Open:

```text
http://localhost:3000
```

Useful commands:

```powershell
docker compose logs -f app
docker compose restart app
docker compose stop app
docker compose down
```

## 4. Development Mode

Use the development profile when you need live reload:

```powershell
docker compose --profile development up --build app-dev
```

This mounts the repository into `/app`, stores container `node_modules` in a named volume, and runs `npm run dev`.

Open:

```text
http://localhost:3001
```

Useful dev commands:

```powershell
docker compose --profile development logs -f app-dev
docker compose --profile development exec app-dev sh
docker compose --profile development restart app-dev
docker compose --profile development stop app-dev
```

## 5. Persistent Data

Named volumes hold runtime data:

1. `drop_lancedb` mounted at `/data/lancedb` for the default production-style service.
2. `drop_lancedb_dev` mounted at `/data/lancedb` for development.
3. `drop_node_modules` for development dependencies.

To remove containers and volumes:

```powershell
docker compose --profile development down -v
```

Use that only when you intentionally want to reset local state.

## 6. Updating After Code Changes

For the default Docker run:

```powershell
docker compose up --build
```

For development mode:

```powershell
docker compose --profile development up --build app-dev
```

## 7. Troubleshooting

### Docker says the daemon is not running

Start Docker Desktop and wait until it reports that the engine is running.

### Port 3000 or 3001 is already in use

Set a different port in `.env`:

```dotenv
PORT="3100"
DEV_PORT="3101"
```

Then recreate the relevant service.

For cross-origin browser clients, set `CORS_ORIGIN` to a comma-separated list of
allowed origins. Same-origin Docker deployments can leave it empty.

### Development file changes are not detected

Confirm that both polling variables remain enabled in `compose.yml`:

```dotenv
CHOKIDAR_USE_POLLING=true
VITE_USE_POLLING=true
```

Then recreate the dev container:

```powershell
docker compose --profile development down
docker compose --profile development up --build app-dev
```
