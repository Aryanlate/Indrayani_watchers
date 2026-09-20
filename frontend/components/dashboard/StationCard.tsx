'use client';

import React from 'react';
import Link from 'next/link';
import { Station, Reading } from '@/lib/types';
import { Card, LiveValue, StatusBadge } from '@/components/primitives';
import Sparkline from './Sparkline';
import { ChevronRight } from 'lucide-react';

interface StationCardProps {
  station: Station;
  reading: Reading;
  sparklineData: number[]; // last 6 hours of WQI readings
  pulseKey?: unknown;
}

const STATUS_BORDER_COLORS: Record<string, string> = {
  good: 'border-l-[#22C55E]',
  moderate: 'border-l-[#FDE047]',
  poor: 'border-l-[#F97316]',
  'very-poor': 'border-l-[#EF4444]',
  offline: 'border-l-[#64748B]',
};

const STATUS_HEX_COLORS: Record<string, string> = {
  good: '#22C55E',
  moderate: '#FDE047',
  poor: '#F97316',
  'very-poor': '#EF4444',
  offline: '#64748B',
};

export default function StationCard({
  station,
  reading,
  sparklineData,
  pulseKey,
}: StationCardProps) {
  const isOffline = reading?.status === 'offline' || reading?.isOnline === false;
  const status = isOffline ? 'offline' : (reading?.status || 'moderate');
  const borderClass = STATUS_BORDER_COLORS[status] || STATUS_BORDER_COLORS.moderate;
  const colorHex = STATUS_HEX_COLORS[status] || STATUS_HEX_COLORS.moderate;

  return (
    <Link href={`/station/${station.id}`} className="group block focus:outline-none">
      <Card
        pulseKey={pulseKey}
        className={`p-4 sm:p-5 border-l-[3px] ${borderClass} ${isOffline ? 'opacity-60 grayscale-[25%]' : ''} transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.015] hover:border-[#22D3EE]/50 hover:bg-[#142033] flex flex-col justify-between h-full`}
      >
        <div>
          {/* Card Header: Station Name, Order & Status Badge */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#0D1524] text-[#22D3EE] border border-[#1E2C42]">
                  {station.id}
                </span>
                <span className="text-xs text-[#8A9BB4] font-medium">
                  #{station.order} Upstream
                </span>
              </div>
              <h3 className="mt-1 text-base font-bold text-[#E6EDF7] group-hover:text-[#22D3EE] transition-colors duration-200">
                {station.name}
              </h3>
            </div>
            <StatusBadge status={status} size="sm" />
          </div>

          <p className="mt-1.5 text-xs text-[#8A9BB4] line-clamp-1">
            {station.description}
          </p>

          {/* Large Current WQI Display */}
          <div className="mt-4 pb-3 border-b border-[#1E2C42]/60 flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wider text-[#8A9BB4] font-medium">
              Water Quality Index
            </span>
            <div className="text-2xl font-bold font-mono">
              {isOffline ? (
                <span className="text-xs font-mono font-bold tracking-wider px-2 py-1 rounded bg-[#1E293B] text-[#94A3B8] border border-[#334155]">
                  OFFLINE
                </span>
              ) : (
                <LiveValue value={reading?.wqi ?? 0} unit="/100" decimals={1} />
              )}
            </div>
          </div>

          {/* Compact 2-Column Monospace Parameter Readouts */}
          <div className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
            {/* pH */}
            <div className="flex items-baseline justify-between bg-[#0D1524]/60 px-2.5 py-1.5 rounded border border-[#1E2C42]/40">
              <span className="text-[#8A9BB4] font-medium">pH</span>
              <LiveValue value={reading?.ph ?? 7.0} decimals={2} />
            </div>

            {/* DO */}
            <div className="flex items-baseline justify-between bg-[#0D1524]/60 px-2.5 py-1.5 rounded border border-[#1E2C42]/40">
              <span className="text-[#8A9BB4] font-medium">DO</span>
              <LiveValue value={reading?.do ?? 5.0} unit="mg/L" decimals={1} />
            </div>

            {/* Turbidity */}
            <div className="flex items-baseline justify-between bg-[#0D1524]/60 px-2.5 py-1.5 rounded border border-[#1E2C42]/40">
              <span className="text-[#8A9BB4] font-medium">Turbidity</span>
              <LiveValue value={reading?.turbidity ?? 5.0} unit="NTU" decimals={1} />
            </div>

            {/* TDS */}
            <div className="flex items-baseline justify-between bg-[#0D1524]/60 px-2.5 py-1.5 rounded border border-[#1E2C42]/40">
              <span className="text-[#8A9BB4] font-medium">TDS</span>
              <LiveValue value={reading?.tds ?? 200} unit="ppm" decimals={0} />
            </div>

            {/* Conductivity */}
            <div className="flex items-baseline justify-between bg-[#0D1524]/60 px-2.5 py-1.5 rounded border border-[#1E2C42]/40">
              <span className="text-[#8A9BB4] font-medium">EC</span>
              <LiveValue value={reading?.conductivity ?? 400} unit="µS" decimals={0} />
            </div>

            {/* Temperature */}
            <div className="flex items-baseline justify-between bg-[#0D1524]/60 px-2.5 py-1.5 rounded border border-[#1E2C42]/40">
              <span className="text-[#8A9BB4] font-medium">Temp</span>
              <LiveValue value={reading?.temperature ?? 24.0} unit="°C" decimals={1} />
            </div>
          </div>
        </div>

        {/* Card Footer: 40px WQI Sparkline (last 6 hours) */}
        <div className="mt-4 pt-3 border-t border-[#1E2C42]/60">
          <div className="flex items-center justify-between mb-1 text-[11px] text-[#8A9BB4]">
            <span className="font-mono">6h WQI Trend</span>
            <span className="flex items-center gap-1 text-[#22D3EE] group-hover:translate-x-0.5 transition-transform duration-200">
              Station Telemetry <ChevronRight className="h-3 w-3" />
            </span>
          </div>
          <Sparkline data={sparklineData} color={colorHex} height={40} />
        </div>
      </Card>
    </Link>
  );
}

export function StationCardSkeleton() {
  return (
    <div
      className="group block"
      aria-hidden="true"
    >
      <div className="relative rounded-xl border border-[#1E2C42] bg-[#121C2E] p-4 sm:p-5 border-l-[3px] border-l-[#64748B] flex flex-col justify-between h-full motion-safe:animate-pulse">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="h-5 w-10 rounded bg-[#1E2C42]" />
                <span className="h-3.5 w-24 rounded bg-[#1E2C42]" />
              </div>
              <div className="mt-1 h-5 w-40 rounded bg-[#1E2C42]" />
            </div>
            <div className="h-5 w-16 rounded-full bg-[#1E2C42]" />
          </div>

          <div className="mt-1.5 h-3 w-full rounded bg-[#1E2C42]" />

          <div className="mt-4 pb-3 border-b border-[#1E2C42]/60 flex items-baseline justify-between">
            <span className="h-3.5 w-32 rounded bg-[#1E2C42]" />
            <div className="h-7 w-24 rounded bg-[#1E2C42]" />
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
            <div className="flex items-baseline justify-between bg-[#0D1524]/60 px-2.5 py-1.5 rounded border border-[#1E2C42]/40">
              <span className="h-3 w-5 rounded bg-[#1E2C42]" />
              <span className="h-3.5 w-12 rounded bg-[#1E2C42]" />
            </div>

            <div className="flex items-baseline justify-between bg-[#0D1524]/60 px-2.5 py-1.5 rounded border border-[#1E2C42]/40">
              <span className="h-3 w-5 rounded bg-[#1E2C42]" />
              <span className="h-3.5 w-14 rounded bg-[#1E2C42]" />
            </div>

            <div className="flex items-baseline justify-between bg-[#0D1524]/60 px-2.5 py-1.5 rounded border border-[#1E2C42]/40">
              <span className="h-3 w-14 rounded bg-[#1E2C42]" />
              <span className="h-3.5 w-12 rounded bg-[#1E2C42]" />
            </div>

            <div className="flex items-baseline justify-between bg-[#0D1524]/60 px-2.5 py-1.5 rounded border border-[#1E2C42]/40">
              <span className="h-3 w-7 rounded bg-[#1E2C42]" />
              <span className="h-3.5 w-12 rounded bg-[#1E2C42]" />
            </div>

            <div className="flex items-baseline justify-between bg-[#0D1524]/60 px-2.5 py-1.5 rounded border border-[#1E2C42]/40">
              <span className="h-3 w-5 rounded bg-[#1E2C42]" />
              <span className="h-3.5 w-12 rounded bg-[#1E2C42]" />
            </div>

            <div className="flex items-baseline justify-between bg-[#0D1524]/60 px-2.5 py-1.5 rounded border border-[#1E2C42]/40">
              <span className="h-3 w-9 rounded bg-[#1E2C42]" />
              <span className="h-3.5 w-10 rounded bg-[#1E2C42]" />
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#1E2C42]/60">
          <div className="flex items-center justify-between mb-1 text-[11px]">
            <span className="h-3 w-24 rounded bg-[#1E2C42]" />
            <span className="h-3 w-32 rounded bg-[#1E2C42]" />
          </div>
          <div className="h-[40px] w-full rounded bg-[#1E2C42]" />
        </div>
      </div>
    </div>
  );
}
