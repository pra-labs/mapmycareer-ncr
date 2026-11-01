'use client';

import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { Job, FilterState, CandidateProfile, JobMatchResult } from '../types/job';
import { filterJobs, extractUniqueValues } from '../lib/filterUtils';
import { scoreJobMatch } from '../lib/resumeMatcher';
import { Header } from '../components/Header';
import { FilterBar } from '../components/FilterBar';
import { JobCard } from '../components/JobCard';
import { MapView } from '../components/MapView';
import { JobDetailsModal } from '../components/JobDetailsModal';
import { AtsAuditModal } from '../components/AtsAuditModal';
import { ResumeBuilderModal } from '../components/ResumeBuilderModal';
import { RecruiterValidatorModal } from '../components/RecruiterValidatorModal';
import { ResumeMatcherModal } from '../components/ResumeMatcherModal';
import { AnnouncementBanner } from '../components/AnnouncementBanner';
import { CorridorFaqSection } from '../components/CorridorFaqSection';
import { CorridorFaqModal } from '../components/CorridorFaqModal';
import { DevProfileAuditorModal } from '../components/DevProfileAuditorModal';
import { Loader2, AlertCircle, List, Map as MapIcon, Target, Sparkles, X } from 'lucide-react';

export default function Home() {
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [hoveredJob, setHoveredJob] = useState<Job | null>(null);
  const [modalJob, setModalJob] = useState<Job | null>(null);
  const [mobileTab, setMobileTab] = useState<'list' | 'map'>('list');

  // Resizable Split Pane State
  const [feedWidthPercent, setFeedWidthPercent] = useState<number>(42);
  const splitContainerRef = React.useRef<HTMLDivElement>(null);

  const handleMouseDownDivider = (e: React.MouseEvent) => {
    e.preventDefault();
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const newWidth = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      if (newWidth >= 25 && newWidth <= 65) {
        setFeedWidthPercent(newWidth);
      }
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.dispatchEvent(new Event('mapInvalidateSize'));
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // CareerForge Modals State
  const [isAtsModalOpen, setIsAtsModalOpen] = useState<boolean>(false);
  const [isResumeBuilderOpen, setIsResumeBuilderOpen] = useState<boolean>(false);
  const [isRecruiterModalOpen, setIsRecruiterModalOpen] = useState<boolean>(false);
  const [isDevProfileAuditorOpen, setIsDevProfileAuditorOpen] = useState<boolean>(false);
  const [isFaqModalOpen, setIsFaqModalOpen] = useState<boolean>(false);
  const [isResumeMatcherOpen, setIsResumeMatcherOpen] = useState<boolean>(false);
  const [activeResumeProfile, setActiveResumeProfile] = useState<CandidateProfile | null>(null);
  const [matchThreshold, setMatchThreshold] = useState<number>(35);
  const [activeJobContext, setActiveJobContext] = useState<{
    title: string;
    company: string;
    skills: string[];
  } | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    selectedCity: 'All Cities',
    selectedHub: 'All Hubs',
    experienceLevels: [],
    workplaceModels: [],
    minSalaryLPA: 0,
    selectedSkills: [],
    showSavedOnly: false,
  });

  const [savedJobIds, setSavedJobIds] = useState<Set<string | number>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem('savedJobs');
      if (saved) {
        setSavedJobIds(new Set(JSON.parse(saved)));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const toggleSaveJob = (jobId: string | number) => {
    setSavedJobIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      localStorage.setItem('savedJobs', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  // Fetch jobs dataset
  useEffect(() => {
    async function loadJobs() {
      try {
        const res = await fetch('/data/jobs.json');
        if (!res.ok) throw new Error('Failed to load dataset');
        const data = await res.json();
        setAllJobs(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadJobs();
  }, []);

  const { cities, hubs } = useMemo(() => extractUniqueValues(allJobs), [allJobs]);

  const deferredFilters = useDeferredValue(filters);

  // Compute match results for all jobs when activeResumeProfile changes
  const jobMatchMap = useMemo(() => {
    const map = new Map<number | string, JobMatchResult>();
    if (!activeResumeProfile) return map;
    allJobs.forEach((job) => {
      const result = scoreJobMatch(job, activeResumeProfile);
      map.set(job.id, result);
    });
    return map;
  }, [allJobs, activeResumeProfile]);

  const filteredJobs = useMemo(() => {
    let result = filterJobs(allJobs, deferredFilters, savedJobIds);

    // If resume match profile is active, filter by threshold and sort by matchScore
    if (activeResumeProfile) {
      result = result
        .filter((job) => {
          const match = jobMatchMap.get(job.id);
          return match ? match.matchScore >= matchThreshold : false;
        })
        .sort((a, b) => {
          const matchA = jobMatchMap.get(a.id);
          const matchB = jobMatchMap.get(b.id);
          const scoreA = matchA?.matchScore || 0;
          const scoreB = matchB?.matchScore || 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          const matchedCountA = matchA?.matchedSkills.length || 0;
          const matchedCountB = matchB?.matchedSkills.length || 0;
          return matchedCountB - matchedCountA;
        });
    }

    return result;
  }, [allJobs, deferredFilters, savedJobIds, activeResumeProfile, jobMatchMap, matchThreshold]);

  const [displayLimit, setDisplayLimit] = useState<number>(40);

  // Reset displayLimit whenever filters change
  useEffect(() => {
    setDisplayLimit(40);
  }, [filters]);

  const displayedJobs = useMemo(() => {
    return filteredJobs.slice(0, displayLimit);
  }, [filteredJobs, displayLimit]);

  const handleScrollFeed = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 300) {
      if (displayLimit < filteredJobs.length) {
        setDisplayLimit((prev) => Math.min(prev + 40, filteredJobs.length));
      }
    }
  };

  const handleResetFilters = () => {
    setFilters({
      searchQuery: '',
      selectedCity: 'All Cities',
      selectedHub: 'All Hubs',
      experienceLevels: [],
      workplaceModels: [],
      minSalaryLPA: 0,
      selectedSkills: [],
    });
  };

  // Job Modal Action Handlers
  const handleAuditForJob = (job: Job) => {
    setActiveJobContext({
      title: job.title,
      company: job.company,
      skills: job.skills || [],
    });
    setModalJob(null);
    setIsAtsModalOpen(true);
  };

  const handleGenerateForJob = (job: Job) => {
    setActiveJobContext({
      title: job.title,
      company: job.company,
      skills: job.skills || [],
    });
    setModalJob(null);
    setIsResumeBuilderOpen(true);
  };

  const handleVerifyRecruiterForJob = (job: Job) => {
    setActiveJobContext({
      title: job.title,
      company: job.company,
      skills: job.skills || [],
    });
    setModalJob(null);
    setIsRecruiterModalOpen(true);
  };

  const handleScrollToInsights = () => {
    setMobileTab('list');
    setTimeout(() => {
      const el = document.getElementById('corridor-insights-faq');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
          Loading India Geo-Spatial Job Radar...
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
      {/* Dynamic Announcement Banner (Vercel Edge Config) */}
      <AnnouncementBanner />

      {/* Top Navbar */}
      <Header
        totalJobs={allJobs.length}
        filteredCount={filteredJobs.length}
        hasActiveResumeMatch={Boolean(activeResumeProfile)}
        onOpenResumeMatcher={() => setIsResumeMatcherOpen(true)}
        onOpenAtsAuditor={() => {
          setActiveJobContext(null);
          setIsAtsModalOpen(true);
        }}
        onOpenResumeBuilder={() => {
          setActiveJobContext(null);
          setIsResumeBuilderOpen(true);
        }}
        onOpenRecruiterValidator={() => {
          setActiveJobContext(null);
          setIsRecruiterModalOpen(true);
        }}
        onOpenDevProfileAuditor={() => {
          setIsDevProfileAuditorOpen(true);
        }}
        onScrollToInsights={handleScrollToInsights}
        onOpenFaqModal={() => setIsFaqModalOpen(true)}
      />

      {/* Main Container */}
      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-3 sm:p-4">
        {/* Active Resume Match Banner */}
        {activeResumeProfile && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-2.5 text-xs shadow-sm dark:border-blue-900/60 dark:bg-blue-950/40">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                <Target className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-blue-950 dark:text-blue-100">
                    Active Resume Radar: {activeResumeProfile.detectedTrack}
                  </span>
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {activeResumeProfile.seniority}
                  </span>
                </div>
                <p className="text-[11px] text-blue-800/80 dark:text-blue-300">
                  {activeResumeProfile.skills.length} skills extracted ({activeResumeProfile.skills.slice(0, 5).join(', ')}{activeResumeProfile.skills.length > 5 ? '...' : ''}) • Ranked by match score (≥{matchThreshold}%)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsResumeMatcherOpen(true)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700"
              >
                Adjust Match Profile
              </button>
              <button
                onClick={() => setActiveResumeProfile(null)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Sticky Filter Bar */}
        <div className="sticky top-0 z-20">
          <FilterBar
            filters={filters}
            onFilterChange={setFilters}
            cities={cities}
            hubs={hubs}
            onReset={handleResetFilters}
          />
        </div>

        {/* Split Screen Content: Left Job Feed, Right Geospatial Map with Resizable Splitter */}
        <div
          ref={splitContainerRef}
          className="relative flex flex-1 flex-col lg:flex-row gap-0 overflow-hidden rounded-xl"
        >
          {/* Left: Job Cards Feed (Independent Scroll) */}
          <div
            onScroll={handleScrollFeed}
            style={{ width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${feedWidthPercent}%` : '100%' }}
            className={`h-full flex-col overflow-y-auto pr-1 lg:pr-2 ${
              mobileTab === 'list' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            {filteredJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
                <AlertCircle className="h-8 w-8 text-zinc-400" />
                <h3 className="mt-2 text-sm font-bold text-zinc-800 dark:text-white">
                  No matching jobs found
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {activeResumeProfile
                    ? 'Try lowering the minimum match threshold in the Resume Matcher or clearing some search filters.'
                    : 'Try relaxing your salary or experience filters to see more opportunities.'}
                </p>
                <div className="mt-4 flex gap-2">
                  {activeResumeProfile && (
                    <button
                      onClick={() => setIsResumeMatcherOpen(true)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Adjust Threshold
                    </button>
                  )}
                  <button
                    onClick={handleResetFilters}
                    className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400"
                  >
                    Clear all filters
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 pb-28 lg:pb-6">
                {displayedJobs.map((job) => (
                  <div key={job.id} id={`job-card-${job.id}`}>
                    <JobCard
                      job={job}
                      isSelected={selectedJob?.id === job.id}
                      isSaved={savedJobIds.has(job.id)}
                      matchResult={activeResumeProfile ? jobMatchMap.get(job.id) : undefined}
                      onSelect={(j) => {
                        setSelectedJob(j);
                        setModalJob(j);
                      }}
                      onHover={(j) => setHoveredJob(j)}
                      onToggleSave={(j, e) => {
                        e.stopPropagation();
                        toggleSaveJob(j.id);
                      }}
                    />
                  </div>
                ))}
                {displayLimit < filteredJobs.length && (
                  <div className="space-y-2.5 py-2">
                    {/* Animated Skeleton Loading Card Placeholders */}
                    <div className="animate-pulse rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                          <div className="space-y-1.5">
                            <div className="h-3.5 w-36 rounded bg-zinc-200 dark:bg-zinc-800" />
                            <div className="h-2.5 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
                          </div>
                        </div>
                        <div className="h-5 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
                      </div>
                      <div className="mt-4 flex gap-2">
                        <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
                        <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
                      </div>
                    </div>
                  </div>
                )}
                <CorridorFaqSection />
              </div>
            )}
          </div>

          {/* Desktop Resizable Divider Handle */}
          <div
            onMouseDown={handleMouseDownDivider}
            className="hidden lg:flex w-2 cursor-col-resize items-center justify-center transition-colors hover:bg-blue-500/20 active:bg-blue-500/40 select-none group"
            title="Drag to resize feed & map"
          >
            <div className="h-10 w-1 rounded-full bg-zinc-300 transition-colors group-hover:bg-blue-500 dark:bg-zinc-700" />
          </div>

          {/* Right: Map Explorer */}
          <div
            style={{ width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `calc(${100 - feedWidthPercent}% - 8px)` : '100%' }}
            className={`h-full flex-1 ${
              mobileTab === 'map'
                ? 'block relative'
                : 'hidden lg:block'
            }`}
          >
            <MapView
              jobs={filteredJobs}
              selectedJob={selectedJob}
              hoveredJob={hoveredJob}
              onSelectJob={(j) => {
                setSelectedJob(j);
                setModalJob(j);
                // Scroll card into view in left pane
                const cardEl = document.getElementById(`job-card-${j.id}`);
                if (cardEl) {
                  cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
              }}
            />
          </div>
        </div>

        {/* Mobile Floating View Switcher Pill — positioned with safe-area spacing */}
        <div
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
          className="fixed left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded-full border border-zinc-200/80 bg-zinc-900/90 p-1.5 shadow-2xl backdrop-blur-md dark:border-zinc-700/80 dark:bg-zinc-900/95 lg:hidden"
        >
          <button
            onClick={() => setMobileTab('list')}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all ${
              mobileTab === 'list'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <List className="h-4 w-4" />
            <span>Jobs ({filteredJobs.length})</span>
          </button>
          <button
            onClick={() => {
              setMobileTab('map');
              setTimeout(() => {
                window.dispatchEvent(new Event('mapInvalidateSize'));
              }, 50);
            }}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all ${
              mobileTab === 'map'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MapIcon className="h-4 w-4" />
            <span>Map View</span>
          </button>
        </div>
      </div>

      {/* Job Details Popup Modal */}
      <JobDetailsModal
        job={modalJob}
        isSaved={modalJob ? savedJobIds.has(modalJob.id) : false}
        matchResult={activeResumeProfile && modalJob ? jobMatchMap.get(modalJob.id) : undefined}
        onClose={() => setModalJob(null)}
        onToggleSave={() => modalJob && toggleSaveJob(modalJob.id)}
        onAuditResume={handleAuditForJob}
        onGenerateResume={handleGenerateForJob}
        onVerifyRecruiter={handleVerifyRecruiterForJob}
      />

      {/* Resume Matcher Radar Modal */}
      <ResumeMatcherModal
        isOpen={isResumeMatcherOpen}
        onClose={() => setIsResumeMatcherOpen(false)}
        jobs={allJobs}
        activeProfile={activeResumeProfile}
        minThreshold={matchThreshold}
        onApplyProfile={(prof, thresh) => {
          setActiveResumeProfile(prof);
          setMatchThreshold(thresh);
        }}
        onClearProfile={() => {
          setActiveResumeProfile(null);
        }}
      />

      {/* CareerForge ATS Auditor Modal */}
      <AtsAuditModal
        isOpen={isAtsModalOpen}
        onClose={() => setIsAtsModalOpen(false)}
        initialJobContext={activeJobContext}
      />

      {/* CareerForge Resume Builder Modal */}
      <ResumeBuilderModal
        isOpen={isResumeBuilderOpen}
        onClose={() => setIsResumeBuilderOpen(false)}
        initialJobContext={activeJobContext}
      />

      {/* CareerForge Recruiter Radar Modal */}
      <RecruiterValidatorModal
        isOpen={isRecruiterModalOpen}
        onClose={() => setIsRecruiterModalOpen(false)}
        initialJobContext={activeJobContext}
      />

      {/* CareerForge Dev Profile Auditor & Indian Notice Period Engine Modal */}
      <DevProfileAuditorModal
        isOpen={isDevProfileAuditorOpen}
        onClose={() => setIsDevProfileAuditorOpen(false)}
      />

      {/* Corridor Insights & Tech Career FAQ Modal */}
      <CorridorFaqModal
        isOpen={isFaqModalOpen}
        onClose={() => setIsFaqModalOpen(false)}
      />
    </div>
  );
}
