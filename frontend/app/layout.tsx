'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  STATIONS,
  HISTORICAL_READINGS,
  getLiveReading,
  mockAlerts,
} from '@/lib/mockData';
import { classifyWQI } from '@/lib/wqi';
import { Reading, Alert } from '@/lib/types';
import apiClient from '@/lib/apiClient';
import { useRiverStore } from '@/lib/store';

// Dashboard Components
import RiverRibbon from '@/components/dashboard/RiverRibbon';
import KpiRow from '@/components/dashboard/KpiRow';
import StationGrid from '@/components/dashboard/StationGrid';
import ComparisonChart from '@/components/dashboard/ComparisonChart';
import AlertsPanel from '@/components/dashboard/AlertsPanel';
import { Radio, RefreshCw, WifiOff, DatabaseZap } from 'lucide-react';

export default function DashboardPage() {
  // Initialize readings immediately so there is ZERO loading spinner on first paint
  const [readings, setReadings] = useState<Record<string, Reading>>(() => {
    const initial: Record<string, Reading> = {};
    for (const s of STATIONS) {
      // Get the latest reading from pre-generated historical cache
      const hist = HISTORICAL_READINGS[s.id];
      if (hist && hist.length > 0) {
        initial[s.id] = hist[hist.length - 1];
      } else {
        initial[s.id] = getLiveReading(s.id);
      }
    }
    return initial;
  });

  // 6-hour sparkline history cache (24 intervals of 15-min readings)
  const [sparklineData, setSparklineData] = useState<Record<string, number[]>>(() => {
    const initial: Record<string, number[]> = {};
    for (const s of STATIONS) {
      const hist = HISTORICAL_READINGS[s.id] || [];
      // Last 24 points = 6 hours
      initial[s.id] = hist.slice(-24).map((r) => r.wqi);
    }
    return initial;
  });

  const [alerts, setAlerts] = useState<Alert[]>(() => [...mockAlerts]);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number>(() => Date.now());
  const [pulseKey, setPulseKey] = useState<number>(() => Date.now());
  const [showDisconnectedBanner, setShowDisconnectedBanner] = useState<boolean>(false);

  const streamStatus = useRiverStore((s) => s.streamStatus);
  const isStreaming = streamStatus === 'connected';

  useEffect(() => {
    if (streamStatus === 'disconnected') {
      const timer = setTimeout(() => {
        setShowDisconnectedBanner(true);
      }, 10000);
      return () => clearTimeout(timer);
    } else {
      setShowDisconnectedBanner(false);
    }
  }, [streamStatus]);

  const handleReconnect = () => {
    apiClient.connectStream();
  };

  const handleRepollData = () => {
    const reseeded: Record<string, Reading> = {};
    for (const s of STATIONS) {
      reseeded[s.id] = getLiveReading(s.id);
    }
    setReadings(reseeded);
    setLastSyncTimestamp(Date.now());
    setPulseKey(Date.now());
    apiClient.connectStream();
  };

  const hasReadings = Object.keys(readings).length > 0;

  // Calculate live river-wide average WQI
  const { averageWqi, averageStatus, worstStation } = useMemo(() => {
    const readingList = Object.values(readings);
    if (readingList.length === 0) {
      return {
        averageWqi: 65,
        averageStatus: 'moderate' as const,
        worstStation: null,
      };
    }

    const totalWqi = readingList.reduce((acc, r) => acc + r.wqi, 0);
    const avg = Math.round((totalWqi / readingList.length) * 10) / 10;
    const status = classifyWQI(avg);

    // Identify current worst station
    let worst: { id: string; name: string; wqi: number; status: Reading['status'] } | null = null;
    let minWqi = Infinity;

    for (const s of STATIONS) {
      const r = readings[s.id];
      if (r && r.wqi < minWqi) {
        minWqi = r.wqi;
        worst = {
          id: s.id,
          name: s.name,
          wqi: r.wqi,
          status: r.status,
        };
      }
    }

    return {
      averageWqi: avg,
      averageStatus: status,
      worstStation: worst,
    };
  }, [readings]);

  // Connect to backend Realtime SSE stream on mount
  useEffect(() => {
    apiClient.connectStream();

    return () => {
      apiClient.disconnectStream();
    };
  }, []);

  // Sync with Zustand store updates when backend SSE pushes new data
  const zustandReadings = useRiverStore((s) => s.latestReadings);
  useEffect(() => {
    if (Object.keys(zustandReadings).length > 0) {
      setReadings((prev) => ({
        ...prev,
        ...zustandReadings,
      }));
      setLastSyncTimestamp(Date.now());
      setPulseKey(Date.now());
    }
  }, [zustandReadings]);

  // Live Telemetry Engine: Polls getLiveReading() every 3 seconds for all stations
  useEffect(() => {
    const pollInterval = setInterval(() => {
      const newReadings: Record<string, Reading> = {};
      const newSparklines: Record<string, number[]> = {};
      const now = Date.now();

      for (const s of STATIONS) {
        const freshReading = getLiveReading(s.id);
        newReadings[s.id] = freshReading;

        // Update sparkline 6h array
        setSparklineData((prev) => {
          const current = prev[s.id] || [];
          const updated = [...current.slice(-23), freshReading.wqi];
          newSparklines[s.id] = updated;
          return {
            ...prev,
            [s.id]: updated,
          };
        });

        // Detect live anomaly events at S4 or S5 and inject alerts
        if (
          (s.id === 'S4' || s.id === 'S5') &&
          (freshReading.status === 'very-poor' || freshReading.do < 3.0 || freshReading.turbidity > 65)
        ) {
          const newAlert: Alert = {
            id: `live-alert-${s.id}-${now}`,
            stationId: s.id,
            stationName: s.name,
            severity: freshReading.do < 2.5 ? 'critical' : 'warning',
            parameter: freshReading.do < 3.0 ? 'do' : 'turbidity',
            message:
              freshReading.do < 3.0
                ? `Critical Hypoxia: DO plunged to ${freshReading.do.toFixed(1)} mg/L during industrial discharge.`
                : `Turbidity surge (${freshReading.turbidity.toFixed(1)} NTU) detected at industrial checkpoint.`,
            timestamp: new Date().toISOString(),
            resolved: false,
          };

          setAlerts((prev) => {
            // Deduplicate if recent alert within 20s
            if (prev.length > 0 && prev[0].stationId === s.id && prev[0].parameter === newAlert.parameter) {
              return prev;
            }
            return [newAlert, ...prev.slice(0, 49)];
          });
        }
      }

      setReadings(newReadings);
      setLastSyncTimestamp(now);
      setPulseKey(now);
    }, 3000);

    return () => clearInterval(pollInterval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0B1220] pb-16">
      {/* Top Breadcrumb & Live Control Room Banner */}
      <div className="border-b border-[#1E2C42] bg-[#0D1524]/60 backdrop-blur-sm sticky top-16 z-30">
        <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22D3EE] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#22D3EE]" />
            </div>
            <span className="text-xs font-semibold text-[#E6EDF7] tracking-wide">
              Indrayani River Basin Telemetry Control Room
            </span>
            <span className="text-xs text-[#8A9BB4] hidden md:inline">
              &bull; Dehu Ghat to Downstream Confluence (42.8 km corridor)
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-[#8A9BB4]">
            <div className="flex items-center gap-1.5 bg-[#121C2E] px-2.5 py-1 rounded border border-[#1E2C42]">
              <Radio className="h-3.5 w-3.5 text-[#22D3EE] animate-pulse" />
              <span className="text-[#E6EDF7] font-medium">3s Telemetry Cycle</span>
            </div>
          </div>
        </div>
      </div>

      {showDisconnectedBanner && (
        <div className="border-b border-[#EF4444]/30 bg-gradient-to-r from-[#EF4444]/15 via-[#EF4444]/10 to-transparent backdrop-blur-sm">
          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30">
                <WifiOff className="h-4 w-4 text-[#EF4444]" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#FECACA]">
                  Telemetry connection lost
                </div>
                <div className="text-xs text-[#FCA5A5]/80 mt-0.5">
                  Realtime SSE stream dropped &mdash; station readings may be stale.
                </div>
              </div>
            </div>
            <button
              onClick={handleReconnect}
              className="inline-flex items-center gap-2 rounded-lg bg-[#EF4444] px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#DC2626] active:scale-[0.98] transition-all duration-150"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reconnect
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
        {!hasReadings ? (
          <section aria-label="No telemetry data empty state">
            <div className="relative rounded-xl border border-[#1E2C42] bg-[#121C2E] p-8 sm:p-12 flex flex-col items-center justify-center text-center min-h-[420px]">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0D1524] border border-[#1E2C42] mb-5">
                <DatabaseZap className="h-8 w-8 text-[#8A9BB4]" />
              </div>
              <h2 className="text-lg font-bold text-[#E6EDF7]">
                No telemetry data
              </h2>
              <p className="mt-2 text-sm text-[#8A9BB4] max-w-md">
                The dashboard could not load sensor readings from the telemetry pipeline.
                The SSE stream may not have emitted initial state, or the mock cache is unavailable.
              </p>
              <button
                onClick={handleRepollData}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#22D3EE] px-4 py-2.5 text-xs font-semibold text-[#0B1220] shadow-sm hover:bg-[#06B6D4] active:scale-[0.98] transition-all duration-150"
              >
                <RefreshCw className="h-4 w-4" />
                Reseed &amp; Repoll
              </button>
            </div>
          </section>
        ) : (
          <>
            {/* 1. River Health Header Strip (Average WQI + Longitudinal River Ribbon) */}
            <section aria-label="River Health Header Strip">
              <RiverRibbon
                stations={STATIONS}
                readings={readings}
                averageWqi={averageWqi}
                averageStatus={averageStatus}
                pulseKey={pulseKey}
              />
            </section>

            {/* 2. KPI Row (4 Pulsing Cards) */}
            <section aria-label="Key Performance Indicators">
              <KpiRow
                onlineCount={STATIONS.length}
                totalCount={STATIONS.length}
                activeAlertsCount={alerts.length}
                worstStation={worstStation}
                lastSyncTimestamp={lastSyncTimestamp}
                isStreaming={isStreaming}
                pulseKey={pulseKey}
              />
            </section>

            {/* 3. Station Grid (6 Cards with 3px status left-border & 40px sparklines) */}
            <section aria-label="Station Telemetry Grid">
              <StationGrid
                stations={STATIONS}
                readings={readings}
                historyByStation={sparklineData}
                pulseKey={pulseKey}
              />
            </section>

            {/* 4. Comparison Chart (Recharts multi-line with shaded BIS permissible band) & 5. Alerts Panel */}
            <section aria-label="Basin Analysis & Alerts" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ComparisonChart
                  stations={STATIONS}
                  historicalReadings={HISTORICAL_READINGS}
                />
              </div>

              <div className="lg:col-span-1">
                <AlertsPanel alerts={alerts} />
              </div>
            </section>
          </>
        )}

      </div>
    </div>
  );
}
