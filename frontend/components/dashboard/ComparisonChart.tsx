'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceArea,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { Card } from '@/components/primitives';
import { Station, Reading } from '@/lib/types';
import { SlidersHorizontal, ShieldCheck } from 'lucide-react';

interface ComparisonChartProps {
  stations: Station[];
  historicalReadings: Record<string, Reading[]>;
}

type ParameterKey = 'wqi' | 'ph' | 'do' | 'turbidity' | 'tds' | 'temperature';
type TimeRange = '6h' | '24h' | '72h';

const PARAMETER_CONFIG: Record<
  ParameterKey,
  {
    name: string;
    unit: string;
    yDomain: [number, number];
    bandMin: number;
    bandMax: number;
    bandLabel: string;
    criticalMin?: number;
    criticalMax?: number;
    bisNote: string;
  }
> = {
  wqi: {
    name: 'Water Quality Index',
    unit: '/100',
    yDomain: [0, 100],
    bandMin: 80,
    bandMax: 100,
    bandLabel: 'Good Quality (≥80)',
    criticalMin: 40,
    bisNote: 'Composite CCME/NSF Index. Target: ≥80 (Good). Below 40 is Very Poor.',
  },
  ph: {
    name: 'pH Level',
    unit: 'pH',
    yDomain: [4.5, 10.0],
    bandMin: 6.5,
    bandMax: 8.5,
    bandLabel: 'BIS IS 10500 Permissible (6.5–8.5)',
    criticalMin: 6.0,
    criticalMax: 9.0,
    bisNote: 'BIS IS 10500:2012 limit is 6.5 – 8.5. Chemical effluent lowers pH.',
  },
  do: {
    name: 'Dissolved Oxygen',
    unit: 'mg/L',
    yDomain: [0, 12.0],
    bandMin: 5.0,
    bandMax: 12.0,
    bandLabel: 'CPCB / BIS Class B Safe (≥5.0 mg/L)',
    criticalMin: 4.0,
    bisNote: 'Minimum 5.0 mg/L required for aquatic survival. Below 4.0 mg/L causes hypoxia.',
  },
  turbidity: {
    name: 'Turbidity',
    unit: 'NTU',
    yDomain: [0, 100],
    bandMin: 0,
    bandMax: 5.0,
    bandLabel: 'BIS Permissible Ceiling (≤5.0 NTU)',
    criticalMax: 25.0,
    bisNote: '1.0 NTU acceptable; 5.0 NTU permissible. Industrial surges exceed 50 NTU.',
  },
  tds: {
    name: 'Total Dissolved Solids',
    unit: 'ppm',
    yDomain: [0, 600],
    bandMin: 0,
    bandMax: 500,
    bandLabel: 'BIS Acceptable Ceiling (≤500 ppm)',
    criticalMax: 1000,
    bisNote: '500 ppm desirable standard. Elevated values indicate inorganic electrolytes.',
  },
  temperature: {
    name: 'Water Temperature',
    unit: '°C',
    yDomain: [15, 35],
    bandMin: 18.0,
    bandMax: 28.0,
    bandLabel: 'Nominal Ambient Range (18–28 °C)',
    criticalMax: 32.0,
    bisNote: 'Baseline tropical river range. High temperatures accelerate deoxygenation.',
  },
};

const STATION_COLORS: Record<string, string> = {
  S1: '#22C55E', // Green - Dehu
  S2: '#FDE047', // Yellow - Alandi
  S3: '#F59E0B', // Amber - Moshi
  S4: '#EF4444', // Red - Chikhali (Industrial)
  S5: '#DC2626', // Deep Red - Charholi
  S6: '#06B6D4', // Cyan - Confluence
};

export default function ComparisonChart({
  stations,
  historicalReadings,
}: ComparisonChartProps) {
  const [selectedParam, setSelectedParam] = useState<ParameterKey>('wqi');
  const [selectedRange, setSelectedRange] = useState<TimeRange>('24h');
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Compute number of data points: 6h = 24, 24h = 96, 72h = 288
  const dataPointCount = selectedRange === '6h' ? 24 : selectedRange === '24h' ? 96 : 288;

  // Prepare aligned time-series dataset for Recharts
  const chartData = useMemo(() => {
    const s1Data = historicalReadings['S1'] || [];
    const slicedS1 = s1Data.slice(-dataPointCount);

    return slicedS1.map((reading, idx) => {
      const date = new Date(reading.timestamp);
      // Format time label e.g. "14:30" or "Fri 14h"
      const timeLabel =
        selectedRange === '72h'
          ? date.toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit' })
          : date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

      const point: Record<string, unknown> = {
        time: timeLabel,
        timestamp: date.toISOString(),
      };

      for (const s of stations) {
        const stationSeries = historicalReadings[s.id] || [];
        const stationSliced = stationSeries.slice(-dataPointCount);
        const item = stationSliced[idx];
        if (item) {
          point[s.id] = item[selectedParam];
        }
      }

      return point;
    });
  }, [historicalReadings, dataPointCount, selectedParam, selectedRange, stations]);

  const paramConfig = PARAMETER_CONFIG[selectedParam];
  const hasData = Object.keys(historicalReadings).length > 0 && chartData.length > 0;

  if (!isMounted || !hasData) {
    return (
      <Card className="p-5 sm:p-6 border-[#1E2C42] motion-safe:animate-pulse" aria-hidden="true">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-[#1E2C42]/60 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-[#1E2C42]" />
              <div className="h-4 w-64 rounded bg-[#1E2C42]" />
            </div>
            <div className="mt-1 h-3 w-96 rounded bg-[#1E2C42]" />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="h-8 w-[230px] rounded-lg bg-[#1E2C42]" />
            <div className="h-8 w-[110px] rounded-lg bg-[#1E2C42]" />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg bg-[#0D1524]/60 px-3.5 py-2 border border-[#1E2C42]/60">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-[#1E2C42]" />
            <div className="h-3.5 w-56 rounded bg-[#1E2C42]" />
            <div className="h-3 w-72 rounded bg-[#1E2C42]" />
          </div>
          <div className="h-3 w-64 rounded bg-[#1E2C42] hidden md:block" />
        </div>

        <div className="mt-5 h-[340px] w-full relative">
          <div className="absolute inset-0 flex flex-col justify-between py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-px w-full bg-[#1E2C42] opacity-60" />
            ))}
          </div>
          <div className="absolute left-0 bottom-0 h-[340px] flex flex-col justify-between py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-2.5 w-8 rounded bg-[#1E2C42]" />
            ))}
          </div>
          <div className="absolute left-0 right-0 bottom-0 flex justify-between px-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-2.5 w-12 rounded bg-[#1E2C42]" />
            ))}
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-40 rounded bg-[#1E2C42] opacity-70" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6 border-[#1E2C42]">
      {/* Header and Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-[#1E2C42]/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[#22D3EE]" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8A9BB4]">
              Multi-Station Parameter Comparison
            </h2>
          </div>
          <p className="mt-1 text-xs text-[#8A9BB4]">
            Continuous time-series with{' '}
            <span className="text-[#22C55E] font-medium">
              BIS IS 10500:2012 permissible reference band
            </span>
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Parameter Selector */}
          <div className="flex items-center rounded-lg bg-[#0D1524] p-1 border border-[#1E2C42]">
            {(
              [
                ['wqi', 'WQI'],
                ['ph', 'pH'],
                ['do', 'DO'],
                ['turbidity', 'Turbidity'],
                ['tds', 'TDS'],
                ['temperature', 'Temp'],
              ] as [ParameterKey, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSelectedParam(key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                  selectedParam === key
                    ? 'bg-[#22D3EE] text-[#0B1220] font-semibold shadow-sm'
                    : 'text-[#8A9BB4] hover:text-[#E6EDF7]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center rounded-lg bg-[#0D1524] p-1 border border-[#1E2C42]">
            {(['6h', '24h', '72h'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setSelectedRange(range)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                  selectedRange === range
                    ? 'bg-[#17243B] text-[#22D3EE] font-semibold border border-[#22D3EE]/30'
                    : 'text-[#8A9BB4] hover:text-[#E6EDF7]'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* BIS Standard Banner */}
      <div className="mt-4 flex items-center justify-between rounded-lg bg-[#0D1524]/60 px-3.5 py-2 text-xs border border-[#1E2C42]/60">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#22C55E]" />
          <span className="text-[#E6EDF7] font-medium">{paramConfig.bandLabel}:</span>
          <span className="text-[#8A9BB4]">{paramConfig.bisNote}</span>
        </div>
        <span className="font-mono text-[#22D3EE] hidden md:inline">
          Shaded area = BIS/CPCB Nominal Envelope
        </span>
      </div>

      {/* Recharts Multi-Line Container */}
      <div className="mt-5 h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E2C42" opacity={0.6} />

            <XAxis
              dataKey="time"
              stroke="#8A9BB4"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#1E2C42' }}
            />

            <YAxis
              stroke="#8A9BB4"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#1E2C42' }}
              domain={paramConfig.yDomain}
              unit={` ${paramConfig.unit}`}
            />

            {/* Shaded Reference Area for BIS Permissible Limits */}
            <ReferenceArea
              y1={paramConfig.bandMin}
              y2={paramConfig.bandMax}
              fill="#22C55E"
              fillOpacity={0.07}
              stroke="#22C55E"
              strokeOpacity={0.35}
              strokeDasharray="4 4"
            />

            {/* Critical threshold warning line if defined */}
            {paramConfig.criticalMin !== undefined && selectedParam === 'do' && (
              <ReferenceLine
                y={paramConfig.criticalMin}
                stroke="#EF4444"
                strokeDasharray="3 3"
                label={{
                  value: 'Hypoxia (<4.0 mg/L)',
                  fill: '#EF4444',
                  position: 'insideBottomRight',
                  fontSize: 10,
                }}
              />
            )}

            <Tooltip
              content={<CustomComparisonTooltip unit={paramConfig.unit} stations={stations} />}
            />

            <Legend
              wrapperStyle={{ paddingTop: '14px', fontSize: '12px' }}
              formatter={(value) => {
                const s = stations.find((st) => st.id === value);
                return (
                  <span className="text-xs text-[#E6EDF7] font-medium mr-3">
                    {value}: {s ? s.name.split(' ')[0] : ''}
                  </span>
                );
              }}
            />

            {/* One line per station (S1 to S6) */}
            {stations.map((s) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={s.id}
                name={s.id}
                stroke={STATION_COLORS[s.id] || '#22D3EE'}
                strokeWidth={s.id === 'S4' || s.id === 'S5' ? 2.2 : 1.75}
                dot={false}
                activeDot={{ r: 4, stroke: '#0B1220', strokeWidth: 1.5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
  unit: string;
  stations: Station[];
}

function CustomComparisonTooltip({
  active,
  payload,
  label,
  unit,
  stations,
}: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-xl border border-[#1E2C42] bg-[#121C2E]/95 p-3.5 shadow-2xl backdrop-blur-md min-w-[210px]">
      <div className="text-xs font-mono text-[#8A9BB4] border-b border-[#1E2C42] pb-1 mb-2 flex items-center justify-between">
        <span>Timeline Timestamp</span>
        <span className="text-[#22D3EE] font-semibold">{label}</span>
      </div>

      <div className="space-y-1.5">
        {payload.map((entry) => {
          const station = stations.find((s) => s.id === entry.name);
          return (
            <div key={entry.name} className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-[#E6EDF7] font-medium">
                  {entry.name} ({station ? station.name.split(' ')[0] : ''})
                </span>
              </div>
              <span className="font-semibold text-[#E6EDF7]">
                {entry.value !== undefined ? entry.value : '—'} {unit}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
