# Drop Deployment Guide for Ubuntu

This project runs as one Node.js server:

1. Express serves the API.
2. Vite runs in middleware mode during development.
3. Production serves Docker-built frontend files from `dist/`.
4. LanceDB data and processed community story images are stored in host
   directories bind-mounted into Docker.

## 1. Prerequisites

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

## 2. Project Setup

Move into the project directory and create the environment file:

```bash
cp .env.example .env
```

The example uses `APP_URL=https://findadrop.org`. Keep that value for the
public deployment; use a different origin only for a separate environment.

If port `3000` or `3001` is already busy, set `PORT` or `DEV_PORT` in `.env`.
The datastore starts empty; no demo data is generated. Docker Compose stores
persistent LanceDB and community media data under `./data/` on the host.

## 3. Default Docker Run

Build and run the app:

```bash
docker compose up --build
```

This builds the `production` Docker target. The frontend is built from source inside Docker with `npm run build`; local `node_modules/` and `dist/` are not required or copied into the image.

Open:

```text
http://localhost:3000
```

Useful commands:

```bash
docker compose logs -f app
docker compose restart app
docker compose stop app
docker compose down
```

## 4. Development Mode

Use the development profile when you need live reload:

```bash
docker compose --profile development up --build app-dev
```

This mounts the repository into `/app`, stores container `node_modules` in a named volume, and runs `npm run dev`.

Open:

```text
http://localhost:3001
```

Useful dev commands:

```bash
docker compose --profile development logs -f app-dev
docker compose --profile development exec app-dev sh
docker compose --profile development restart app-dev
docker compose --profile development stop app-dev
```

## 5. Persistent Data

Runtime data lives in `./data/` on the host through bind mounts, not in Docker
named volumes, so you can back it up or inspect it with ordinary tools:

1. `./data/lancedb` mounted at `/data/lancedb` for the default production-style service.
2. `./data/media/community` mounted at `/data/media/community` for the default production-style service.
3. `./data/lancedb-dev` mounted at `/data/lancedb` for development.
4. `./data/media-dev/community` mounted at `/data/media/community` for development.
5. `./data/scraped` holds scraped donor listings (NDJSON).
6. `drop_node_modules` is the only named volume left, for development dependencies.

`./data/` is git-ignored because it is large and holds personal data. Back it up
by copying the directory while the containers are stopped:

```bash
docker compose --profile development down
tar czf drop-data-$(date +%F).tar.gz data/
```

This archive includes both LanceDB records and processed community story images
for the production and development services.

To remove containers and the dependency volume:

```bash
docker compose --profile development down -v
```

That no longer deletes your data — `./data/` survives. Delete that directory by
hand if you intentionally want to reset local state.

### Importing public donor listings

Imported donor records live in the LanceDB directory for the service running the
import, not in a separate volume. The commands below use `app-dev`, so they write
to the bind-mounted `./data/lancedb-dev` directory. Populating it is a manual,
two-step operation, never something the running server does:

```bash
docker compose --profile development run --rm app-dev npm run scrape -- --source=all --resume
docker compose --profile development run --rm app-dev npm run import-donors -- --in=data/scraped
```

The scrape writes NDJSON to `data/scraped/` on the host and takes hours,
because the source hosts are slow and the scraper deliberately backs off when
they start failing. `--resume` continues an interrupted run. Re-running the
import replaces rows by id, so it is safe to repeat.

## 6. Updating After Code Changes

For the default Docker run:

```bash
docker compose up --build
```

For development mode:

```bash
docker compose --profile development up --build app-dev
```

## 7. Troubleshooting

### Permission denied when running Docker

Your user is probably not in the `docker` group yet. Either use `sudo` temporarily or add your user to the group and start a new shell session.

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

```bash
docker compose --profile development down
docker compose --profile development up --build app-dev
```

### Default service serves an old UI

The image was likely not rebuilt. Run:

```bash
docker compose up --build
```
