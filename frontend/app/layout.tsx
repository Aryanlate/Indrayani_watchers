import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BottomTabBar from '@/components/BottomTabBar';
import AlertToast from '@/components/alerts/AlertToast';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Indrayani Watch — Real-time River Water Quality Monitoring',
  description: 'Community and IoT sensor network monitoring water quality, pollution anomalies, and alerts across the Indrayani River basin.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-[#0B1220] text-[#E6EDF7] font-sans antialiased selection:bg-[#22D3EE] selection:text-[#0B1220]">
        <div className="relative flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1 pb-4 md:pb-0">
            {children}
          </main>
          <Footer />
          <BottomTabBar />
          <AlertToast />

          {/* Visually-hidden ARIA live region for critical/warning alert announcements */}
          <div
            id="aria-live-alerts"
            role="status"
            aria-live="polite"
            aria-relevant="additions text"
            className="sr-only"
          />
        </div>
      </body>
    </html>
  );
}
