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
- Open a dev container shell: `docker compose --profile development exec app-dev sh`
- Stop services: `docker compose --profile development down`

## Validation Policy
- For minor documentation, copy, or narrowly scoped style changes, do not run non-critical tests after building.
- For TypeScript or server changes, run `docker compose --profile development run --rm app-dev npm run lint` when practical.
- For frontend behavior changes, run the narrowest useful browser or build check.
- For dependency, routing, or production-impacting changes, run `docker compose build app` unless the user asks to skip it.

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
