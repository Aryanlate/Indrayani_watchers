'use client';

import React from 'react';
import { LiveValue } from '@/components/primitives';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface RadialGaugeProps {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  bisMin?: number;
  bisMax?: number;
  decimals?: number;
  criticalType?: 'min' | 'max' | 'both';
}

/**
 * Converts polar coordinates to Cartesian coordinates for SVG arcs
 */
function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 180) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

/**
 * Generates an SVG arc path string
 */
function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ');
}

export default function RadialGauge({
  label,
  value,
  unit,
  min,
  max,
  bisMin,
  bisMax,
  decimals = 1,
  criticalType = 'max',
}: RadialGaugeProps) {
  const safeVal = Math.max(min, Math.min(max, typeof value === 'number' && !isNaN(value) ? value : min));

  // Gauge angles: 0 degrees (left) to 180 degrees (right)
  const startAngle = 0;
  const endAngle = 180;
  const totalSweep = 180;

  // Fraction of value between min and max
  const valFraction = (safeVal - min) / (max - min || 1);
  const needleAngle = startAngle + valFraction * totalSweep;

  // BIS Safe Zone Arc Angles
  const effectiveBisMin = bisMin !== undefined ? Math.max(min, bisMin) : min;
  const effectiveBisMax = bisMax !== undefined ? Math.min(max, bisMax) : max;

  const bisStartAngle = startAngle + ((effectiveBisMin - min) / (max - min || 1)) * totalSweep;
  const bisEndAngle = startAngle + ((effectiveBisMax - min) / (max - min || 1)) * totalSweep;

  // Check if current value breaches BIS standard
  let exceedsLimit = false;
  if (criticalType === 'min' && bisMin !== undefined) {
    exceedsLimit = value < bisMin;
  } else if (criticalType === 'max' && bisMax !== undefined) {
    exceedsLimit = value > bisMax;
  } else if (criticalType === 'both') {
    exceedsLimit = (bisMin !== undefined && value < bisMin) || (bisMax !== undefined && value > bisMax);
  }

  const cx = 70;
  const cy = 65;
  const radius = 48;

  const trackPath = describeArc(cx, cy, radius, startAngle, endAngle);
  const bisSafePath = describeArc(cx, cy, radius, Math.max(0, bisStartAngle), Math.min(180, bisEndAngle));

  return (
    <div className="flex flex-col items-center justify-between rounded-xl bg-[#0D1524] p-3 border border-[#1E2C42] shadow-sm">
      {/* Gauge Header */}
      <div className="w-full flex items-center justify-between text-xs mb-1">
        <span className="font-semibold text-[#E6EDF7] truncate">{label}</span>
        {exceedsLimit ? (
          <span className="inline-flex items-center gap-1 rounded bg-[#EF4444]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#EF4444] border border-[#EF4444]/30 animate-pulse">
            <AlertTriangle className="h-2.5 w-2.5" />
            Exceeds BIS
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded bg-[#22C55E]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#22C55E] border border-[#22C55E]/20">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Safe Zone
          </span>
        )}
      </div>

      {/* SVG Radial Gauge */}
      <div className="relative w-[140px] h-[75px] flex items-center justify-center overflow-hidden">
        <svg viewBox="0 0 140 80" className="w-full h-full overflow-visible">
          {/* Base Track */}
          <path d={trackPath} fill="none" stroke="#1E2C42" strokeWidth="6" strokeLinecap="round" />

          {/* Shaded Green BIS Permissible Safe Zone */}
          <path
            d={bisSafePath}
            fill="none"
            stroke="#22C55E"
            strokeWidth="6"
            strokeLinecap="round"
            strokeOpacity="0.85"
          />

          {/* Pivot Center Cap */}
          <circle cx={cx} cy={cy} r="5" fill="#E6EDF7" stroke="#0B1220" strokeWidth="2" />

          {/* Animated Needle */}
          <g
            style={{
              transformOrigin: `${cx}px ${cy}px`,
              transform: `rotate(${needleAngle - 90}deg)`,
              transition: 'transform 400ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <line
              x1={cx}
              y1={cy}
              x2={cx}
              y2={cy - radius + 4}
              stroke={exceedsLimit ? '#EF4444' : '#22D3EE'}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx={cx} cy={cy - radius + 4} r="2" fill={exceedsLimit ? '#EF4444' : '#22D3EE'} />
          </g>

          {/* Scale Labels */}
          <text x={cx - radius + 2} y={cy + 13} fontSize="8" fill="#8A9BB4" textAnchor="middle" fontFamily="monospace">
            {min}
          </text>
          <text x={cx + radius - 2} y={cy + 13} fontSize="8" fill="#8A9BB4" textAnchor="middle" fontFamily="monospace">
            {max}
          </text>
        </svg>
      </div>

      {/* Value Readout */}
      <div className="mt-1 flex items-baseline justify-center text-sm font-mono font-bold">
        <LiveValue value={value} unit={unit} decimals={decimals} className={exceedsLimit ? 'text-[#EF4444]' : 'text-[#E6EDF7]'} />
      </div>

      {/* BIS Permissible Note */}
      <div className="mt-0.5 text-[10px] text-[#8A9BB4] text-center font-mono">
        BIS: {bisMin !== undefined ? `${bisMin}` : ''}
        {bisMin !== undefined && bisMax !== undefined ? '–' : ''}
        {bisMax !== undefined ? `${bisMax}` : ''} {unit}
      </div>
    </div>
  );
}
