export interface PincodeInfo {
  pincode: string;
  postOfficeName: string;
  district: string;
  state: string;
  matchedCity?: string;
  matchedHub?: string;
  lat?: number;
  lon?: number;
}

const pincodeCache = new Map<string, PincodeInfo | null>();

// Approximate coordinates for known tech hubs / districts in India
const KNOWN_DISTRICT_COORDS: Record<string, { city: string; hub: string; lat: number; lon: number }> = {
  '122002': { city: 'Gurugram', hub: 'DLF Cyber City', lat: 28.4943, lon: 77.0901 },
  '122001': { city: 'Gurugram', hub: 'Sohna Road / Sector 32', lat: 28.4595, lon: 77.0266 },
  '122018': { city: 'Gurugram', hub: 'Udyog Vihar / Golf Course Ext', lat: 28.4239, lon: 77.0583 },
  '122003': { city: 'Gurugram', hub: 'Sector 44 / HUDA City Centre', lat: 28.4552, lon: 77.0722 },
  '560103': { city: 'Bengaluru', hub: 'Outer Ring Road (ORR) / Bellandur', lat: 12.9352, lon: 77.6946 },
  '560066': { city: 'Bengaluru', hub: 'Whitefield / ITPB', lat: 12.9850, lon: 77.7315 },
  '560045': { city: 'Bengaluru', hub: 'Manyata Tech Park / Hebbal', lat: 13.0450, lon: 77.6200 },
  '560100': { city: 'Bengaluru', hub: 'Electronic City Phase 1', lat: 12.8450, lon: 77.6600 },
  '560037': { city: 'Bengaluru', hub: 'Marathahalli', lat: 12.9591, lon: 77.6974 },
  '560095': { city: 'Bengaluru', hub: 'Koramangala', lat: 12.9352, lon: 77.6245 },
  '201301': { city: 'Noida', hub: 'Sector 16 / Film City', lat: 28.5700, lon: 77.3200 },
  '201305': { city: 'Noida', hub: 'Sector 135 / Expressway', lat: 28.5020, lon: 77.4080 },
  '201309': { city: 'Noida', hub: 'Sector 62 IT Park', lat: 28.6280, lon: 77.3649 },
  '500081': { city: 'Hyderabad', hub: 'HITEC City / Madhapur', lat: 17.4435, lon: 78.3772 },
  '500032': { city: 'Hyderabad', hub: 'Gachibowli / Financial District', lat: 17.4400, lon: 78.3489 },
  '411057': { city: 'Pune', hub: 'Hinjawadi Rajiv Gandhi Infotech Park', lat: 18.5913, lon: 73.7389 },
  '411014': { city: 'Pune', hub: 'Kharadi / EON Free Zone', lat: 18.5515, lon: 73.9354 },
  '400051': { city: 'Mumbai', hub: 'Bandra Kurla Complex (BKC)', lat: 19.0664, lon: 72.8687 },
  '400076': { city: 'Mumbai', hub: 'Powai / Hiranandani', lat: 19.1176, lon: 72.9060 },
  '110037': { city: 'Delhi', hub: 'Aerocity / Worldmark', lat: 28.5510, lon: 77.1215 },
  '110020': { city: 'Delhi', hub: 'Okhla Phase 3', lat: 28.5355, lon: 77.2713 },
};

export async function lookupPincode(pincode: string): Promise<PincodeInfo | null> {
  const cleanPin = pincode.trim();
  if (!/^\d{6}$/.test(cleanPin)) {
    return null;
  }

  if (pincodeCache.has(cleanPin)) {
    return pincodeCache.get(cleanPin) || null;
  }

  // Fast check local curated list
  const known = KNOWN_DISTRICT_COORDS[cleanPin];

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.Status === 'Success' && Array.isArray(data[0]?.PostOffice) && data[0].PostOffice.length > 0) {
        const po = data[0].PostOffice[0];
        const district = po.District || '';
        const state = po.State || '';
        const name = po.Name || '';

        // Match to platform tech city if applicable
        let matchedCity: string | undefined = known?.city;
        if (!matchedCity) {
          const lowerDistrict = district.toLowerCase();
          const lowerState = state.toLowerCase();
          if (lowerDistrict.includes('gurgaon') || lowerDistrict.includes('gurugram')) matchedCity = 'Gurugram';
          else if (lowerDistrict.includes('bangalore') || lowerDistrict.includes('bengaluru')) matchedCity = 'Bengaluru';
          else if (lowerDistrict.includes('noida') || lowerDistrict.includes('gautam buddha nagar')) matchedCity = 'Noida';
          else if (lowerDistrict.includes('hyderabad') || lowerDistrict.includes('rangareddy')) matchedCity = 'Hyderabad';
          else if (lowerDistrict.includes('pune')) matchedCity = 'Pune';
          else if (lowerDistrict.includes('mumbai')) matchedCity = 'Mumbai';
          else if (lowerDistrict.includes('delhi')) matchedCity = 'Delhi';
        }

        const info: PincodeInfo = {
          pincode: cleanPin,
          postOfficeName: name,
          district,
          state,
          matchedCity: matchedCity || district,
          matchedHub: known?.hub,
          lat: known?.lat,
          lon: known?.lon,
        };

        pincodeCache.set(cleanPin, info);
        return info;
      }
    }
  } catch (err) {
    console.warn('Postal API lookup failed, falling back to local dataset', err);
  }

  if (known) {
    const fallbackInfo: PincodeInfo = {
      pincode: cleanPin,
      postOfficeName: known.hub,
      district: known.city,
      state: 'India',
      matchedCity: known.city,
      matchedHub: known.hub,
      lat: known.lat,
      lon: known.lon,
    };
    pincodeCache.set(cleanPin, fallbackInfo);
    return fallbackInfo;
  }

  pincodeCache.set(cleanPin, null);
  return null;
}
