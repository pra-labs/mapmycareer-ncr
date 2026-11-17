'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Job } from '../types/job';
import { Loader2, Maximize2, MapPin } from 'lucide-react';
import Link from 'next/link';

interface CorridorMiniMapProps {
  jobs: Job[];
  totalJobsCount?: number;
  corridorName: string;
  centerLat: number;
  centerLon: number;
  zoom?: number;
}

// Dynamically import Leaflet with SSR false
const LeafletMap = dynamic(
  () => import('./CorridorLeafletMapInner').then((mod) => mod.CorridorLeafletMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 sm:h-80 w-full flex-col items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="text-xs font-medium text-zinc-500">Loading corridor coordinates...</span>
      </div>
    ),
  }
);

export const CorridorMiniMap: React.FC<CorridorMiniMapProps> = ({
  jobs,
  totalJobsCount,
  corridorName,
  centerLat,
  centerLon,
  zoom = 14,
}) => {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
            {corridorName} Interactive Campus Radar
          </span>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            {totalJobsCount ?? jobs.length} mapped roles
          </span>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          <Maximize2 className="h-3 w-3" />
          <span className="hidden sm:inline">Launch Fullscreen Map</span>
        </Link>
      </div>

      <div className="h-64 sm:h-80 w-full">
        <LeafletMap
          jobs={jobs}
          centerLat={centerLat}
          centerLon={centerLon}
          zoom={zoom}
        />
      </div>
    </div>
  );
};
