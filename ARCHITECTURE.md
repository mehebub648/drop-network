# Drop Network Architecture

Current application version: `0.0.171`

The privately provisioned Play reviewer account uses one fixed non-routable
identifier for password sign-in. Registration/recovery phone validation stays
strict, and the identifier is excluded from SMS delivery and public donor search.

The website uses a shared horizontal navigation header and the selected Kindred
Community homepage, with blood-group/district search continuing into the existing
upazila workflow. Presentation is in `src/styles/site-shell.css` and
`src/styles/home.css`; the native Android UI and API contracts are unchanged.

The website and API use `https://findadrop.org`. Administration and invitation
changes passed isolated type checking, 190 unit tests, protected-flow integration
and production bundle validation before release.

Administrator credentials and sessions are separate from member accounts.
Invitation campaigns and reviewed donor submissions use private LanceDB tables;
attachments remain in the existing persistent media volume behind authorization.

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
