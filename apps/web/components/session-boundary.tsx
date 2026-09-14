'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { StaffSession } from '../lib/session-model';

/** Close already-open tabs on expiry/revocation and discard forms on context changes. */
export function SessionBoundary({ session, children }: { session: StaffSession; children: ReactNode }) {
  const [blocked, setBlocked] = useState(false);
  const checking = useRef(false);
  const check = useCallback(async () => {
    if (checking.current) return;
    checking.current = true; setBlocked(true);
    try {
      const response = await fetch('/api/session-status', { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000) });
      if ([401, 403].includes(response.status)) { window.location.replace('/auth/login'); return; }
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (!result.authenticated || result.expiresAt <= Date.now()) { window.location.replace('/auth/login'); return; }
      if (result.contextVersion !== (session.contextVersion ?? 0)) { window.location.reload(); return; }
      setBlocked(false);
    } catch { setBlocked(true); }
    finally { checking.current = false; }
  }, [session.contextVersion]);
  useEffect(() => {
    const expires = session.expiresAt;
    const expire = expires ? setTimeout(() => window.location.replace('/auth/login'), Math.max(0, expires - Date.now())) : undefined;
    const focus = () => { if (!document.hidden) void check(); };
    const pageshow = () => { void check(); };
    window.addEventListener('focus', focus); window.addEventListener('pageshow', pageshow); document.addEventListener('visibilitychange', focus);
    const interval = setInterval(() => { if (!document.hidden) void check(); }, 60000);
    return () => { clearTimeout(expire); clearInterval(interval); window.removeEventListener('focus', focus); window.removeEventListener('pageshow', pageshow); document.removeEventListener('visibilitychange', focus); };
  }, [check, session.expiresAt]);
  return <><div hidden={blocked}>{children}</div>{blocked && <main className="auth-page"><section className="auth-card"><h1>Checking staff access</h1><p>Your workspace is locked until your session can be verified.</p><button className="button primary" onClick={() => { void check(); }}>Retry</button><form method="post" action="/auth/logout"><button className="button">Sign out</button></form></section></main>}</>;
}
