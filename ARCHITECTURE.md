# Drop Network Architecture

Current application version: `0.0.168` (unreleased source; live code is `0.0.164`)

The live website and API use `https://findadrop.org`. The domain was connected
through configuration only; the unreleased source changes remain separate.

Website color tokens in `src/index.css` use a white canvas, cherry primary actions
and blush, mint, sky and lilac accents. `src/styles/website.css` applies them to
illustrations, account surfaces and outlined form controls.

Drop Network is a Docker-run Node/TypeScript React application with an Express
API and a LanceDB datastore. The React frontend lives in `src/`, the server
lives in `server/`, and Docker Compose is the supported workflow for runtime,
development, linting, and builds.

The detailed architecture is maintained in
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md). Keep that document synchronized
when routes, data flow, storage, Docker runtime behavior, configuration, or
deployment expectations change.
