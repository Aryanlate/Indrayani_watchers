'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { STATIONS, HISTORICAL_READINGS, getLiveReading } from '@/lib/mockData';
import { Reading } from '@/lib/types';
import apiClient from '@/lib/apiClient';
import { useRiverStore } from '@/lib/store';

function MapSkeleton() {
  return (
    <div
      className="relative h-full min-h-[480px] w-full overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 30% 40%, #162236 0%, #0E1829 35%, #0B1220 70%, #070C18 100%)',
      }}
      aria-hidden="true"
    >
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0" style={{
          backgroundImage:
            'linear-gradient(to right, rgba(34,211,238,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(34,211,238,0.06) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
      </div>

      <div className="absolute left-4 top-4 flex flex-col gap-2 z-10">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-9 w-48 rounded-lg bg-[#121C2E] border border-[#1E2C42] animate-pulse"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>

      <div className="absolute bottom-5 left-1/2 z-10 w-[min(92%,880px)] -translate-x-1/2 rounded-xl border border-[#1E2C42] bg-[#121C2E]/90 p-4 shadow-xl backdrop-blur">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="h-4 w-40 rounded bg-[#1E2C42] animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-[#1E2C42] animate-pulse" />
            <div className="h-7 w-20 rounded-lg bg-[#1E2C42] animate-pulse" />
            <div className="h-7 w-16 rounded-lg bg-[#1E2C42] animate-pulse" />
          </div>
        </div>
        <div className="relative flex h-3 items-center">
          <div className="absolute inset-x-0 h-1.5 rounded-full bg-[#1E2C42] animate-pulse" />
          <div className="absolute left-0 h-4 w-4 -translate-y-0.5 rounded-full border-2 border-[#0B1220] bg-[#22D3EE] shadow-[0_0_10px_rgba(34,211,238,0.6)]" />
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 font-mono text-sm text-[#8A9BB4]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#22D3EE] border-t-transparent" />
          <span>Initializing Telemetry Map...</span>
        </div>
      </div>
    </div>
  );
}

// Dynamic import for MapLibre GL to prevent any SSR window/WebGL evaluation issues
const RiverMap = dynamic(() => import('@/components/map/RiverMap'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export default function MapPage() {
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapRetryKey, setMapRetryKey] = useState<number>(0);
  const mapErrorLockRef = React.useRef<number>(0);

  const handleRetry = () => {
    setMapError(null);
    setMapRetryKey((prev) => prev + 1);
  };

  useEffect(() => {
    let cancelled = false;

    const handleError = (event: ErrorEvent) => {
      if (cancelled) return;
      const msg = typeof event.message === 'string' ? event.message : '';
      const lower = msg.toLowerCase();

      const isFatalMapInitError =
        lower.includes('webgl context') ||
        lower.includes('could not create maplibre') ||
        lower.includes('maplibregl is not defined') ||
        lower.includes('failed to initialize webgl') ||
        lower.includes('instantiated maplibregl.map') ||
        /maplibre.*(syntax|type|load)error/.test(lower) ||
        /failed to load module script/.test(lower) ||
        /blocked a frame|cross-origin.*maplibre/.test(lower);

      if (!isFatalMapInitError) return;

      const now = Date.now();
      if (now - mapErrorLockRef.current < 5000) return; // throttle: max 1 per 5s
      mapErrorLockRef.current = now;
      setMapError(msg);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (cancelled) return;
      const reason =
        (event.reason && typeof event.reason === 'object' && 'message' in event.reason
          ? String((event.reason as { message?: unknown }).message ?? '')
          : String(event.reason ?? '')) || '';
      const lower = reason.toLowerCase();

      const isFatalMapInitError =
        lower.includes('webgl context') ||
        lower.includes('could not create maplibre') ||
        lower.includes('maplibregl is not defined') ||
        lower.includes('failed to initialize webgl') ||
        lower.includes('instantiated maplibregl.map') ||
        /maplibre.*(syntax|type|load)error/.test(lower);

      if (!isFatalMapInitError) return;

      const now = Date.now();
      if (now - mapErrorLockRef.current < 5000) return;
      mapErrorLockRef.current = now;
      setMapError(reason);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      cancelled = true;
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Initialize readings immediately so there is no loading lag
  const [readings, setReadings] = useState<Record<string, Reading>>(() => {
    const initial: Record<string, Reading> = {};
    for (const s of STATIONS) {
      const hist = HISTORICAL_READINGS[s.id];
      initial[s.id] = hist && hist.length > 0 ? hist[hist.length - 1] : getLiveReading(s.id);
    }
    return initial;
  });

  function recordsShallowEqual(
    a: Record<string, Reading>,
    b: Record<string, Reading>
  ): boolean {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const k of keysA) {
      if (a[k] !== b[k]) return false;
    }
    return true;
  }

  function readingsDeeplyEqual(
    a: Record<string, Reading>,
    b: Record<string, Reading>
  ): boolean {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const k of keysA) {
      const ra = a[k];
      const rb = b[k];
      if (ra === rb) continue;
      if (!ra || !rb) return false;
      if (
        ra.wqi !== rb.wqi ||
        ra.do !== rb.do ||
        ra.ph !== rb.ph ||
        ra.turbidity !== rb.turbidity ||
        ra.tds !== rb.tds ||
        ra.conductivity !== rb.conductivity ||
        ra.status !== rb.status ||
        ra.isOnline !== rb.isOnline ||
        ra.timestamp !== rb.timestamp
      ) {
        return false;
      }
    }
    return true;
  }

  // Connect to backend Realtime SSE stream on mount
  useEffect(() => {
    apiClient.connectStream();

    return () => {
      apiClient.disconnectStream();
    };
  }, []);

  // Sync with Zustand store updates if backend broadcasts new readings
  const zustandReadings = useRiverStore((s) => s.latestReadings);
  useEffect(() => {
    if (Object.keys(zustandReadings).length === 0) return;
    setReadings((prev) => {
      const merged = { ...prev, ...zustandReadings };
      if (recordsShallowEqual(prev, merged) || readingsDeeplyEqual(prev, merged)) {
        return prev;
      }
      return merged;
    });
  }, [zustandReadings]);

  // Poll getLiveReading() every 3 seconds for all stations, but only write a new
  // readings Record when at least one reading's numeric/status fields actually changed.
  // This prevents thousands of spurious RiverMap re-renders per minute from polling.
  useEffect(() => {
    const interval = setInterval(() => {
      setReadings((prev) => {
        const nextReadings: Record<string, Reading> = {};
        for (const s of STATIONS) {
          nextReadings[s.id] = getLiveReading(s.id);
        }
        if (readingsDeeplyEqual(prev, nextReadings)) return prev;
        return nextReadings;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      aria-labelledby="indrayani-map-page-title"
      className="relative h-full min-h-0 w-full overflow-hidden bg-[#0B1220]"
    >
      <h1 id="indrayani-map-page-title" className="sr-only">
        Indrayani River Telemetry Map
      </h1>

      {mapError ? (
        <div
          role="alert"
          className="absolute inset-0 z-50 flex items-center justify-center bg-[#0B1220]/95 backdrop-blur-sm"
        >
          <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-xl border border-[#EF4444]/40 bg-[#121C2E] p-8 shadow-2xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EF4444]/15 ring-1 ring-[#EF4444]/30">
              <svg
                className="h-7 w-7 text-[#EF4444]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <h2 className="font-mono text-lg font-semibold text-[#E6EDF7]">
                Map failed to load
              </h2>
              <p className="font-mono text-sm text-[#8A9BB4]">
                {mapError || 'An error occurred while initializing the map.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              aria-label="Retry loading the Indrayani River map"
              className="inline-flex items-center gap-2 rounded-lg border border-[#22D3EE]/40 bg-[#22D3EE]/10 px-5 py-2.5 font-mono text-sm font-semibold text-[#22D3EE] transition-all duration-200 hover:bg-[#22D3EE]/20 hover:ring-2 hover:ring-[#22D3EE]/30 focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/50"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Retry
            </button>
          </div>
        </div>
      ) : (
        <RiverMap key={mapRetryKey} stations={STATIONS} liveReadings={readings} />
      )}
    </div>
  );
}
