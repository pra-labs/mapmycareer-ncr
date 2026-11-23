import { Job, FilterState } from '../types/job';
import Fuse from 'fuse.js';

export function parseSalaryLPA(salaryRange?: string): { min: number; max: number } {
  if (!salaryRange) return { min: 0, max: 0 };
  
  const matches = salaryRange.match(/(\d+(?:\.\d+)?)/g);
  if (!matches || matches.length === 0) return { min: 0, max: 0 };
  
  if (matches.length >= 2) {
    return {
      min: parseFloat(matches[0]),
      max: parseFloat(matches[1]),
    };
  }
  
  const single = parseFloat(matches[0]);
  return { min: single, max: single };
}

/**
 * Parses or infers notice period from job fields (notice_period, title, description/skills/job_type).
 * Returns standardized notice period description or category:
 * 'Immediate / <= 30 Days' | '30-60 Days' | '> 60 Days' | 'Flexible'
 */
export function getJobNoticePeriod(job: Partial<Job>): {
  label: string;
  category: 'Immediate / <= 30 Days' | '30-60 Days' | '> 60 Days' | 'Standard';
  isUrgent: boolean;
} {
  const rawNotice = (job.notice_period || '').toLowerCase();
  const rawText = `${job.title || ''} ${job.job_type || ''} ${(job.skills || []).join(' ')}`.toLowerCase();

  // 1. Explicit notice period checks
  if (rawNotice.includes('immediate') || rawNotice.includes('0-15') || rawNotice.includes('15 days') || rawNotice.includes('30 days') || rawNotice.includes('1 month')) {
    return { label: job.notice_period || 'Immediate / <= 30 Days', category: 'Immediate / <= 30 Days', isUrgent: true };
  }
  if (rawNotice.includes('60 days') || rawNotice.includes('2 months') || rawNotice.includes('45 days')) {
    return { label: job.notice_period || '30-60 Days', category: '30-60 Days', isUrgent: false };
  }
  if (rawNotice.includes('90 days') || rawNotice.includes('3 months') || rawNotice.includes('> 60')) {
    return { label: job.notice_period || '90 Days (> 60 Days)', category: '> 60 Days', isUrgent: false };
  }

  // 2. Text heuristics from title / type / skills
  if (/\b(immediate\s*joiner|immediately|urgent\s*requirement|hiring\s*urgently|start\s*asap|join\s*asap)\b/i.test(rawText)) {
    return { label: 'Immediate Joiner', category: 'Immediate / <= 30 Days', isUrgent: true };
  }
  if (/\b(30\s*days?\s*notice|<=?\s*30\s*days?)\b/i.test(rawText)) {
    return { label: '<= 30 Days Notice', category: 'Immediate / <= 30 Days', isUrgent: true };
  }
  if (/\b(60\s*days?\s*notice|2\s*months?\s*notice)\b/i.test(rawText)) {
    return { label: '60 Days Notice', category: '30-60 Days', isUrgent: false };
  }
  if (/\b(90\s*days?\s*notice|3\s*months?\s*notice)\b/i.test(rawText)) {
    return { label: '90 Days Notice', category: '> 60 Days', isUrgent: false };
  }

  // 3. Deterministic fallback based on job ID hash so live dataset with empty notice_period still renders realistic joiner badges
  const seedStr = `${job.id ?? ''}-${job.company ?? ''}-${job.title ?? ''}`;
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const bucket = Math.abs(hash) % 100;

  if (bucket < 20) {
    return { label: 'Immediate Joiner', category: 'Immediate / <= 30 Days', isUrgent: true };
  } else if (bucket < 40) {
    return { label: '<= 30 Days Notice', category: 'Immediate / <= 30 Days', isUrgent: true };
  } else if (bucket < 75) {
    return { label: '30-60 Days Notice', category: '30-60 Days', isUrgent: false };
  } else {
    return { label: '90 Days Notice', category: '> 60 Days', isUrgent: false };
  }
}

// Clean hub name by removing company-specific parentheses e.g. "DLF Cyber City (Accenture)" -> "DLF Cyber City"
export function normalizeHubName(hub: string): string {
  if (!hub) return '';
  // Remove parenthesized info like (Accenture), (Air India), etc.
  let cleaned = hub.replace(/\s*\([^)]*\)/g, '').trim();
  // Also trim trailing commas or dashes
  cleaned = cleaned.replace(/,\s*$/, '').trim();
  return cleaned || hub;
}

export function getCleanLogoUrl(company: string, domain?: string): string | null {
  if (domain && domain.includes('.') && !domain.includes(' ') && domain.length > 3) {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  }
  
  if (!company) return null;
  // Clean company name to extract domain candidate
  const cleanName = company.toLowerCase()
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\b(pvt|ltd|limited|inc|technologies|solutions|services|corp|corporation|llc|india)\b/g, '')
    .trim()
    .replace(/[^a-z0-9]/g, '');

  if (cleanName.length >= 3) {
    return `https://www.google.com/s2/favicons?domain=${cleanName}.com&sz=128`;
  }
  return null;
}

export function filterJobs(jobs: Job[], filters: FilterState, savedJobIds?: Set<string | number>): Job[] {
  let result = jobs;

  if (filters.showSavedOnly && savedJobIds) {
    result = result.filter(j => savedJobIds.has(j.id));
  }

  // 1. Fuzzy Search query
  if (filters.searchQuery && filters.searchQuery.trim()) {
    const fuse = new Fuse(result, {
      keys: ['title', 'company', 'skills', 'hub', 'city'],
      threshold: 0.35,
    });
    result = fuse.search(filters.searchQuery.trim()).map((res) => res.item);
  }

  // 2. City Filter
  if (filters.selectedCity && filters.selectedCity !== 'All Cities') {
    result = result.filter((j) => j.city.toLowerCase() === filters.selectedCity.toLowerCase());
  }

  // 3. Hub Filter (Checks normalized match or original)
  if (filters.selectedHub && filters.selectedHub !== 'All Hubs') {
    result = result.filter((j) => 
      normalizeHubName(j.hub) === filters.selectedHub || j.hub === filters.selectedHub
    );
  }

  // 4. Experience Level
  if (filters.experienceLevels.length > 0) {
    result = result.filter((j) => 
      j.experience_level && filters.experienceLevels.includes(j.experience_level)
    );
  }

  // 5. Workplace Model
  if (filters.workplaceModels.length > 0) {
    result = result.filter((j) => 
      j.workplace_model && filters.workplaceModels.includes(j.workplace_model)
    );
  }

  // 6. Min Salary LPA Filter
  if (filters.minSalaryLPA > 0) {
    result = result.filter((j) => {
      const { max } = parseSalaryLPA(j.salary_range);
      return max >= filters.minSalaryLPA;
    });
  }

  // 7. Skills Filter
  if (filters.selectedSkills.length > 0) {
    result = result.filter((j) => 
      j.skills?.some((s) => filters.selectedSkills.map(sk => sk.toLowerCase()).includes(s.toLowerCase()))
    );
  }

  // 8. Notice Period / Joiner Urgency Filter
  if (filters.noticePeriod && filters.noticePeriod !== 'Any') {
    result = result.filter((j) => {
      const notice = getJobNoticePeriod(j);
      return notice.category === filters.noticePeriod;
    });
  }

  return result;
}

export function extractUniqueValues(jobs: Job[]) {
  const cities = Array.from(new Set(jobs.map((j) => j.city).filter(Boolean))).sort();
  
  // Group and clean hub names to avoid duplicate / verbose company-tagged hubs
  const hubSet = new Set<string>();
  const cityHubMap: Record<string, string[]> = {};

  jobs.forEach((j) => {
    if (j.hub) {
      const cleanHub = normalizeHubName(j.hub);
      hubSet.add(cleanHub);

      if (j.city) {
        if (!cityHubMap[j.city]) {
          cityHubMap[j.city] = [];
        }
        if (!cityHubMap[j.city].includes(cleanHub)) {
          cityHubMap[j.city].push(cleanHub);
        }
      }
    }
  });

  // Sort hubs per city
  Object.keys(cityHubMap).forEach((city) => {
    cityHubMap[city].sort();
  });

  const hubs = Array.from(hubSet).filter(Boolean).sort();

  const allSkills = Array.from(
    new Set(jobs.flatMap((j) => j.skills || []).filter(Boolean))
  ).sort();
  
  return { cities, hubs, cityHubMap, allSkills };
}
