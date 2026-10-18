import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, HelpCircle, TrendingUp, ShieldCheck } from 'lucide-react';

export const CorridorFaqSection: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <section
      id="corridor-insights-faq"
      aria-labelledby="corridor-insights-heading"
      className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-all dark:border-zinc-800 dark:bg-zinc-900/90 sm:p-5"
    >
      {/* Collapsible Section Header */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h2
              id="corridor-insights-heading"
              className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white sm:text-base"
            >
              Corridor Insights & Tech Career FAQ
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Verified salary benchmarks, corridor comparisons & location intelligence
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-expanded={isOpen}
          aria-controls="corridor-insights-body"
        >
          <span>{isOpen ? 'Collapse' : 'Expand'}</span>
          {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Crawlable Semantic Content Body */}
      {isOpen && (
        <div id="corridor-insights-body" className="mt-4 space-y-6 text-xs text-zinc-700 dark:text-zinc-300">
          {/* Collapsible Salary Benchmark Accordion */}
          <details className="group rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 open:bg-white dark:border-zinc-800 dark:bg-zinc-800/40 dark:open:bg-zinc-900" open>
            <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-zinc-900 group-open:text-blue-600 dark:text-white dark:group-open:text-blue-400">
              <span className="text-xs sm:text-sm">What is the average tech salary in DLF Cyber City vs Outer Ring Road Bengaluru?</span>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 space-y-2.5">
              <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
                According to verified compensation data across 10,500+ active roles, tech salaries in DLF Cyber City (Gurugram NCR) offer parity in base pay for senior positions while Outer Ring Road (ORR Bengaluru) yields higher equity grants for early-stage and Series B/C product firms:
              </p>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-zinc-50 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">Experience Tier</th>
                      <th scope="col" className="px-3 py-2 font-semibold">DLF Cyber City (Gurugram)</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Outer Ring Road (Bengaluru)</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Primary Industry Focus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="px-2 py-1.5 font-medium text-zinc-900 dark:text-white">Entry (0-2 YOE)</td>
                      <td className="px-2 py-1.5">₹10 - ₹18 LPA</td>
                      <td className="px-2 py-1.5">₹12 - ₹22 LPA</td>
                      <td className="px-2 py-1.5 text-zinc-500 dark:text-zinc-400">Fintech, E-commerce, SaaS</td>
                    </tr>
                    <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="px-2 py-1.5 font-medium text-zinc-900 dark:text-white">Mid-Level (3-6 YOE)</td>
                      <td className="px-2 py-1.5">₹22 - ₹38 LPA</td>
                      <td className="px-2 py-1.5">₹24 - ₹42 LPA</td>
                      <td className="px-2 py-1.5 text-zinc-500 dark:text-zinc-400">BigTech, Cloud Platforms, AI/ML</td>
                    </tr>
                    <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="px-2 py-1.5 font-medium text-zinc-900 dark:text-white">Senior / Staff (7-11 YOE)</td>
                      <td className="px-2 py-1.5">₹42 - ₹75 LPA</td>
                      <td className="px-2 py-1.5">₹45 - ₹80 LPA</td>
                      <td className="px-2 py-1.5 text-zinc-500 dark:text-zinc-400">Enterprise Systems, GCCs</td>
                    </tr>
                    <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="px-2 py-1.5 font-medium text-zinc-900 dark:text-white">Principal / Lead (12+ YOE)</td>
                      <td className="px-2 py-1.5">₹70 - ₹1.3 Cr</td>
                      <td className="px-2 py-1.5">₹75 - ₹1.4 Cr</td>
                      <td className="px-2 py-1.5 text-zinc-500 dark:text-zinc-400">Global Capability Centers & VC tech</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </details>

          {/* Collapsible City Comparison Guide Accordion */}
          <details className="group rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 open:bg-white dark:border-zinc-800 dark:bg-zinc-800/40 dark:open:bg-zinc-900">
            <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-zinc-900 group-open:text-blue-600 dark:text-white dark:group-open:text-blue-400">
              <span className="text-xs sm:text-sm">How to choose between Gurugram and Bengaluru tech jobs?</span>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3">
              <ol className="list-decimal space-y-1.5 pl-4 leading-relaxed text-zinc-600 dark:text-zinc-400">
                <li>
                  <strong className="text-zinc-800 dark:text-zinc-200">Evaluate Primary Sector Fit:</strong> Gurugram NCR leads in Global Capability Centers (GCCs), Big 4 Advisory, Fintech, and Consumer Internet. Bengaluru specializes in core Developer Tooling, deep AI/ML R&D, and venture-backed SaaS.
                </li>
                <li>
                  <strong className="text-zinc-800 dark:text-zinc-200">Calculate Effective Net Savings (Rent vs CTC):</strong> While base pay in Bengaluru averages 5-8% higher, Gurugram micro-markets (Golf Course Extn, Cyber Hub) provide superior metro connectivity and faster commute times per kilometer.
                </li>
                <li>
                  <strong className="text-zinc-800 dark:text-zinc-200">Consider Transit & Infrastructure:</strong> NCR features direct Rapid Metro integration with DLF Cyber City and Delhi Airport access, whereas Bengaluru ORR relies heavily on feeder shuttles and upcoming metro phases.
                </li>
                <li>
                  <strong className="text-zinc-800 dark:text-zinc-200">Assess Stock Grants (ESOPs vs Liquid RSUs):</strong> Bengaluru startups heavily weight compensation toward equity, while NCR MNCs and Fortune 500 GCCs offer high liquid cash components.
                </li>
              </ol>
            </div>
          </details>

          {/* Question 3: Semantic Accordion FAQ */}
          <div className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-white sm:text-sm">
              <HelpCircle className="h-4 w-4 text-blue-500" />
              <span>Frequently Asked Questions</span>
            </h3>
            <div className="space-y-1.5">
              <details className="group rounded-lg border border-zinc-200 bg-zinc-50/50 p-2.5 open:bg-white dark:border-zinc-800 dark:bg-zinc-800/40 dark:open:bg-zinc-900">
                <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-zinc-800 group-open:text-blue-600 dark:text-zinc-200 dark:group-open:text-blue-400">
                  <span>Which NCR hub has the highest concentration of Frontend & React openings?</span>
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2 pl-1 leading-relaxed text-zinc-600 dark:text-zinc-400">
                  <Link href="/jobs/gurugram/dlf-cyber-city" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">DLF Cyber City</Link> and Udyog Vihar Phase 1-4 host the densest cluster of modern React, Next.js, and TypeScript roles in North India, driven by engineering teams at Zomato, MakeMyTrip, Blinkit, and Microsoft IDC. Compare with Bengaluru&apos;s <Link href="/jobs/bengaluru/outer-ring-road" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">Outer Ring Road</Link> for scale.
                </p>
              </details>

              <details className="group rounded-lg border border-zinc-200 bg-zinc-50/50 p-2.5 open:bg-white dark:border-zinc-800 dark:bg-zinc-800/40 dark:open:bg-zinc-900">
                <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-zinc-800 group-open:text-blue-600 dark:text-zinc-200 dark:group-open:text-blue-400">
                  <span>Are remote and hybrid options still prevalent in Indian tech hubs?</span>
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2 pl-1 leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Over 64% of indexed openings operate under a structured hybrid model (2-3 in-office days per week), with fully remote opportunities primarily offered by US/EU based early-stage software companies.
                </p>
              </details>
            </div>
          </div>

          {/* Question 4: E-E-A-T Verification Methodology */}
          <aside id="methodology" className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="space-y-1">
                <h4 className="font-bold text-zinc-900 dark:text-white">
                  E-E-A-T Verification & Salary Benchmark Methodology
                </h4>
                <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Every position on MapMyCareer is verified against <strong>10,500+ active company career portals</strong>, matched to sub-meter <strong>exact coordinate geocoding</strong>, and indexed against levels.fyi and verified peer benchmarks. We filter ghost job postings and refresh recruitment statuses daily to guarantee candidate trust and data freshness.
                </p>
                <div className="pt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Curated & engineered by <strong className="text-zinc-800 dark:text-zinc-200">PraLabs</strong> ·{' '}
                  <a
                    href="https://github.com/pra-labs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    GitHub
                  </a>{' '}
                  ·{' '}
                  <a
                    href="https://www.linkedin.com/company/pra-labs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    LinkedIn
                  </a>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
};
