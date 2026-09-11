import Link from 'next/link';
import { Logo, Icon } from '../../../components/icons';
import { authConfigured } from '../../../lib/server-auth';
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const configured = authConfigured();
  return <main className="auth-page"><section className="auth-card">
    <div className="brand"><Logo />Mobicred</div>
    <div className="eyebrow" style={{ marginTop: 30 }}>Staff access</div>
    <h1>Your operations. One secure workspace.</h1>
    <p>Continue with your staff identity. Tenant access is verified against your identity-provider grants, not granted by this form.</p>
    {error && <div className="notice warning" role="alert">Sign-in could not be completed. Your flow may have expired, or your staff role or tenant is not authorized.</div>}
    {configured ? <form method="post" action="/auth/start">
      <label className="form-field">Workspace tenant<input name="tenant" autoComplete="organization" maxLength={96} pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}" placeholder="Your assigned tenant identifier" required /></label>
      <button className="button primary" type="submit"><Icon name="lock" size={15} />Continue with Keycloak</button>
    </form> : <div className="notice"><Icon name="info" size={17} /><div><strong>Staff sign-in needs configuration.</strong><p>Ask your administrator to configure the Keycloak client, console origin, BFF endpoint and login-cookie key. No tokens or API keys should be pasted into this page.</p></div></div>}
    <p className="legal-note">Access tokens remain encrypted in server-side session storage. This browser receives only an opaque, HttpOnly session cookie.</p>
    <Link className="text-link" href="/overview">Back to console<Icon name="arrow" size={13} /></Link>
  </section></main>;
}
