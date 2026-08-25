# Agent Instructions

## Project Context
- This is a Node/TypeScript React app with an Express server.
- Read [ARCHITECTURE.md](./ARCHITECTURE.md) before making structural or cross-cutting changes.
- Docker Compose is the supported way to run, build, lint, and validate this project.
- Do not run Node, npm, npx, Vite, or TSX directly on the host. If an npm script is needed, run it inside a Docker Compose service.
- Use PowerShell-safe Docker commands on Windows.
- Prefer the existing structure and scripts in `package.json` before adding new tooling.

## Plan File (PLAN.md)
- Read [PLAN.md](./docs/PLAN.md) before starting work and check whether any planned item covers the current task.
- When you finish a planned item, remove it from `PLAN.md` in the same change.
- When you discover new work worth tracking (bugs, missing features, follow-ups, tech debt), add it to `PLAN.md` instead of leaving it implicit.
- Keep `PLAN.md` items short, actionable, and grouped under the existing buckets; include file/line references where useful.

## Token Efficiency
- Inspect only the files needed for the current task.
- Use `rg` or `rg --files` for search instead of broad directory reads.
- Avoid printing large files, generated assets, lockfiles, or dependency folders unless directly relevant.
- Keep explanations concise and focus on changed files, validation performed, and remaining blockers.

## Commands
- Build production image: `docker compose build app`
- Start production-style app: `docker compose up --build app`
- Start development service: `docker compose --profile development up --build app-dev`
- Type-check/lint: `docker compose --profile development run --rm app-dev npm run lint`
- Build frontend/server bundle: `docker compose --profile development run --rm app-dev npm run build`
- Run another package script: `docker compose --profile development run --rm app-dev npm run <script>`
- Scrape public donor listings: `docker compose --profile development run --rm app-dev npm run scrape -- --source=all`
- Import scraped listings: `docker compose --profile development run --rm app-dev npm run import-donors -- --in=data/scraped`
- Regenerate the upazila table from the scraped register: `docker compose --profile development run --rm app-dev npm run generate-upazilas`
- Refresh district facility suggestions from the public DGHS registry: `docker compose --profile development run --rm app-dev npm run generate-collection-facilities`
- Open a dev container shell: `docker compose --profile development exec app-dev sh`
- Stop services: `docker compose --profile development down`

## Local Docker Desktop Policy

- Do not start or use Docker Desktop for testing unless the user explicitly
  asks for Docker Desktop in the current task.
- Do not treat an unavailable local Docker daemon as permission to start Docker
  Desktop automatically. Record skipped local checks and use the hosted
  verification workflow below when a production update is authorized.
- This restriction is specific to local Docker Desktop. The isolated rootless
  Docker Compose project on the production host remains the supported deploy
  runtime and must still be used through the site-scoped workflow.

## Production Hosting and MCP Updates

- Production is hosted at
  `https://site-21000.91.108.104.57.mehebub.com/` on server
  `91.108.104.57` as CloudPanel site user `site-21000`.
- The Panelavo system domain is
  `site-21000.91.108.104.57.mehebub.com`. Use this exact domain with the
  `panel-91-108-104-57` MCP connection.
- The application root is
  `/home/site-21000/htdocs/site-21000.91.108.104.57.mehebub.com`.
- The rootless Compose app listens through `127.0.0.1:21000`; never use the
  host root Docker daemon or restart another website.
- GitHub is the durable source of truth:
  `git@github.com:mehebub648/drop-network.git`, branch `main`. Production must
  remain a clean fast-forward-only checkout. Never make the durable code fix
  directly on the server.
- Runtime data is not in Git. Preserve `data/lancedb`,
  `data/media/community`, `.env`, and the private donor source files in
  `data/scraped` across every deployment. Never commit donor source files or
  copy them into a public artifact.

### Hosted Testing

- The canonical live test target is
  `https://site-21000.91.108.104.57.mehebub.com/`. Use that origin for release
  verification; do not substitute a localhost result for hosted evidence.
- Prefer the `panel-91-108-104-57` Panelavo MCP connection. When it is not
  available and the user has authorized server access, SSH to
  `root@91.108.104.57`, then run site commands as `site-21000` in the exact
  application root. Never operate Drop through root's Docker daemon.
- After deployment, verify the exact Git commit and application version, the
  scoped app container health and restart count, `/`, `/health`, `/ready`, one
  representative hashed static asset, and the relevant changed API behavior.
- Use a real browser against the hosted origin for changed user-facing flows.
  Check the rendered desktop/mobile state, browser console, failed requests,
  and the exact interaction changed by the release.
- Keep live tests non-destructive by default. If a changed flow requires test
  records or a temporary security setting, use clearly labelled test data,
  record the before state, restore it afterward, and verify cleanup. Never use
  a real donor, blood request, OTP, or imported-listing withdrawal as test data.
- A successful live homepage or health response alone does not verify an OTP,
  admin, privacy, data, or authentication change; test the relevant protected
  flow or report the exact authentication or credential limitation.

For every production code update:

1. Make and verify the change locally, increment the version, add its new
   changelog, create a focused commit, and push that exact commit to `main`
   only when the user authorizes a production update.
2. Use `panelavo_whoami`, `panelavo_get_site`, and
   `panelavo_get_site_section` (`git`, `actions`, and `backups`) to confirm the
   live actor, site, clean checkout, ready Compose plan, and backup state.
3. For data/schema risk, call `panelavo_create_backup`. For LanceDB table
   changes, inspect with `panelavo_inspect_lancedb` and create a selective
   `panelavo_create_lancedb_snapshot`; wait for its job to finish before
   continuing.
4. Call `panelavo_execute_terminal_command` as `site-21000`, with the
   application root as `cwd`, to run
   `git fetch --prune origin main && git pull --ff-only origin main`. Refuse a
   dirty tree, diverged branch, or unexpected commit instead of overwriting it.
5. Re-read the `actions` section, then call `panelavo_deploy_site` with the
   ready `compose` plan and approve its one-use confirmation. Rebuild/recreate
   only Drop's app service; never run `down --volumes`, prune volumes, or
   restart host-wide Docker.
6. Verify the deployed commit/version, container health and restart count,
   `/`, `/health`, `/ready`, a representative static asset, and the public
   directory. Confirm `.env`, LanceDB, community media, and donor counts were
   preserved.

For donor-list refreshes, keep the NDJSON files private in `data/scraped`.
Use the documented importer with `--dry-run` first and compare its totals, take
a selective `imported_donors` LanceDB snapshot through MCP, stop only Drop's
exact Compose app while importing, and always restart and verify the same
project. Re-importing preserves withdrawals but currently resets claim state;
review that open `PLAN.md` limitation before replacing a populated table.

## Validation Policy
- For minor documentation, copy, or narrowly scoped style changes, do not run non-critical tests after building.
- Do not start local Docker Desktop for validation unless the user explicitly
  requests it. The Docker commands above remain available for that case.
- For an authorized production update, let the scoped rootless production
  Compose build validate the application image, then test the changed behavior
  on the canonical hosted origin.
- For frontend behavior changes, run the narrowest useful live browser check.
- Report any local lint, unit, or bundle check skipped because local Docker was
  not explicitly authorized; never replace it with host-side Node/npm commands.

## Process Cleanup
- Avoid detached/background processes unless they are required.
- When starting a server, record the port and stop the process immediately after validation.
- Confirm any used port is free before finishing, unless the process existed before the task.
- Do not kill unrelated user processes.

## Editing Rules
- Keep changes scoped to the user request.
- Do not revert user changes or unrelated dirty work.
- Prefer `apply_patch` for manual edits.
- Do not edit generated outputs such as `dist` unless explicitly requested.

## Documentation, Versioning, and Changelog
- After every repository edit, update any affected documentation, including `README.md`, deployment docs, `AGENTS.md`, `CLAUDE.md`, and `ARCHITECTURE.md`.
- Every change must increase the application version.
- Update version references everywhere they exist, including `package.json`, `package-lock.json`, `ARCHITECTURE.md`, and any future docs/config files that show the app version.
- Create one new changelog file for every version bump under `changelog/`.
- Changelog file names must use this format: `v<old-version>-<new-version>-changelog.md`.
- Keep changelog text short, clear, and easy to read.
- Example sequence: `changelog/v0.0.1-0.0.2-changelog.md`, then `changelog/v0.0.2-0.0.3-changelog.md`.
