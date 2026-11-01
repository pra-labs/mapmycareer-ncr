'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Award,
  CheckCircle2,
  Calendar,
  Code2,
  Star,
  GitFork,
  ExternalLink,
  BookOpen,
  Sparkles,
  ArrowRight,
  Calculator,
  Briefcase,
  AlertCircle,
  TrendingUp,
  GitBranch,
} from 'lucide-react';
import { auditGitHubProfile, ProofOfWorkAuditResult } from '../lib/devProfileAuditor';
import { calculateNoticePeriod, NoticePeriodCalculation } from '../lib/holidayService';

// Custom inline SVG for standard GitHub Mark
const GitHubIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

interface DevProfileAuditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DevProfileAuditorModal: React.FC<DevProfileAuditorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'github' | 'notice'>('github');

  // GitHub Auditor State
  const [username, setUsername] = useState('AbhiPra24');
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<ProofOfWorkAuditResult | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Notice Period Calculator State
  const todayStr = new Date().toISOString().split('T')[0];
  const [resignationDate, setResignationDate] = useState(todayStr);
  const [noticeDays, setNoticeDays] = useState(60);
  const [isCalculatingNotice, setIsCalculatingNotice] = useState(false);
  const [noticeResult, setNoticeResult] = useState<NoticePeriodCalculation | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleAudit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim()) return;

    setIsAuditing(true);
    setAuditError(null);
    try {
      const res = await auditGitHubProfile(username);
      setAuditResult(res);
    } catch (err: any) {
      setAuditError(err.message || 'Failed to audit profile');
    } finally {
      setIsAuditing(false);
    }
  };

  const handleCalculateNotice = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsCalculatingNotice(true);
    try {
      const res = await calculateNoticePeriod(resignationDate, noticeDays);
      setNoticeResult(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsCalculatingNotice(false);
    }
  };

  useEffect(() => {
    if (isOpen && !noticeResult) {
      handleCalculateNotice();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Title & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
              CareerForge Dev Intelligence
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Deterministic Proof-of-Work Auditor & Indian Notice Period Engine
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="mt-4 flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab('github')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'github'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <GitHubIcon className="h-4 w-4" />
            <span>GitHub Proof-of-Work (100 pts)</span>
          </button>
          <button
            onClick={() => setActiveTab('notice')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'notice'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <Calculator className="h-4 w-4" />
            <span>Notice Period & Working Days (IN)</span>
          </button>
        </div>

        {/* TAB 1: GITHUB PROOF OF WORK */}
        {activeTab === 'github' && (
          <div className="mt-4 space-y-4">
            <form onSubmit={handleAudit} className="flex gap-2">
              <div className="relative flex-1">
                <GitHubIcon className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Enter GitHub username (e.g. torvalds, AbhiPra24)..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 py-2 pl-9 pr-3 text-xs font-medium text-zinc-900 outline-none transition focus:border-blue-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <button
                type="submit"
                disabled={isAuditing}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                {isAuditing ? 'Auditing...' : 'Run Audit'}
              </button>
            </form>

            {auditError && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{auditError}</span>
              </div>
            )}

            {auditResult && (
              <div className="space-y-4">
                {/* Profile Overview Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                  <div className="flex items-center gap-3">
                    <img
                      src={auditResult.user.avatar_url}
                      alt={auditResult.username}
                      className="h-12 w-12 rounded-xl border border-zinc-200 object-cover dark:border-zinc-700"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                          {auditResult.user.name || auditResult.username}
                        </h3>
                        <a
                          href={`https://github.com/${auditResult.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-400 hover:text-blue-600"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        @{auditResult.username} {auditResult.user.company ? `· ${auditResult.user.company}` : ''}
                      </p>
                      {auditResult.user.bio && (
                        <p className="mt-1 line-clamp-1 text-xs text-zinc-600 dark:text-zinc-300">
                          {auditResult.user.bio}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Proof of Work Score Badge */}
                  <div className="flex items-center gap-3 self-start sm:self-center border-t sm:border-t-0 sm:border-l border-zinc-200 pt-2 sm:pt-0 sm:pl-4 dark:border-zinc-700">
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        PoW Score
                      </div>
                      <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                        {auditResult.totalScore}
                        <span className="text-xs font-semibold text-zinc-400">/100</span>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        auditResult.totalScore >= 80
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : auditResult.totalScore >= 65
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {auditResult.tier}
                    </span>
                  </div>
                </div>

                {/* Key Stats Row */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-800/60">
                    <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]">
                      <Star className="h-3.5 w-3.5 text-amber-500" />
                      <span>Stars Earned</span>
                    </div>
                    <div className="mt-1 text-base font-bold text-zinc-900 dark:text-white">
                      {auditResult.keyStats.totalStars}
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-800/60">
                    <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]">
                      <GitFork className="h-3.5 w-3.5 text-blue-500" />
                      <span>Forks Earned</span>
                    </div>
                    <div className="mt-1 text-base font-bold text-zinc-900 dark:text-white">
                      {auditResult.keyStats.totalForks}
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-800/60">
                    <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]">
                      <Code2 className="h-3.5 w-3.5 text-purple-500" />
                      <span>Original Repos</span>
                    </div>
                    <div className="mt-1 text-base font-bold text-zinc-900 dark:text-white">
                      {auditResult.keyStats.originalReposCount}
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-800/60">
                    <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]">
                      <Calendar className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Account Age</span>
                    </div>
                    <div className="mt-1 text-base font-bold text-zinc-900 dark:text-white">
                      {auditResult.keyStats.accountAgeYears} yrs
                    </div>
                  </div>
                </div>

                {/* Score Breakdown Bars */}
                <div className="space-y-2.5 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Deterministic 100-Point Scoring Breakdown
                  </h4>

                  {/* 1. Profile Completeness */}
                  <div>
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-zinc-700 dark:text-zinc-300">Profile Completeness</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {auditResult.breakdown.profileCompleteness.score} / {auditResult.breakdown.profileCompleteness.max}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-1.5 rounded-full bg-blue-600 transition-all duration-300"
                        style={{
                          width: `${(auditResult.breakdown.profileCompleteness.score / auditResult.breakdown.profileCompleteness.max) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* 2. Repos & Community Validation */}
                  <div>
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-zinc-700 dark:text-zinc-300">Public Repos & Community Traction</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        {auditResult.breakdown.repoStarsForks.score} / {auditResult.breakdown.repoStarsForks.max}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-1.5 rounded-full bg-amber-500 transition-all duration-300"
                        style={{
                          width: `${(auditResult.breakdown.repoStarsForks.score / auditResult.breakdown.repoStarsForks.max) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* 3. Language Diversity */}
                  <div>
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-zinc-700 dark:text-zinc-300">Languages & Tech Stack Diversity</span>
                      <span className="font-bold text-purple-600 dark:text-purple-400">
                        {auditResult.breakdown.languagesDiversity.score} / {auditResult.breakdown.languagesDiversity.max}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-1.5 rounded-full bg-purple-600 transition-all duration-300"
                        style={{
                          width: `${(auditResult.breakdown.languagesDiversity.score / auditResult.breakdown.languagesDiversity.max) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {auditResult.breakdown.languagesDiversity.languages.map((l) => (
                        <span
                          key={l.name}
                          className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          {l.name} ({l.count})
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 4. Recent Activity */}
                  <div>
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-zinc-700 dark:text-zinc-300">Commit Recency & Consistency</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {auditResult.breakdown.recentActivity.score} / {auditResult.breakdown.recentActivity.max}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-1.5 rounded-full bg-emerald-600 transition-all duration-300"
                        style={{
                          width: `${(auditResult.breakdown.recentActivity.score / auditResult.breakdown.recentActivity.max) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* 5. Documentation Hygiene */}
                  <div>
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-zinc-700 dark:text-zinc-300">Documentation Hygiene & Licenses</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {auditResult.breakdown.documentationHygiene.score} / {auditResult.breakdown.documentationHygiene.max}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-1.5 rounded-full bg-indigo-600 transition-all duration-300"
                        style={{
                          width: `${(auditResult.breakdown.documentationHygiene.score / auditResult.breakdown.documentationHygiene.max) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                {auditResult.recommendations.length > 0 && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 dark:border-blue-900/60 dark:bg-blue-950/20">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-300">
                      <Sparkles className="h-4 w-4 text-blue-600" />
                      <span>Actionable Tips to Maximize Profile Impact</span>
                    </div>
                    <ul className="mt-2 space-y-1.5 text-xs text-blue-950 dark:text-blue-200">
                      {auditResult.recommendations.map((tip, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-blue-500 font-bold">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: NOTICE PERIOD CALCULATOR */}
        {activeTab === 'notice' && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
              <h3 className="text-xs font-bold text-zinc-900 dark:text-white">
                Indian IT Notice Period & Gazetted Holidays Engine
              </h3>
              <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                Determines exact Last Working Day (LWD), working vs non-working days, and gazetted public holidays via Nager.Date.
              </p>

              <form onSubmit={handleCalculateNotice} className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                    Resignation / Intimation Date
                  </label>
                  <input
                    type="date"
                    value={resignationDate}
                    onChange={(e) => setResignationDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                    Notice Duration (Days)
                  </label>
                  <div className="mt-1 flex gap-1.5">
                    {[30, 60, 90].map((d) => (
                      <button
                        type="button"
                        key={d}
                        onClick={() => setNoticeDays(d)}
                        className={`flex-1 rounded-lg border py-2 text-xs font-bold transition ${
                          noticeDays === d
                            ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-300'
                            : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        {d} Days
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isCalculatingNotice}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                  >
                    <span>Recalculate Schedule</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </form>
            </div>

            {noticeResult && (
              <div className="space-y-3">
                {/* Result Highlights */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-900/60 dark:bg-blue-950/30">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                      Last Working Day
                    </span>
                    <div className="mt-1 text-sm sm:text-base font-extrabold text-blue-950 dark:text-blue-100">
                      {noticeResult.lastWorkingDay}
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Net Working Days
                    </span>
                    <div className="mt-1 text-base font-extrabold text-emerald-950 dark:text-emerald-100">
                      {noticeResult.workingDays} days
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-800/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Weekend Offs
                    </span>
                    <div className="mt-1 text-base font-extrabold text-zinc-800 dark:text-zinc-200">
                      {noticeResult.weekendDays} days
                    </div>
                  </div>

                  <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-3 dark:border-purple-900/60 dark:bg-purple-950/30">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                      Public Holidays
                    </span>
                    <div className="mt-1 text-base font-extrabold text-purple-950 dark:text-purple-100">
                      {noticeResult.publicHolidaysCount} days
                    </div>
                  </div>
                </div>

                {/* Holiday breakdown */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
                    Indian Gazetted Holidays During Your Notice Period
                  </h4>
                  {noticeResult.holidaysDuringNotice.length > 0 ? (
                    <div className="mt-2.5 divide-y divide-zinc-100 dark:divide-zinc-800">
                      {noticeResult.holidaysDuringNotice.map((h, i) => (
                        <div key={i} className="flex items-center justify-between py-2 text-xs">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">{h.name}</span>
                          <span className="rounded bg-purple-50 px-2 py-0.5 font-mono text-[11px] font-medium text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                            {h.date}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-500">
                      No Indian gazetted weekday holidays fall within this period.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
