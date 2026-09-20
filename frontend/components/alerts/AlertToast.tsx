'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRiverStore } from '@/lib/store';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';

export function AlertToast() {
  const router = useRouter();
  const { activeCriticalToastAlert, dismissCriticalToast, markAlertAsRead } = useRiverStore();
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!activeCriticalToastAlert) {
      setProgress(100);
      return;
    }

    // Auto-dismiss after 8 seconds with smooth progress bar
    setProgress(100);
    const duration = 8000;
    const interval = 50;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          dismissCriticalToast();
          return 0;
        }
        return prev - step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [activeCriticalToastAlert, dismissCriticalToast]);

  useEffect(() => {
    if (!activeCriticalToastAlert) return;
    const ariaLiveEl = document.getElementById('aria-live-alerts');
    if (ariaLiveEl) {
      const stationLabel = activeCriticalToastAlert.stationName || `Station ${activeCriticalToastAlert.stationId}`;
      ariaLiveEl.textContent = `CRITICAL ALERT at ${stationLabel}: ${activeCriticalToastAlert.message}`;
    }
  }, [activeCriticalToastAlert]);

  if (!activeCriticalToastAlert) return null;

  const alert = activeCriticalToastAlert;

  const handleClick = () => {
    markAlertAsRead(String(alert.id));
    dismissCriticalToast();
    router.push(`/station/${alert.stationId}`);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-[calc(100vw-3rem)] animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div
        onClick={handleClick}
        className="group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-[#EF4444] bg-[#121C2E]/95 p-4 shadow-[0_10px_40px_rgba(239,68,68,0.4)] backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:bg-[#16233B]"
        role="alert"
      >
        {/* Glowing Ambient Backdrop */}
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#EF4444]/20 blur-2xl" />

        {/* Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#EF4444] opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[#EF4444]"></span>
            </span>
            <div className="flex items-center gap-1.5 rounded-md border border-[#EF4444]/40 bg-[#EF4444]/15 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-[#FCA5A5]">
              <AlertTriangle className="h-3.5 w-3.5 text-[#EF4444]" />
              CRITICAL ANOMALY
            </div>
            <span className="font-mono text-xs font-semibold text-[#E6EDF7]">
              {alert.stationName || `Station ${alert.stationId}`}
            </span>
          </div>

          {/* Dismiss Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              markAlertAsRead(String(alert.id));
              dismissCriticalToast();
            }}
            className="rounded-lg p-1 text-[#8A9BB4] hover:bg-[#1E2C42] hover:text-[#E6EDF7] transition-colors"
            title="Dismiss alert"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Message & Cause Hint */}
        <div className="mt-2.5 space-y-1">
          <h4 className="text-sm font-semibold text-[#E6EDF7] leading-snug">
            {alert.message}
          </h4>
          {alert.causeHint && (
            <p className="text-xs text-[#CBD5E1] leading-relaxed">
              {alert.causeHint}
            </p>
          )}
        </div>

        {/* Diagnostics & Metric Pill */}
        <div className="mt-3 flex items-center justify-between border-t border-[#1E2C42] pt-2.5 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="text-[#8A9BB4]">Observed:</span>
            <span className="font-mono font-bold text-[#EF4444]">
              {alert.observedValue !== undefined ? alert.observedValue : alert.value ?? '—'}
            </span>
            {alert.expectedRange && (
              <span className="text-[#8A9BB4]">
                (Expected: <span className="font-mono text-[#22D3EE]">{alert.expectedRange}</span>)
              </span>
            )}
          </div>

          <span className="inline-flex items-center gap-1 font-semibold text-[#22D3EE] group-hover:translate-x-0.5 transition-transform">
            View Station <ArrowRight className="h-3 w-3" />
          </span>
        </div>

        {/* Progress Bar (Auto-dismiss in 8s) */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1E2C42]">
          <div
            className="h-full bg-[#EF4444] transition-all ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default AlertToast;
