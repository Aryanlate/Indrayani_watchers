'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { useRiverStore } from '@/lib/store';
import {
  Waves,
  Activity,
  Map,
  Newspaper,
  Info,
  Bell,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  CheckCheck,
  ArrowRight,
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { alerts, readAlertIds, markAllAlertsRead, markAlertAsRead } = useRiverStore();

  const [isLive, setIsLive] = useState<boolean | null>(null);
  const [secondsAgo, setSecondsAgo] = useState<number>(0);
  const [lastCheckTime, setLastCheckTime] = useState<number>(Date.now());
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isBellOpen, setIsBellOpen] = useState<boolean>(false);

  const bellRef = useRef<HTMLDivElement>(null);

  // Calculate unread alerts
  const unreadAlerts = alerts.filter((a) => !readAlertIds.includes(String(a.id)));
  const unreadCount = unreadAlerts.length;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setIsBellOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Poll backend health status
  const checkServerStatus = async () => {
    setIsChecking(true);
    try {
      const res = await apiClient.checkHealth();
      if (res.ok) {
        setIsLive(true);
        setLastCheckTime(Date.now());
        setSecondsAgo(0);
      } else {
        setIsLive(false);
      }
    } catch {
      setIsLive(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkServerStatus();

    const pollInterval = setInterval(() => {
      checkServerStatus();
    }, 15000);

    const tickerInterval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastCheckTime) / 1000));
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(tickerInterval);
    };
  }, [lastCheckTime]);

  const navLinks = [
    { name: 'Dashboard', href: '/', icon: Activity },
    { name: 'Live Map', href: '/map', icon: Map },
    { name: 'Alerts', href: '/alerts', icon: ShieldAlert, badge: unreadCount > 0 ? unreadCount : undefined },
    { name: 'News', href: '/news', icon: Newspaper },
    { name: 'About', href: '/about', icon: Info },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#1E2C42] bg-[#0B1220]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#1E2C42] bg-[#121C2E] transition-all duration-300 group-hover:border-[#22D3EE]/50">
              <Waves className="h-5 w-5 text-[#22D3EE]" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-[#E6EDF7] transition-colors group-hover:text-[#22D3EE] sm:text-lg">
                Indrayani Watch
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#8A9BB4]">
                River Telemetry Network
              </span>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center space-x-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${isActive
                    ? 'border border-[#1E2C42] bg-[#121C2E] text-[#22D3EE]'
                    : 'text-[#8A9BB4] hover:bg-[#121C2E]/60 hover:text-[#E6EDF7]'
                  }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-[#22D3EE]' : 'text-[#8A9BB4]'}`} />
                {link.name}
                {link.badge && (
                  <span className="ml-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#EF4444] px-1 font-mono text-[10px] font-bold text-white shadow-sm">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Section: Bell Icon + Live Status Pill */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Bell Icon with Unread Count & Dropdown */}
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => setIsBellOpen((prev) => !prev)}
              title={`${unreadCount} unread alerts`}
              className={`relative flex h-9 w-9 items-center justify-center rounded-lg border transition-all duration-200 ${isBellOpen || unreadCount > 0
                  ? 'border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444]'
                  : 'border-[#1E2C42] bg-[#121C2E] text-[#8A9BB4] hover:border-[#22D3EE]/40 hover:text-[#E6EDF7]'
                }`}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-[#EF4444] px-1 font-mono text-[10px] font-bold text-white shadow-md animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Unread Alerts Dropdown */}
            {isBellOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 overflow-hidden rounded-2xl border border-[#1E2C42] bg-[#121C2E]/95 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                <div className="flex items-center justify-between border-b border-[#1E2C42] px-4 py-3 bg-[#0B1220]/70">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-[#EF4444]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#E6EDF7]">
                      Effluent &amp; Anomaly Alerts
                    </span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-[#EF4444]/20 px-2 py-0.5 font-mono text-[10px] font-bold text-[#EF4444]">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAlertsRead}
                      className="flex items-center gap-1 text-[11px] font-medium text-[#22D3EE] hover:underline"
                    >
                      <CheckCheck className="h-3 w-3" /> Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-[#1E2C42]/50 p-1">
                  {alerts.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#8A9BB4]">
                      No active alerts recorded
                    </div>
                  ) : (
                    alerts.slice(0, 5).map((alert) => {
                      const isUnread = !readAlertIds.includes(String(alert.id));
                      const isCritical = alert.severity === 'critical';

                      return (
                        <div
                          key={alert.id}
                          onClick={() => {
                            markAlertAsRead(String(alert.id));
                            setIsBellOpen(false);
                            router.push(`/alerts?highlight=${alert.id}`);
                          }}
                          className={`group cursor-pointer p-3 transition-colors hover:bg-[#1A263D] ${isUnread ? 'bg-[#1E2C42]/30' : ''
                            }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {isCritical ? (
                                <AlertTriangle className="h-3.5 w-3.5 text-[#EF4444] shrink-0" />
                              ) : (
                                <AlertCircle className="h-3.5 w-3.5 text-[#F97316] shrink-0" />
                              )}
                              <span className="font-mono text-xs font-bold text-[#E6EDF7]">
                                {alert.stationName || `Station ${alert.stationId}`}
                              </span>
                            </div>
                            <span className="font-mono text-[10px] text-[#8A9BB4]">
                              {alert.algorithm || 'anomaly'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[#CBD5E1] line-clamp-1 leading-snug">
                            {alert.message}
                          </p>
                          {alert.causeHint && (
                            <p className="mt-0.5 text-[11px] text-[#8A9BB4] line-clamp-2">
                              {alert.causeHint}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="border-t border-[#1E2C42] bg-[#0B1220]/80 p-2.5 text-center">
                  <Link
                    href="/alerts"
                    onClick={() => setIsBellOpen(false)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#22D3EE] hover:underline"
                  >
                    View full alert history ({alerts.length}) <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Live Status Pill */}
          <button
            onClick={checkServerStatus}
            disabled={isChecking}
            title="Click to re-check API connection"
            className={`group inline-flex items-center gap-2 rounded-full border px-3 sm:px-3.5 py-1 text-xs font-medium transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isLive === true
                ? 'border-[#22C55E]/30 bg-[#22C55E]/10 text-[#22C55E]'
                : isLive === false
                  ? 'border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444]'
                  : 'border-[#FDE047]/30 bg-[#FDE047]/10 text-[#FDE047]'
              }`}
          >
            <span className="relative flex h-2 w-2">
              {isLive === true && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-75"></span>
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${isLive === true
                    ? 'bg-[#22C55E]'
                    : isLive === false
                      ? 'bg-[#EF4444]'
                      : 'bg-[#FDE047]'
                  }`}
              ></span>
            </span>

            <span className="font-mono tabular-nums text-[11px] sm:text-xs">
              {isLive === true
                ? `● LIVE — ${secondsAgo}s`
                : isLive === false
                  ? '● OFFLINE'
                  : '● CONNECTING...'}
            </span>
          </button>
        </div>
      </div>

    </header>
  );
}
