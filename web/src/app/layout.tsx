import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.mapmycareer.online'),
  title: {
    default: 'MapMyCareer - Geo-Spatial Tech Job Discovery & Career Radar',
    template: '%s | MapMyCareer',
  },
  description:
    'Explore 10,500+ verified tech jobs across Bengaluru, Delhi NCR, Hyderabad, Pune, Mumbai, Kochi, Chandigarh & Kolkata with exact campus coordinates, metro commute insights, and verified salary ranges.',
  keywords: [
    'India Tech Jobs',
    'Bengaluru Software Engineer Jobs',
    'Delhi NCR Tech Jobs',
    'Hyderabad Tech Openings',
    'Pune IT Jobs',
    'Mumbai Software Jobs',
    'Gurgaon Software Engineer Jobs',
    'Noida Developer Jobs',
    'DLF Cyber City Tech Openings',
    'Outer Ring Road Bangalore Jobs',
    'HITEC City Hyderabad Jobs',
    'Geospatial Job Radar',
    'MapMyCareer',
    'Tech Jobs Commute Radar',
    'Tech Salaries India 2026',
    'Verified Engineering Jobs India',
  ],
  authors: [{ name: 'Abhinav Prakash', url: 'https://www.linkedin.com/in/abhinav-prakash-dev/' }, { name: 'MapMyCareer' }],
  creator: 'Abhinav Prakash',
  publisher: 'MapMyCareer',
  applicationName: 'MapMyCareer',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'MapMyCareer · Geo-Spatial Tech Job Discovery & Radar',
    description:
      'Explore 10,500+ verified tech jobs across Bengaluru, Delhi NCR, Hyderabad, Pune, Mumbai, Kochi, Chandigarh & Kolkata mapped to exact office campuses with commute and salary benchmarks.',
    url: 'https://www.mapmycareer.online',
    siteName: 'MapMyCareer',
    locale: 'en_IN',
    type: 'website',
    images: [
      {
        url: '/api/og?title=Geo-Spatial%20Tech%20Job%20Radar&company=India%20Tech%20Hubs&city=Delhi%20NCR%20%7C%20Bengaluru%20%7C%20Hyderabad&hub=DLF%20Cyber%20City%20%7C%20Outer%20Ring%20Road&salary=%E2%82%B925L%20-%20%E2%82%B960L',
        width: 1200,
        height: 630,
        alt: 'MapMyCareer India Tech Radar',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MapMyCareer · Geo-Spatial Tech Job Discovery & Radar',
    description:
      'Explore 10,500+ verified tech jobs mapped to exact office campuses across Bengaluru, Delhi NCR, Hyderabad, Pune & Mumbai.',
    images: ['/api/og?title=Geo-Spatial%20Tech%20Job%20Radar&company=India%20Tech%20Hubs&city=Delhi%20NCR%20%7C%20Bengaluru%20%7C%20Hyderabad&hub=DLF%20Cyber%20City%20%7C%20Outer%20Ring%20Road&salary=%E2%82%B925L%20-%20%E2%82%B960L'],
  },
  verification: {
    google: 'XR4_4wE5Q3wYA7z66aZFzdZNDBgLOQoOYDowiaKROck',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://www.mapmycareer.online/#website',
      url: 'https://www.mapmycareer.online',
      name: 'MapMyCareer',
      description:
        'Geospatial tech job discovery radar for top tech hubs across India (Bengaluru, Delhi NCR, Hyderabad, Pune, Mumbai, Kochi, Chandigarh, Kolkata).',
      inLanguage: 'en-IN',
      publisher: {
        '@id': 'https://www.mapmycareer.online/#organization',
      },
    },
    {
      '@type': 'Organization',
      '@id': 'https://www.mapmycareer.online/#organization',
      name: 'MapMyCareer',
      url: 'https://www.mapmycareer.online',
      logo: 'https://www.mapmycareer.online/icon.svg',
      founder: {
        '@type': 'Organization',
        name: 'PraLabs',
        url: 'https://www.linkedin.com/company/pra-labs',
        sameAs: [
          'https://www.linkedin.com/company/pra-labs',
          'https://github.com/pra-labs',
        ],
      },
      sameAs: [
        'https://github.com/pra-labs',
        'https://www.linkedin.com/company/pra-labs',
      ],
      publishingPrinciples: 'https://www.mapmycareer.online/#methodology',
      knowsAbout: [
        'Software Engineering Salaries India',
        'Geospatial Job Market Intelligence',
        'Tech Corridors & Commute Times (DLF Cyber City, Outer Ring Road, HITEC City)',
        'Direct ATS Career Portal Verification',
      ],
      description:
        'MapMyCareer is a developer-first career intelligence platform indexing 10,500+ verified tech roles with exact campus geolocations, commute radar, and real-time ATS verification.',
    },
    {
      '@type': 'WebApplication',
      '@id': 'https://www.mapmycareer.online/#webapp',
      name: 'MapMyCareer Tech Job Radar',
      url: 'https://www.mapmycareer.online',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'All',
      browserRequirements: 'Requires JavaScript. Requires HTML5.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'INR',
      },
      featureList: [
        'Interactive Leaflet Pin Clusters',
        'Hiring Density Heatmaps',
        'Campus & Tech Park Coordinates',
        '10,500+ Verified Live Tech Openings Across Indian Tech Hubs',
        'Inline Filtering by Stack, Experience, and Work Model',
        'Metro Line & Commute Radius Integration',
      ],
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://www.mapmycareer.online/#faq',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How do tech salaries in Gurugram DLF Cyber City compare to Bengaluru Outer Ring Road and Hyderabad HITEC City?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Across senior software engineering roles (4-8 years experience), Bengaluru Outer Ring Road (ORR) typically leads base compensation at ₹32L - ₹58L CTC, driven by multinational R&D centers and tier-1 product startups. Gurugram DLF Cyber City and Golf Course Extension command ₹28L - ₹52L CTC, with strong concentrations in fintech, consumer tech, and global capability centers (GCCs). Hyderabad HITEC City and Financial District offer competitive packages between ₹26L - ₹48L CTC, often paired with a 15-20% lower cost of living compared to Bengaluru.',
          },
        },
        {
          '@type': 'Question',
          name: 'Which tech hubs in India offer direct metro access for tech commutes?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Gurugram DLF Cyber City is seamlessly connected via the Rapid Metro Gurgaon directly interfacing with Delhi Metro Yellow Line at Sikanderpur. Hyderabad HITEC City and Raidurg are directly served by the Hyderabad Metro Blue Line. Bengaluru Outer Ring Road (Silk Board to KR Puram) is currently undergoing Namma Metro Phase 2A (Blue Line) development, with Baiyappanahalli, Indiranagar, and Swami Vivekananda Road acting as operational nodal stations alongside feeder shuttles.',
          },
        },
        {
          '@type': 'Question',
          name: 'How does MapMyCareer verify tech job listings and prevent phantom or ghost jobs?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'MapMyCareer indexes job postings directly from primary corporate Applicant Tracking Systems (ATS) including Greenhouse, Lever, Ashby, and Workday, refreshed daily. Postings are verified against live career endpoints and validated for physical campus presence before inclusion, filtering out ghost listings, stale aggregator postings, and unverified third-party recruiters.',
          },
        },
      ],
    },
    {
      '@type': 'ItemList',
      '@id': 'https://www.mapmycareer.online/#job-openings',
      name: 'Verified Tech Openings in India',
      description: 'Directory of verified software engineering, platform, data, and ML openings mapped across India tech corridors.',
      numberOfItems: 10500,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Bengaluru Outer Ring Road Tech Hub Openings',
          url: 'https://www.mapmycareer.online/?city=Bengaluru',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Delhi NCR & Gurugram DLF Cyber City Tech Openings',
          url: 'https://www.mapmycareer.online/?city=Delhi+NCR',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Hyderabad HITEC City & Financial District Tech Openings',
          url: 'https://www.mapmycareer.online/?city=Hyderabad',
        },
        {
          '@type': 'ListItem',
          position: 4,
          name: 'Pune IT Corridors (Hinjawadi & Magarpatta) Tech Openings',
          url: 'https://www.mapmycareer.online/?city=Pune',
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://tile.openstreetmap.org" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://basemaps.cartocdn.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://tile.openstreetmap.org" />
        <link rel="dns-prefetch" href="https://basemaps.cartocdn.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
