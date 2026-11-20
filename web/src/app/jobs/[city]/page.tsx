import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, Building2, ArrowRight, ArrowLeft } from 'lucide-react';
import { Job } from '@/types/job';
import { getJobsByCity, getAllCitySlugs } from '@/lib/db';
import { TECH_CORRIDORS } from '@/lib/corridors';

interface CityMetadata {
  postalCode: string;
  addressRegion: string;
  streetAddress: string;
}

const CITY_METADATA: Record<string, CityMetadata> = {
  bengaluru: { postalCode: '560103', addressRegion: 'Karnataka', streetAddress: 'Outer Ring Road & Whitefield Tech Corridors' },
  gurugram: { postalCode: '122002', addressRegion: 'Haryana', streetAddress: 'DLF Cyber City, Phase 2 & Sector 44' },
  noida: { postalCode: '201301', addressRegion: 'Uttar Pradesh', streetAddress: 'Sector 62 & Noida Expressway Tech Corridor' },
  hyderabad: { postalCode: '500081', addressRegion: 'Telangana', streetAddress: 'HITEC City & Gachibowli Financial District' },
  pune: { postalCode: '411057', addressRegion: 'Maharashtra', streetAddress: 'Rajiv Gandhi Infotech Park, Hinjawadi' },
  mumbai: { postalCode: '400051', addressRegion: 'Maharashtra', streetAddress: 'Bandra Kurla Complex (BKC) & Powai' },
  delhi: { postalCode: '110037', addressRegion: 'Delhi', streetAddress: 'Aerocity Worldmark & Okhla Tech Zone' },
  chennai: { postalCode: '600096', addressRegion: 'Tamil Nadu', streetAddress: 'OMR IT Corridor, Sholinganallur' },
  kochi: { postalCode: '682030', addressRegion: 'Kerala', streetAddress: 'Infopark Kakkanad' },
  ahmedabad: { postalCode: '382355', addressRegion: 'Gujarat', streetAddress: 'GIFT City & SG Highway' },
  kolkata: { postalCode: '700091', addressRegion: 'West Bengal', streetAddress: 'Sector V, Salt Lake' },
  chandigarh: { postalCode: '160019', addressRegion: 'Chandigarh', streetAddress: 'Rajiv Gandhi Chandigarh Technology Park' },
  coimbatore: { postalCode: '641014', addressRegion: 'Tamil Nadu', streetAddress: 'TIDEL Park, Peelamedu' },
  thiruvananthapuram: { postalCode: '695581', addressRegion: 'Kerala', streetAddress: 'Technopark Campus, Kazhakoottam' },
};

interface CityPageProps {
  params: Promise<{ city: string }>;
}

function getJobsForCity(citySlug: string): { cityDisplayName: string; jobs: Job[] } {
  const matchedJobs = getJobsByCity(citySlug);

  const cityDisplayName =
    matchedJobs.length > 0 && matchedJobs[0].city
      ? matchedJobs[0].city
      : citySlug
          .split('-')
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(' ');

  return { cityDisplayName, jobs: matchedJobs };
}

export async function generateStaticParams() {
  const citySlugs = getAllCitySlugs();
  return citySlugs.map((city) => ({ city }));
}

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const { city } = await params;
  const { cityDisplayName, jobs } = getJobsForCity(city);

  if (jobs.length === 0) {
    return {
      title: 'City Not Found | MapMyCareer',
    };
  }

  const title = `${jobs.length}+ Tech Jobs in ${cityDisplayName} | Geo-Spatial Map & Commute Radar`;
  const description = `Discover ${jobs.length}+ active software engineering, developer, and cloud tech roles in ${cityDisplayName}. Mapped to exact office campuses and tech corridors with commute and salary insights.`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://www.mapmycareer.online/jobs/${city}`,
    },
    openGraph: {
      title: `${jobs.length}+ Verified Tech Jobs in ${cityDisplayName} · MapMyCareer`,
      description,
      url: `https://www.mapmycareer.online/jobs/${city}`,
      siteName: 'MapMyCareer',
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(jobs.length + '+ Tech Jobs in ' + cityDisplayName)}&company=${encodeURIComponent(cityDisplayName + ' Tech Hubs')}&city=${encodeURIComponent(cityDisplayName)}&salary=${encodeURIComponent('₹15L - ₹55L')}`,
          width: 1200,
          height: 630,
          alt: `MapMyCareer ${cityDisplayName} Tech Jobs`,
        },
      ],
    },
  };
}

export default async function CityJobsPage({ params }: CityPageProps) {
  const { city } = await params;
  const { cityDisplayName, jobs } = getJobsForCity(city);

  if (jobs.length === 0) {
    notFound();
  }

  const meta = CITY_METADATA[city.toLowerCase()] || {
    postalCode: '110001',
    addressRegion: cityDisplayName,
    streetAddress: `${cityDisplayName} Tech Hubs & Innovation Parks`,
  };

  // Top 10 sample jobs for Rich JobPosting Schema
  const structuredJobSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Verified Tech Openings in ${cityDisplayName}`,
    numberOfItems: jobs.length,
    itemListElement: jobs.slice(0, 15).map((job, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      item: {
        '@type': 'JobPosting',
        title: job.title,
        description: `${job.title} opportunity at ${job.company} located in ${job.hub || cityDisplayName}. Required skills: ${job.skills?.join(', ') || 'Software Development'}.`,
        datePosted: '2026-09-01',
        validThrough: '2026-12-31',
        hiringOrganization: {
          '@type': 'Organization',
          name: job.company,
          sameAs: job.company_domain ? `https://${job.company_domain}` : undefined,
        },
        jobLocation: {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            streetAddress: job.hub || meta.streetAddress,
            addressLocality: cityDisplayName,
            addressRegion: meta.addressRegion || cityDisplayName,
            postalCode: meta.postalCode,
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
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredJobSchema) }}
      />

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/90 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold text-zinc-600 transition hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Full Interactive Map</span>
        </Link>
        <Link
          href="/"
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700"
        >
          Launch Full Radar
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* City Hero Section */}
        <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-950/60 dark:text-blue-400">
                  Corridor Index
                </span>
                <span className="text-xs text-zinc-400">Verified Direct ATS Openings</span>
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                {jobs.length}+ Tech & Developer Jobs in {cityDisplayName}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Explore real software engineering, cloud, frontend, and backend positions in {cityDisplayName}. Every role is mapped to physical office coordinates, verified against active applicant tracking systems, and indexed with commute insights.
              </p>

              {/* High-Intent Tech Corridors */}
              {(() => {
                const cityCorridors = Object.values(TECH_CORRIDORS).filter(
                  (c) => c.citySlug.toLowerCase() === city.toLowerCase()
                );
                if (cityCorridors.length === 0) return null;

                return (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                      Major Corridors:
                    </span>
                    {cityCorridors.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/jobs/${city}/${c.slug}`}
                        className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-blue-600 transition hover:border-blue-300 hover:bg-blue-50 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-blue-400 dark:hover:border-blue-700"
                      >
                        {c.displayName} →
                      </Link>
                    ))}
                  </div>
                );
              })()}
            </div>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:opacity-95"
            >
              <span>Explore on Map</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Job Listings Grid */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
            Active Verified Openings in {cityDisplayName} ({jobs.length})
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            {jobs.slice(0, 40).map((job) => (
              <article
                key={job.id}
                className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-600"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      {job.company_logo ? (
                        <img
                          src={job.company_logo}
                          alt={job.company}
                          className="h-9 w-9 rounded-lg border border-zinc-100 object-contain p-1 dark:border-zinc-800 dark:bg-zinc-800"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          <Building2 className="h-4 w-4" />
                        </div>
                      )}
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
                      <span className="line-clamp-1">{job.hub || job.city}</span>
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
                    <span>View Coordinates</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </article>
            ))}
          </div>

          {jobs.length > 40 && (
            <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="font-bold text-zinc-900 dark:text-white">
                Viewing 40 of {jobs.length} jobs in {cityDisplayName}
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
        </div>
      </main>
    </div>
  );
}
