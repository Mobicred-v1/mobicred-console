'use client';
import { createContext, startTransition, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { sessionFrom, type PartnerContext, type StaffSession } from '../lib/session-model';
import { sessionRevision } from '../lib/session-revision';

type WorkspaceSession = {
  session: StaffSession;
  changingContext: boolean;
  verify: (force?: boolean) => Promise<StaffSession | null>;
  changeContext: (partner: Pick<PartnerContext, 'partnerCode' | 'tenantId'> | null, destination?: string) => Promise<void>;
};
const Context = createContext<WorkspaceSession | null>(null);
export function useStaffWorkspace(): WorkspaceSession {
  const value = useContext(Context);
  if (!value) throw new Error('Staff workspace requires its authenticated layout');
  return value;
}

/** One verification/expiry lifecycle per staff workspace, not one per menu/page. */
export function StaffSessionProvider({ initialSession, children }: { initialSession: StaffSession; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState(initialSession);
  const latest = useRef(initialSession);
  const [locked, setLocked] = useState(false);
  const [changingContext, setChangingContext] = useState(false);
  const changing = useRef(false);
  const mounted = useRef(true);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const flight = useRef<Promise<StaffSession | null> | null>(null);

  const signIn = useCallback(() => {
    if (mounted.current) setLocked(true);
    window.location.replace('/auth/login');
  }, []);

  const verify = useCallback((force = false): Promise<StaffSession | null> => {
    if (!force && flight.current) return flight.current;
    if (!force && changing.current) return Promise.resolve(latest.current);
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const ticket = ++sequence.current;
    const timer = setTimeout(() => abort.abort(), 8000);
    const work = (async () => {
      try {
        const response = await fetch('/api/session-status', { cache: 'no-store', redirect: 'error', signal: abort.signal });
        if (ticket !== sequence.current || !mounted.current) return null;
        if (response.status === 401 || response.status === 403) { signIn(); return null; }
        if (!response.ok) throw new Error('Session verification unavailable');
        const value = await response.json();
        if (value.authenticated !== true) throw new Error('Invalid session status');
        const next = sessionFrom(value);
        if (ticket !== sequence.current || !mounted.current) return null;
        if ((next.staffId ?? next.name) !== (latest.current.staffId ?? latest.current.name)) { signIn(); return null; }
        if ((next.contextVersion ?? 0) < (latest.current.contextVersion ?? 0)) throw new Error('Stale session status');
        const changed = sessionRevision(next) !== sessionRevision(latest.current);
        latest.current = next;
        if (changed) { setSession(next); startTransition(() => router.refresh()); }
        setLocked(false);
        return next;
      } catch {
        if (ticket === sequence.current && mounted.current) setLocked(true);
        return null;
      } finally {
        clearTimeout(timer);
        if (ticket === sequence.current) flight.current = null;
      }
    })();
    flight.current = work;
    return work;
  }, [router, signIn]);

  const changeContext = useCallback(async (partner: Pick<PartnerContext, 'partnerCode' | 'tenantId'> | null, destination = '/overview') => {
    if (changing.current) return;
    if (!/^\/(overview|inbox|partners(?:\/[a-z0-9][a-z0-9_-]{1,63})?)$/.test(destination)) throw new Error('Invalid workspace destination');
    changing.current = true; setChangingContext(true);
    ++sequence.current; controller.current?.abort(); flight.current = null;
    try {
      const response = await fetch('/api/partners/context', {
        method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000),
        headers: { 'content-type': 'application/json', 'x-console-context-version': String(latest.current.contextVersion ?? 0) },
        body: JSON.stringify(partner ?? { partnerCode: null }),
      });
      if (!response.ok) {
        if (response.status === 401) signIn();
        throw new Error(response.status === 409 ? 'The context changed in another tab. Refresh and choose again.' : 'The operational filter could not be confirmed. Retry after refreshing.');
      }
      const next = await verify(true);
      if (!next) throw new Error('The updated staff session could not be verified.');
      startTransition(() => { router.replace(destination); router.refresh(); });
    } finally { changing.current = false; if (mounted.current) setChangingContext(false); }
  }, [router, signIn, verify]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; ++sequence.current; controller.current?.abort(); flight.current = null; };
  }, []);
  useEffect(() => {
    const expire = setTimeout(signIn, Math.max(0, (session.expiresAt ?? 0) - Date.now()));
    const focus = () => { if (!document.hidden) void verify(); };
    const restored = (event: PageTransitionEvent) => { if (event.persisted) void verify(true); };
    window.addEventListener('focus', focus); window.addEventListener('pageshow', restored); document.addEventListener('visibilitychange', focus);
    const interval = setInterval(focus, 60000);
    return () => { clearTimeout(expire); clearInterval(interval); window.removeEventListener('focus', focus); window.removeEventListener('pageshow', restored); document.removeEventListener('visibilitychange', focus); };
  }, [session.expiresAt, signIn, verify]);
  useEffect(() => { void verify(); }, [pathname, verify]);

  return <Context.Provider value={{ session, changingContext, verify, changeContext }}>
    {locked ? <main className="auth-page" data-session-lock="true"><section className="auth-card"><h1>Staff access temporarily unavailable</h1><p>Your workspace is locked until your session can be verified. Open dialogs and displayed secrets have been cleared.</p><button className="button primary" onClick={() => { void verify(true); }}>Retry</button><form method="post" action="/auth/logout"><button className="button">Sign out</button></form></section></main> : children}
  </Context.Provider>;
}
