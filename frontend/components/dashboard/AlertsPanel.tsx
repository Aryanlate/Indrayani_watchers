'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/primitives';
import { Alert } from '@/lib/types';
import { AlertTriangle, AlertCircle, Info, Clock, ShieldAlert, CheckCircle, ArrowRight, Cpu, Activity, Shield } from 'lucide-react';

interface AlertsPanelProps {
  alerts: Alert[];
}

const SEVERITY_CONFIG = {
  critical: {
    color: '#EF4444',
    bg: 'bg-[#EF4444]/10',
    border: 'border-[#EF4444]/30',
    icon: AlertTriangle,
    badgeText: 'CRITICAL',
  },
  warning: {
    color: '#F97316',
    bg: 'bg-[#F97316]/10',
    border: 'border-[#F97316]/30',
    icon: AlertCircle,
    badgeText: 'WARNING',
  },
  info: {
    color: '#22D3EE',
    bg: 'bg-[#22D3EE]/10',
    border: 'border-[#22D3EE]/30',
    icon: Info,
    badgeText: 'NOTICE',
  },
};

const ALGORITHM_ICONS: Record<string, typeof Cpu> = {
  'z-score': Cpu,
  'rate-of-change': Activity,
  threshold: Shield,
};

export default function AlertsPanel({ alerts }: AlertsPanelProps) {
  // Sort alerts newest first
  const sortedAlerts = [...alerts].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <Card className="p-5 sm:p-6 border-[#1E2C42]">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-[#1E2C42]/60 pb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[#EF4444]" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8A9BB4]">
            Basin Alerts &amp; Effluent Anomalies
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="flex h-2 w-2 rounded-full bg-[#EF4444] animate-pulse" />
            <span className="text-xs font-mono text-[#8A9BB4]">
              {sortedAlerts.length} Event{sortedAlerts.length === 1 ? '' : 's'} Recorded
            </span>
          </div>
          <Link
            href="/alerts"
            className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-[#22D3EE] hover:underline"
          >
            View All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Scrolling List of Events */}
      <div className="mt-4 space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {sortedAlerts.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <CheckCircle className="h-8 w-8 text-[#22C55E]/60 mb-2" />
            <p className="text-sm font-medium text-[#E6EDF7]">All Stations Nominal</p>
            <p className="text-xs text-[#8A9BB4] mt-1 max-w-sm">
              Zero industrial effluent anomalies or critical water quality excursions detected in recent telemetry.
            </p>
          </div>
        ) : (
          sortedAlerts.map((alert, idx) => {
            const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.warning;
            const Icon = config.icon;
            const AlgoIcon = alert.algorithm ? ALGORITHM_ICONS[alert.algorithm] || Cpu : Cpu;
            const alertDate = new Date(alert.timestamp);
            const timeString = alertDate.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            });

            return (
              <div
                key={alert.id || idx}
                className={`relative rounded-xl border p-3.5 transition-all duration-300 ${config.border} ${config.bg} animate-in fade-in slide-in-from-top-2 duration-300 hover:border-[#22D3EE]/50 hover:shadow-md`}
              >
                {/* Header line: Severity badge, Station, Algorithm tag, Timestamp */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0" style={{ color: config.color }} />
                    <span
                      className="text-[11px] font-bold tracking-wider uppercase font-mono px-1.5 py-0.5 rounded border"
                      style={{
                        color: config.color,
                        borderColor: `${config.color}55`,
                        backgroundColor: `${config.color}15`,
                      }}
                    >
                      {config.badgeText}
                    </span>
                    <span className="text-xs font-bold text-[#E6EDF7]">
                      {alert.stationName || `Station ${alert.stationId}`}
                    </span>
                    {alert.algorithm && (
                      <span className="hidden sm:inline-flex items-center gap-1 rounded bg-[#0B1220]/60 px-1.5 py-0.5 text-[10px] font-mono text-[#8A9BB4] border border-[#1E2C42]">
                        <AlgoIcon className="h-2.5 w-2.5 text-[#22D3EE]" />
                        {alert.algorithm}
                      </span>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-1 text-[11px] font-mono text-[#8A9BB4] shrink-0">
                    <Clock className="h-3 w-3" />
                    <span>{timeString}</span>
                  </div>
                </div>

                {/* Message */}
                <p className="mt-2 text-xs text-[#E6EDF7] font-semibold leading-snug">
                  {alert.message}
                </p>

                {/* Cause Hint (Plain-English Diagnostic) */}
                {alert.causeHint && (
                  <p className="mt-1 text-xs text-[#CBD5E1] leading-relaxed">
                    {alert.causeHint}
                  </p>
                )}

                {/* Footer metadata: Observed value vs Expected Range & Station Link */}
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1E2C42]/50 text-[11px]">
                  <div className="flex items-center gap-2 text-[#8A9BB4]">
                    <span>
                      Observed:{' '}
                      <span className="font-mono font-bold text-[#E6EDF7]">
                        {alert.observedValue !== undefined ? alert.observedValue : alert.value ?? '—'}
                      </span>
                    </span>
                    {alert.expectedRange && (
                      <span className="text-[10px] text-[#8A9BB4]">
                        (Baseline: <span className="font-mono text-[#22D3EE]">{alert.expectedRange}</span>)
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/station/${alert.stationId}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#22D3EE] hover:underline"
                  >
                    Station {alert.stationId} <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
