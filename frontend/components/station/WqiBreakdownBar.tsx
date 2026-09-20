'use client';

import React, { useState } from 'react';
import { WQIInput, calculateWQIBreakdown, WQI_WEIGHTS } from '@/lib/wqi';
import StatusBadge from '@/components/primitives/StatusBadge';
import { Info, AlertCircle, CheckCircle2 } from 'lucide-react';

interface WqiBreakdownBarProps {
  input: WQIInput;
  stationName?: string;
}

const PARAM_DETAILS = [
  {
    key: 'do' as const,
    label: 'Dissolved Oxygen',
    short: 'DO',
    weight: WQI_WEIGHTS.do,
    maxPts: WQI_WEIGHTS.do * 100, // 30 pts
    color: '#38BDF8', // Sky blue
    bg: 'bg-[#38BDF8]',
    border: 'border-[#38BDF8]',
    unit: 'mg/L',
  },
  {
    key: 'turbidity' as const,
    label: 'Turbidity',
    short: 'Turb',
    weight: WQI_WEIGHTS.turbidity,
    maxPts: WQI_WEIGHTS.turbidity * 100, // 20 pts
    color: '#F59E0B', // Amber
    bg: 'bg-[#F59E0B]',
    border: 'border-[#F59E0B]',
    unit: 'NTU',
  },
  {
    key: 'ph' as const,
    label: 'pH Level',
    short: 'pH',
    weight: WQI_WEIGHTS.ph,
    maxPts: WQI_WEIGHTS.ph * 100, // 20 pts
    color: '#A855F7', // Purple
    bg: 'bg-[#A855F7]',
    border: 'border-[#A855F7]',
    unit: '',
  },
  {
    key: 'tds' as const,
    label: 'Total Dissolved Solids',
    short: 'TDS',
    weight: WQI_WEIGHTS.tds,
    maxPts: WQI_WEIGHTS.tds * 100, // 15 pts
    color: '#10B981', // Emerald
    bg: 'bg-[#10B981]',
    border: 'border-[#10B981]',
    unit: 'ppm',
  },
  {
    key: 'temperature' as const,
    label: 'Temperature',
    short: 'Temp',
    weight: WQI_WEIGHTS.temperature,
    maxPts: WQI_WEIGHTS.temperature * 100, // 15 pts
    color: '#EC4899', // Pink
    bg: 'bg-[#EC4899]',
    border: 'border-[#EC4899]',
    unit: '°C',
  },
];

export function WqiBreakdownBar({ input, stationName }: WqiBreakdownBarProps) {
  const breakdown = calculateWQIBreakdown(input);
  const [activeParam, setActiveParam] = useState<string | null>(null);

  // Compute contributions: contribution_i = subIndex_i * weight_i
  const contributions = PARAM_DETAILS.map((param) => {
    const subScore = breakdown.subIndices[param.key];
    const pointsScored = Math.round(subScore * param.weight * 10) / 10;
    const pointsLost = Math.round((param.maxPts - pointsScored) * 10) / 10;
    const rawVal = input[param.key];

    return {
      ...param,
      subScore,
      pointsScored,
      pointsLost,
      rawVal,
    };
  });

  return (
    <div className="rounded-2xl border border-[#1E2C42] bg-[#121C2E] p-5 sm:p-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#1E2C42] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[#22D3EE] animate-pulse" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#E6EDF7]">
              WQI Parameter Contribution Breakdown
            </h3>
          </div>
          <p className="mt-1 text-xs text-[#8A9BB4]">
            Scientific weighted-sum analysis showing why {stationName || 'this station'} scores a WQI of{' '}
            <strong className="font-mono text-[#22D3EE]">{breakdown.wqi}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={breakdown.status} size="lg" />
          <div className="flex flex-col items-end">
            <span className="font-mono text-2xl font-black tabular-nums text-[#E6EDF7]">
              {breakdown.wqi}
              <span className="text-xs font-normal text-[#8A9BB4]"> / 100</span>
            </span>
          </div>
        </div>
      </div>

      {/* Horizontal Stacked Bar */}
      <div className="mt-5">
        <div className="relative flex h-8 w-full overflow-hidden rounded-xl border border-[#1E2C42] bg-[#0B1220] p-0.5">
          {contributions.map((c) => {
            // Width in % out of total 100
            const widthPct = Math.max(c.pointsScored, 0);

            return (
              <div
                key={c.key}
                onMouseEnter={() => setActiveParam(c.key)}
                onMouseLeave={() => setActiveParam(null)}
                style={{ width: `${widthPct}%`, backgroundColor: c.color }}
                className="group relative h-full transition-all duration-300 hover:opacity-90 hover:brightness-110 cursor-pointer first:rounded-l-lg last:rounded-r-lg"
                title={`${c.label}: ${c.pointsScored} / ${c.maxPts} pts (Sub-index: ${c.subScore}/100)`}
              >
                {/* Segment label inside if width permits */}
                {widthPct >= 8 && (
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-bold text-[#0B1220] truncate px-1">
                    {c.short} ({c.pointsScored})
                  </span>
                )}
              </div>
            );
          })}

          {/* Lost points grey remainder bar */}
          {100 - breakdown.wqi > 0.5 && (
            <div
              style={{ width: `${Math.max(0, 100 - breakdown.wqi)}%` }}
              className="h-full bg-[#1E2C42]/50 flex items-center justify-center"
              title={`Lost Points: ${(100 - breakdown.wqi).toFixed(1)} pts lost due to water degradation`}
            >
              {100 - breakdown.wqi >= 10 && (
                <span className="font-mono text-[10px] text-[#8A9BB4] truncate px-1">
                  -{(100 - breakdown.wqi).toFixed(0)} pts
                </span>
              )}
            </div>
          )}
        </div>

        {/* Legend Row */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {contributions.map((c) => {
            const isHovered = activeParam === c.key;
            const isDegraded = c.pointsLost >= c.maxPts * 0.35;

            return (
              <div
                key={c.key}
                onMouseEnter={() => setActiveParam(c.key)}
                onMouseLeave={() => setActiveParam(null)}
                className={`rounded-xl border p-2.5 transition-all duration-200 cursor-pointer ${
                  isHovered
                    ? 'border-[#22D3EE] bg-[#1A263D] shadow-md scale-[1.02]'
                    : 'border-[#1E2C42] bg-[#0B1220]/60 hover:bg-[#121C2E]'
                }`}
              >
                {/* Top line: Color square + short label */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="text-xs font-semibold text-[#E6EDF7]">{c.short}</span>
                  </div>
                  <span className="font-mono text-[10px] text-[#8A9BB4]">{c.weight * 100}% Wt</span>
                </div>

                {/* Score & Contributed Points */}
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-mono text-xs font-bold text-[#E6EDF7]">
                    {c.pointsScored}
                    <span className="text-[10px] font-normal text-[#8A9BB4]"> / {c.maxPts} pts</span>
                  </span>
                  <span className="font-mono text-[10px] text-[#22D3EE]">
                    Q: {Math.round(c.subScore)}
                  </span>
                </div>

                {/* Status Indicator / Penalty */}
                <div className="mt-1.5 flex items-center gap-1 text-[10px]">
                  {isDegraded ? (
                    <span className="flex items-center gap-1 text-[#EF4444] font-medium">
                      <AlertCircle className="h-2.5 w-2.5" /> -{c.pointsLost} pts lost
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[#22C55E] font-medium">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Nominal ({c.rawVal} {c.unit})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Diagnostic Insight Note */}
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#1E2C42] bg-[#0B1220]/40 p-3 text-xs text-[#8A9BB4]">
          <Info className="h-4 w-4 text-[#22D3EE] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Diagnostic Interpretation:</strong> Points are penalized when parameters deviate from optimal
            ecological standards. Dissolved Oxygen contributes up to <strong>30 points</strong> (highest weight),
            while Turbidity and pH contribute up to <strong>20 points each</strong>. Hover over any parameter above to
            inspect individual sub-index scores.
          </p>
        </div>
      </div>
    </div>
  );
}

export default WqiBreakdownBar;
