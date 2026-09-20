'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  CartesianGrid,
} from 'recharts';
import RadialGauge from '@/components/map/RadialGauge';
import { LiveValue } from '@/components/primitives';
import { CheckCircle2, AlertTriangle, Activity } from 'lucide-react';

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

interface ParameterPanelProps {
  paramKey: 'do' | 'turbidity' | 'ph' | 'tds' | 'temperature';
  title: string;
  unit: string;
  currentValue: number;
  description: string;
  bisLabel: string;
  bisMin?: number;
  bisMax?: number;
  isBreaching: boolean;
  gaugeMin: number;
  gaugeMax: number;
  decimals?: number;
  primaryStationName: string;
  primaryHistory: TimeSeriesPoint[];
  comparisonStationName?: string | null;
  comparisonHistory?: TimeSeriesPoint[] | null;
  color: string;
  comparisonColor?: string;
}

export function ParameterPanel({
  title,
  unit,
  currentValue,
  description,
  bisLabel,
  bisMin,
  bisMax,
  isBreaching,
  gaugeMin,
  gaugeMax,
  decimals = 1,
  primaryStationName,
  primaryHistory,
  comparisonStationName,
  comparisonHistory,
  color,
  comparisonColor = '#F59E0B',
}: ParameterPanelProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Compute stats: Min, Avg, Max for primary station
  const stats = useMemo(() => {
    if (primaryHistory.length === 0) return { min: 0, avg: 0, max: 0 };
    const vals = primaryHistory.map((p) => p.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return {
      min: Number(min.toFixed(decimals)),
      avg: Number(avg.toFixed(decimals)),
      max: Number(max.toFixed(decimals)),
    };
  }, [primaryHistory, decimals]);

  // Compute stats for comparison station if present
  const compStats = useMemo(() => {
    if (!comparisonHistory || comparisonHistory.length === 0) return null;
    const vals = comparisonHistory.map((p) => p.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return {
      min: Number(min.toFixed(decimals)),
      avg: Number(avg.toFixed(decimals)),
      max: Number(max.toFixed(decimals)),
    };
  }, [comparisonHistory, decimals]);

  // Merge primary and comparison history for Recharts
  const chartData = useMemo(() => {
    // Map by index or timestamp match
    return primaryHistory.map((item, idx) => {
      const compItem = comparisonHistory && comparisonHistory[idx];
      const timeDate = new Date(item.timestamp);
      const timeLabel = timeDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      return {
        timestamp: item.timestamp,
        timeLabel,
        primary: item.value,
        comparison: compItem ? compItem.value : undefined,
      };
    });
  }, [primaryHistory, comparisonHistory]);

  // Determine Y-axis bounds
  const yDomain = useMemo(() => {
    const allVals = primaryHistory.map((p) => p.value);
    if (comparisonHistory) {
      allVals.push(...comparisonHistory.map((p) => p.value));
    }
    if (bisMin !== undefined) allVals.push(bisMin);
    if (bisMax !== undefined) allVals.push(bisMax);

    const min = Math.max(0, Math.min(...allVals) * 0.9);
    const max = Math.max(...allVals) * 1.1;
    return [Math.floor(min), Math.ceil(max)];
  }, [primaryHistory, comparisonHistory, bisMin, bisMax]);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#1E2C42] bg-[#121C2E] p-5 sm:p-6 shadow-xl transition-all hover:border-[#1E2C42]/80">
      {/* Panel Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#1E2C42] pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
            <h3 className="text-base sm:text-lg font-bold text-[#E6EDF7]">{title}</h3>
            <span className="rounded-md border border-[#1E2C42] bg-[#0B1220] px-2 py-0.5 font-mono text-xs text-[#8A9BB4]">
              {unit || 'index'}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#8A9BB4] max-w-2xl">{description}</p>
        </div>

        {/* BIS Compliance Badge */}
        <div className="flex items-center gap-2">
          {isBreaching ? (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/15 px-3 py-1 text-xs font-semibold text-[#EF4444]">
              <AlertTriangle className="h-4 w-4" />
              <span>Exceeds BIS Permissible Limit</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#22C55E]/40 bg-[#22C55E]/15 px-3 py-1 text-xs font-semibold text-[#22C55E]">
              <CheckCircle2 className="h-4 w-4" />
              <span>Within BIS Permissible Limit</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Left Diagnostics vs Right 72h Area Chart */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Value, Gauge, Min/Avg/Max stats (4 cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-4 rounded-xl border border-[#1E2C42]/70 bg-[#0B1220]/40 p-4">
          {/* Live Monospace Reading */}
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A9BB4]">
              Live Telemetry Value
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <LiveValue
                value={currentValue}
                unit={unit}
                decimals={decimals}
                className="font-mono text-3xl font-black text-[#E6EDF7]"
              />
            </div>
            <span className="mt-1 block text-[11px] font-mono text-[#22D3EE]/90">
              {bisLabel}
            </span>
          </div>

          {/* Radial Gauge */}
          <div className="flex items-center justify-center py-1">
            <RadialGauge
              label={title}
              value={currentValue}
              unit={unit}
              min={gaugeMin}
              max={gaugeMax}
              bisMin={bisMin}
              bisMax={bisMax}
              decimals={decimals}
              criticalType={bisMin !== undefined && bisMax !== undefined ? 'both' : bisMin !== undefined ? 'min' : 'max'}
            />
          </div>

          {/* Window Statistics (Min / Avg / Max) */}
          <div className="rounded-lg border border-[#1E2C42] bg-[#121C2E] p-3">
            <div className="flex items-center justify-between text-[11px] text-[#8A9BB4] border-b border-[#1E2C42] pb-1.5 mb-2 font-semibold uppercase tracking-wider">
              <span>Selected Window Stats</span>
              <span className="font-mono text-[#22D3EE]">{primaryHistory.length} readings</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[10px] text-[#8A9BB4] block">MIN</span>
                <span className="font-mono text-xs font-bold text-[#E6EDF7]">
                  {stats.min} {unit}
                </span>
                {compStats && (
                  <span className="text-[9px] font-mono text-[#F59E0B] block" title={`Comparison: ${compStats.min}`}>
                    vs {compStats.min}
                  </span>
                )}
              </div>

              <div className="border-x border-[#1E2C42]">
                <span className="text-[10px] text-[#8A9BB4] block">AVG</span>
                <span className="font-mono text-xs font-bold text-[#22D3EE]">
                  {stats.avg} {unit}
                </span>
                {compStats && (
                  <span className="text-[9px] font-mono text-[#F59E0B] block" title={`Comparison: ${compStats.avg}`}>
                    vs {compStats.avg}
                  </span>
                )}
              </div>

              <div>
                <span className="text-[10px] text-[#8A9BB4] block">MAX</span>
                <span className="font-mono text-xs font-bold text-[#E6EDF7]">
                  {stats.max} {unit}
                </span>
                {compStats && (
                  <span className="text-[9px] font-mono text-[#F59E0B] block" title={`Comparison: ${compStats.max}`}>
                    vs {compStats.max}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: 72-Hour Area Chart with Shaded BIS Range & Comparison Overlay (8 cols) */}
        <div className="lg:col-span-8 flex flex-col justify-between rounded-xl border border-[#1E2C42]/70 bg-[#0B1220]/40 p-4">
          {/* Chart Header & Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E2C42] pb-3 mb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#22D3EE]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#CBD5E1]">
                72-Hour Time-Series Trend
              </span>
            </div>

            {/* Legend Pills */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: color }} />
                <span className="font-semibold text-[#E6EDF7] text-[11px] truncate max-w-[140px]">
                  {primaryStationName}
                </span>
              </div>

              {comparisonStationName && (
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-3 rounded-sm border-t-2 border-dashed"
                    style={{ borderColor: comparisonColor }}
                  />
                  <span className="font-semibold text-[#F59E0B] text-[11px] truncate max-w-[140px]">
                    {comparisonStationName} (Overlay)
                  </span>
                </div>
              )}

              {bisMin !== undefined && bisMax !== undefined && (
                <div className="flex items-center gap-1.5 text-[#22C55E] text-[11px]">
                  <span className="h-2 w-3 rounded-sm bg-[#22C55E]/20 border border-[#22C55E]/40" />
                  <span>BIS Safe Band ({bisMin}–{bisMax})</span>
                </div>
              )}
            </div>
          </div>

          {/* Area Chart Container */}
          <div className="h-64 sm:h-72 w-full pt-2">
            {isMounted && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid stroke="#1E2C42" strokeDasharray="3 3" vertical={false} />

                  <XAxis
                    dataKey="timeLabel"
                    stroke="#8A9BB4"
                    fontSize={10}
                    tickLine={false}
                    interval={Math.floor(chartData.length / 8)}
                  />

                  <YAxis
                    domain={yDomain}
                    stroke="#8A9BB4"
                    fontSize={10}
                    tickLine={false}
                    tickFormatter={(v) => `${v}`}
                  />

                  {/* Shaded Reference Area for BIS Permissible Band */}
                  {bisMin !== undefined && bisMax !== undefined && (
                    <ReferenceArea
                      y1={bisMin}
                      y2={bisMax}
                      fill="rgba(34, 197, 94, 0.08)"
                      stroke="rgba(34, 197, 94, 0.3)"
                      strokeDasharray="4 4"
                    />
                  )}
                  {bisMin !== undefined && bisMax === undefined && (
                    <ReferenceArea
                      y1={bisMin}
                      y2={yDomain[1]}
                      fill="rgba(34, 197, 94, 0.08)"
                      stroke="rgba(34, 197, 94, 0.3)"
                      strokeDasharray="4 4"
                    />
                  )}
                  {bisMin === undefined && bisMax !== undefined && (
                    <ReferenceArea
                      y1={0}
                      y2={bisMax}
                      fill="rgba(34, 197, 94, 0.08)"
                      stroke="rgba(34, 197, 94, 0.3)"
                      strokeDasharray="4 4"
                    />
                  )}

                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const primVal = payload.find((p) => p.dataKey === 'primary')?.value as number;
                      const compVal = payload.find((p) => p.dataKey === 'comparison')?.value as number | undefined;
                      const diff = compVal !== undefined ? primVal - compVal : undefined;

                      return (
                        <div className="rounded-xl border border-[#1E2C42] bg-[#121C2E]/95 p-3 shadow-2xl backdrop-blur-md text-xs">
                          <div className="font-mono text-[11px] text-[#8A9BB4] border-b border-[#1E2C42] pb-1 mb-1.5">
                            Timestamp: {label}
                          </div>

                          <div className="flex items-center justify-between gap-4 py-0.5">
                            <span className="flex items-center gap-1.5 text-[#E6EDF7] font-medium">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                              {primaryStationName}:
                            </span>
                            <span className="font-mono font-bold text-[#22D3EE]">
                              {primVal} {unit}
                            </span>
                          </div>

                          {compVal !== undefined && (
                            <div className="flex items-center justify-between gap-4 py-0.5">
                              <span className="flex items-center gap-1.5 text-[#F59E0B] font-medium">
                                <span className="h-2 w-2 rounded-full bg-[#F59E0B]" />
                                {comparisonStationName}:
                              </span>
                              <span className="font-mono font-bold text-[#F59E0B]">
                                {compVal} {unit}
                              </span>
                            </div>
                          )}

                          {diff !== undefined && (
                            <div className="mt-1 pt-1 border-t border-[#1E2C42] flex items-center justify-between gap-2 text-[10px] font-mono">
                              <span className="text-[#8A9BB4]">Difference (Δ):</span>
                              <span className={diff > 0 ? 'text-[#EF4444]' : 'text-[#22C55E]'}>
                                {diff > 0 ? `+${diff.toFixed(decimals)}` : diff.toFixed(decimals)} {unit}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />

                  {/* Primary Station Area */}
                  <Area
                    type="monotone"
                    dataKey="primary"
                    stroke={color}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill={`url(#grad-${title})`}
                    isAnimationActive={false}
                  />

                  {/* Comparison Station Dotted Line */}
                  {comparisonStationName && (
                    <Line
                      type="monotone"
                      dataKey="comparison"
                      stroke={comparisonColor}
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      isAnimationActive={false}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#8A9BB4]">
                Loading telemetry chart...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ParameterPanel;
