import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ido — Job Hunt HQ',
  description: 'Full-stack / product engineer openings across Berlin and Israel, with fit notes and a weekly playbook.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
