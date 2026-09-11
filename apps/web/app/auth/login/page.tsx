import Link from 'next/link';
import { Logo } from '../../../components/icons';
export default function LoginPage() { return <main className="auth-page"><section className="auth-card"><div className="brand"><Logo />Mobicred</div><div className="eyebrow" style={{ marginTop: 30 }}>Staff access</div><h1>A secure workspace for your operations.</h1><p>Staff sign-in is not configured in this design-only change. The authenticated Keycloak session is supplied by the next PR. Do not paste tokens or API keys here.</p><Link className="button" href="/overview">Return to console</Link></section></main>; }
