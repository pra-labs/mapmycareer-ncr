import type { MetadataRoute } from 'next';
import { getAllCitySlugs, getAllCityCorridorPairs } from '@/lib/db';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.mapmycareer.online';
  const entries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ];

  try {
    // Unique Cities via db helper
    const cities = getAllCitySlugs();
    cities.forEach((citySlug) => {
      entries.push({
        url: `${baseUrl}/jobs/${citySlug}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.8,
      });
    });

    // High-Intent Corridors via db helper
    const corridorPairs = getAllCityCorridorPairs();
    corridorPairs.forEach((pair) => {
      entries.push({
        url: `${baseUrl}/jobs/${pair.city}/${pair.corridor}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.9,
      });
    });
  } catch (e) {
    console.error('Error generating dynamic sitemap:', e);
  }

  return entries;
}
