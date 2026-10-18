import React from 'react';
import { Compass, Layers, FileCode2, Zap, MailCheck, BookOpen, Target } from 'lucide-react';

interface HeaderProps {
  totalJobs: number;
  filteredCount: number;
  hasActiveResumeMatch?: boolean;
  onOpenResumeMatcher?: () => void;
  onOpenAtsAuditor?: () => void;
  onOpenResumeBuilder?: () => void;
  onOpenRecruiterValidator?: () => void;
  onScrollToInsights?: () => void;
  onOpenFaqModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  totalJobs,
  filteredCount,
  hasActiveResumeMatch,
  onOpenResumeMatcher,
  onOpenAtsAuditor,
  onOpenResumeBuilder,
  onOpenRecruiterValidator,
  onScrollToInsights,
  onOpenFaqModal,
}) => {
  const triggerFaq = onOpenFaqModal || onScrollToInsights;
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-white/85 px-3 py-2 sm:px-6 sm:py-2.5 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/85">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
          <Compass className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <h1 className="text-sm sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
              MapMyCareer <span className="text-blue-600 dark:text-blue-400">India</span>
            </h1>
            <span className="hidden rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-950/50 dark:text-blue-400 sm:inline-block">
              Radar v2.0
            </span>
          </div>
          <p className="hidden text-xs text-zinc-500 dark:text-zinc-400 sm:block">
            Interactive Geo-Spatial Tech Openings & CareerForge Utility Engines
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-3 flex-wrap justify-end">
        {/* Mobile quick launcher icons (visible on small screens) */}
        <div className="flex items-center gap-1 md:hidden">
          {triggerFaq && (
            <button
              onClick={triggerFaq}
              className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg border border-amber-200/80 bg-amber-50/70 text-amber-700 transition hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
              title="Corridor Insights & FAQ"
              aria-label="Corridor Insights & FAQ"
            >
              <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400" />
            </button>
          )}
          <button
            onClick={onOpenAtsAuditor}
            className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg border border-blue-200/80 bg-blue-50/70 text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
            title="ATS Auditor"
            aria-label="ATS Auditor"
          >
            <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </button>
          <button
            onClick={onOpenResumeBuilder}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200/80 bg-emerald-50/70 text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
            title="Resume Builder"
            aria-label="Resume Builder"
          >
            <FileCode2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </button>
          <button
            onClick={onOpenRecruiterValidator}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-200/80 bg-purple-50/70 text-purple-700 transition hover:bg-purple-100 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300"
            title="Recruiter Radar"
            aria-label="Recruiter Radar"
          >
            <MailCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </button>
        </div>

        {/* Desktop CareerForge Utility Quick Launchers */}
        <div className="hidden items-center gap-1.5 md:flex">
          {triggerFaq && (
            <button
              onClick={triggerFaq}
              className="flex items-center gap-1.5 rounded-lg border border-amber-200/80 bg-amber-50/70 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/50"
              title="Corridor Insights & Position-Zero FAQ"
            >
              <BookOpen className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>Corridor Insights & FAQ</span>
            </button>
          )}

          <button
            onClick={onOpenResumeMatcher}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow-sm transition ${
              hasActiveResumeMatch
                ? 'border border-blue-500 bg-blue-600 text-white shadow-blue-500/20'
                : 'border border-indigo-200/80 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/50'
            }`}
            title="Upload or paste resume to find and rank matching jobs"
          >
            <Target className={`h-3.5 w-3.5 ${hasActiveResumeMatch ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
            <span>{hasActiveResumeMatch ? 'Resume Match Active' : 'Match Resume'}</span>
          </button>

          <button
            onClick={onOpenAtsAuditor}
            className="flex items-center gap-1.5 rounded-lg border border-blue-200/80 bg-blue-50/70 px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50"
            title="100-Point Heuristic ATS Score & Google XYZ Auditor"
          >
            <Zap className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>ATS Auditor</span>
          </button>

          <button
            onClick={onOpenResumeBuilder}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
            title="Role-Tailored LaTeX & ATS Resume Generator"
          >
            <FileCode2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Resume Builder</span>
          </button>

          <button
            onClick={onOpenRecruiterValidator}
            className="flex items-center gap-1.5 rounded-lg border border-purple-200/80 bg-purple-50/70 px-2.5 py-1.5 text-xs font-semibold text-purple-700 transition hover:bg-purple-100 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/50"
            title="Recruiter Email Deliverability & Anti-Bounce Validator"
          >
            <MailCheck className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            <span>Recruiter Radar</span>
          </button>
        </div>

        {/* Social Profile Links (Compact on mobile, fully styled on tablet/desktop) */}
        <div className="flex items-center gap-0.5 border-r border-zinc-200 pr-1 sm:gap-1 sm:pr-2 dark:border-zinc-800 hidden min-[380px]:flex">
          <a
            href="https://github.com/pra-labs"
            target="_blank"
            rel="noopener noreferrer"
            title="PraLabs on GitHub"
            aria-label="GitHub Profile"
            className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>

          <a
            href="https://www.linkedin.com/company/pra-labs"
            target="_blank"
            rel="noopener noreferrer"
            title="PraLabs on LinkedIn"
            aria-label="LinkedIn Profile"
            className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-100 hover:text-[#0A66C2] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-[#0A66C2]"
          >
            <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.76v8.37H6.46v-8.37M7.84 6.2a1.62 1.62 0 1 0 0 3.24 1.62 1.62 0 0 0 0-3.24z" />
            </svg>
          </a>
        </div>

        {/* Job Counter Badge */}
        <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 sm:px-3">
          <Layers className="h-3.5 w-3.5 text-blue-500" />
          <span className="hidden sm:inline">
            Showing <strong className="text-zinc-900 dark:text-white">{filteredCount}</strong> of {totalJobs} jobs
          </span>
          <span className="sm:hidden">
            <strong className="text-zinc-900 dark:text-white">{filteredCount}</strong> jobs
          </span>
        </div>
      </div>
    </header>
  );
};
