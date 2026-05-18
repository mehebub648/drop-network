# Drop Deployment Guide for Ubuntu

This document covers how to run the project on Ubuntu with Docker Compose for both development and a production-style deployment.

## 1. What the Stack Looks Like

The app runs as a single Node.js server:

1. Express handles the API.
2. Vite runs in middleware mode during development.
3. The server switches to static file serving in production.
4. LanceDB persists local data under `.lancedb`.

Compose exposes two services:

1. `app` for development on port `3000`
2. `app-prod` for production on port `3001` using the `production` profile

## 2. Prerequisites

Install Docker Engine and the Compose plugin:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Optional but recommended: run Docker without `sudo`.

```bash
sudo usermod -aG docker $USER
newgrp docker
```

Verify installation:

```bash
docker compose version
docker version
```

## 3. Project Setup

Move into the project directory and create the environment file:

```bash
cp .env.example .env
```

Most local setups can keep the default values unchanged.

If ports `3000` or `3001` are already in use on the host, set `DEV_PORT` or `PROD_PORT` in `.env` before starting the services.

## 4. Start Development Mode

Build and run the dev service:

```bash
docker compose up --build app
```

Open:

```text
http://localhost:3000
```

Development behavior:

1. Frontend changes under `src/` reload through Vite HMR.
2. Backend changes in `server.ts` and `db.ts` reload through `tsx watch`.
3. The project directory is bind-mounted into the container.
4. Dependency files and LanceDB data are stored in named volumes.

## 5. Why Reload Works Without Manual Restart

The development container is configured with two important pieces:

1. `tsx watch server.ts` for backend restarts
2. Polling-based file watching for Vite and chokidar on mounted filesystems

Those settings are applied through environment variables in `compose.yml`:

```dotenv
CHOKIDAR_USE_POLLING=true
VITE_USE_POLLING=true
```

## 6. Daily Development Commands

Run in the foreground:

```bash
docker compose up app
```

Run in the background:

```bash
docker compose up --build -d app
```

Follow logs:

```bash
docker compose logs -f app
```

Open a shell in the running container:

```bash
docker compose exec app sh
```

Stop the service:

```bash
docker compose stop app
```

Shut everything down:

```bash
docker compose down
```

## 7. Handling Small Operational Tasks

If you change only source files, Compose should not need a rebuild.

If you change one of these files, rebuild the image:

1. `package.json`
2. `package-lock.json`
3. `Dockerfile`
4. `compose.yml`

Rebuild command:

```bash
docker compose up --build app
```

If you want a full clean reset:

```bash
docker compose down -v
docker compose up --build app
```

## 8. Managing Persistent Data

The project uses named volumes for:

1. development `node_modules`
2. development LanceDB data
3. production LanceDB data

List the volumes:

```bash
docker volume ls
```

Remove all Compose volumes for this project:

```bash
docker compose down -v
```

Use that only when you intentionally want to reset state.

## 9. Start Production Mode

Build and start the production service:

```bash
docker compose --profile production up --build -d app-prod
```

Open:

```text
http://localhost:3001
```

Useful production operations:

Follow logs:

```bash
docker compose logs -f app-prod
```

Restart:

```bash
docker compose restart app-prod
```

Stop:

```bash
docker compose --profile production stop app-prod
```

Remove containers:

```bash
docker compose --profile production down
```

## 10. Updating Production After Code Changes

Whenever the source changes:

```bash
docker compose --profile production up --build -d app-prod
```

That rebuilds the image, recreates the container, and keeps the production LanceDB volume mounted.

## 11. Troubleshooting

### Permission denied when running Docker

Your user is probably not in the `docker` group yet. Either use `sudo` temporarily or add your user to the group and start a new shell session.

### The port is already occupied

Update `DEV_PORT` or `PROD_PORT` in `.env`, then recreate the relevant service.

Example:

```dotenv
DEV_PORT="3100"
PROD_PORT="3101"
```

### The app starts but code changes do not reload

1. Confirm you started the `app` service, not `app-prod`.
2. Confirm the service is using the bind mount from the repo root.
3. Check logs with `docker compose logs -f app`.
4. Recreate the dev container if needed.

```bash
docker compose down
docker compose up --build app
```

### Production service serves an old UI

The image was likely not rebuilt. Run:

```bash
docker compose --profile production up --build -d app-prod
```