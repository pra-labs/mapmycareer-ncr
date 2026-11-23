import React, { useState } from 'react';
import { Job, JobMatchResult } from '../types/job';
import { getCleanLogoUrl, getJobNoticePeriod } from '../lib/filterUtils';
import { trackEvent } from '../lib/analytics';
import { MapPin, Building2, Briefcase, IndianRupee, ExternalLink, Bookmark, Target, Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface JobCardProps {
  job: Job;
  isSelected?: boolean;
  isSaved?: boolean;
  matchResult?: JobMatchResult;
  onSelect: (job: Job) => void;
  onHover?: (job: Job | null) => void;
  onToggleSave?: (job: Job, e: React.MouseEvent) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ job, isSelected, isSaved, matchResult, onSelect, onHover, onToggleSave }) => {
  const [imgError, setImgError] = useState(false);
  const [isSkillsExpanded, setIsSkillsExpanded] = useState(false);

  const notice = getJobNoticePeriod(job);

  const getBadgeColor = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'entry':
        return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400';
      case 'mid':
        return 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-400';
      case 'senior':
        return 'bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-950/40 dark:text-purple-400';
      case 'lead':
        return 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-400';
      default:
        return 'bg-zinc-50 text-zinc-700 ring-zinc-600/20 dark:bg-zinc-800 dark:text-zinc-300';
    }
  };

  const logoSrc = !imgError ? (job.company_logo || getCleanLogoUrl(job.company, job.company_domain)) : null;

  return (
    <div
      onClick={() => onSelect(job)}
      onMouseEnter={() => onHover && onHover(job)}
      onMouseLeave={() => onHover && onHover(null)}
      className={`group relative flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition-all duration-200 hover:shadow-lg ${
        isSelected
          ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-500/20 dark:border-blue-400 dark:bg-blue-950/30'
          : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-zinc-700'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt={job.company}
                loading="lazy"
                onError={() => setImgError(true)}
                className="h-10 w-10 shrink-0 rounded-lg border border-zinc-100 object-contain p-1 dark:border-zinc-800 dark:bg-zinc-800"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                <Building2 className="h-5 w-5" />
              </div>
            )}
            <div>
              <h3 className="line-clamp-1 text-sm font-semibold text-zinc-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                {job.title}
              </h3>
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{job.company}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 shrink-0">
            <div className="flex flex-col items-end gap-1">
              {matchResult && (
                <span
                  className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${
                    matchResult.matchScore >= 70
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/30 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : matchResult.matchScore >= 50
                      ? 'bg-blue-50 text-blue-700 ring-blue-600/30 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'bg-amber-50 text-amber-700 ring-amber-600/30 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}
                  title={`Skills: ${matchResult.skillsScore}%, Title: ${matchResult.titleScore}%, Exp: ${matchResult.experienceScore}%`}
                >
                  <Target className="h-3 w-3" />
                  <span>{matchResult.matchScore}% Match</span>
                </span>
              )}
              {job.experience_level && (
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${getBadgeColor(
                    job.experience_level
                  )}`}
                >
                  {job.experience_level}
                </span>
              )}
              {/* Notice Period / Joiner Urgency Badge */}
              <span
                className={`flex items-center gap-1 shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                  notice.isUrgent
                    ? 'bg-amber-50 text-amber-700 ring-amber-500/30 dark:bg-amber-950/50 dark:text-amber-300'
                    : 'bg-zinc-50 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-400'
                }`}
                title={`Notice Period: ${notice.label}`}
              >
                <Clock className="h-2.5 w-2.5" />
                <span>{notice.label}</span>
              </span>
            </div>
            {onToggleSave && (
              <button
                onClick={(e) => onToggleSave(job, e)}
                aria-label={isSaved ? 'Remove from saved jobs' : 'Save job'}
                className={`flex h-11 w-11 self-start items-center justify-center rounded-lg transition active:scale-95 ${
                  isSaved
                    ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 ring-1 ring-rose-500/20'
                    : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Bookmark className="h-4 w-4" fill={isSaved ? 'currentColor' : 'none'} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-y-1.5 gap-x-3 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-1" title={job.location || job.hub || job.city}>
            <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
            <span className="line-clamp-1">
              {job.hub ? `${job.hub}, ${job.city}` : (job.city || job.location || 'India')}
            </span>
          </div>
          {job.salary_range && (
            <div className="flex items-center gap-1 font-semibold text-zinc-700 dark:text-zinc-300">
              <IndianRupee className="h-3.5 w-3.5 text-emerald-500" />
              <span>{job.salary_range}</span>
            </div>
          )}
          {job.workplace_model && (
            <div className="flex items-center gap-1">
              <Briefcase className="h-3.5 w-3.5 text-blue-500" />
              <span>{job.workplace_model}</span>
            </div>
          )}
        </div>

        {job.skills && job.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1">
            {(isSkillsExpanded ? job.skills : job.skills.slice(0, 3)).map((skill, idx) => {
              const isMatched = matchResult?.matchedSkills.some(
                (ms) => ms.toLowerCase() === skill.toLowerCase()
              );
              return (
                <span
                  key={idx}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                    isMatched
                      ? 'bg-emerald-100 font-semibold text-emerald-800 ring-1 ring-emerald-500/30 dark:bg-emerald-950/80 dark:text-emerald-300'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {isMatched && '✓ '}{skill}
                </span>
              );
            })}
            {job.skills.length > 3 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSkillsExpanded((prev) => !prev);
                }}
                className="flex items-center gap-0.5 rounded-md bg-zinc-100 hover:bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition"
                title={isSkillsExpanded ? 'Collapse skills' : `Click to see all: ${job.skills.slice(3).join(', ')}`}
                aria-label={isSkillsExpanded ? 'Collapse skill tags' : `Expand ${job.skills.length - 3} more skills`}
              >
                <span>{isSkillsExpanded ? 'show less' : `+${job.skills.length - 3} more`}</span>
                {isSkillsExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-3.5 flex items-center justify-between border-t border-zinc-100 pt-2.5 dark:border-zinc-800/80">
        <span className="text-[11px] text-zinc-400">
          {job.experience_yoe ? `${job.experience_yoe}` : 'Experience open'}
        </span>
        {job.apply_url && (
          <a
            href={job.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              trackEvent('job_apply_outbound', {
                job_id: job.id,
                title: job.title,
                company: job.company,
                url: job.apply_url,
                source: 'job_card',
              });
            }}
            className="flex items-center gap-1 rounded-md bg-blue-50 px-3 py-2 min-h-[44px] text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-400 dark:hover:bg-blue-900/60"
          >
            <span>Apply</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
};
