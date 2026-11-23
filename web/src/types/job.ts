/**
 * Nominal Brand type helper for strict type safety
 */
export type Brand<K, T> = K & { readonly __brand: T };

export type JobId = Brand<number | string, 'JobId'>;
export type Latitude = Brand<number, 'Latitude'>;
export type Longitude = Brand<number, 'Longitude'>;

export type ExperienceTier = 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Principal';
export type WorkplaceModel = 'Remote' | 'Hybrid' | 'On-site';

export type TechHubCity =
  | 'Bengaluru'
  | 'Gurugram'
  | 'Noida'
  | 'Hyderabad'
  | 'Pune'
  | 'Mumbai'
  | 'Kochi'
  | 'Chandigarh'
  | 'Kolkata'
  | 'Delhi'
  | (string & {});

export interface Job {
  id: number | string;
  title: string;
  company: string;
  company_logo?: string;
  company_domain?: string;
  experience_yoe?: string;
  experience_level?: ExperienceTier | string;
  job_type?: string;
  city: TechHubCity;
  location?: string;
  hub: string;
  lat: number;
  lon: number;
  skills?: string[];
  salary_range?: string;
  salary_min_lpa?: number;
  salary_max_lpa?: number;
  workplace_model?: WorkplaceModel | string;
  apply_url?: string;
  source?: string;
  standard_level?: string;
  level_name?: string;
  level_code?: string;
  level_tier?: string;
  level_yoe_range?: string;
  levels_fyi_benchmark?: string;
  levels_fyi_url?: string;
  notice_period?: string;
}

export type NoticePeriodFilter = 'Any' | 'Immediate / <= 30 Days' | '30-60 Days' | '> 60 Days';

export interface FilterState {
  searchQuery: string;
  selectedCity: string;
  selectedHub: string;
  experienceLevels: string[];
  workplaceModels: string[];
  minSalaryLPA: number;
  selectedSkills: string[];
  noticePeriod?: NoticePeriodFilter | string;
  showSavedOnly?: boolean;
}

/**
 * Readonly immutable helper for state filtering
 */
export type ReadonlyFilterState = Readonly<FilterState>;

export interface CandidateProfile {
  skills: string[];
  seniority: 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Any';
  detectedTrack?: string;
  yoeEstimate?: number;
  rawText?: string;
}

export interface JobMatchResult {
  jobId: number | string;
  matchScore: number;          // 0 to 100
  skillsScore: number;         // 0 to 100
  titleScore: number;          // 0 to 100
  experienceScore: number;     // 0 to 100
  matchedSkills: string[];
  missingSkills: string[];
  seniorityAlignment?: 'Exact Match' | 'Close Match' | 'Gap';
  verifiedSalaryRange?: string;
  matchReasons?: string[];
}

export interface MatchedJob extends Job {
  matchResult?: JobMatchResult;
}
