'use client';

import React from 'react';
import Link from 'next/link';
import { Station, Reading } from '@/lib/types';
import { StatusBadge, LiveValue } from '@/components/primitives';
import RadialGauge from './RadialGauge';
import {
  X,
  ExternalLink,
  MapPin,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface StationSidePanelProps {
  station: Station | null;
  reading: Reading | null;
  history24h: Reading[];
  isOpen: boolean;
  onClose: () => void;
}

export default function StationSidePanel({
  station,
  reading,
  history24h,
  isOpen,
  onClose,
}: StationSidePanelProps) {
  // Format 24h mini series data for Recharts (MUST be before any early return - hooks rules)
  const chartData = React.useMemo(() => {
    return history24h.slice(-96).map((item) => {
      const d = new Date(item.timestamp);
      return {
        time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        wqi: item.wqi,
        do: item.do,
        turbidity: item.turbidity,
      };
    });
  }, [history24h]);

  if (!station || !reading) return null;

  const status = reading.status || 'moderate';

  // Check which parameters breach BIS limits
  const breaches: string[] = [];
  if (reading.ph < 6.5 || reading.ph > 8.5) breaches.push(`pH (${reading.ph.toFixed(2)})`);
  if (reading.do < 5.0) breaches.push(`DO (${reading.do.toFixed(1)} mg/L < 5.0)`);
  if (reading.turbidity > 5.0) breaches.push(`Turbidity (${reading.turbidity.toFixed(1)} NTU > 5.0)`);
  if (reading.tds > 500) breaches.push(`TDS (${reading.tds} ppm > 500)`);
  if (reading.temperature < 18 || reading.temperature > 28) {
    breaches.push(`Temperature (${reading.temperature.toFixed(1)} °C)`);
  }

  return (
    <>
      {/* Backdrop overlay: only on <lg (bottom-sheet mode: modal), hidden on lg (side-panel mode: non-modal) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel: <lg = bottom sheet, lg+ = right side slide-in */}
      <aside
        className={`fixed z-50 bg-[#121C2E]/95 backdrop-blur-2xl shadow-2xl flex flex-col justify-between border-[#1E2C42]
          /* Mobile Bottom Sheet (base styles) */
          bottom-0 inset-x-0 max-h-[85vh] rounded-t-2xl border-t w-full
          /* Desktop Right Slide-In overrides (≥1024px) */
          lg:top-0 lg:right-0 lg:bottom-0 lg:inset-x-auto lg:max-h-none lg:rounded-none lg:border-l lg:border-t-0 lg:w-[460px]
          transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
          ${isOpen
            ? 'translate-y-0 lg:translate-x-0'
            : 'translate-y-full lg:translate-y-0 lg:translate-x-full'
          }`}
        aria-label="Station Telemetry Diagnostics"
        role="dialog"
        aria-modal="true"
        aria-labelledby="station-panel-title"
      >
        {/* Mobile Bottom-Sheet Handle Bar (only on <lg) */}
        <div className="lg:hidden flex justify-center pt-2 pb-1" aria-hidden="true">
          <span className="block h-1 w-9 rounded-full bg-[#1E2C42] ring-1 ring-[#1E2C42]" />
        </div>

        {/* Panel Header */}
        <div className="p-5 border-b border-[#1E2C42]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#0D1524] text-[#22D3EE] border border-[#1E2C42]">
                  {station.id}
                </span>
                <span className="text-xs text-[#8A9BB4] font-medium">
                  Order #{station.order} Upstream
                </span>
              </div>
              <h2 className="mt-1.5 text-xl font-bold text-[#E6EDF7] tracking-tight">
                {station.name}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <StatusBadge status={status} size="md" />
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-[#8A9BB4] hover:text-[#E6EDF7] hover:bg-[#1E2C42] transition-colors"
                aria-label="Close station panel"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-xs text-[#8A9BB4]">
            <MapPin className="h-3.5 w-3.5 text-[#22D3EE] shrink-0" />
            <span className="truncate">{station.description}</span>
          </div>

          {/* Current WQI Banner */}
          <div className="mt-4 rounded-xl bg-[#0D1524] p-3 border border-[#1E2C42] flex items-baseline justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8A9BB4] block">
                Current Water Quality Index
              </span>
              <span className="text-[11px] text-[#8A9BB4]">
                Telemetry recorded:{' '}
                {new Date(reading.timestamp).toLocaleTimeString('en-US', { hour12: false })}
              </span>
            </div>
            <div className="text-3xl font-bold font-mono">
              <LiveValue value={reading.wqi} unit="/100" decimals={1} />
            </div>
          </div>

          {/* Breaches Warning Banner */}
          {breaches.length > 0 ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-[#EF4444]/10 p-2.5 text-xs text-[#EF4444] border border-[#EF4444]/25">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">BIS IS 10500:2012 Excursion Detected:</span>
                <span className="text-[11px] text-[#E6EDF7]">{breaches.join(' &bull; ')}</span>
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-lg bg-[#22C55E]/10 p-2 text-xs text-[#22C55E] border border-[#22C55E]/20 text-center font-medium">
              All 5 parameters within BIS statutory permissible limits
            </div>
          )}
        </div>

        {/* Panel Body: 5 Radial Gauges & 24h Mini Time-Series */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Radial Gauges Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8A9BB4]">
                Sensor Parameters &bull; BIS Safe Zones
              </span>
              <span className="text-[10px] text-[#22C55E] font-mono">Green Arc = Safe</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* 1. pH */}
              <RadialGauge
                label="pH Level"
                value={reading.ph}
                unit=""
                min={4.0}
                max={10.0}
                bisMin={6.5}
                bisMax={8.5}
                criticalType="both"
                decimals={2}
              />

              {/* 2. Dissolved Oxygen */}
              <RadialGauge
                label="Dissolved Oxygen"
                value={reading.do}
                unit="mg/L"
                min={0}
                max={12.0}
                bisMin={5.0}
                bisMax={12.0}
                criticalType="min"
                decimals={1}
              />

              {/* 3. Turbidity */}
              <RadialGauge
                label="Turbidity"
                value={reading.turbidity}
                unit="NTU"
                min={0}
                max={60.0}
                bisMin={0}
                bisMax={5.0}
                criticalType="max"
                decimals={1}
              />

              {/* 4. TDS */}
              <RadialGauge
                label="TDS"
                value={reading.tds}
                unit="ppm"
                min={0}
                max={800}
                bisMin={0}
                bisMax={500}
                criticalType="max"
                decimals={0}
              />

              {/* 5. Temperature (spans 2 cols on mobile/full) */}
              <div className="col-span-2">
                <RadialGauge
                  label="Water Temperature"
                  value={reading.temperature}
                  unit="°C"
                  min={10}
                  max={40}
                  bisMin={18.0}
                  bisMax={28.0}
                  criticalType="both"
                  decimals={1}
                />
              </div>
            </div>
          </div>

          {/* 24-Hour Mini Time-Series */}
          <div className="rounded-xl bg-[#0D1524] p-3.5 border border-[#1E2C42]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#8A9BB4] uppercase">
                <Activity className="h-3.5 w-3.5 text-[#22D3EE]" />
                <span>24-Hour WQI Trend</span>
              </div>
              <span className="text-[10px] font-mono text-[#8A9BB4]">
                Min: {Math.min(...chartData.map((d) => d.wqi || 100)).toFixed(0)} &bull; Max:{' '}
                {Math.max(...chartData.map((d) => d.wqi || 0)).toFixed(0)}
              </span>
            </div>

            <div className="h-[120px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#1E2C42" opacity={0.5} />
                  <XAxis dataKey="time" stroke="#8A9BB4" fontSize={9} tickLine={false} />
                  <YAxis domain={[20, 100]} stroke="#8A9BB4" fontSize={9} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#121C2E',
                      borderColor: '#1E2C42',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="wqi"
                    name="WQI"
                    stroke="#22D3EE"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Panel Footer: Link to Full Station Page */}
        <div className="p-4 border-t border-[#1E2C42] bg-[#0D1524]/60">
          <Link
            href={`/station/${station.id}`}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#22D3EE] px-4 py-3 text-sm font-bold text-[#0B1220] transition-all duration-300 hover:bg-[#38BDF8] active:scale-98 shadow-lg shadow-[#22D3EE]/20"
          >
            <span>Inspect Full Station Diagnostics</span>
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </aside>
    </>
  );
}
