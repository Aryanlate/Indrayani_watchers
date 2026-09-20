'use client';

import React, { useEffect, useState } from 'react';
import { Card, LiveValue, StatusBadge } from '@/components/primitives';
import { Radio, AlertTriangle, AlertOctagon, Clock, CheckCircle2 } from 'lucide-react';
import { WaterStatus } from '@/components/primitives/StatusBadge';

interface WorstStationInfo {
  id: string;
  name: string;
  wqi: number;
  status: WaterStatus;
}

interface KpiRowProps {
  onlineCount: number;
  totalCount: number;
  activeAlertsCount: number;
  worstStation: WorstStationInfo | null;
  lastSyncTimestamp: number;
  isStreaming: boolean;
  pulseKey?: unknown;
}

export default function KpiRow({
  onlineCount,
  totalCount,
  activeAlertsCount,
  worstStation,
  lastSyncTimestamp,
  isStreaming,
  pulseKey,
}: KpiRowProps) {
  const [relativeTime, setRelativeTime] = useState<string>('Just now');

  // Live ticking relative time update every second
  useEffect(() => {
    const updateRelative = () => {
      const diffSeconds = Math.floor((Date.now() - lastSyncTimestamp) / 1000);
      if (diffSeconds <= 1) {
        setRelativeTime('Just now');
      } else if (diffSeconds < 60) {
        setRelativeTime(`${diffSeconds}s ago`);
      } else {
        const mins = Math.floor(diffSeconds / 60);
        setRelativeTime(`${mins}m ago`);
      }
    };

    updateRelative();
    const interval = setInterval(updateRelative, 1000);
    return () => clearInterval(interval);
  }, [lastSyncTimestamp]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* KPI 1: Stations Online */}
      <Card pulseKey={pulseKey} className="p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#8A9BB4]">
            Stations Online
          </span>
          <div className="flex items-center gap-1.5 rounded-full bg-[#22C55E]/10 px-2 py-0.5 text-xs text-[#22C55E] border border-[#22C55E]/20">
            <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-ping" />
            <span>100%</span>
          </div>
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <div className="text-3xl font-bold font-mono tracking-tight text-[#E6EDF7]">
            {onlineCount}/{totalCount}
          </div>
          <Radio className="h-5 w-5 text-[#22D3EE]" />
        </div>
        <div className="mt-2 text-xs text-[#8A9BB4] flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#22C55E]" />
          <span>All IoT telemetry nodes operational</span>
        </div>
      </Card>

      {/* KPI 2: Active Alerts */}
      <Card pulseKey={pulseKey} className="p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#8A9BB4]">
            Active Alerts
          </span>
          {activeAlertsCount > 0 ? (
            <span className="rounded-full bg-[#EF4444]/10 px-2 py-0.5 text-xs font-semibold text-[#EF4444] border border-[#EF4444]/20 animate-pulse">
              Requires attention
            </span>
          ) : (
            <span className="rounded-full bg-[#22C55E]/10 px-2 py-0.5 text-xs font-medium text-[#22C55E] border border-[#22C55E]/20">
              Clear
            </span>
          )}
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <div className="text-3xl font-bold font-mono tracking-tight text-[#E6EDF7]">
            <LiveValue value={activeAlertsCount} decimals={0} />
          </div>
          <AlertTriangle
            className={`h-5 w-5 ${
              activeAlertsCount > 0 ? 'text-[#EF4444]' : 'text-[#8A9BB4]'
            }`}
          />
        </div>
        <div className="mt-2 text-xs text-[#8A9BB4]">
          {activeAlertsCount > 0
            ? 'Industrial discharge & hypoxia events'
            : 'Basin parameters within nominal safety limits'}
        </div>
      </Card>

      {/* KPI 3: Worst Station Right Now */}
      <Card pulseKey={pulseKey} className="p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#8A9BB4]">
            Worst Station Right Now
          </span>
          {worstStation && (
            <StatusBadge status={worstStation.status} size="sm" />
          )}
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <div className="truncate pr-2">
            <span className="text-lg font-bold text-[#E6EDF7] block truncate">
              {worstStation ? `${worstStation.id} — ${worstStation.name.split(' ')[0]}` : 'N/A'}
            </span>
            <span className="text-xs font-mono text-[#8A9BB4]">
              WQI:{' '}
              <span className="font-semibold text-[#E6EDF7]">
                {worstStation ? worstStation.wqi.toFixed(1) : '—'}
              </span>
            </span>
          </div>
          <AlertOctagon className="h-5 w-5 text-[#F97316] shrink-0" />
        </div>
        <div className="mt-2 text-xs text-[#8A9BB4] truncate">
          {worstStation?.id === 'S4' || worstStation?.id === 'S5'
            ? 'Industrial corridor effluent hotspot'
            : 'Lowest current basin reading'}
        </div>
      </Card>

      {/* KPI 4: Last Sync */}
      <Card pulseKey={pulseKey} className="p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#8A9BB4]">
            Last Sync
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                isStreaming ? 'bg-[#22D3EE] animate-ping' : 'bg-[#22C55E]'
              }`}
            />
            <span className="text-[11px] font-mono text-[#22D3EE]">
              {isStreaming ? 'SSE Active' : '3s Polling'}
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <div className="text-3xl font-bold font-mono tracking-tight text-[#E6EDF7]">
            {relativeTime}
          </div>
          <Clock className="h-5 w-5 text-[#22D3EE]" />
        </div>
        <div className="mt-2 text-xs text-[#8A9BB4]">
          Telemetry refreshes in place every 3 seconds
        </div>
      </Card>
    </div>
  );
}
