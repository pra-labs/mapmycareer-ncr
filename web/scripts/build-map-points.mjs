import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// jobs.json path
const inputPath = path.resolve(__dirname, '../public/data/jobs.json');
const outputPath = path.resolve(__dirname, '../public/data/map-points.json');

const LEVEL_MAP = {
  entry: 0,
  junior: 0,
  mid: 1,
  senior: 2,
  lead: 3,
  principal: 3,
  executive: 3,
};

function buildMapPoints() {
  console.log(`[build-map-points] Reading: ${inputPath}`);

  if (!fs.existsSync(inputPath)) {
    console.warn(`[build-map-points] Warning: ${inputPath} not found. Writing empty array.`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify([]));
    return;
  }

  const rawData = fs.readFileSync(inputPath, 'utf-8');
  const jobs = JSON.parse(rawData);

  // Normalize points to compact tuples: [id, lat, lon, title, company, level, city, url]
  const mapPoints = [];

  for (const j of jobs) {
    if (typeof j.lat === 'number' && typeof j.lon === 'number') {
      const lvlStr = (j.experience_level || '').toLowerCase();
      const level = LEVEL_MAP[lvlStr] ?? 4;
      mapPoints.push([
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

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(mapPoints));
  console.log(`[build-map-points] Successfully generated ${mapPoints.length} points -> ${outputPath}`);
}

buildMapPoints();
