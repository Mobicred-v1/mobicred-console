import type { Metadata } from 'next';
import './globals.css';
import './accessibility.css';
import './refinements.css';

export const metadata: Metadata = {
  title: { default: 'Mobicred Console', template: '%s · Mobicred' },
  description: 'A scoped staff workspace for customer, payment, credit and partner operations.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
