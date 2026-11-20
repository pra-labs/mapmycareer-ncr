import fs from 'fs';
import path from 'path';
import type { Job } from '@/types/job';
import { getCorridorConfig, TECH_CORRIDORS } from '@/lib/corridors';

interface JobsStats {
  count: number;
  cities: number;
}

interface CorridorPair {
  city: string;
  corridor: string;
}

interface RawDbRow {
  raw_json: string;
}

interface CitySlugRow {
  city_slug: string;
}

interface CorridorPairRow {
  city_slug: string;
  corridor_slug: string;
}

interface StatsRow {
  count: number;
  cities: number;
}

interface DatabaseSyncType {
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[];
    get: (...params: unknown[]) => unknown;
  };
  close?: () => void;
}

let dbInstance: DatabaseSyncType | null = null;
let dbInitializationAttempted = false;
let fallbackJobsCache: Job[] | null = null;

function resolveDbPath(): string | null {
  const primary = path.join(process.cwd(), 'data', 'jobs.db');
  if (fs.existsSync(primary)) {
    return primary;
  }
  const secondary = path.join(process.cwd(), 'web', 'data', 'jobs.db');
  if (fs.existsSync(secondary)) {
    return secondary;
  }
  return null;
}

function resolveFallbackJsonPath(): string | null {
  const primary = path.join(process.cwd(), 'public', 'data', 'jobs.json');
  if (fs.existsSync(primary)) {
    return primary;
  }
  const secondary = path.join(process.cwd(), 'web', 'public', 'data', 'jobs.json');
  if (fs.existsSync(secondary)) {
    return secondary;
  }
  return null;
}

function getDatabase(): DatabaseSyncType | null {
  if (dbInitializationAttempted) {
    return dbInstance;
  }
  dbInitializationAttempted = true;

  try {
    const dbPath = resolveDbPath();
    if (!dbPath) {
      return null;
    }

    // Use process.getBuiltinModule in Node 22+ to cleanly obtain native sqlite
    // without triggering Turbopack CommonJS bundler external errors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proc = process as any;
    let sqliteModule = typeof proc.getBuiltinModule === 'function'
      ? proc.getBuiltinModule('node:sqlite')
      : null;

    if (!sqliteModule) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        sqliteModule = require('node:sqlite');
      } catch {
        // Ignored, fallback gracefully
      }
    }

    if (sqliteModule && typeof sqliteModule.DatabaseSync === 'function') {
      dbInstance = new sqliteModule.DatabaseSync(dbPath, { readOnly: true }) as DatabaseSyncType;
      return dbInstance;
    }
  } catch (err) {
    console.warn('[db] Failed to initialize node:sqlite database:', err);
  }

  return null;
}

function getFallbackJobs(): Job[] {
  if (fallbackJobsCache) {
    return fallbackJobsCache;
  }

  try {
    const jsonPath = resolveFallbackJsonPath();
    if (jsonPath && fs.existsSync(jsonPath)) {
      const fileContent = fs.readFileSync(jsonPath, 'utf-8');
      fallbackJobsCache = JSON.parse(fileContent) as Job[];
      return fallbackJobsCache;
    }
  } catch (err) {
    console.error('[db] Failed to read fallback jobs.json:', err);
  }

  return [];
}

/**
 * Get all jobs for a specific city slug (e.g. 'bengaluru', 'gurugram')
 */
export function getJobsByCity(citySlug: string): Job[] {
  const normalizedCitySlug = citySlug.trim().toLowerCase();
  const db = getDatabase();

  if (db) {
    try {
      const stmt = db.prepare('SELECT raw_json FROM jobs WHERE city_slug = ?');
      const rows = stmt.all(normalizedCitySlug) as RawDbRow[];
      return rows.map((row) => JSON.parse(row.raw_json) as Job);
    } catch (err) {
      console.warn('[db] Error executing getJobsByCity on SQLite, falling back to JSON:', err);
    }
  }

  const jobs = getFallbackJobs();
  return jobs.filter((job) => {
    if (!job.city) return false;
    return job.city.toLowerCase().replace(/\s+/g, '-') === normalizedCitySlug;
  });
}

/**
 * Get all jobs for a specific city and corridor slug
 */
export function getJobsByCityAndCorridor(citySlug: string, corridorSlug: string): Job[] {
  const normalizedCitySlug = citySlug.trim().toLowerCase();
  const normalizedCorridorSlug = corridorSlug.trim().toLowerCase();
  const db = getDatabase();

  if (db) {
    try {
      const stmt = db.prepare(
        'SELECT raw_json FROM jobs WHERE city_slug = ? AND corridor_slug = ?'
      );
      const rows = stmt.all(normalizedCitySlug, normalizedCorridorSlug) as RawDbRow[];
      if (rows.length > 0) {
        return rows.map((row) => JSON.parse(row.raw_json) as Job);
      }
    } catch (err) {
      console.warn('[db] Error executing getJobsByCityAndCorridor on SQLite:', err);
    }
  }

  // If no rows found in db or db unavailable, fallback to keyword matching using CorridorConfig
  const config = getCorridorConfig(citySlug, corridorSlug);
  if (!config) {
    return [];
  }

  const cityJobs = getJobsByCity(citySlug);
  return cityJobs.filter((job) => {
    const hubText = (job.hub || '').toLowerCase();
    const titleText = (job.title || '').toLowerCase();
    return config.hubKeywords.some(
      (kw) => hubText.includes(kw.toLowerCase()) || titleText.includes(kw.toLowerCase())
    );
  });
}

/**
 * Get all unique city slugs present in the database / jobs feed
 */
export function getAllCitySlugs(): string[] {
  const db = getDatabase();

  if (db) {
    try {
      const stmt = db.prepare(
        "SELECT DISTINCT city_slug FROM jobs WHERE city_slug IS NOT NULL AND city_slug != '' ORDER BY city_slug ASC"
      );
      const rows = stmt.all() as CitySlugRow[];
      return rows.map((r) => r.city_slug);
    } catch (err) {
      console.warn('[db] Error executing getAllCitySlugs on SQLite, falling back:', err);
    }
  }

  const jobs = getFallbackJobs();
  const cities = new Set<string>();
  jobs.forEach((j) => {
    if (j.city) {
      cities.add(j.city.toLowerCase().replace(/\s+/g, '-'));
    }
  });

  return Array.from(cities).sort();
}

/**
 * Get all valid (city, corridor) slug pairs
 */
export function getAllCityCorridorPairs(): CorridorPair[] {
  const db = getDatabase();

  if (db) {
    try {
      const stmt = db.prepare(
        "SELECT DISTINCT city_slug, corridor_slug FROM jobs WHERE corridor_slug IS NOT NULL AND corridor_slug != '' ORDER BY city_slug ASC, corridor_slug ASC"
      );
      const rows = stmt.all() as CorridorPairRow[];
      if (rows.length > 0) {
        return rows.map((r) => ({
          city: r.city_slug,
          corridor: r.corridor_slug,
        }));
      }
    } catch (err) {
      console.warn('[db] Error executing getAllCityCorridorPairs on SQLite:', err);
    }
  }

  const pairs: CorridorPair[] = [];
  const visited = new Set<string>();

  // Check known corridors from corridors.ts
  Object.values(TECH_CORRIDORS).forEach((corr) => {
    const key = `${corr.citySlug}/${corr.slug}`;
    if (!visited.has(key)) {
      visited.add(key);
      pairs.push({ city: corr.citySlug, corridor: corr.slug });
    }
  });

  return pairs;
}

/**
 * Get database summary statistics
 */
export function getJobsStats(): JobsStats {
  const db = getDatabase();

  if (db) {
    try {
      const stmt = db.prepare(
        "SELECT COUNT(*) as count, COUNT(DISTINCT city_slug) as cities FROM jobs WHERE city_slug IS NOT NULL AND city_slug != ''"
      );
      const row = stmt.get() as StatsRow;
      if (row) {
        return {
          count: row.count,
          cities: row.cities,
        };
      }
    } catch (err) {
      console.warn('[db] Error executing getJobsStats on SQLite:', err);
    }
  }

  const citySlugs = getAllCitySlugs();
  const jobs = getFallbackJobs();

  return {
    count: jobs.length,
    cities: citySlugs.length,
  };
}
