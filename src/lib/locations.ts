// The district table lives in `server/locations.ts` so the API can resolve a
// district name without trusting client-supplied coordinates, and is
// re-exported here for the frontend. See src/lib/upazilas.ts and
// src/lib/blood.ts for the same arrangement.
export * from '../../server/locations';
