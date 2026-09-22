'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BottomTabBar from '@/components/BottomTabBar';
import AlertToast from '@/components/alerts/AlertToast';

export default function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMapPage = pathname === '/map';

  return (
    <div className={`relative flex min-h-dvh flex-col ${isMapPage ? 'h-dvh overflow-hidden' : ''}`}>
      <Navbar />
      <main
        className={
          isMapPage
            ? 'relative min-h-0 flex-1 overflow-hidden pb-16 md:pb-0'
            : 'flex-1 pb-4 md:pb-0'
        }
      >
        {children}
      </main>
      {!isMapPage && <Footer />}
      <BottomTabBar />
      <AlertToast />
      <div
        id="aria-live-alerts"
        role="status"
        aria-live="polite"
        aria-relevant="additions text"
        className="sr-only"
      />
    </div>
  );
}
