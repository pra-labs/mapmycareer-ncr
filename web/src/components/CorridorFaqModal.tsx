'use client';

import React from 'react';
import Link from 'next/link';
import {
  X,
  TrendingUp,
  HelpCircle,
  ShieldCheck,
  ChevronDown,
  Building2,
  Train,
  ExternalLink,
} from 'lucide-react';

interface CorridorFaqModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CorridorFaqModal: React.FC<CorridorFaqModalProps> = ({ isOpen, onClose }) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="corridor-faq-modal-title"
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <h2
                id="corridor-faq-modal-title"
                className="text-base font-bold text-zinc-900 dark:text-white"
              >
                Corridor Insights & Tech Career FAQ
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Verified salary benchmarks, transit corridors & developer intelligence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs text-zinc-700 dark:text-zinc-300">
          {/* Question 1: Table Snippet Target */}
          <article className="space-y-2.5">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              What is the average tech salary in DLF Cyber City vs Outer Ring Road Bengaluru?
            </h3>
            <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
              According to verified compensation data across 10,500+ active roles, tech salaries in DLF Cyber City (Gurugram NCR) offer parity in base pay for senior positions while Outer Ring Road (ORR Bengaluru) yields higher equity grants for early-stage and Series B/C product firms:
            </p>
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-zinc-50 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">Experience Tier</th>
                    <th scope="col" className="px-3 py-2 font-semibold">DLF Cyber City (Gurugram)</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Outer Ring Road (Bengaluru)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                    <td className="px-3 py-2 font-medium text-zinc-900 dark:text-white">Entry Level (0-2 YOE)</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">₹8 - ₹16 LPA</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">₹10 - ₹20 LPA</td>
                  </tr>
                  <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                    <td className="px-3 py-2 font-medium text-zinc-900 dark:text-white">Mid-Level / SDE-2 (3-5 YOE)</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">₹18 - ₹36 LPA</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">₹24 - ₹45 LPA</td>
                  </tr>
                  <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                    <td className="px-3 py-2 font-medium text-zinc-900 dark:text-white">Senior Software Engineer (5-8 YOE)</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">₹35 - ₹65 LPA</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">₹42 - ₹78 LPA</td>
                  </tr>
                  <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                    <td className="px-3 py-2 font-medium text-zinc-900 dark:text-white">Principal / Staff / Architect</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">₹55 - ₹95 LPA</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">₹65 - ₹1.2 Cr</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>

          {/* Question 2: Ordered List How-To Snippet */}
          <article className="space-y-2.5">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              How to choose between Gurugram and Bengaluru tech jobs?
            </h3>
            <ol className="list-decimal space-y-1.5 pl-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
              <li>
                <strong className="text-zinc-800 dark:text-zinc-200">Analyze Sector Focus:</strong> Gurugram leads in Fintech, B2B SaaS, Quick-Commerce (Zomato/Blinkit), and Travel-Tech (MakeMyTrip), whereas Bengaluru dominates DeepTech, AI/ML research labs, and early-stage venture product engineering.
              </li>
              <li>
                <strong className="text-zinc-800 dark:text-zinc-200">Calculate Net Take-Home vs Rent:</strong> Rental costs along Gurugram Golf Course Ext and Cyber City hover around 15–20% lower for comparable gated societies compared to Bellandur/HSR Layout in Bengaluru.
              </li>
              <li>
                <strong className="text-zinc-800 dark:text-zinc-200">Evaluate Commute Infrastructure:</strong> Gurugram benefits from the Rapid Metro and direct Yellow Line access, while Bengaluru ORR relies heavily on feeder buses until the Namma Metro Blue Line is commissioned.
              </li>
              <li>
                <strong className="text-zinc-800 dark:text-zinc-200">Assess Stock Liquidity:</strong> MNC GCCs in both corridors provide liquid US RSUs, but Gurugram packages tend to skew slightly higher toward cash component versus unvested equity.
              </li>
            </ol>
          </article>

          {/* Quick Hub Links */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
            <span className="font-bold text-zinc-800 dark:text-zinc-200">Explore Dedicated Corridor Radars:</span>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href="/jobs/gurugram/dlf-cyber-city"
                onClick={onClose}
                className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950 dark:text-blue-300"
              >
                DLF Cyber City (900+ jobs) →
              </Link>
              <Link
                href="/jobs/bengaluru/outer-ring-road"
                onClick={onClose}
                className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950 dark:text-blue-300"
              >
                Bengaluru Outer Ring Road →
              </Link>
              <Link
                href="/jobs/hyderabad/hitec-city"
                onClick={onClose}
                className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950 dark:text-blue-300"
              >
                Hyderabad HITEC City →
              </Link>
              <Link
                href="/jobs/noida/sector-62"
                onClick={onClose}
                className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950 dark:text-blue-300"
              >
                Noida Sector 62 →
              </Link>
            </div>
          </div>

          {/* E-E-A-T & Author Social Links */}
          <aside className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="space-y-1.5">
                <h4 className="font-bold text-zinc-900 dark:text-white text-xs sm:text-sm">
                  E-E-A-T Verification & Salary Benchmark Methodology
                </h4>
                <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Every position on MapMyCareer is verified against <strong>10,500+ active company career portals</strong>, matched to sub-meter <strong>exact coordinate geocoding</strong>, and indexed against levels.fyi and verified peer benchmarks.
                </p>
                <div className="pt-2 border-t border-blue-200/60 dark:border-blue-900/40 flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Created by PraLabs:
                  </span>
                  <a
                    href="https://github.com/pra-labs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    GitHub ↗
                  </a>
                  <a
                    href="https://www.linkedin.com/company/pra-labs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-semibold text-[#0A66C2] hover:underline"
                  >
                    LinkedIn ↗
                  </a>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
