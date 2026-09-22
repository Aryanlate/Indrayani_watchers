import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import SiteShell from '@/components/SiteShell';

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
      <body className="min-h-dvh bg-[#0B1220] text-[#E6EDF7] font-sans antialiased selection:bg-[#22D3EE] selection:text-[#0B1220]">
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
