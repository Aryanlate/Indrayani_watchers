'use client';

import React from 'react';
import { Station, Reading } from '@/lib/types';
import StationCard, { StationCardSkeleton } from './StationCard';

interface StationGridProps {
  stations: Station[];
  readings: Record<string, Reading>;
  historyByStation: Record<string, number[]>; // Array of 6h WQI numbers per station
  pulseKey?: unknown;
}

export default function StationGrid({
  stations,
  readings,
  historyByStation,
  pulseKey,
}: StationGridProps) {
  // Sort upstream to downstream
  const sorted = [...stations].sort((a, b) => a.order - b.order);
  const isEmpty = stations.length === 0 || Object.keys(readings).length === 0;
  const skeletonCount = 6;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8A9BB4]">
            Monitoring Stations Grid
          </h2>
          <p className="text-xs text-[#8A9BB4] mt-0.5">
            Real-time multi-parameter telemetry across 6 sensor nodes (Upstream to Downstream)
          </p>
        </div>
        <span className="text-xs font-mono text-[#22D3EE] bg-[#22D3EE]/10 px-2.5 py-1 rounded border border-[#22D3EE]/20 hidden sm:inline-block">
          Click card for station telemetry &amp; calibration
        </span>
      </div>

      {/* Mobile: Horizontal snap-scroll carousel. sm+: Standard 2-3 col grid. */}
      <div className="sm:hidden relative">
        {/* Left scroll hint fade */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 z-10 bg-gradient-to-r from-[#0B1220] via-[#0B1220]/70 to-transparent"
        />
        {/* Right scroll hint fade */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 z-10 bg-gradient-to-l from-[#0B1220] via-[#0B1220]/70 to-transparent"
        />
        <div
          role="list"
          aria-label="Monitoring stations, scroll horizontally"
          className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-4 px-4 scrollbar-hide"
        >
          {isEmpty ? (
            Array.from({ length: skeletonCount }).map((_, i) => (
              <div
                key={`skel-${i}`}
                role="listitem"
                className="snap-start shrink-0 w-[85vw] max-w-[320px]"
              >
                <StationCardSkeleton />
              </div>
            ))
          ) : (
            sorted.map((station) => {
              const reading = readings[station.id];
              const sparkline = historyByStation[station.id] || [];

              return (
                <div
                  key={station.id}
                  role="listitem"
                  className="snap-start shrink-0 w-[85vw] max-w-[320px]"
                >
                  <StationCard
                    station={station}
                    reading={reading}
                    sparklineData={sparkline}
                    pulseKey={pulseKey}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="hidden sm:grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isEmpty ? (
          Array.from({ length: skeletonCount }).map((_, i) => (
            <StationCardSkeleton key={`skel-${i}`} />
          ))
        ) : (
          sorted.map((station) => {
            const reading = readings[station.id];
            const sparkline = historyByStation[station.id] || [];

            return (
              <StationCard
                key={station.id}
                station={station}
                reading={reading}
                sparklineData={sparkline}
                pulseKey={pulseKey}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
