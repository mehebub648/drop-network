export function requestLocation(request: { hospital_name?: string | null; upazila?: string | null; location?: { area_name?: string | null; district?: string | null; upazila?: string | null } }) {
  const facility = request.hospital_name?.trim();
  const meaningful = facility && !/^collection facility$/i.test(facility);
  return [...new Set([meaningful ? facility : request.upazila || request.location?.upazila, request.location?.area_name || request.location?.district].filter(Boolean))].join(', ') || 'Location shared in request';
}
