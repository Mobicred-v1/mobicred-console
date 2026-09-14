import { Logo, Icon } from '../../../components/icons';
import { authConfigured } from '../../../lib/server-auth';
export const dynamic = 'force-dynamic';
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="auth-page"><section className="auth-card">
    <div className="brand"><Logo />Mobicred</div>
    <div className="eyebrow" style={{ marginTop: 30 }}>Operations console</div>
    <h1>Sign in to Mobicred</h1>
    <p>Your partners, customers and operations in one staff workspace.</p>
    {error && <div className="notice warning" role="alert">Sign-in could not be completed. Please try again or contact your administrator.</div>}
    {authConfigured() ? <form method="post" action="/auth/start"><button className="button primary" type="submit"><Icon name="lock" size={15} />Continue securely</button></form> : <div className="notice" role="status">Staff sign-in is temporarily unavailable. Contact your administrator.</div>}
    <p className="legal-note">For authorized Mobicred staff only.</p>
  </section></main>;
}
