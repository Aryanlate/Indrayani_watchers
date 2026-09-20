'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRiverStore } from '@/lib/store';
import { apiClient } from '@/lib/apiClient';
import { Alert, AlertSeverity } from '@/lib/types';
import AlertRulesModal from '@/components/alerts/AlertRulesModal';
import {
  ShieldAlert,
  Sliders,
  Sparkles,
  Search,
  CheckCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  ArrowRight,
  CheckCircle2,
  Filter,
  Cpu,
  Activity,
  Shield,
  RefreshCw,
} from 'lucide-react';

const SEVERITY_CONFIG: Record<
  AlertSeverity,
  { label: string; badge: string; border: string; text: string; icon: typeof AlertTriangle }
> = {
  critical: {
    label: 'Critical',
    badge: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30',
    border: 'border-[#EF4444]/40 hover:border-[#EF4444]',
    text: 'text-[#EF4444]',
    icon: AlertTriangle,
  },
  warning: {
    label: 'Warning',
    badge: 'bg-[#F97316]/15 text-[#F97316] border-[#F97316]/30',
    border: 'border-[#F97316]/40 hover:border-[#F97316]',
    text: 'text-[#F97316]',
    icon: AlertCircle,
  },
  info: {
    label: 'Notice',
    badge: 'bg-[#22D3EE]/15 text-[#22D3EE] border-[#22D3EE]/30',
    border: 'border-[#22D3EE]/40 hover:border-[#22D3EE]',
    text: 'text-[#22D3EE]',
    icon: Info,
  },
};

const ALGORITHM_CONFIG: Record<
  string,
  { label: string; icon: typeof Cpu; color: string }
> = {
  'z-score': { label: 'Z-Score Outlier', icon: Cpu, color: 'text-[#22D3EE]' },
  'rate-of-change': { label: 'Rate-of-Change', icon: Activity, color: 'text-[#EF4444]' },
  threshold: { label: 'BIS Standard Limit', icon: Shield, color: 'text-[#FDE047]' },
  combined: { label: 'Combined Industrial Signature', icon: Activity, color: 'text-[#EF4444]' },
};

function getRelativeTimeString(dateStr: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${Math.floor(diffHour / 24)}d ago`;
}

export default function AlertsPage() {
  const { alerts, setAlerts, readAlertIds, markAlertAsRead, markAllAlertsRead, addAlert } =
    useRiverStore();

  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRulesModalOpen, setIsRulesModalOpen] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(alerts.length === 0);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      await apiClient.getAlerts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to connect to alerts service';
      console.warn('Failed to load initial alerts:', err);
      setFetchError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch initial alerts from backend if store has fewer than 3
  useEffect(() => {
    if (alerts.length === 0) {
      loadAlerts();
    }
  }, [alerts.length, loadAlerts]);

  // Handle simulation of critical alert
  const handleSimulateAlert = async () => {
    setIsSimulating(true);
    try {
      const res = await apiClient.post<Alert>('/api/alerts/simulate', {
        stationId: 'S4',
        parameter: 'do',
        severity: 'critical',
      });

      if (res.data) {
        addAlert(res.data);
      }
    } catch {
      // Fallback local simulated alert if backend offline
      const localSim: Alert = {
        id: `alert-local-sim-${Date.now()}`,
        stationId: 'S4',
        stationName: 'Chikhali (Bhosari MIDC)',
        severity: 'critical',
        parameter: 'multi',
        observedValue: 88.5,
        expectedRange: 'Turbidity ≤ 15.0 NTU, DO ≥ 5.0 mg/L',
        causeHint: 'Sharp turbidity surge (+140%) coupled with acute DO collapse (-48%) in 18 minutes — consistent with toxic industrial effluent dumping.',
        message: 'Industrial Effluent Discharge Signature Detected (Shockwave Outfall)',
        algorithm: 'rate-of-change',
        timestamp: new Date().toISOString(),
        acknowledged: false,
        resolved: false,
      };
      addAlert(localSim);
    } finally {
      setIsSimulating(false);
    }
  };

  // Toggle acknowledge state locally
  const handleAcknowledgeAlert = (alertId: string) => {
    markAlertAsRead(alertId);
    const updated = alerts.map((a) =>
      String(a.id) === alertId ? { ...a, acknowledged: true } : a
    );
    setAlerts(updated);
  };

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      // Severity filter
      if (selectedSeverity !== 'all' && alert.severity !== selectedSeverity) {
        return false;
      }

      // Station filter
      if (selectedStation !== 'all' && alert.stationId !== selectedStation) {
        return false;
      }

      // Algorithm filter
      if (selectedAlgorithm !== 'all' && alert.algorithm !== selectedAlgorithm) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchMsg = alert.message.toLowerCase().includes(q);
        const matchHint = alert.causeHint ? alert.causeHint.toLowerCase().includes(q) : false;
        const matchStation = (alert.stationName || alert.stationId).toLowerCase().includes(q);
        const matchParam = alert.parameter ? alert.parameter.toLowerCase().includes(q) : false;
        if (!matchMsg && !matchHint && !matchStation && !matchParam) return false;
      }

      return true;
    });
  }, [alerts, selectedSeverity, selectedStation, selectedAlgorithm, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
    const zScoreCount = alerts.filter((a) => a.algorithm === 'z-score').length;
    const rocCount = alerts.filter((a) => a.algorithm === 'rate-of-change').length;
    const unreadCount = alerts.filter((a) => !readAlertIds.includes(String(a.id))).length;

    return { criticalCount, zScoreCount, rocCount, unreadCount };
  }, [alerts, readAlertIds]);

  return (
    <div className="min-h-screen bg-[#0B1220] pb-24 pt-6">
      {/* Rules Modal */}
      <AlertRulesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-[#1E2C42] pb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-1 text-xs font-mono font-medium text-[#EF4444]">
              <ShieldAlert className="h-3 w-3 animate-pulse" />
              INTELLIGENT EFFLUENT ANOMALY SURVEILLANCE
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-[#E6EDF7]">
              Effluent Anomalies &amp; Basin Alert History
            </h1>
            <p className="mt-1 text-sm text-[#8A9BB4] max-w-3xl">
              Continuous multi-method detection engine combining 24-hour rolling Z-score statistical models,
              30-minute rate-of-change industrial discharge signatures, and statutory BIS IS 10500:2012 thresholds.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            <button
              onClick={() => setIsRulesModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#1E2C42] bg-[#121C2E] px-3.5 py-2 text-xs font-semibold text-[#CBD5E1] transition-all hover:border-[#22D3EE]/50 hover:text-[#22D3EE]"
            >
              <Sliders className="h-4 w-4 text-[#22D3EE]" />
              Alert Rules Settings
            </button>

            <button
              onClick={handleSimulateAlert}
              disabled={isSimulating}
              title="Trigger a simulated industrial effluent event to verify bottom-right toast notification"
              className="inline-flex items-center gap-2 rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/15 px-3.5 py-2 text-xs font-semibold text-[#FCA5A5] transition-all hover:bg-[#EF4444]/25 hover:border-[#EF4444]"
            >
              <Sparkles className="h-4 w-4 text-[#EF4444]" />
              {isSimulating ? 'Triggering...' : 'Simulate Anomaly'}
            </button>

            {stats.unreadCount > 0 && (
              <button
                onClick={markAllAlertsRead}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#1E2C42] bg-[#121C2E] px-3 py-2 text-xs font-medium text-[#8A9BB4] hover:text-[#E6EDF7] transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Fetch Error Banner */}
        {fetchError && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 p-3 text-xs text-[#FCA5A5]">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-[#EF4444]" />
              <span>Notice: {fetchError}.</span>
            </div>
            <button
              onClick={loadAlerts}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#EF4444]/40 bg-[#EF4444]/15 px-3 py-1.5 text-xs font-semibold text-[#FCA5A5] hover:bg-[#EF4444]/25 hover:border-[#EF4444] transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Retry load
            </button>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-xl border border-[#1E2C42] bg-[#121C2E] p-4">
            <span className="text-xs font-medium text-[#8A9BB4]">Total Logged Alerts</span>
            <div className="mt-1 font-mono text-2xl font-bold text-[#E6EDF7]">
              {alerts.length}
            </div>
            <span className="text-[11px] text-[#8A9BB4]">Full telemetry history</span>
          </div>

          <div className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 p-4">
            <span className="text-xs font-medium text-[#FCA5A5]">Critical Effluent Outfalls</span>
            <div className="mt-1 font-mono text-2xl font-bold text-[#EF4444]">
              {stats.criticalCount}
            </div>
            <span className="text-[11px] text-[#FCA5A5]/80">Immediate action required</span>
          </div>

          <div className="rounded-xl border border-[#22D3EE]/30 bg-[#22D3EE]/10 p-4">
            <span className="text-xs font-medium text-[#7DD3FC]">Rate-of-Change Signatures</span>
            <div className="mt-1 font-mono text-2xl font-bold text-[#22D3EE]">
              {stats.rocCount}
            </div>
            <span className="text-[11px] text-[#7DD3FC]/80">Sudden chemical dumping</span>
          </div>

          <div className="rounded-xl border border-[#FDE047]/30 bg-[#FDE047]/10 p-4">
            <span className="text-xs font-medium text-[#FDE047]">Z-Score Excursions</span>
            <div className="mt-1 font-mono text-2xl font-bold text-[#FDE047]">
              {stats.zScoreCount}
            </div>
            <span className="text-[11px] text-[#FDE047]/80">&gt; 2.5σ baseline deviation</span>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="rounded-xl border border-[#1E2C42] bg-[#121C2E]/60 p-4 backdrop-blur-md space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            {/* Severity Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-[#8A9BB4] mr-1 flex items-center gap-1">
                <Filter className="h-3.5 w-3.5 text-[#22D3EE]" /> Severity:
              </span>
              {[
                { id: 'all', label: 'All', count: alerts.length },
                { id: 'critical', label: 'Critical', count: stats.criticalCount },
                { id: 'warning', label: 'Warning', count: alerts.filter((a) => a.severity === 'warning').length },
                { id: 'info', label: 'Notice', count: alerts.filter((a) => a.severity === 'info').length },
              ].map((tab) => {
                const isSelected = selectedSeverity === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedSeverity(tab.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-[#22D3EE] bg-[#22D3EE]/15 text-[#22D3EE] font-bold'
                        : 'border-[#1E2C42] bg-[#0B1220] text-[#8A9BB4] hover:text-[#E6EDF7]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="rounded-full bg-[#1E2C42] px-1.5 py-0.2 font-mono text-[10px] text-[#CBD5E1]">
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Station Dropdown + Algorithm Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}
                className="rounded-lg border border-[#1E2C42] bg-[#0B1220] px-3 py-1.5 text-xs font-medium text-[#E6EDF7] focus:border-[#22D3EE] focus:outline-none"
              >
                <option value="all">All Monitoring Stations</option>
                <option value="S1">S1 — Dehu</option>
                <option value="S2">S2 — Alandi</option>
                <option value="S3">S3 — Moshi</option>
                <option value="S4">S4 — Chikhali (Bhosari MIDC)</option>
                <option value="S5">S5 — Charholi / Nirgudi</option>
                <option value="S6">S6 — Confluence (Tulapur)</option>
              </select>

              <select
                value={selectedAlgorithm}
                onChange={(e) => setSelectedAlgorithm(e.target.value)}
                className="rounded-lg border border-[#1E2C42] bg-[#0B1220] px-3 py-1.5 text-xs font-medium text-[#E6EDF7] focus:border-[#22D3EE] focus:outline-none"
              >
                <option value="all">All Algorithms</option>
                <option value="rate-of-change">Rate-of-Change (Effluent)</option>
                <option value="z-score">Z-Score Outlier (2.5σ)</option>
                <option value="threshold">Statutory BIS Breach</option>
              </select>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative w-full">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-3.5 w-3.5 text-[#8A9BB4]" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search alert causes, parameters, station names, or diagnostic descriptions..."
              className="w-full rounded-lg border border-[#1E2C42] bg-[#0B1220] py-2 pl-9 pr-4 text-xs text-[#E6EDF7] placeholder-[#8A9BB4]/60 transition-colors focus:border-[#22D3EE] focus:outline-none"
            />
          </div>
        </div>

        {/* Alerts List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="group relative flex flex-col justify-between rounded-xl border border-[#1E2C42] bg-[#121C2E] p-4 sm:p-5 animate-pulse"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="h-5 w-20 rounded-md bg-[#1E2C42]" />
                    <div className="h-4 w-32 rounded bg-[#1E2C42]" />
                    <div className="h-5 w-36 rounded-md bg-[#1E2C42]" />
                  </div>
                  <div className="h-4 w-24 rounded bg-[#1E2C42]" />
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="h-5 w-3/4 rounded bg-[#1E2C42]" />
                  <div className="h-4 w-full rounded bg-[#1E2C42]/70" />
                  <div className="h-4 w-5/6 rounded bg-[#1E2C42]/70" />
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#1E2C42] pt-3">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="h-4 w-28 rounded bg-[#1E2C42]/70" />
                    <div className="h-4 w-24 rounded bg-[#1E2C42]/70" />
                    <div className="h-4 w-36 rounded bg-[#1E2C42]/70" />
                  </div>
                  <div className="h-7 w-24 rounded-lg bg-[#1E2C42]" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredAlerts.length === 0 && alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#1E2C42] bg-[#121C2E]/40 py-20 text-center">
            <CheckCircle2 className="h-12 w-12 text-[#22C55E]/60 mb-2" />
            <h3 className="text-base font-semibold text-[#E6EDF7]">No Alerts Yet</h3>
            <p className="mt-1 text-xs text-[#8A9BB4] max-w-sm">
              All sensors nominal. Trigger a test anomaly to verify the alert pipeline and toast notification.
            </p>
            <button
              onClick={handleSimulateAlert}
              disabled={isSimulating}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/15 px-4 py-2 text-xs font-semibold text-[#FCA5A5] transition-all hover:bg-[#EF4444]/25 hover:border-[#EF4444]"
            >
              <Sparkles className="h-4 w-4 text-[#EF4444]" />
              {isSimulating ? 'Triggering...' : 'Simulate Anomaly'}
            </button>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#1E2C42] bg-[#121C2E]/40 py-20 text-center">
            <CheckCircle2 className="h-12 w-12 text-[#22C55E]/60 mb-2" />
            <h3 className="text-base font-semibold text-[#E6EDF7]">No Matching Alerts Found</h3>
            <p className="mt-1 text-xs text-[#8A9BB4] max-w-sm">
              All sensors nominal under the chosen filter criteria.
            </p>
            <button
              onClick={() => {
                setSelectedSeverity('all');
                setSelectedStation('all');
                setSelectedAlgorithm('all');
                setSearchQuery('');
              }}
              className="mt-4 rounded-lg border border-[#22D3EE]/40 bg-[#22D3EE]/10 px-4 py-2 text-xs font-semibold text-[#22D3EE] hover:bg-[#22D3EE]/20 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map((alert) => {
              const sevConfig = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.warning;
              const Icon = sevConfig.icon;
              const algo = alert.algorithm ? ALGORITHM_CONFIG[alert.algorithm] : null;
              const AlgoIcon = algo?.icon || Cpu;
              const isUnread = !readAlertIds.includes(String(alert.id));

              return (
                <div
                  key={alert.id}
                  className={`group relative flex flex-col justify-between rounded-xl border bg-[#121C2E] p-4 sm:p-5 transition-all duration-300 ${
                    sevConfig.border
                  } ${isUnread ? 'bg-[#121C2E] ring-1 ring-[#EF4444]/30' : 'bg-[#121C2E]/80'}`}
                >
                  {/* Top Bar: Badges, Station, Timestamp */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider ${sevConfig.badge}`}
                      >
                        <Icon className="h-3 w-3" />
                        {sevConfig.label}
                      </span>

                      <span className="font-mono text-xs font-bold text-[#E6EDF7]">
                        {alert.stationName || `Station ${alert.stationId}`}
                      </span>

                      {algo && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-[#1E2C42] bg-[#0B1220] px-2 py-0.5 text-[11px] font-mono text-[#CBD5E1]">
                          <AlgoIcon className={`h-3 w-3 ${algo.color}`} />
                          {algo.label}
                        </span>
                      )}

                      {isUnread && (
                        <span className="rounded-full bg-[#EF4444] px-1.5 py-0.2 font-mono text-[10px] font-bold text-white uppercase">
                          New
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-xs font-mono text-[#8A9BB4]">
                      <Clock className="h-3 w-3 text-[#22D3EE]" />
                      <span>{getRelativeTimeString(alert.timestamp)}</span>
                      <span className="text-[10px] text-[#8A9BB4]/60 hidden sm:inline">
                        ({new Date(alert.timestamp).toLocaleTimeString()})
                      </span>
                    </div>
                  </div>

                  {/* Headline & Plain-English Cause Hint */}
                  <div className="mt-3 space-y-1.5">
                    <h3 className="text-sm sm:text-base font-semibold text-[#E6EDF7]">
                      {alert.message}
                    </h3>
                    {alert.causeHint && (
                      <p className="text-xs text-[#CBD5E1] leading-relaxed">
                        {alert.causeHint}
                      </p>
                    )}
                  </div>

                  {/* Diagnostic Footer */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#1E2C42] pt-3 text-xs">
                    <div className="flex flex-wrap items-center gap-4 text-[#8A9BB4]">
                      <div>
                        Parameter:{' '}
                        <strong className="font-mono text-[#22D3EE] uppercase">
                          {alert.parameter || 'Multiple'}
                        </strong>
                      </div>
                      <div>
                        Observed:{' '}
                        <strong className="font-mono text-[#E6EDF7]">
                          {alert.observedValue !== undefined ? alert.observedValue : alert.value ?? '—'}
                        </strong>
                      </div>
                      {alert.expectedRange && (
                        <div>
                          Expected Baseline:{' '}
                          <strong className="font-mono text-[#CBD5E1]">
                            {alert.expectedRange}
                          </strong>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {!alert.acknowledged ? (
                        <button
                          onClick={() => handleAcknowledgeAlert(String(alert.id))}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#1E2C42] bg-[#0B1220] px-3 py-1 text-xs font-medium text-[#CBD5E1] hover:border-[#22D3EE]/50 hover:text-[#22D3EE] transition-colors"
                        >
                          <CheckCircle2 className="h-3 w-3 text-[#22C55E]" />
                          Acknowledge
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#22C55E] font-medium">
                          <CheckCircle2 className="h-3 w-3" /> Acknowledged
                        </span>
                      )}

                      <Link
                        href={`/station/${alert.stationId}`}
                        className="inline-flex items-center gap-1 font-semibold text-[#22D3EE] hover:underline text-xs"
                      >
                        Inspect Station <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
