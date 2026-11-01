import { Metadata } from 'next';
import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  MapPin,
  Building2,
  Train,
  Briefcase,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  TrendingUp,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Job } from '@/types/job';
import {
  getAllCorridorSlugs,
  getCorridorConfig,
  CorridorConfig,
} from '@/lib/corridors';
import { CorridorMiniMap } from '@/components/CorridorMiniMap';

interface CorridorPageProps {
  params: Promise<{ city: string; corridor: string }>;
}

function getJobsForCorridor(config: CorridorConfig): Job[] {
  const dataPath = path.join(process.cwd(), 'public', 'data', 'jobs.json');
  if (!fs.existsSync(dataPath)) return [];

  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const allJobs: Job[] = JSON.parse(rawData);

  // Filter jobs by city and corridor keywords
  return allJobs.filter((job) => {
    if (!job.city) return false;
    const cityMatch =
      job.city.toLowerCase().replace(/\s+/g, '-') === config.citySlug.toLowerCase();
    if (!cityMatch) return false;

    const hubText = (job.hub || '').toLowerCase();
    const titleText = (job.title || '').toLowerCase();

    return config.hubKeywords.some(
      (kw) => hubText.includes(kw.toLowerCase()) || titleText.includes(kw.toLowerCase())
    );
  });
}

export async function generateStaticParams() {
  return getAllCorridorSlugs();
}

export async function generateMetadata({ params }: CorridorPageProps): Promise<Metadata> {
  const { city, corridor } = await params;
  const config = getCorridorConfig(city, corridor);

  if (!config) {
    return { title: 'Tech Corridor Not Found | MapMyCareer' };
  }

  const jobs = getJobsForCorridor(config);
  const countDisplay = jobs.length > 0 ? `${jobs.length}+` : 'Explore';

  const title = `${countDisplay} ${config.displayName} Tech Openings | Campus Radar & Metro Guide`;
  const description = `Discover ${jobs.length} verified software engineering, developer, and cloud tech roles in ${config.displayName} (${config.cityDisplayName}). Mapped to exact office campuses with commute insights and salary benchmarks.`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://www.mapmycareer.online/jobs/${city}/${corridor}`,
    },
    openGraph: {
      title: `${countDisplay} Tech Jobs in ${config.displayName} · MapMyCareer`,
      description,
      url: `https://www.mapmycareer.online/jobs/${city}/${corridor}`,
      siteName: 'MapMyCareer',
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(countDisplay + ' Tech Jobs in ' + config.shortName)}&company=${encodeURIComponent(config.displayName)}&city=${encodeURIComponent(config.cityDisplayName)}&hub=${encodeURIComponent(config.shortName)}&salary=${encodeURIComponent(config.avgSalaryRange)}`,
          width: 1200,
          height: 630,
          alt: `MapMyCareer ${config.displayName} Tech Jobs`,
        },
      ],
    },
  };
}

export default async function CorridorJobsPage({ params }: CorridorPageProps) {
  const { city, corridor } = await params;
  const config = getCorridorConfig(city, corridor);

  if (!config) {
    notFound();
  }

  const jobs = getJobsForCorridor(config);

  // Structured ItemList, Place, and FAQPage Schemas
  const structuredCorridorSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://www.mapmycareer.online',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: `${config.cityDisplayName} Tech Jobs`,
            item: `https://www.mapmycareer.online/jobs/${city}`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: config.displayName,
            item: `https://www.mapmycareer.online/jobs/${city}/${corridor}`,
          },
        ],
      },
      {
        '@type': 'Place',
        '@id': `https://www.mapmycareer.online/jobs/${city}/${corridor}#place`,
        name: config.displayName,
        description: config.description,
        address: {
          '@type': 'PostalAddress',
          streetAddress: config.streetAddress || `${config.displayName} Tech Corridor`,
          addressLocality: config.cityDisplayName,
          addressRegion: config.addressRegion || config.cityDisplayName,
          postalCode: config.postalCode || '110001',
          addressCountry: 'IN',
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: config.lat,
          longitude: config.lon,
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: config.faqSnippet.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: config.faqSnippet.answer,
            },
          },
          {
            '@type': 'Question',
            name: `What is the average tech salary in ${config.displayName}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `The average tech compensation in ${config.displayName} typically ranges from ${config.avgSalaryRange}, varying by experience level and tier-1 product vs consulting employer.`,
            },
          },
        ],
      },
      {
        '@type': 'ItemList',
        name: `Verified Tech Openings in ${config.displayName}`,
        numberOfItems: jobs.length,
        itemListElement: jobs.slice(0, 15).map((job, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          item: {
            '@type': 'JobPosting',
            title: job.title,
            description: `${job.title} at ${job.company} located in ${job.hub || config.displayName}.`,
            datePosted: '2026-09-01',
            validThrough: '2026-12-31',
            hiringOrganization: {
              '@type': 'Organization',
              name: job.company,
            },
            jobLocation: {
              '@type': 'Place',
              address: {
                '@type': 'PostalAddress',
                streetAddress: job.hub || config.streetAddress || config.primaryTowers[0] || `${config.displayName} Tech Corridor`,
                addressLocality: config.displayName,
                addressRegion: config.addressRegion || config.cityDisplayName,
                postalCode: config.postalCode || '110001',
                addressCountry: 'IN',
              },
              geo: {
                '@type': 'GeoCoordinates',
                latitude: job.lat,
                longitude: job.lon,
              },
            },
            baseSalary: job.salary_range
              ? {
                  '@type': 'MonetaryAmount',
                  currency: 'INR',
                  value: {
                    '@type': 'QuantitativeValue',
                    value: job.salary_range,
                    unitText: 'YEAR',
                  },
                }
              : undefined,
            employmentType: job.job_type || 'FULL_TIME',
          },
        })),
      },
    ],
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredCorridorSchema) }}
      />

      {/* Top Navigation */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/90 sm:px-8">
        <div className="flex items-center gap-3 text-xs font-semibold text-zinc-500">
          <Link
            href="/"
            className="transition hover:text-blue-600 dark:hover:text-blue-400"
          >
            Radar
          </Link>
          <ChevronRight className="h-3 w-3 text-zinc-400" />
          <Link
            href={`/jobs/${city}`}
            className="transition hover:text-blue-600 dark:hover:text-blue-400"
          >
            {config.cityDisplayName}
          </Link>
          <ChevronRight className="h-3 w-3 text-zinc-400" />
          <span className="font-bold text-zinc-900 dark:text-white line-clamp-1">
            {config.shortName}
          </span>
        </div>

        <Link
          href="/"
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700"
        >
          Launch Full Map
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-6">
        {/* Corridor Hero Card */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-600 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-950/60 dark:text-blue-400">
                  Tech Corridor Spotlight
                </span>
                <span className="text-xs text-zinc-400">
                  {jobs.length} Verified Roles
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                {jobs.length}+ Tech Openings in {config.displayName}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {config.description} Explore active openings with physical office coordinates, direct ATS apply endpoints, and verified salary benchmarks.
              </p>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20 text-center">
                <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                  Benchmark Comp
                </span>
                <p className="text-base font-black text-emerald-700 dark:text-emerald-300">
                  {config.avgSalaryRange}
                </p>
              </div>
            </div>
          </div>

          {/* Transit & Major Tech Parks */}
          <div className="mt-6 grid gap-4 border-t border-zinc-100 pt-5 dark:border-zinc-800 sm:grid-cols-2">
            <div className="flex items-start gap-2.5">
              <Train className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <div>
                <h2 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Metro & Commute Transit
                </h2>
                <ul className="mt-1 space-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {config.metroLines.map((line, idx) => (
                    <li key={idx}>• {line}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h2 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Primary Campuses & Towers
                </h2>
                <ul className="mt-1 space-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {config.primaryTowers.map((tower, idx) => (
                    <li key={idx}>• {tower}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Semantic Corridor Intelligence Summary & SSR HTML Table */}
          <div className="mt-6 border-t border-zinc-100 pt-5 dark:border-zinc-800">
            {/* BLUF Statement for Search / AI Engines */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/30">
              <p className="text-xs font-semibold leading-relaxed text-blue-950 dark:text-blue-200">
                <strong className="font-bold">Bottom Line Up Front (BLUF):</strong> {config.displayName} is a key technology corridor in {config.cityDisplayName} ({config.addressRegion || 'India'}) anchored around {config.lat.toFixed(4)}°N, {config.lon.toFixed(4)}°E. It hosts {jobs.length}+ verified software engineering and technical roles across major hubs like {config.primaryTowers.slice(0, 3).join(', ')}, commanding benchmark compensation of {config.avgSalaryRange} with direct connectivity via {config.metroLines[0] || 'arterial transit'}.
              </p>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="border-b border-zinc-100 bg-zinc-50/80 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/50">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  {config.displayName} Corridor Key Statistics
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    <tr>
                      <th scope="row" className="whitespace-nowrap px-4 py-2.5 font-semibold text-zinc-600 dark:text-zinc-400">
                        Metro / City Hub
                      </th>
                      <td className="px-4 py-2.5 text-zinc-900 dark:text-zinc-100">
                        {config.cityDisplayName} ({config.addressRegion || 'India'})
                      </td>
                    </tr>
                    <tr>
                      <th scope="row" className="whitespace-nowrap px-4 py-2.5 font-semibold text-zinc-600 dark:text-zinc-400">
                        Geographic Coordinates
                      </th>
                      <td className="px-4 py-2.5 text-zinc-900 dark:text-zinc-100">
                        {config.lat.toFixed(4)}° N, {config.lon.toFixed(4)}° E (Postal Code: {config.postalCode || 'N/A'})
                      </td>
                    </tr>
                    <tr>
                      <th scope="row" className="whitespace-nowrap px-4 py-2.5 font-semibold text-zinc-600 dark:text-zinc-400">
                        Benchmark Tech Compensation
                      </th>
                      <td className="px-4 py-2.5 font-bold text-emerald-600 dark:text-emerald-400">
                        {config.avgSalaryRange} (Fresher: ₹8-16L | Senior/Staff: ₹45-85L+)
                      </td>
                    </tr>
                    <tr>
                      <th scope="row" className="whitespace-nowrap px-4 py-2.5 font-semibold text-zinc-600 dark:text-zinc-400">
                        Transit & Metro Connections
                      </th>
                      <td className="px-4 py-2.5 text-zinc-900 dark:text-zinc-100">
                        {config.metroLines.join(' • ')}
                      </td>
                    </tr>
                    <tr>
                      <th scope="row" className="whitespace-nowrap px-4 py-2.5 font-semibold text-zinc-600 dark:text-zinc-400">
                        Prominent Tech Towers & Parks
                      </th>
                      <td className="px-4 py-2.5 text-zinc-900 dark:text-zinc-100">
                        {config.primaryTowers.join(', ')}
                      </td>
                    </tr>
                    <tr>
                      <th scope="row" className="whitespace-nowrap px-4 py-2.5 font-semibold text-zinc-600 dark:text-zinc-400">
                        Verified Active Openings
                      </th>
                      <td className="px-4 py-2.5 font-bold text-blue-600 dark:text-blue-400">
                        {jobs.length} direct ATS postings indexed
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Corridor Map (Mobile & Desktop Responsive) */}
        {jobs.length > 0 && (
          <section aria-label="Interactive Map View">
            <CorridorMiniMap
              jobs={jobs}
              corridorName={config.displayName}
              centerLat={config.lat}
              centerLon={config.lon}
            />
          </section>
        )}

        {/* Position-Zero PAA Snippet Answer */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
              Corridor Career Guidance & FAQs
            </h2>
          </div>

          <div className="mt-4 space-y-4 text-xs">
            <div>
              <h3 className="font-bold text-zinc-800 dark:text-zinc-200 sm:text-sm">
                {config.faqSnippet.question}
              </h3>
              <div className="mt-2 whitespace-pre-line leading-relaxed text-zinc-600 dark:text-zinc-400">
                {config.faqSnippet.answer}
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <h3 className="font-bold text-zinc-800 dark:text-zinc-200 sm:text-sm">
                What is the typical tech compensation ladder in {config.displayName}?
              </h3>
              <p className="mt-1 leading-relaxed text-zinc-600 dark:text-zinc-400">
                Compensation in {config.displayName} reflects tier-1 engineering benchmarks ({config.avgSalaryRange}). Junior developers (0-2 YOE) range from ₹8–16 LPA, Mid-level SDE-2 engineers (3-5 YOE) command ₹18–38 LPA, while Staff and Lead engineers earn ₹40–75+ LPA with significant stock grants.
              </p>
            </div>
          </div>
        </section>

        {/* Verified Job Listings Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
              Verified Openings in {config.displayName} ({jobs.length})
            </h2>
            <Link
              href="/"
              className="text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
            >
              Filter on Main Radar
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {jobs.slice(0, 30).map((job) => (
              <article
                key={job.id}
                className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-600"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-zinc-900 line-clamp-1 dark:text-white">
                          {job.title}
                        </h3>
                        <p className="text-xs font-semibold text-zinc-500">{job.company}</p>
                      </div>
                    </div>
                    {job.experience_level && (
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                        {job.experience_level}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                      <span className="line-clamp-1">{job.hub || config.displayName}</span>
                    </span>
                    {job.salary_range && (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {job.salary_range}
                      </span>
                    )}
                  </div>

                  {job.skills && job.skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {job.skills.slice(0, 4).map((skill, idx) => (
                        <span
                          key={idx}
                          className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <span className="text-[11px] text-zinc-400">
                    {job.workplace_model || 'Full-time'}
                  </span>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <span>Inspect Campus</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </article>
            ))}
          </div>

          {jobs.length > 30 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="font-bold text-zinc-900 dark:text-white">
                Viewing 30 of {jobs.length} jobs in {config.displayName}
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                Launch the interactive map radar to filter by salary, metro walk times, and ATS requirements.
              </p>
              <Link
                href="/"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-blue-700"
              >
                <span>Launch Interactive Geospatial Radar</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
