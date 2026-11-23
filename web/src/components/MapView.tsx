'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Job } from '../types/job';
import { Loader2 } from 'lucide-react';

interface MapViewProps {
  jobs: Job[];
  selectedJob: Job | null;
  hoveredJob: Job | null;
  onSelectJob: (job: Job) => void;
  resetViewSignal?: number;
  selectedCity?: string;
  onCitySelect?: (cityName: string) => void;
}

// Dynamically import Leaflet map with SSR turned off
const DynamicMap = dynamic(
  () => import('./MapViewInner').then((mod) => mod.MapViewInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
        <span className="text-xs font-semibold text-zinc-500">Initializing Geospatial Job Radar Engine...</span>
      </div>
    ),
  }
);

export const MapView: React.FC<MapViewProps> = (props) => {
  return <DynamicMap {...props} />;
};
