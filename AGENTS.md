# Agent Instructions

## Project Context
- This is a Node/TypeScript React app with an Express server.
- Read [ARCHITECTURE.md](./ARCHITECTURE.md) before making structural or cross-cutting changes.
- Use PowerShell-safe commands on Windows, including `npm.cmd` and `npx.cmd`.
- Prefer the existing structure and scripts in `package.json` before adding new tooling.

## Token Efficiency
- Inspect only the files needed for the current task.
- Use `rg` or `rg --files` for search instead of broad directory reads.
- Avoid printing large files, generated assets, lockfiles, or dependency folders unless directly relevant.
- Keep explanations concise and focus on changed files, validation performed, and remaining blockers.

## Commands
- Install dependencies: `npm.cmd install`
- Type-check/lint: `npm.cmd run lint`
- Build: `npm.cmd run build`
- Start app: `npm.cmd run start`
- Dev server: `npm.cmd run dev`
- Preview build: `npm.cmd run preview`

## Validation Policy
- For minor documentation, copy, or narrowly scoped style changes, do not run non-critical tests after building.
- For TypeScript or server changes, run `npm.cmd run lint` when practical.
- For frontend behavior changes, run the narrowest useful browser or build check.
- For dependency, routing, or production-impacting changes, run `npm.cmd run build` unless the user asks to skip it.

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
