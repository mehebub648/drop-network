export type BangladeshLocation = { area: string; lat: number; lng: number };

// District administrative-centre coordinates. They are suitable for an
// initial radius search, not street-level navigation or clinical dispatch.
export const BD_LOCATIONS: BangladeshLocation[] = [
  { area: 'Bagerhat', lat: 22.6516, lng: 89.7856 },
  { area: 'Bandarban', lat: 22.1953, lng: 92.2184 },
  { area: 'Barguna', lat: 22.1592, lng: 90.1256 },
  { area: 'Barishal', lat: 22.7010, lng: 90.3535 },
  { area: 'Bhola', lat: 22.6859, lng: 90.6482 },
  { area: 'Bogura', lat: 24.8465, lng: 89.3778 },
  { area: 'Brahmanbaria', lat: 23.9571, lng: 91.1119 },
  { area: 'Chandpur', lat: 23.2333, lng: 90.6712 },
  { area: 'Chapainawabganj', lat: 24.5965, lng: 88.2775 },
  { area: 'Chattogram', lat: 22.3569, lng: 91.7832 },
  { area: 'Chuadanga', lat: 23.6402, lng: 88.8418 },
  { area: "Cox's Bazar", lat: 21.4272, lng: 92.0058 },
  { area: 'Cumilla', lat: 23.4607, lng: 91.1809 },
  { area: 'Dhaka', lat: 23.8103, lng: 90.4125 },
  { area: 'Dinajpur', lat: 25.6217, lng: 88.6355 },
  { area: 'Faridpur', lat: 23.6070, lng: 89.8429 },
  { area: 'Feni', lat: 23.0159, lng: 91.3976 },
  { area: 'Gaibandha', lat: 25.3297, lng: 89.5430 },
  { area: 'Gazipur', lat: 23.9999, lng: 90.4203 },
  { area: 'Gopalganj', lat: 23.0051, lng: 89.8266 },
  { area: 'Habiganj', lat: 24.3745, lng: 91.4155 },
  { area: 'Jamalpur', lat: 24.9375, lng: 89.9378 },
  { area: 'Jashore', lat: 23.1634, lng: 89.2182 },
  { area: 'Jhalokati', lat: 22.6406, lng: 90.1987 },
  { area: 'Jhenaidah', lat: 23.5448, lng: 89.1539 },
  { area: 'Joypurhat', lat: 25.0968, lng: 89.0227 },
  { area: 'Khagrachhari', lat: 23.1193, lng: 91.9847 },
  { area: 'Khulna', lat: 22.8456, lng: 89.5403 },
  { area: 'Kishoreganj', lat: 24.4449, lng: 90.7766 },
  { area: 'Kurigram', lat: 25.8054, lng: 89.6362 },
  { area: 'Kushtia', lat: 23.9013, lng: 89.1205 },
  { area: 'Lakshmipur', lat: 22.9425, lng: 90.8412 },
  { area: 'Lalmonirhat', lat: 25.9923, lng: 89.2847 },
  { area: 'Madaripur', lat: 23.1641, lng: 90.1897 },
  { area: 'Magura', lat: 23.4855, lng: 89.4198 },
  { area: 'Manikganj', lat: 23.8644, lng: 90.0047 },
  { area: 'Meherpur', lat: 23.7622, lng: 88.6318 },
  { area: 'Moulvibazar', lat: 24.4829, lng: 91.7774 },
  { area: 'Munshiganj', lat: 23.5422, lng: 90.5305 },
  { area: 'Mymensingh', lat: 24.7471, lng: 90.4203 },
  { area: 'Naogaon', lat: 24.7936, lng: 88.9318 },
  { area: 'Narail', lat: 23.1725, lng: 89.5127 },
  { area: 'Narayanganj', lat: 23.6337, lng: 90.5000 },
  { area: 'Narsingdi', lat: 23.9193, lng: 90.7176 },
  { area: 'Natore', lat: 24.4102, lng: 89.0002 },
  { area: 'Netrokona', lat: 24.8709, lng: 90.7279 },
  { area: 'Nilphamari', lat: 25.9318, lng: 88.8560 },
  { area: 'Noakhali', lat: 22.8696, lng: 91.0995 },
  { area: 'Pabna', lat: 24.0044, lng: 89.2504 },
  { area: 'Panchagarh', lat: 26.3411, lng: 88.5542 },
  { area: 'Patuakhali', lat: 22.3596, lng: 90.3299 },
  { area: 'Pirojpur', lat: 22.5841, lng: 89.9720 },
  { area: 'Rajbari', lat: 23.7574, lng: 89.6445 },
  { area: 'Rajshahi', lat: 24.3636, lng: 88.6241 },
  { area: 'Rangamati', lat: 22.7324, lng: 92.2985 },
  { area: 'Rangpur', lat: 25.7439, lng: 89.2752 },
  { area: 'Satkhira', lat: 22.7185, lng: 89.0705 },
  { area: 'Shariatpur', lat: 23.2423, lng: 90.4348 },
  { area: 'Sherpur', lat: 25.0205, lng: 90.0153 },
  { area: 'Sirajganj', lat: 24.4534, lng: 89.7007 },
  { area: 'Sunamganj', lat: 25.0658, lng: 91.3950 },
  { area: 'Sylhet', lat: 24.8949, lng: 91.8687 },
  { area: 'Tangail', lat: 24.2513, lng: 89.9167 },
  { area: 'Thakurgaon', lat: 26.0337, lng: 88.4616 }
];

const LEGACY_ALIASES: Record<string, string> = {
  barisal: 'Barishal',
  bogra: 'Bogura',
  chittagong: 'Chattogram',
  comilla: 'Cumilla',
  jessore: 'Jashore'
};

export const BD_LOCATION_NAMES = BD_LOCATIONS.map(location => location.area);

export function getLocationByName(name: string) {
  const normalized = name.trim().toLowerCase();
  const canonical = LEGACY_ALIASES[normalized]?.toLowerCase() || normalized;
  const location = BD_LOCATIONS.find(item => item.area.toLowerCase() === canonical);
  return location ? { lat: location.lat, lng: location.lng, area_name: location.area } : null;
}
