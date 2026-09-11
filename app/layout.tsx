import type { Metadata } from 'next';
import './globals.css';
import './hunter.css';

export const metadata: Metadata = {
  title: 'Job Hunter',
  description: 'Find your next role, one focused application at a time.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
