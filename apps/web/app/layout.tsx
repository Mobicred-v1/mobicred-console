import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MobiCred Console',
  description:
    'Staff operations over Core, payments, and credit evidence. Not a second ledger.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
