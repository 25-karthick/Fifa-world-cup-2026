import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StadiumPulse AI - Ops Command Center',
  description: 'FIFA World Cup 2026 Smart Stadium Telemetry and Real-Time AI Briefing Dashboard',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
