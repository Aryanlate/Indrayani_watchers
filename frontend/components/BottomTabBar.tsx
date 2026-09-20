'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRiverStore } from '@/lib/store';
import {
  Activity,
  Map,
  ShieldAlert,
  Newspaper,
  Info,
} from 'lucide-react';

interface TabItem {
  name: string;
  href: string;
  icon: typeof Activity;
  badge?: number;
}

export default function BottomTabBar() {
  const pathname = usePathname();
  const { alerts, readAlertIds } = useRiverStore();

  const unreadCount = alerts.filter((a) => !readAlertIds.includes(String(a.id))).length;

  const tabs: TabItem[] = [
    { name: 'Dashboard', href: '/', icon: Activity },
    { name: 'Map', href: '/map', icon: Map },
    {
      name: 'Alerts',
      href: '/alerts',
      icon: ShieldAlert,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    { name: 'News', href: '/news', icon: Newspaper },
    { name: 'About', href: '/about', icon: Info },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-[#1E2C42] bg-[#0B1220]/95 backdrop-blur-md"
      role="navigation"
      aria-label="Primary navigation (mobile)"
    >
      <ul className="flex items-center justify-around h-16 max-w-full mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            tab.href === '/' ? pathname === '/' : pathname?.startsWith(tab.href);
          return (
            <li key={tab.name} className="flex-1 h-full">
              <Link
                href={tab.href}
                className={`relative flex h-full w-full flex-col items-center justify-center gap-0.5 transition-colors duration-150 ${
                  isActive ? 'text-[#22D3EE]' : 'text-[#8A9BB4] hover:text-[#E6EDF7]'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Active top border indicator */}
                <span
                  className={`absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full transition-all duration-150 ${
                    isActive ? 'bg-[#22D3EE] opacity-100' : 'opacity-0'
                  }`}
                  aria-hidden="true"
                />
                <div className="relative flex items-center justify-center">
                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 2} />
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span
                      className="absolute -top-2 -right-3 flex min-w-[1.125rem] h-4 items-center justify-center rounded-full bg-[#EF4444] px-1 font-mono text-[9px] font-bold text-white shadow-md"
                      aria-label={`${tab.badge} unread alerts`}
                    >
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium ${
                    isActive ? 'font-semibold' : ''
                  }`}
                >
                  {tab.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
