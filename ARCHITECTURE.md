# Drop Network Architecture

Current application version: `0.0.129`

Drop Network is a Docker-run Node/TypeScript React application with an Express
API and a LanceDB datastore. The React frontend lives in `src/`, the server
lives in `server/`, and Docker Compose is the supported workflow for runtime,
development, linting, and builds.

The detailed architecture is maintained in
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md). Keep that document synchronized
when routes, data flow, storage, Docker runtime behavior, configuration, or
deployment expectations change.
