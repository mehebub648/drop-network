// The upazila table is generated into `server/` because the production image
// contains only `server/` and `dist/` (see Dockerfile), so the Express server
// cannot import it from here. Vite bundles it into the browser build through
// this re-export, which keeps one copy of the data instead of two.
export * from '../../server/upazilas';
