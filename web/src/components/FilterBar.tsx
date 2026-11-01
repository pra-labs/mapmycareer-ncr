import React from 'react';
import { FilterState } from '../types/job';
import { Search, SlidersHorizontal, IndianRupee, RotateCcw, MapPin, Loader2, X } from 'lucide-react';
import { lookupPincode, PincodeInfo } from '../lib/pincodeService';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  cities: string[];
  hubs: string[];
  onReset: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  cities,
  hubs,
  onReset,
}) => {
  const [localSearch, setLocalSearch] = React.useState(filters.searchQuery);
  const [isMobileExpanded, setIsMobileExpanded] = React.useState(false);

  // PIN Code Auto-Search & Geocoding State
  const [detectedPinInfo, setDetectedPinInfo] = React.useState<PincodeInfo | null>(null);
  const [isLookingUpPin, setIsLookingUpPin] = React.useState(false);

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

  const activeFiltersCount =
    (filters.selectedCity !== 'All Cities' ? 1 : 0) +
    (filters.selectedHub !== 'All Hubs' ? 1 : 0) +
    filters.experienceLevels.length +
    filters.workplaceModels.length +
    (filters.minSalaryLPA > 0 ? 1 : 0) +
    (filters.showSavedOnly ? 1 : 0);

  return (
    <div className="flex flex-col gap-2.5 sm:gap-3 rounded-xl border border-zinc-200 bg-white p-3 sm:p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90">
      {/* Connected Search & Filter Unit */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        {/* Search input with integrated mobile filter trigger */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search role, skills, or company..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 py-2 pl-9 pr-11 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400 sm:pr-3"
          />

          {/* Embedded Mobile Filter Expand Toggle */}
          <button
            onClick={() => setIsMobileExpanded((prev) => !prev)}
            className={`absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md border text-xs font-semibold sm:hidden transition ${
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
            <option value="All Hubs">All Tech Hubs / Zones</option>
            {hubs.map((hub) => (
              <option key={hub} value={hub} className="dark:bg-zinc-800 dark:text-zinc-100">
                {hub}
              </option>
            ))}
          </select>
        </div>

        {/* Reset button */}
        <div className={`w-full md:w-auto shrink-0 ${isMobileExpanded ? 'flex' : 'hidden sm:flex'}`}>
          <button
            onClick={onReset}
            className="flex w-full md:w-auto items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-100 py-2 px-3 text-xs font-medium text-zinc-600 transition hover:bg-zinc-200 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

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
