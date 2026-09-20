'use client';

import React from 'react';
import { Station, Reading, NewsItem } from '@/lib/types';
import StatusBadge from '@/components/primitives/StatusBadge';
import { Database, X } from 'lucide-react';

interface StationDataStripProps {
  stations: Station[];
  readings: Record<string, Reading>;
  articles: NewsItem[];
  selectedStationId: string | null;
  onSelectStation: (stationId: string | null) => void;
}

export function StationDataStrip({
  stations,
  readings,
  articles,
  selectedStationId,
  onSelectStation,
}: StationDataStripProps) {
  // Count articles per station
  const stationCounts = stations.reduce<Record<string, number>>((acc, st) => {
    acc[st.id] = articles.filter((a) => a.relatedStations?.includes(st.id)).length;
    return acc;
  }, {});

  const totalRelated = articles.filter(
    (a) => a.relatedStations && a.relatedStations.length > 0
  ).length;

  return (
    <div className="rounded-xl border border-[#1E2C42] bg-[#121C2E]/70 p-4 backdrop-blur-md">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-2.5 border-b border-[#1E2C42]/80">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#22D3EE]/10 border border-[#22D3EE]/30 text-[#22D3EE]">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#E6EDF7] flex items-center gap-2">
              Related to Sensor Telemetry
              <span className="rounded-full bg-[#22D3EE]/15 px-2 py-0.5 text-[11px] font-mono text-[#22D3EE] font-medium border border-[#22D3EE]/30">
                {totalRelated} stories correlated
              </span>
            </h2>
            <p className="text-[11px] text-[#8A9BB4]">
              Regional news stories mapped directly to real-time IoT monitoring stations along the Indrayani
            </p>
          </div>
        </div>

        {selectedStationId && (
          <button
            onClick={() => onSelectStation(null)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#1E2C42] bg-[#0B1220] px-2.5 py-1 text-xs text-[#CBD5E1] hover:border-[#EF4444]/40 hover:text-[#EF4444] transition-colors"
          >
            <X className="h-3 w-3" />
            Clear station filter
          </button>
        )}
      </div>

      {/* Horizontal station cards strip in upstream->downstream order */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {stations.map((station) => {
          const reading = readings[station.id];
          const count = stationCounts[station.id] || 0;
          const isSelected = selectedStationId === station.id;
          const status = reading?.status || 'moderate';
          const wqi = reading ? Math.round(reading.wqi) : null;

          return (
            <button
              key={station.id}
              onClick={() => onSelectStation(isSelected ? null : station.id)}
              className={`group flex flex-col items-start justify-between rounded-lg border p-2.5 text-left transition-all duration-200 ${
                isSelected
                  ? 'border-[#22D3EE] bg-[#22D3EE]/10 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                  : count > 0
                  ? 'border-[#1E2C42] bg-[#0B1220]/60 hover:border-[#22D3EE]/40 hover:bg-[#121C2E]'
                  : 'border-[#1E2C42]/50 bg-[#0B1220]/30 opacity-60 hover:opacity-100 hover:border-[#1E2C42]'
              }`}
            >
              {/* Top row: Station ID + count */}
              <div className="flex w-full items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#22D3EE]">
                  {station.id}
                </span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono font-medium ${
                    count > 0
                      ? 'bg-[#1E2C42] text-[#CBD5E1]'
                      : 'bg-transparent text-[#8A9BB4]/50'
                  }`}
                >
                  {count} {count === 1 ? 'story' : 'stories'}
                </span>
              </div>

              {/* Station Name */}
              <div className="mt-1 font-medium text-xs text-[#E6EDF7] truncate w-full" title={station.name}>
                {station.name}
              </div>

              {/* Status and WQI */}
              <div className="mt-2 flex w-full items-center justify-between pt-1.5 border-t border-[#1E2C42]/50">
                <StatusBadge status={status} size="sm" />
                <span className="font-mono text-[11px] font-semibold text-[#CBD5E1]">
                  {wqi !== null ? `WQI ${wqi}` : '—'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default StationDataStrip;
