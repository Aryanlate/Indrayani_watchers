'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRiverStore } from '@/lib/store';
import { STATIONS, getStationHistory, getLiveReading } from '@/lib/mockData';
import { Reading, Station } from '@/lib/types';
import StatusBadge from '@/components/primitives/StatusBadge';
import WqiBreakdownBar from '@/components/station/WqiBreakdownBar';
import ParameterPanel from '@/components/station/ParameterPanel';
import {
  Download,
  Clock,
  ArrowLeft,
  MapPin,
  Compass,
  SlidersHorizontal,
  ChevronDown,
  Printer,
} from 'lucide-react';

interface StationDetailPageProps {
  params: {
    id: string;
  };
}

export default function StationDetailPage({ params }: StationDetailPageProps) {
  const router = useRouter();
  const stationId = params.id ? params.id.toUpperCase() : 'S1';

  const { stations, latestReadings } = useRiverStore();

  // Find target station metadata (fallback to first station if not found)
  const station: Station = useMemo(() => {
    return (
      stations.find((s) => s.id === stationId) ||
      STATIONS.find((s) => s.id === stationId) ||
      STATIONS[0]
    );
  }, [stations, stationId]);

  // Telemetry time-window filter (24h, 48h, 72h)
  const [timeWindowHours, setTimeWindowHours] = useState<number>(72);

  // Comparison station selector (default to S1 Dehu if viewing S4/S5/etc.)
  const [comparisonStationId, setComparisonStationId] = useState<string>(() => {
    if (station.id === 'S1') return 'S4';
    return 'S1'; // Default compare against clean upstream Dehu
  });

  // Current live reading for target station
  const currentReading: Reading = useMemo(() => {
    return latestReadings[station.id] || getLiveReading(station.id);
  }, [latestReadings, station.id]);

  // Current live reading for comparison station
  const comparisonReading: Reading | undefined = useMemo(() => {
    if (!comparisonStationId || comparisonStationId === 'none') return undefined;
    return latestReadings[comparisonStationId] || getLiveReading(comparisonStationId);
  }, [latestReadings, comparisonStationId]);

  // Comparison station object
  const comparisonStation: Station | undefined = useMemo(() => {
    if (!comparisonStationId || comparisonStationId === 'none') return undefined;
    return stations.find((s) => s.id === comparisonStationId) || STATIONS.find((s) => s.id === comparisonStationId);
  }, [stations, comparisonStationId]);

  // Live "last reading Xs ago" ticker
  const [secondsAgo, setSecondsAgo] = useState<number>(0);

  useEffect(() => {
    const updateTicker = () => {
      const ts = currentReading.timestamp ? new Date(currentReading.timestamp).getTime() : Date.now();
      setSecondsAgo(Math.max(0, Math.floor((Date.now() - ts) / 1000)));
    };

    updateTicker();
    const interval = setInterval(updateTicker, 1000);
    return () => clearInterval(interval);
  }, [currentReading.timestamp]);

  // Historical telemetry series for primary station
  const primaryHistory = useMemo(() => {
    return getStationHistory(station.id, timeWindowHours);
  }, [station.id, timeWindowHours]);

  // Historical telemetry series for comparison station
  const compHistory = useMemo(() => {
    if (!comparisonStationId || comparisonStationId === 'none') return null;
    return getStationHistory(comparisonStationId, timeWindowHours);
  }, [comparisonStationId, timeWindowHours]);

  // Parameter-specific time series mappers
  const primaryDo = useMemo(() => primaryHistory.map((r) => ({ timestamp: r.timestamp, value: r.do })), [primaryHistory]);
  const compDo = useMemo(() => compHistory?.map((r) => ({ timestamp: r.timestamp, value: r.do })) || null, [compHistory]);

  const primaryTurbidity = useMemo(() => primaryHistory.map((r) => ({ timestamp: r.timestamp, value: r.turbidity })), [primaryHistory]);
  const compTurbidity = useMemo(() => compHistory?.map((r) => ({ timestamp: r.timestamp, value: r.turbidity })) || null, [compHistory]);

  const primaryPh = useMemo(() => primaryHistory.map((r) => ({ timestamp: r.timestamp, value: r.ph })), [primaryHistory]);
  const compPh = useMemo(() => compHistory?.map((r) => ({ timestamp: r.timestamp, value: r.ph })) || null, [compHistory]);

  const primaryTds = useMemo(() => primaryHistory.map((r) => ({ timestamp: r.timestamp, value: r.tds })), [primaryHistory]);
  const compTds = useMemo(() => compHistory?.map((r) => ({ timestamp: r.timestamp, value: r.tds })) || null, [compHistory]);

  const primaryTemp = useMemo(() => primaryHistory.map((r) => ({ timestamp: r.timestamp, value: r.temperature })), [primaryHistory]);
  const compTemp = useMemo(() => compHistory?.map((r) => ({ timestamp: r.timestamp, value: r.temperature })) || null, [compHistory]);

  // Download CSV Export
  const handleDownloadCSV = () => {
    const headers = [
      'Timestamp',
      'StationId',
      'StationName',
      'pH',
      'DissolvedOxygen_mgL',
      'Turbidity_NTU',
      'TDS_ppm',
      'Conductivity_uScm',
      'Temperature_C',
      'WQI',
      'Status',
    ];

    const rows = primaryHistory.map((r) => [
      `"${r.timestamp}"`,
      `"${r.stationId}"`,
      `"${station.name}"`,
      r.ph,
      r.do,
      r.turbidity,
      r.tds,
      r.conductivity,
      r.temperature,
      r.wqi,
      `"${r.status}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `indrayani_${station.id}_${timeWindowHours}h_telemetry.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download Report / Print
  const handlePrintReport = () => {
    window.print();
  };

  const roundedWqi = Math.round(currentReading.wqi);

  return (
    <div className="min-h-screen bg-[#0B1220] pb-24 pt-6 text-[#E6EDF7]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Navigation Breadcrumb & Station Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#1E2C42] pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#1E2C42] bg-[#121C2E] px-3 py-1.5 text-xs font-medium text-[#8A9BB4] hover:border-[#22D3EE]/50 hover:text-[#E6EDF7] transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            <span className="text-[#8A9BB4]/60">/</span>
            <span className="font-mono text-xs font-semibold text-[#22D3EE]">
              Station Node {station.id}
            </span>
          </div>

          {/* Upstream -> Downstream Quick Station Jump Tabs */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] uppercase tracking-wider text-[#8A9BB4] mr-1 hidden md:inline">
              Switch Station:
            </span>
            {STATIONS.map((st) => {
              const isCurrent = st.id === station.id;
              return (
                <button
                  key={st.id}
                  onClick={() => router.push(`/station/${st.id}`)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-mono font-semibold transition-all ${
                    isCurrent
                      ? 'border-[#22D3EE] bg-[#22D3EE]/20 text-[#22D3EE] shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                      : 'border-[#1E2C42] bg-[#121C2E] text-[#8A9BB4] hover:bg-[#1A263D] hover:text-[#E6EDF7]'
                  }`}
                >
                  {st.id}
                </button>
              );
            })}
          </div>
        </div>

        {/* Station Header Strip */}
        <div className="relative overflow-hidden rounded-2xl border border-[#1E2C42] bg-[#121C2E] p-6 shadow-2xl backdrop-blur-md">
          {/* Ambient Glow */}
          <div
            className="absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl opacity-15"
            style={{
              backgroundColor:
                currentReading.status === 'good'
                  ? '#22C55E'
                  : currentReading.status === 'moderate'
                  ? '#FDE047'
                  : currentReading.status === 'poor'
                  ? '#F97316'
                  : '#EF4444',
            }}
          />

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Left Metadata */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-sm font-bold text-[#22D3EE] bg-[#22D3EE]/10 border border-[#22D3EE]/30 rounded-md px-2 py-0.5">
                  STATION {station.id}
                </span>
                <span className="text-xs font-mono text-[#8A9BB4]">
                  Position {station.order} of 6 (Upstream → Downstream)
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#E6EDF7]">
                {station.name}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-xs text-[#8A9BB4]">
                <span className="flex items-center gap-1">
                  <Compass className="h-3.5 w-3.5 text-[#22D3EE]" />
                  <span className="font-mono">{station.lat.toFixed(4)}° N, {station.lng.toFixed(4)}° E</span>
                </span>

                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-[#22D3EE]" />
                  <span>{station.description}</span>
                </span>
              </div>
            </div>

            {/* Right Status & Big WQI */}
            <div className="flex items-center gap-6 self-start lg:self-auto border-t lg:border-t-0 border-[#1E2C42] pt-4 lg:pt-0">
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-2">
                  <StatusBadge status={currentReading.status} size="lg" />
                </div>
                <span className="mt-1.5 flex items-center gap-1 text-xs font-mono text-[#8A9BB4]">
                  <Clock className="h-3 w-3 text-[#22D3EE]" />
                  Last reading {secondsAgo}s ago
                </span>
              </div>

              {/* Large WQI Number */}
              <div className="flex flex-col items-center justify-center rounded-2xl border border-[#1E2C42] bg-[#0B1220] px-5 py-3 shadow-inner">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#8A9BB4]">
                  LIVE WQI
                </span>
                <span
                  className="font-mono text-4xl sm:text-5xl font-black tabular-nums transition-colors duration-500"
                  style={{
                    color:
                      currentReading.status === 'good'
                        ? '#22C55E'
                        : currentReading.status === 'moderate'
                        ? '#FDE047'
                        : currentReading.status === 'poor'
                        ? '#F97316'
                        : '#EF4444',
                  }}
                >
                  {roundedWqi}
                </span>
                <span className="text-[10px] text-[#8A9BB4]/80">Scale 0 - 100</span>
              </div>
            </div>
          </div>
        </div>

        {/* WQI Breakdown Component */}
        <WqiBreakdownBar
          stationName={station.name}
          input={{
            ph: currentReading.ph,
            do: currentReading.do,
            turbidity: currentReading.turbidity,
            tds: currentReading.tds,
            temperature: currentReading.temperature,
          }}
        />

        {/* Controls Bar: Time Window, Comparison Dropdown, and Export Buttons */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-xl border border-[#1E2C42] bg-[#121C2E] p-4 shadow-lg">
          {/* Left: Compare With & Time Window */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Compare with Dropdown */}
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-[#22D3EE]" />
              <label className="text-xs font-semibold text-[#CBD5E1]">Compare with:</label>
              <div className="relative">
                <select
                  value={comparisonStationId}
                  onChange={(e) => setComparisonStationId(e.target.value)}
                  className="appearance-none rounded-lg border border-[#1E2C42] bg-[#0B1220] py-1.5 pl-3 pr-8 font-mono text-xs text-[#E6EDF7] focus:border-[#22D3EE] focus:outline-none cursor-pointer"
                >
                  <option value="none">None (Single Station)</option>
                  {STATIONS.filter((s) => s.id !== station.id).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id} — {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-[#8A9BB4]" />
              </div>
            </div>

            {/* Time Window Buttons */}
            <div className="flex items-center gap-1 pl-2 border-l border-[#1E2C42]">
              <span className="text-xs text-[#8A9BB4] mr-1 hidden sm:inline">Window:</span>
              {[24, 48, 72].map((hours) => {
                const isActive = timeWindowHours === hours;
                return (
                  <button
                    key={hours}
                    onClick={() => setTimeWindowHours(hours)}
                    className={`rounded-md border px-2.5 py-1 font-mono text-xs font-medium transition-colors ${
                      isActive
                        ? 'border-[#22D3EE] bg-[#22D3EE]/15 text-[#22D3EE] font-bold'
                        : 'border-[#1E2C42] bg-[#0B1220] text-[#8A9BB4] hover:text-[#E6EDF7]'
                    }`}
                  >
                    {hours}h
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Export Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleDownloadCSV}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#1E2C42] bg-[#0B1220] px-3 py-1.5 text-xs font-semibold text-[#CBD5E1] hover:border-[#22D3EE]/50 hover:text-[#22D3EE] transition-all shadow-sm"
              title="Download telemetry readings as CSV"
            >
              <Download className="h-3.5 w-3.5 text-[#22D3EE]" />
              Download CSV
            </button>

            <button
              onClick={handlePrintReport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#1E2C42] bg-[#0B1220] px-3 py-1.5 text-xs font-semibold text-[#CBD5E1] hover:border-[#22D3EE]/50 hover:text-[#22D3EE] transition-all shadow-sm"
              title="Download print-optimized audit report"
            >
              <Printer className="h-3.5 w-3.5 text-[#22D3EE]" />
              Download Report (PDF)
            </button>
          </div>
        </div>

        {/* Comparison Notice banner if comparison active */}
        {comparisonStation && (
          <div className="flex items-center justify-between rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-4 py-2.5 text-xs text-[#FDE047]">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#F59E0B] animate-pulse" />
              <span>
                Comparative Mode Active: Overlaying <strong>{comparisonStation.name} ({comparisonStation.id})</strong>{' '}
                [Live WQI: {comparisonReading ? Math.round(comparisonReading.wqi) : '—'}] on charts below.
              </span>
            </div>
            <button
              onClick={() => setComparisonStationId('none')}
              className="underline font-semibold hover:text-white"
            >
              Disable Comparison
            </button>
          </div>
        )}

        {/* Five Full-Width Parameter Panels */}
        <div className="space-y-6">
          {/* 1. Dissolved Oxygen */}
          <ParameterPanel
            paramKey="do"
            title="Dissolved Oxygen (DO)"
            unit="mg/L"
            currentValue={currentReading.do}
            description="Crucial metric for river life. Hypoxia sets in below 4.0 mg/L; acute fish mortality below 2.0 mg/L."
            bisLabel="BIS Limit: ≥ 5.0 mg/L"
            bisMin={5.0}
            isBreaching={currentReading.do < 5.0}
            gaugeMin={0}
            gaugeMax={12}
            decimals={2}
            primaryStationName={station.name}
            primaryHistory={primaryDo}
            comparisonStationName={comparisonStation?.name}
            comparisonHistory={compDo}
            color="#38BDF8"
            comparisonColor="#F59E0B"
          />

          {/* 2. Turbidity */}
          <ParameterPanel
            paramKey="turbidity"
            title="Turbidity"
            unit="NTU"
            currentValue={currentReading.turbidity}
            description="Measures suspended solids, clay, and sewage particulate matter. Blocks sunlight and carries pathogens."
            bisLabel="BIS Permissible: ≤ 5.0 NTU"
            bisMax={5.0}
            isBreaching={currentReading.turbidity > 5.0}
            gaugeMin={0}
            gaugeMax={60}
            decimals={1}
            primaryStationName={station.name}
            primaryHistory={primaryTurbidity}
            comparisonStationName={comparisonStation?.name}
            comparisonHistory={compTurbidity}
            color="#F59E0B"
            comparisonColor="#A855F7"
          />

          {/* 3. pH Level */}
          <ParameterPanel
            paramKey="ph"
            title="pH Level"
            unit="pH"
            currentValue={currentReading.ph}
            description="Hydrogen ion activity. Acidity (<6.5) suggests metal pickling rinses; alkalinity (>8.5) indicates detergent/industrial wash."
            bisLabel="BIS Permissible: 6.5 – 8.5"
            bisMin={6.5}
            bisMax={8.5}
            isBreaching={currentReading.ph < 6.5 || currentReading.ph > 8.5}
            gaugeMin={4.0}
            gaugeMax={10.0}
            decimals={2}
            primaryStationName={station.name}
            primaryHistory={primaryPh}
            comparisonStationName={comparisonStation?.name}
            comparisonHistory={compPh}
            color="#A855F7"
            comparisonColor="#38BDF8"
          />

          {/* 4. Total Dissolved Solids (TDS) */}
          <ParameterPanel
            paramKey="tds"
            title="Total Dissolved Solids (TDS)"
            unit="ppm"
            currentValue={currentReading.tds}
            description="Dissolved inorganic salts and organic matter. Surges during chemical outfall or concentrated municipal sewage."
            bisLabel="BIS Standard: ≤ 500 ppm"
            bisMax={500}
            isBreaching={currentReading.tds > 500}
            gaugeMin={0}
            gaugeMax={800}
            decimals={0}
            primaryStationName={station.name}
            primaryHistory={primaryTds}
            comparisonStationName={comparisonStation?.name}
            comparisonHistory={compTds}
            color="#10B981"
            comparisonColor="#F43F5E"
          />

          {/* 5. Water Temperature */}
          <ParameterPanel
            paramKey="temperature"
            title="Water Temperature"
            unit="°C"
            currentValue={currentReading.temperature}
            description="Regulates oxygen solubility and biochemical kinetics. Sudden thermal spikes indicate boiler or cooling blowdown outfalls."
            bisLabel="Nominal Tropical: 18.0 – 28.0 °C"
            bisMin={18.0}
            bisMax={28.0}
            isBreaching={currentReading.temperature > 28.0 || currentReading.temperature < 18.0}
            gaugeMin={10.0}
            gaugeMax={40.0}
            decimals={1}
            primaryStationName={station.name}
            primaryHistory={primaryTemp}
            comparisonStationName={comparisonStation?.name}
            comparisonHistory={compTemp}
            color="#EC4899"
            comparisonColor="#38BDF8"
          />
        </div>
      </div>
    </div>
  );
}
