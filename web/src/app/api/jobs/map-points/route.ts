import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { CompactJobTuple } from '@/types/geo';

const LEVEL_MAP: Record<string, number> = {
  entry: 0,
  junior: 0,
  mid: 1,
  senior: 2,
  lead: 3,
  principal: 3,
  executive: 3,
};

// Normalized tuple: [id, lat, lon, title, company, level, city, url]
export type DetailedMapPointTuple = [
  id: number | string,
  lat: number,
  lon: number,
  title: string,
  company: string,
  level: number,
  city: string,
  url: string
];

let cachedPoints: DetailedMapPointTuple[] | null = null;

export async function GET() {
  if (cachedPoints) {
    return NextResponse.json(cachedPoints, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  }

  try {
    // If pre-built static map-points.json exists, serve it
    const staticMapPointsPath = path.join(process.cwd(), 'public/data/map-points.json');
    if (fs.existsSync(staticMapPointsPath)) {
      const staticData = fs.readFileSync(staticMapPointsPath, 'utf-8');
      cachedPoints = JSON.parse(staticData);
      return NextResponse.json(cachedPoints, {
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    }

    const filePath = path.join(process.cwd(), 'public/data/jobs.json');
    if (!fs.existsSync(filePath)) {
      return NextResponse.json([]);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const jobs = JSON.parse(fileContent);

    // Build payload: [id, lat, lon, title, company, level, city, url]
    const points: DetailedMapPointTuple[] = [];
    for (const j of jobs) {
      if (typeof j.lat === 'number' && typeof j.lon === 'number') {
        const lvlStr = (j.experience_level || '').toLowerCase();
        const level = LEVEL_MAP[lvlStr] ?? 4;
        points.push([
          j.id,
          j.lat,
          j.lon,
          j.title || '',
          j.company || '',
          level,
          j.city || '',
          j.apply_url || ''
        ]);
      }
    }

    cachedPoints = points;

    return NextResponse.json(points, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    console.error('Failed to load map points:', err);
    return NextResponse.json({ error: 'Failed to generate map points' }, { status: 500 });
  }
}
