'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Job, CandidateProfile } from '../types/job';
import { parseResumeFile } from '../lib/resumeParser';
import { extractCandidateProfile, rankJobsByResume } from '../lib/resumeMatcher';
import { trackEvent } from '../lib/analytics';
import {
  X,
  UploadCloud,
  FileText,
  Loader2,
  Trash2,
  Sliders,
  CheckCircle2,
  Target,
  ArrowRight,
  Plus,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ResumeMatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: Job[];
  activeProfile: CandidateProfile | null;
  minThreshold: number;
  onApplyProfile: (profile: CandidateProfile, threshold: number) => void;
  onClearProfile: () => void;
}

const SAMPLE_SDET_RESUME = `Priya Sharma
Lead SDET & AI Automation Architect
Bengaluru, India | priya.sharma@example.com | linkedin.com/in/priyasharma

SUMMARY
Lead SDET with 7+ years architecting scalable E2E test automation frameworks, distributed CI/CD quality gates, and AI-driven regression testing suites across microservices.

TECHNICAL SKILLS
Languages: Python, Java, JavaScript, TypeScript, SQL
Test Automation: Selenium, Playwright, Cypress, TestNG, Appium, Cucumber, PyTest, Postman, RestAssured, JMeter
CI/CD & Cloud: Jenkins, Docker, Kubernetes, AWS, GitHub Actions, Git
Databases: PostgreSQL, MySQL, Redis

EXPERIENCE
Lead SDET -- CloudPay FinTech (2021 - Present)
- Architected Playwright and TypeScript test automation suite reducing regression cycle from 18 hours to 42 minutes.
- Automated API integration test suites covering 350+ microservices endpoints with RestAssured and Python.
- Built performance testing harness in JMeter simulating 25,000 peak concurrent users.

Senior SDET -- Apex Technologies (2018 - 2021)
- Developed mobile automation framework using Appium and Java for iOS & Android.
- Integrated automated smoke suites into Jenkins CI/CD pipeline achieving 99.4% build reliability.

EDUCATION
B.Tech in Computer Science -- NIT Surathkal (2014 - 2018)
`;

const SAMPLE_BACKEND_RESUME = `Alex Rivera
Senior Distributed Systems Engineer
Bengaluru, India | alex@example.com | linkedin.com/in/alexrivera

SUMMARY
Senior Backend Engineer with 6+ years designing, scaling, and maintaining resilient high-throughput Go microservices, event-driven Kafka pipelines, and cloud native AWS infrastructure.

TECHNICAL SKILLS
Languages: Go, Python, Java, TypeScript, SQL, Bash
Backend & Architecture: Microservices, RESTful APIs, gRPC, Kafka, Redis, RabbitMQ
Cloud & DevOps: AWS (EKS, Lambda, S3, RDS), Kubernetes, Docker, Terraform, CI/CD
Databases: PostgreSQL, Redis, DynamoDB, Elasticsearch

EXPERIENCE
Senior Backend Engineer -- CloudScale Solutions (2022 - Present)
- Architected high-throughput ingestion pipeline handling 25M+ events daily with 99.99% service uptime in Go & Kafka.
- Optimized database indexing and query workflows, curtailing P99 latency from 180ms to 24ms.
- Spearheaded migration of monolithic service into 12 Go microservices on AWS EKS.

EDUCATION
B.Tech in Computer Science (2015 - 2019)
`;

const SAMPLE_PM_RESUME = `Rohan Mehta
Senior Product Manager
Bengaluru, India | rohan.mehta@example.com | linkedin.com/in/rohanmehta

SUMMARY
Senior Product Manager with 6+ years driving product roadmap strategy, user growth, and agile execution for SaaS & fintech products. Led cross-functional teams of 20+ engineers and designers.

TECHNICAL & DOMAIN SKILLS
Product Strategy: PRDs, Product Roadmaps, A/B Testing, User Stories, User Research
Tools & Analytics: Jira, Confluence, Amplitude, Mixpanel, SQL, Google Analytics, Figma
Methodologies: Agile, Scrum, Kanban, Conversion Rate Optimization (CRO)

EXPERIENCE
Senior Product Manager -- Apex Fintech (2022 - Present)
- Led end-to-end launch of instant merchant settlements, boosting conversion by 28% and driving ₹20M in monthly volume.
- Partnered with engineering and UX design to write detailed PRDs and manage 2-week agile sprint delivery.
- Conducted multivariate experiments in Amplitude, improving user onboarding activation from 35% to 54%.

EDUCATION
MBA / B.Tech (2014 - 2018)
`;

const SAMPLE_SALES_RESUME = `Karan Kapoor
Enterprise Account Executive
Gurugram, India | karan.k@example.com | linkedin.com/in/karankapoor

SUMMARY
Enterprise SaaS Account Executive with 5+ years closing complex B2B sales cycles with C-suite stakeholders. Achieved 140%+ annual quota attainment.

SKILLS & EXPERTISE
Sales & Methodology: Enterprise B2B Sales, MEDDPICC, Lead Generation, Pipeline Management, Contract Negotiation
CRM & Tech Stack: Salesforce, HubSpot, LinkedIn Sales Navigator, Outreach, Gong

EXPERIENCE
Enterprise Account Executive -- Global Cloud Systems (2022 - Present)
- Closed ₹28M in net-new ARR across 14 enterprise enterprise clients, exceeding FY24 quota at 142%.
- Prospected and led multi-threaded deal cycles with CTOs and CISOs across banking and retail sectors.
- Partnered with solutions architects to deliver technical product demos and proofs-of-concept.

EDUCATION
BBA in Marketing & Management (2015 - 2019)
`;

export const ResumeMatcherModal: React.FC<ResumeMatcherModalProps> = ({
  isOpen,
  onClose,
  jobs,
  activeProfile,
  minThreshold,
  onApplyProfile,
  onClearProfile,
}) => {
  const [resumeText, setResumeText] = useState<string>(activeProfile?.rawText || SAMPLE_SDET_RESUME);
  const [profile, setProfile] = useState<CandidateProfile | null>(activeProfile);
  const [threshold, setThreshold] = useState<number>(minThreshold || 35);
  const [customSkillInput, setCustomSkillInput] = useState<string>('');
  const [selectedJobId, setSelectedJobId] = useState<number | string | null>(null);

  // File upload state
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract profile on resumeText change
  useEffect(() => {
    if (!resumeText.trim()) {
      setProfile(null);
      return;
    }
    const extracted = extractCandidateProfile(resumeText);
    setProfile(extracted);
  }, [resumeText]);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsParsing(true);
    setParseError(null);

    try {
      const text = await parseResumeFile(file);
      if (!text.trim()) {
        throw new Error('No readable text could be extracted from this document.');
      }
      setResumeText(text);
      setLoadedFileName(file.name);
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse document.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleAddCustomSkill = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customSkillInput.trim();
    if (!clean || !profile) return;
    if (!profile.skills.includes(clean)) {
      setProfile({
        ...profile,
        skills: [...profile.skills, clean],
      });
    }
    setCustomSkillInput('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    if (!profile) return;
    setProfile({
      ...profile,
      skills: profile.skills.filter((s) => s !== skillToRemove),
    });
  };

  // Preview match results (memoized to prevent heavy re-ranking during typing or UI re-renders)
  const previewMatches = useMemo(() => {
    return profile ? rankJobsByResume(jobs, profile, threshold) : [];
  }, [jobs, profile, threshold]);

  // Keep selected job in sync with previewMatches
  const activeSelectedJob = useMemo(() => {
    if (!previewMatches.length) return null;
    if (selectedJobId !== null) {
      const found = previewMatches.find((m) => m.id === selectedJobId);
      if (found) return found;
    }
    return previewMatches[0];
  }, [previewMatches, selectedJobId]);

  const handleApply = () => {
    if (!profile) return;
    trackEvent('resume_matcher_applied', {
      threshold,
      matched_count: previewMatches.length,
      detected_track: profile?.detectedTrack,
      seniority: profile?.seniority,
    });
    onApplyProfile(profile, threshold);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                  Resume-to-Job Matcher & Career Radar
                </h2>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-600 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-950/60 dark:text-blue-400">
                  100% Client-Side
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Extract your skills & seniority locally to rank 1,450+ verified live jobs by relevance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-12">
          {/* Left: Resume Input & Upload */}
          <div className="flex flex-col border-b border-zinc-200 p-4 dark:border-zinc-800 md:col-span-6 md:border-b-0 md:border-r">
            {/* Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-950/20'
                  : 'border-zinc-200 bg-zinc-50/50 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-800/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
              {isParsing ? (
                <div className="flex items-center gap-2 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Parsing resume text locally in-memory...</span>
                </div>
              ) : loadedFileName ? (
                <div className="flex items-center justify-between w-full px-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <FileText className="h-4 w-4" />
                    <span className="line-clamp-1">{loadedFileName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLoadedFileName(null);
                      setResumeText('');
                    }}
                    className="p-1 text-zinc-400 hover:text-rose-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <UploadCloud className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Drop your resume file or browse
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    Supports .pdf, .docx, .txt, .md (Parsed 100% locally in browser)
                  </span>
                </div>
              )}
            </div>

            {parseError && (
              <div className="mt-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {parseError}
              </div>
            )}

            {/* Quick Samples */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Or Paste Resume Content
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setResumeText(SAMPLE_SDET_RESUME);
                    setLoadedFileName(null);
                  }}
                  className="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  SDET
                </button>
                <span className="text-zinc-300">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setResumeText(SAMPLE_BACKEND_RESUME);
                    setLoadedFileName(null);
                  }}
                  className="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  Backend
                </button>
                <span className="text-zinc-300">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setResumeText(SAMPLE_PM_RESUME);
                    setLoadedFileName(null);
                  }}
                  className="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  PM
                </button>
                <span className="text-zinc-300">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setResumeText(SAMPLE_SALES_RESUME);
                    setLoadedFileName(null);
                  }}
                  className="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  Sales
                </button>
              </div>
            </div>

            {/* Resume Text Area */}
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your resume text here..."
              className="mt-2 flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 font-mono text-xs text-zinc-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100 dark:focus:border-blue-400"
            />
          </div>

          {/* Right: Extracted Profile & Match Preview */}
          <div className="flex flex-col overflow-y-auto p-5 md:col-span-6 bg-zinc-50/30 dark:bg-zinc-900/30">
            {profile ? (
              <div className="flex flex-col gap-4">
                {/* Detected Role & Seniority Card */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-800/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Detected Candidate Profile
                  </span>
                  <div className="mt-1 flex items-center justify-between">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                      {profile.detectedTrack}
                    </h3>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {profile.seniority} {profile.yoeEstimate ? `(${profile.yoeEstimate}+ yrs)` : ''}
                    </span>
                  </div>
                </div>

                {/* Detected Skills */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-800/40">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Extracted Technical Skills ({profile.skills.length})
                    </span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {profile.skills.map((skill) => (
                      <span
                        key={skill}
                        className="group inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200"
                      >
                        <span>{skill}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill)}
                          className="opacity-60 hover:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Add skill inline form */}
                  <form onSubmit={handleAddCustomSkill} className="mt-3 flex gap-2">
                    <input
                      type="text"
                      placeholder="Add custom skill (e.g. Kafka, Docker)..."
                      value={customSkillInput}
                      onChange={(e) => setCustomSkillInput(e.target.value)}
                      className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                    <button
                      type="submit"
                      className="flex items-center gap-1 rounded-lg bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add</span>
                    </button>
                  </form>
                </div>

                {/* Match Sensitivity Threshold Slider */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-800/40">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-zinc-700 dark:text-zinc-300">
                      <Sliders className="h-3.5 w-3.5 text-blue-500" />
                      <span>Minimum Match Threshold</span>
                    </div>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      ≥ {threshold}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={80}
                    step={5}
                    value={threshold}
                    onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
                    className="mt-2 w-full accent-blue-600"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
                    <span>20% (Broader)</span>
                    <span>50% (Balanced)</span>
                    <span>80% (Strict)</span>
                  </div>
                </div>

                {/* Live Match Results Summary & Gap Explainability */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-950 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                        {previewMatches.length} Matching Openings Found
                      </h4>
                      <p className="text-xs text-emerald-800/80 dark:text-emerald-400">
                        {previewMatches.length > 0
                          ? `Top match: ${previewMatches[0].title} at ${previewMatches[0].company} (${previewMatches[0].matchResult?.matchScore}% match)`
                          : 'Try lowering the minimum match threshold to see more roles.'}
                      </p>
                    </div>
                  </div>

                  {previewMatches.length > 0 && (
                    <div className="mt-3 flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                      {previewMatches.slice(0, 5).map((m) => {
                        const isSelected = activeSelectedJob?.id === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setSelectedJobId(m.id)}
                            className={`flex items-center justify-between rounded-lg p-2 text-left text-xs transition ${
                              isSelected
                                ? 'bg-white ring-2 ring-emerald-500 shadow-sm dark:bg-zinc-800 dark:ring-emerald-400'
                                : 'bg-white/80 hover:bg-white dark:bg-zinc-900/80 dark:hover:bg-zinc-900'
                            }`}
                          >
                            <div className="flex flex-col">
                              <span className="font-semibold text-zinc-900 dark:text-white line-clamp-1">
                                {m.title}
                              </span>
                              <span className="text-[11px] text-zinc-500">{m.company} • {m.city}</span>
                            </div>
                            <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {m.matchResult?.matchScore}%
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Gap & Fit Explainability Radar for Selected Job */}
                {activeSelectedJob && activeSelectedJob.matchResult && (
                  <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-800/40">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-xs font-bold text-zinc-900 dark:text-white">
                          Gap & Fit Explainability: {activeSelectedJob.title}
                        </span>
                      </div>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        {activeSelectedJob.matchResult.matchScore}% Match
                      </span>
                    </div>

                    {/* Fit Drivers */}
                    <div className="mt-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        Why This Role Matched
                      </span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {activeSelectedJob.matchResult.matchReasons?.map((reason, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                          >
                            <CheckCircle2 className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                            <span>{reason}</span>
                          </span>
                        ))}
                        {activeSelectedJob.matchResult.seniorityAlignment && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                            Seniority: {activeSelectedJob.matchResult.seniorityAlignment}
                          </span>
                        )}
                        {activeSelectedJob.matchResult.verifiedSalaryRange && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            Comp: {activeSelectedJob.matchResult.verifiedSalaryRange}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Matched Skills */}
                    <div className="mt-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Verified Skills Overlap ({activeSelectedJob.matchResult.matchedSkills.length})
                      </span>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {activeSelectedJob.matchResult.matchedSkills.length > 0 ? (
                          activeSelectedJob.matchResult.matchedSkills.map((s) => (
                            <span
                              key={s}
                              className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                            >
                              ✓ {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-zinc-400 italic">No direct skill overlaps.</span>
                        )}
                      </div>
                    </div>

                    {/* Missing Skills / Stack Gaps */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Missing Skills / Stack Gaps ({activeSelectedJob.matchResult.missingSkills.length})</span>
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {activeSelectedJob.matchResult.missingSkills.length > 0 ? (
                          activeSelectedJob.matchResult.missingSkills.map((s) => (
                            <span
                              key={s}
                              className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300"
                            >
                              + {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            Full stack coverage! No required skill gaps identified.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-zinc-400">
                <FileText className="h-10 w-10 text-zinc-300" />
                <p className="mt-2 text-xs">Drop or paste a resume to begin matching.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950/80">
          <div>
            {activeProfile && (
              <button
                type="button"
                onClick={() => {
                  onClearProfile();
                  onClose();
                }}
                className="text-xs font-semibold text-rose-600 hover:underline dark:text-rose-400"
              >
                Clear Active Match Filter
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!profile || previewMatches.length === 0}
              onClick={handleApply}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-50"
            >
              <span>Apply to Job Radar ({previewMatches.length})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
