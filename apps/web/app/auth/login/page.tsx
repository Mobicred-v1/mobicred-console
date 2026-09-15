import { redirect } from 'next/navigation';
import { Logo, Icon } from '../../../components/icons';
import { authConfigured, currentSession } from '../../../lib/server-auth';
export const dynamic = 'force-dynamic';
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  let signedIn = false;
  try { signedIn = Boolean(await currentSession()); } catch { /* Invalid/unavailable sessions never render staff content. */ }
  if (signedIn) redirect('/overview');
  return <main className="auth-page" data-staff-entry="platform"><section className="auth-card">
    <div className="brand"><Logo />Mobicred</div>
    <div className="eyebrow" style={{ marginTop: 30 }}>Operations console</div>
    <h1>Sign in to Mobicred</h1>
    <p>Use your Mobicred staff account to manage partners, customers and operations.</p>
    {error && <div className="notice warning" role="alert">Sign-in could not be completed. Please try again or contact your administrator.</div>}
    {authConfigured() ? <form method="post" action="/auth/start"><button className="button primary" type="submit"><Icon name="lock" size={15} />Continue securely</button></form> : <div className="notice" role="status">Staff sign-in is temporarily unavailable. Contact your administrator.</div>}
    <p className="legal-note">For authorized Mobicred staff only. Partner selection is optional and happens inside your workspace.</p>
  </section></main>;
}
