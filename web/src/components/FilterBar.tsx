import React, { useMemo } from 'react';
import { FilterState, NoticePeriodFilter } from '../types/job';
import { Search, SlidersHorizontal, IndianRupee, RotateCcw, MapPin, Loader2, X, Sparkles, Clock } from 'lucide-react';
import { lookupPincode, PincodeInfo } from '../lib/pincodeService';
import { trackEvent } from '../lib/analytics';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  cities: string[];
  hubs: string[];
  cityHubMap?: Record<string, string[]>;
  onReset: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  cities,
  hubs,
  cityHubMap,
  onReset,
}) => {
  const [localSearch, setLocalSearch] = React.useState(filters.searchQuery);
  const [isMobileExpanded, setIsMobileExpanded] = React.useState(false);

  // Dynamic hub list: when a city is selected, show only hubs belonging to that city
  const visibleHubs = useMemo(() => {
    if (!filters.selectedCity || filters.selectedCity === 'All Cities') {
      return hubs;
    }
    if (cityHubMap && cityHubMap[filters.selectedCity]) {
      return cityHubMap[filters.selectedCity];
    }
    // Fallback: if cityHubMap wasn't passed, return all hubs
    return hubs;
  }, [filters.selectedCity, hubs, cityHubMap]);

  // PIN Code Auto-Search & Geocoding State
  const [detectedPinInfo, setDetectedPinInfo] = React.useState<PincodeInfo | null>(null);
  const [isLookingUpPin, setIsLookingUpPin] = React.useState(false);

  // AI Search & Structured Filtering State
  const [isAiSearching, setIsAiSearching] = React.useState(false);
  const [aiExpandedInfo, setAiExpandedInfo] = React.useState<{
    query: string;
    summary: string;
    originalFilters: FilterState;
  } | null>(null);

  const handleAiSearch = async () => {
    const query = localSearch.trim();
    if (!query || isAiSearching) return;

    setIsAiSearching(true);

    try {
      const res = await fetch('/api/job-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'nl_search', input: query, query }),
      });

      if (!res.ok) {
        // Fallback gracefully to standard keyword search on 429 or any non-OK status
        console.warn(`[AI Search] Server status ${res.status}. Falling back to standard keyword search.`);
        onFilterChange({ ...filters, searchQuery: query });
        setIsAiSearching(false);
        return;
      }

      const data = await res.json();
      trackEvent('ai_assistant_used', { feature: 'nl_search' });

      const updatedFilters: FilterState = { ...filters };
      const appliedParts: string[] = [];

      // 1. Role or extracted search query
      const rawRole = data.role || data.search_query || data.query || '';
      let cleanRole = typeof rawRole === 'string' ? rawRole.trim() : '';

      // Strip generic conversational filler words (e.g. "testing role" -> "testing", "developer jobs in gurugram" -> "developer")
      if (cleanRole) {
        cleanRole = cleanRole
          .replace(/\b(in|at|near|for)\s+(gurugram|gurgaon|noida|delhi|bengaluru|bangalore|hyderabad|pune|mumbai)\b/gi, '')
          .replace(/\b(role|roles|job|jobs|position|positions|opening|openings)\b/gi, '')
          .trim();
      }

      if (cleanRole) {
        updatedFilters.searchQuery = cleanRole;
        setLocalSearch(cleanRole);
        appliedParts.push(`Role: "${cleanRole}"`);
      } else {
        // If query was purely location (e.g. "jobs in gurugram"), clear search query so all jobs in city match
        updatedFilters.searchQuery = '';
        setLocalSearch('');
      }

      // 2. City
      const targetCity = data.city || data.location;
      if (targetCity && typeof targetCity === 'string') {
        const matchedCity = cities.find(
          (c) => c.toLowerCase() === targetCity.toLowerCase()
        );
        if (matchedCity) {
          updatedFilters.selectedCity = matchedCity;
          appliedParts.push(`City: ${matchedCity}`);
        }
      }

      // 3. Tech Hub / Zone
      const targetHub = data.hub || data.corridor;
      if (targetHub && typeof targetHub === 'string') {
        const matchedHub = hubs.find(
          (h) => h.toLowerCase() === targetHub.toLowerCase()
        );
        if (matchedHub) {
          updatedFilters.selectedHub = matchedHub;
          appliedParts.push(`Hub: ${matchedHub}`);
        }
      }

      // 4. Workplace Model (Remote / Hybrid / On-site)
      const remoteVal = data.workplace_model || data.workplace_models || data.workplaceModel;
      if (remoteVal) {
        const models = Array.isArray(remoteVal) ? remoteVal : [remoteVal];
        const validModels: string[] = [];
        for (const m of models) {
          const lower = String(m).toLowerCase();
          if (lower.includes('remote')) validModels.push('Remote');
          else if (lower.includes('hybrid')) validModels.push('Hybrid');
          else if (lower.includes('on-site') || lower.includes('onsite') || lower.includes('office')) validModels.push('On-site');
        }
        if (validModels.length > 0) {
          updatedFilters.workplaceModels = Array.from(new Set(validModels));
          appliedParts.push(`Mode: ${validModels.join(', ')}`);
        }
      }

      // 5. Experience Level (Entry / Mid / Senior / Lead)
      const expVal = data.experience_level || data.experience_levels || data.experienceLevel;
      if (expVal) {
        const exps = Array.isArray(expVal) ? expVal : [expVal];
        const validExps: string[] = [];
        for (const e of exps) {
          const lower = String(e).toLowerCase();
          if (lower.includes('entry') || lower.includes('junior') || lower.includes('intern') || lower.includes('fresher')) validExps.push('Entry');
          else if (lower.includes('mid') || lower.includes('associate')) validExps.push('Mid');
          else if (lower.includes('senior') || lower.includes('sr')) validExps.push('Senior');
          else if (lower.includes('lead') || lower.includes('staff') || lower.includes('principal')) validExps.push('Lead');
        }
        if (validExps.length > 0) {
          updatedFilters.experienceLevels = Array.from(new Set(validExps));
          appliedParts.push(`Exp: ${validExps.join(', ')}`);
        }
      }

      // 6. Min Salary
      const salaryLPA = data.min_salary_lpa ?? data.min_salary;
      if (typeof salaryLPA === 'number' && salaryLPA > 0) {
        updatedFilters.minSalaryLPA = salaryLPA;
        appliedParts.push(`Min: ${salaryLPA} LPA`);
      }

      // Apply the structured filters
      onFilterChange(updatedFilters);

      const summary =
        data.summary ||
        (appliedParts.length > 0
          ? appliedParts.join(' • ')
          : `Extracted parameters for "${query}"`);

      setAiExpandedInfo({
        query,
        summary,
        originalFilters: { ...filters },
      });
    } catch (err) {
      console.warn('[AI Search] Network or parsing error, falling back to standard keyword search', err);
      onFilterChange({ ...filters, searchQuery: query });
    } finally {
      setIsAiSearching(false);
    }
  };

  const handleResetAiExpansion = () => {
    if (aiExpandedInfo?.originalFilters) {
      onFilterChange(aiExpandedInfo.originalFilters);
      setLocalSearch(aiExpandedInfo.originalFilters.searchQuery);
    } else {
      onReset();
    }
    setAiExpandedInfo(null);
  };

  React.useEffect(() => {
    setLocalSearch(filters.searchQuery);
  }, [filters.searchQuery]);

  // Check if input has a 6-digit Indian PIN code
  React.useEffect(() => {
    const pinMatch = localSearch.match(/\b([1-9][0-9]{5})\b/);
    if (pinMatch) {
      const pin = pinMatch[1];
      let active = true;
      setIsLookingUpPin(true);
      lookupPincode(pin)
        .then((info) => {
          if (!active) return;
          setIsLookingUpPin(false);
          if (info) {
            setDetectedPinInfo(info);
            // If the matched city is one of our cities, automatically filter to it
            if (info.matchedCity) {
              const matchedCityInList = cities.find(
                (c) => c.toLowerCase() === info.matchedCity!.toLowerCase()
              );
              if (matchedCityInList && filters.selectedCity !== matchedCityInList) {
                onFilterChange({
                  ...filters,
                  selectedCity: matchedCityInList,
                  searchQuery: localSearch,
                });
              }
            }
          }
        })
        .catch(() => {
          if (active) setIsLookingUpPin(false);
        });

      return () => {
        active = false;
      };
    } else {
      setDetectedPinInfo(null);
    }
  }, [localSearch, cities, filters, onFilterChange]);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearch !== filters.searchQuery) {
        onFilterChange({ ...filters, searchQuery: localSearch });
      }
    }, 150);
    return () => clearTimeout(handler);
  }, [localSearch, filters, onFilterChange]);

  const experienceOptions = ['Entry', 'Mid', 'Senior', 'Lead'];
  const workplaceOptions = ['Remote', 'Hybrid', 'On-site'];
  const noticeOptions: NoticePeriodFilter[] = ['Any', 'Immediate / <= 30 Days', '30-60 Days', '> 60 Days'];

  const toggleExperience = (exp: string) => {
    const exists = filters.experienceLevels.includes(exp);
    const updated = exists
      ? filters.experienceLevels.filter((e) => e !== exp)
      : [...filters.experienceLevels, exp];
    onFilterChange({ ...filters, experienceLevels: updated });
  };

  const toggleWorkplace = (wp: string) => {
    const exists = filters.workplaceModels.includes(wp);
    const updated = exists
      ? filters.workplaceModels.filter((w) => w !== wp)
      : [...filters.workplaceModels, wp];
    onFilterChange({ ...filters, workplaceModels: updated });
  };

  const handleNoticeChange = (np: NoticePeriodFilter) => {
    onFilterChange({ ...filters, noticePeriod: np === filters.noticePeriod ? 'Any' : np });
  };

  const activeFiltersCount =
    (filters.selectedCity !== 'All Cities' ? 1 : 0) +
    (filters.selectedHub !== 'All Hubs' ? 1 : 0) +
    filters.experienceLevels.length +
    filters.workplaceModels.length +
    (filters.minSalaryLPA > 0 ? 1 : 0) +
    (filters.noticePeriod && filters.noticePeriod !== 'Any' ? 1 : 0) +
    (filters.showSavedOnly ? 1 : 0);

  return (
    <div className="flex flex-col gap-2.5 sm:gap-3 rounded-xl border border-zinc-200 bg-white p-3 sm:p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90">
      {/* Connected Search & Filter Unit */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        {/* Search input with integrated mobile filter trigger & AI Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search role, skills, or try AI search (e.g. 'Remote Senior React in Bengaluru')..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAiSearch();
              }
            }}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 py-2 pl-9 pr-28 sm:pr-32 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
          />

          {/* Action buttons inside search bar: AI Search + Mobile Filter Toggle */}
          <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
            <button
              type="button"
              onClick={handleAiSearch}
              disabled={isAiSearching || !localSearch.trim()}
              className={`flex h-7 items-center gap-1 px-2 rounded-md border text-[11px] font-semibold transition ${
                localSearch.trim()
                  ? 'border-violet-300 bg-gradient-to-r from-violet-50 to-indigo-50 text-violet-700 hover:from-violet-100 hover:to-indigo-100 dark:border-violet-800/80 dark:bg-gradient-to-r dark:from-violet-950/60 dark:to-indigo-950/60 dark:text-violet-300 dark:hover:from-violet-900/80 dark:hover:to-indigo-900/80 shadow-xs'
                  : 'border-zinc-200 bg-zinc-100/70 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed opacity-60'
              }`}
              title="AI Search: Extract role, location, remote, and experience filters"
              aria-label="AI Search"
            >
              {isAiSearching ? (
                <Loader2 className="h-3 w-3 animate-spin text-violet-600 dark:text-violet-400" />
              ) : (
                <Sparkles className="h-3 w-3 text-violet-600 dark:text-violet-400" />
              )}
              <span className="hidden min-[420px]:inline">
                {isAiSearching ? 'Expanding...' : 'AI Search'}
              </span>
            </button>

            {/* Embedded Mobile Filter Expand Toggle */}
            <button
              onClick={() => setIsMobileExpanded((prev) => !prev)}
              className={`flex h-7 w-7 items-center justify-center rounded-md border text-xs font-semibold sm:hidden transition ${
                isMobileExpanded || activeFiltersCount > 0
                  ? 'border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-400'
                  : 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
              }`}
              title="Toggle filters"
              aria-label="Toggle filters"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* City Filter */}
        <div className={`w-full md:w-44 md:min-w-[140px] ${isMobileExpanded ? 'block' : 'hidden sm:block'}`}>
          <select
            value={filters.selectedCity}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                selectedCity: e.target.value,
                selectedHub: 'All Hubs', // reset hub when city changes
              })
            }
            className="w-full truncate rounded-lg border border-zinc-200 bg-zinc-50/50 py-2 px-2.5 text-xs font-medium text-zinc-900 outline-none transition focus:border-blue-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="All Cities">All Indian Cities</option>
            {cities.map((city) => (
              <option key={city} value={city} className="dark:bg-zinc-800 dark:text-zinc-100">
                {city}
              </option>
            ))}
          </select>
        </div>

        {/* Hub Filter */}
        <div className={`w-full md:w-48 md:min-w-[160px] md:max-w-[200px] ${isMobileExpanded ? 'block' : 'hidden sm:block'}`}>
          <select
            value={filters.selectedHub}
            onChange={(e) => onFilterChange({ ...filters, selectedHub: e.target.value })}
            className="w-full truncate rounded-lg border border-zinc-200 bg-zinc-50/50 py-2 px-2.5 text-xs font-medium text-zinc-900 outline-none transition focus:border-blue-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="All Hubs">
              {filters.selectedCity !== 'All Cities' ? `All ${filters.selectedCity} Hubs` : 'All Tech Hubs / Zones'}
            </option>
            {visibleHubs.map((hub) => (
              <option key={hub} value={hub} className="dark:bg-zinc-800 dark:text-zinc-100">
                {hub}
              </option>
            ))}
          </select>
        </div>

        {/* Reset button */}
        <div className={`w-full md:w-auto shrink-0 ${isMobileExpanded ? 'flex' : 'hidden sm:flex'}`}>
          <button
            onClick={() => {
              setAiExpandedInfo(null);
              onReset();
            }}
            className="flex w-full md:w-auto items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-100 py-2 px-3 text-xs font-medium text-zinc-600 transition hover:bg-zinc-200 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* 🔮 AI Expanded Filter Badge */}
      {aiExpandedInfo && (
        <div className="flex items-center justify-between rounded-lg border border-violet-200 bg-gradient-to-r from-violet-50/90 to-indigo-50/80 px-3 py-1.5 text-xs text-violet-900 dark:border-violet-900/60 dark:bg-gradient-to-r dark:from-violet-950/40 dark:to-indigo-950/40 dark:text-violet-200 animate-in fade-in">
          <div className="flex items-center gap-2 overflow-hidden">
            <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
            <div className="truncate">
              <span className="font-semibold text-violet-700 dark:text-violet-300">AI Expanded:</span>{' '}
              <span className="text-zinc-700 dark:text-zinc-300">{aiExpandedInfo.summary}</span>
            </div>
          </div>
          <button
            onClick={handleResetAiExpansion}
            className="flex items-center gap-1 shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-900/60 transition"
            title="Reset AI search filters"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset AI</span>
          </button>
        </div>
      )}

      {/* 📍 Detected Indian Postal PIN Code Badge */}
      {(detectedPinInfo || isLookingUpPin) && (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200 animate-in fade-in">
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            {isLookingUpPin ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Resolving PIN code details...
              </span>
            ) : (
              <span>
                📍 <strong>{detectedPinInfo?.postOfficeName}</strong> ({detectedPinInfo?.district}, {detectedPinInfo?.state}) — Auto-mapped to{' '}
                <span className="font-bold underline">{detectedPinInfo?.matchedCity || detectedPinInfo?.district}</span>
              </span>
            )}
          </div>
          <button
            onClick={() => setDetectedPinInfo(null)}
            className="rounded p-0.5 text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/50"
            title="Dismiss PIN badge"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Filter Badges & Sliders Row */}
      <div className={`flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-2.5 dark:border-zinc-800/60 ${
        isMobileExpanded ? 'flex' : 'hidden sm:flex'
      }`}>
        {/* Experience Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Experience:
          </span>
          {experienceOptions.map((exp) => {
            const active = filters.experienceLevels.includes(exp);
            return (
              <button
                key={exp}
                onClick={() => toggleExperience(exp)}
                className={`rounded-md px-3 py-1.5 min-h-[36px] text-xs font-medium transition ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                }`}
              >
                {exp}
              </button>
            );
          })}
        </div>

        {/* Workplace Model Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Mode:
          </span>
          {workplaceOptions.map((wp) => {
            const active = filters.workplaceModels.includes(wp);
            return (
              <button
                key={wp}
                onClick={() => toggleWorkplace(wp)}
                className={`rounded-md px-3 py-1.5 min-h-[36px] text-xs font-medium transition ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                }`}
              >
                {wp}
              </button>
            );
          })}
        </div>

        {/* Notice Period / Joiner Urgency Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            <Clock className="h-3 w-3 text-amber-500" />
            <span>Notice:</span>
          </span>
          {noticeOptions.map((np) => {
            const active = (filters.noticePeriod || 'Any') === np;
            return (
              <button
                key={np}
                onClick={() => handleNoticeChange(np)}
                className={`rounded-md px-2.5 py-1.5 min-h-[36px] text-xs font-medium transition ${
                  active && np !== 'Any'
                    ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/20 dark:bg-amber-500 dark:text-zinc-950 font-semibold'
                    : active && np === 'Any'
                    ? 'bg-zinc-200 text-zinc-800 font-semibold dark:bg-zinc-700 dark:text-zinc-100'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                }`}
              >
                {np === 'Immediate / <= 30 Days' ? 'Immediate / ≤30d' : np}
              </button>
            );
          })}
        </div>

        {/* Saved Jobs Filter */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onFilterChange({ ...filters, showSavedOnly: !filters.showSavedOnly })}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 min-h-[36px] text-xs font-medium transition ${
              filters.showSavedOnly
                ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/20'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
            }`}
          >
            <span className="hidden sm:inline">Saved Jobs</span>
            <span className="sm:hidden">Saved</span>
          </button>
        </div>

        {/* Min Salary Filter */}
        <div className="flex items-center gap-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Min Salary:
          </span>
          <div className="flex items-center gap-1 text-xs font-bold text-zinc-700 dark:text-zinc-300 min-w-[58px]">
            <IndianRupee className="h-3.5 w-3.5 text-emerald-500" />
            <span>{filters.minSalaryLPA > 0 ? `${filters.minSalaryLPA} LPA+` : 'Any'}</span>
          </div>
          <input
            type="range"
            min="0"
            max="40"
            step="5"
            value={filters.minSalaryLPA}
            onChange={(e) => onFilterChange({ ...filters, minSalaryLPA: parseInt(e.target.value, 10) })}
            className="h-1.5 w-24 cursor-pointer accent-blue-600"
          />
        </div>
      </div>
    </div>
  );
};
