export interface MetroLandmark {
  id: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
}

export const POPULAR_INDIAN_TRANSIT_HUBS: MetroLandmark[] = [
  // Gurugram / Delhi NCR
  { id: 'gurugram_cyber_city', name: 'Cyber City Rapid Metro (Gurugram)', city: 'Gurugram', lat: 28.4944, lon: 77.0902 },
  { id: 'gurugram_huda_city', name: 'Millennium City Centre (HUDA Yellow Line)', city: 'Gurugram', lat: 28.4593, lon: 77.0725 },
  { id: 'delhi_connaught_place', name: 'Rajiv Chowk Metro (Central Delhi)', city: 'Delhi', lat: 28.6328, lon: 77.2197 },
  { id: 'delhi_aerocity', name: 'Aerocity Metro (Delhi Airport Express)', city: 'Delhi', lat: 28.5510, lon: 77.1215 },
  { id: 'noida_sec_62', name: 'Noida Electronic City / Sec 62 Metro', city: 'Noida', lat: 28.6280, lon: 77.3649 },
  { id: 'noida_sec_137', name: 'Sector 137 Metro (Noida Expressway)', city: 'Noida', lat: 28.5020, lon: 77.4080 },

  // Bengaluru
  { id: 'blr_silk_board', name: 'Central Silk Board Junction (Bengaluru)', city: 'Bengaluru', lat: 12.9174, lon: 77.6238 },
  { id: 'blr_kadugodi', name: 'Whitefield Kadugodi Purple Line (Bengaluru)', city: 'Bengaluru', lat: 12.9850, lon: 77.7315 },
  { id: 'blr_indiranagar', name: 'Indiranagar 100ft Rd / Metro', city: 'Bengaluru', lat: 12.9784, lon: 77.6408 },
  { id: 'blr_hebbal', name: 'Hebbal Manyata Flyover Junction', city: 'Bengaluru', lat: 13.0450, lon: 77.6200 },
  { id: 'blr_bellandur', name: 'Bellandur EcoSpace (ORR)', city: 'Bengaluru', lat: 12.9352, lon: 77.6946 },

  // Hyderabad
  { id: 'hyd_raidurg', name: 'Raidurg Metro Terminus (HITEC City)', city: 'Hyderabad', lat: 17.4435, lon: 78.3772 },
  { id: 'hyd_gachibowli', name: 'Gachibowli ORR Junction', city: 'Hyderabad', lat: 17.4400, lon: 78.3489 },
  { id: 'hyd_ameerpet', name: 'Ameerpet Metro Interchange', city: 'Hyderabad', lat: 17.4375, lon: 78.4482 },

  // Pune
  { id: 'pune_hinjawadi', name: 'Hinjawadi Phase 1 Circle', city: 'Pune', lat: 18.5913, lon: 73.7389 },
  { id: 'pune_kharadi', name: 'Kharadi EON Free Zone', city: 'Pune', lat: 18.5515, lon: 73.9354 },
  { id: 'pune_shivajinagar', name: 'Shivajinagar Metro Station', city: 'Pune', lat: 18.5308, lon: 73.8475 },

  // Mumbai
  { id: 'mumbai_bkc', name: 'BKC Metro Station (Mumbai Line 3)', city: 'Mumbai', lat: 19.0664, lon: 72.8687 },
  { id: 'mumbai_andheri', name: 'Andheri Metro / Suburban Station', city: 'Mumbai', lat: 19.1197, lon: 72.8468 },
  { id: 'mumbai_powai', name: 'Powai Hiranandani Tech Circle', city: 'Mumbai', lat: 19.1176, lon: 72.9060 },
];

export interface CommuteEstimate {
  distanceKm: number;
  roadDistanceKm: number;
  drivePeakMinutes: number; // ~20 km/h in Indian peak traffic
  driveOffPeakMinutes: number; // ~35 km/h off peak
  metroTransitMinutes: number; // ~30 km/h avg metro with wait/transfer
}

// Haversine formula to compute great-circle distance between two coords
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function estimateCommute(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number
): CommuteEstimate {
  const straightLine = calculateHaversineDistanceKm(originLat, originLon, destLat, destLon);
  
  // In dense Indian metropolitan road networks, actual driving distance is roughly 1.35x straight-line
  const roadDistanceKm = Math.round(straightLine * 1.35 * 10) / 10;

  // Indian peak traffic average speed: ~20 km/h
  // Add 5 min buffer for lights and parking
  const drivePeakMinutes = Math.max(5, Math.round((roadDistanceKm / 20) * 60 + 5));

  // Off-peak drive speed: ~35 km/h
  const driveOffPeakMinutes = Math.max(5, Math.round((roadDistanceKm / 35) * 60 + 3));

  // Metro transit heuristic: ~30 km/h plus 7 min station ingress/egress/wait
  const metroTransitMinutes = Math.max(10, Math.round((roadDistanceKm / 30) * 60 + 7));

  return {
    distanceKm: straightLine,
    roadDistanceKm,
    drivePeakMinutes,
    driveOffPeakMinutes,
    metroTransitMinutes,
  };
}
