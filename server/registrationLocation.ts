import { getLocationByName } from './locations';

type RegistrationLocation = {
  lat: number;
  lng: number;
  area_name: string;
};

export function resolveRegistrationLocation(
  locationInput: unknown,
  districtInput: unknown,
  parseLegacyLocation: (value: unknown) => RegistrationLocation | null
) {
  if (locationInput !== undefined) return parseLegacyLocation(locationInput);
  if (typeof districtInput !== 'string') return undefined;
  return getLocationByName(districtInput);
}
