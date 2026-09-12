import Link from 'next/link';
export default function NotFound() { return <main className="auth-page"><section className="auth-card"><div className="eyebrow">Mobicred Console</div><h1>Workspace not found.</h1><p>The view is unavailable, outside your scope, or the preview has not been enabled.</p><Link className="button primary" href="/overview">Return to overview</Link></section></main>; }
