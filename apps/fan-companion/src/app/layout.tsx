import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StadiumPulse AI - Fan Companion',
  description: 'FIFA World Cup 2026 Multilingual Smart Assistant and Wayfinding',
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
