export interface WeatherAqiData {
  temperature: number; // in Celsius
  relativeHumidity: number; // in percentage
  weatherCode: number;
  weatherCondition: string;
  windSpeed: number; // in km/h
  aqi: number; // European AQI (0-100+)
  aqiCategory: 'Good' | 'Fair' | 'Moderate' | 'Poor' | 'Very Poor';
  pm25: number; // µg/m³
  pm10: number; // µg/m³
  timestamp: number;
}

// Map WMO weather codes to human descriptions
export function decodeWeatherCode(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code === 1) return 'Mainly Clear';
  if (code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 55) return 'Drizzle';
  if (code >= 61 && code <= 65) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain Showers';
  if (code >= 95 && code <= 99) return 'Thunderstorm';
  return 'Clear';
}

export function getAqiCategory(aqi: number): 'Good' | 'Fair' | 'Moderate' | 'Poor' | 'Very Poor' {
  if (aqi <= 20) return 'Good';
  if (aqi <= 40) return 'Fair';
  if (aqi <= 60) return 'Moderate';
  if (aqi <= 80) return 'Poor';
  return 'Very Poor';
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes TTL
const memoryCache = new Map<string, { data: WeatherAqiData; expiry: number }>();

function getCacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)}_${lon.toFixed(2)}`;
}

export async function fetchWeatherAndAqi(
  lat: number,
  lon: number
): Promise<WeatherAqiData | null> {
  if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
    return null;
  }

  const cacheKey = getCacheKey(lat, lon);
  const now = Date.now();

  // 1. Check in-memory cache
  const inMemory = memoryCache.get(cacheKey);
  if (inMemory && inMemory.expiry > now) {
    return inMemory.data;
  }

  // 2. Check localStorage cache in browser
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`weather_aqi_${cacheKey}`);
      if (stored) {
        const parsed = JSON.parse(stored) as { data: WeatherAqiData; expiry: number };
        if (parsed.expiry > now) {
          memoryCache.set(cacheKey, parsed);
          return parsed.data;
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`;
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm2_5,pm10`;

    const [weatherRes, aqiRes] = await Promise.allSettled([
      fetch(weatherUrl),
      fetch(aqiUrl),
    ]);

    let temperature = 26;
    let relativeHumidity = 50;
    let weatherCode = 0;
    let windSpeed = 10;
    let aqi = 45;
    let pm25 = 25;
    let pm10 = 40;

    if (weatherRes.status === 'fulfilled' && weatherRes.value.ok) {
      const weatherJson = await weatherRes.value.json();
      if (weatherJson?.current) {
        temperature = Math.round(weatherJson.current.temperature_2m ?? 26);
        relativeHumidity = Math.round(weatherJson.current.relative_humidity_2m ?? 50);
        weatherCode = weatherJson.current.weather_code ?? 0;
        windSpeed = Math.round(weatherJson.current.wind_speed_10m ?? 10);
      }
    }

    if (aqiRes.status === 'fulfilled' && aqiRes.value.ok) {
      const aqiJson = await aqiRes.value.json();
      if (aqiJson?.current) {
        aqi = Math.round(aqiJson.current.european_aqi ?? 45);
        pm25 = Math.round(aqiJson.current.pm2_5 ?? 25);
        pm10 = Math.round(aqiJson.current.pm10 ?? 40);
      }
    }

    const data: WeatherAqiData = {
      temperature,
      relativeHumidity,
      weatherCode,
      weatherCondition: decodeWeatherCode(weatherCode),
      windSpeed,
      aqi,
      aqiCategory: getAqiCategory(aqi),
      pm25,
      pm10,
      timestamp: now,
    };

    // Store in memory & localStorage
    const cacheEntry = { data, expiry: now + CACHE_TTL_MS };
    memoryCache.set(cacheKey, cacheEntry);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`weather_aqi_${cacheKey}`, JSON.stringify(cacheEntry));
      } catch {
        // Ignore quota errors
      }
    }

    return data;
  } catch (err) {
    console.error('Failed to fetch weather/AQI from Open-Meteo:', err);
    return null;
  }
}
