export const BD_LOCATIONS = [
  { area: 'Dhaka', lat: 23.8103, lng: 90.4125 },
  { area: 'Chittagong', lat: 22.3569, lng: 91.7832 },
  { area: 'Sylhet', lat: 24.8949, lng: 91.8687 },
  { area: 'Rajshahi', lat: 24.3636, lng: 88.6241 },
  { area: 'Khulna', lat: 22.8456, lng: 89.5403 },
  { area: 'Barisal', lat: 22.7010, lng: 90.3535 },
  { area: 'Rangpur', lat: 25.7439, lng: 89.2752 },
  { area: 'Mymensingh', lat: 24.7471, lng: 90.4203 },
  { area: 'Comilla', lat: 23.4607, lng: 91.1809 },
  { area: 'Narayanganj', lat: 23.6337, lng: 90.5000 },
  { area: 'Gazipur', lat: 23.9999, lng: 90.4203 },
  { area: 'Bogra', lat: 24.8465, lng: 89.3778 },
  { area: 'Jessore', lat: 23.1634, lng: 89.2182 },
  { area: 'Dinajpur', lat: 25.6217, lng: 88.6355 },
  { area: 'Pabna', lat: 24.0044, lng: 89.2504 },
  { area: "Cox's Bazar", lat: 21.4272, lng: 92.0058 }
];

export const BD_LOCATION_NAMES = BD_LOCATIONS.map(location => location.area);

export function getLocationByName(name: string) {
  const normalized = name.trim().toLowerCase();
  const location = BD_LOCATIONS.find(item => item.area.toLowerCase() === normalized);
  return location ? { lat: location.lat, lng: location.lng, area_name: location.area } : null;
}

