'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Station, Reading } from '@/lib/types';
import { Card, LiveValue, StatusBadge } from '@/components/primitives';
import { ArrowRight, Waves } from 'lucide-react';

interface RiverRibbonProps {
  stations: Station[];
  readings: Record<string, Reading>;
  averageWqi: number;
  averageStatus: 'good' | 'moderate' | 'poor' | 'very-poor';
  pulseKey?: unknown;
}

const STATUS_COLOR_HEX: Record<string, string> = {
  good: '#22C55E',
  moderate: '#FDE047',
  poor: '#F97316',
  'very-poor': '#EF4444',
  offline: '#64748B',
};

export default function RiverRibbon({
  stations,
  readings,
  averageWqi,
  averageStatus,
  pulseKey,
}: RiverRibbonProps) {
  const [hoveredStationId, setHoveredStationId] = useState<string | null>(null);

  // Sort stations strictly in upstream -> downstream order (1 to 6)
  const sortedStations = [...stations].sort((a, b) => a.order - b.order);

  return (
    <Card
      pulseKey={pulseKey}
      className="p-5 sm:p-6 transition-all duration-300 border-[#1E2C42]"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: River-wide Average WQI Readout */}
        <div className="flex items-center gap-5 sm:gap-6 shrink-0">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-[#22D3EE] animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8A9BB4]">
                River-Wide Average WQI
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              <div className="text-4xl sm:text-5xl font-bold tracking-tight text-[#E6EDF7]">
                <LiveValue value={averageWqi} unit="/100" decimals={1} />
              </div>
              <StatusBadge status={averageStatus} size="lg" />
            </div>
            <span className="mt-1 text-xs text-[#8A9BB4]">
              Composite of 6 telemetry monitoring stations
            </span>
          </div>
        </div>

        {/* Right: Horizontal River Ribbon */}
        <div className="flex-1 lg:max-w-2xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#8A9BB4]">
              <Waves className="h-3.5 w-3.5 text-[#22D3EE]" />
              <span>Upstream (Dehu)</span>
              <ArrowRight className="h-3 w-3 text-[#8A9BB4]" />
              <span>Downstream (Confluence)</span>
            </div>
            <span className="text-xs text-[#8A9BB4] hidden sm:inline">
              Hover for station status &bull; Click to inspect
            </span>
          </div>

          {/* Connected Segment Ribbon */}
          <div className="relative flex items-center gap-1 sm:gap-1.5 rounded-xl bg-[#0D1524] p-1.5 border border-[#1E2C42]">
            {sortedStations.map((station, index) => {
              const reading = readings[station.id];
              const status = reading?.status || 'moderate';
              const wqi = reading?.wqi ?? 50;
              const colorHex = STATUS_COLOR_HEX[status];
              const isHovered = hoveredStationId === station.id;

              return (
                <div
                  key={station.id}
                  className="relative flex-1 group"
                  onMouseEnter={() => setHoveredStationId(station.id)}
                  onMouseLeave={() => setHoveredStationId(null)}
                >
                  <Link
                    href={`/station/${station.id}`}
                    className="block relative rounded-lg py-3 px-1 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.03] active:scale-95 text-center overflow-hidden"
                    style={{
                      backgroundColor: `${colorHex}1A`, // 10% opacity backdrop
                      border: `1.5px solid ${colorHex}55`, // subtle border
                      boxShadow: isHovered
                        ? `0 0 16px ${colorHex}44, inset 0 0 12px ${colorHex}22`
                        : 'none',
                    }}
                  >
                    {/* Top status indicator line */}
                    <div
                      className="absolute top-0 left-0 right-0 h-1 transition-all duration-300"
                      style={{ backgroundColor: colorHex }}
                    />

                    {/* Station tag and order */}
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-[11px] font-mono font-bold tracking-tight text-[#E6EDF7]">
                        {station.id}
                      </span>
                      <span
                        className="text-xs font-mono font-semibold tabular-nums mt-0.5"
                        style={{ color: colorHex }}
                      >
                        {wqi.toFixed(0)}
                      </span>
                    </div>
                  </Link>

                  {/* Upstream/Downstream connector notch */}
                  {index < sortedStations.length - 1 && (
                    <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 z-10 pointer-events-none hidden sm:block">
                      <div className="w-1.5 h-1.5 rotate-45 border-t border-r border-[#1E2C42] bg-[#0D1524]" />
                    </div>
                  )}

                  {/* Interactive Tooltip on Hover */}
                  {isHovered && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 z-50 rounded-lg border border-[#1E2C42] bg-[#121C2E] p-3 shadow-2xl pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200">
                      <div className="flex items-center justify-between pb-1 border-b border-[#1E2C42]/60">
                        <span className="text-xs font-bold text-[#E6EDF7] truncate">
                          {station.name}
                        </span>
                        <StatusBadge status={status} size="sm" />
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-[11px] text-[#8A9BB4]">Current WQI:</span>
                        <span className="font-mono text-sm font-bold" style={{ color: colorHex }}>
                          {wqi.toFixed(1)} / 100
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-[#8A9BB4] line-clamp-2 leading-relaxed">
                        {station.description}
                      </p>
                      <div className="mt-2 pt-1.5 border-t border-[#1E2C42]/40 flex items-center justify-between text-[10px] text-[#22D3EE]">
                        <span>Order #{station.order}</span>
                        <span>Click to view telemetry &rarr;</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
