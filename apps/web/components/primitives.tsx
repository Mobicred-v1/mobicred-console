'use client';
import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './icons';
import type { SourceState, Tone } from '../lib/console-model';
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) { return <span className={`badge ${tone}`}>{children}</span>; }
export function Modal({ title, children, close, drawer = false }: { title: string; children: ReactNode; close: () => void; drawer?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current; const previous = document.activeElement as HTMLElement | null;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { dialog?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} className={drawer ? 'drawer-dialog' : 'modal'} aria-label={title}
    onCancel={(event) => { event.preventDefault(); close(); }}
    onClick={(event) => { if (event.target !== ref.current) return; const bounds = ref.current.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close(); }}>
    <header className={drawer ? 'drawer-header' : ''}><div><div className="eyebrow">Mobicred Console</div><h2>{title}</h2></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={close}><Icon name="close" /></button></header>{children}
  </dialog>;
}
const titles: Partial<Record<SourceState, string>> = {
  unauthorized: 'Session verification required', forbidden: 'Access restricted',
  'not-configured': 'Access is not configured', 'not-found': 'Record not found', unavailable: 'Records are currently unavailable',
};
export function EmptyState({ state, detail, retry }: { state: SourceState; detail?: string; retry?: () => void }) {
  const denied = state === 'forbidden' || state === 'not-configured';
  return <div className="empty-state" data-source-state={state}>
    <div className="empty-icon"><Icon name={denied || state === 'unauthorized' ? 'lock' : 'database'} size={25} /></div>
    <h2>{titles[state] ?? 'No records in this workspace'}</h2>
    <p>{detail ?? (denied ? 'You are signed in. An administrator must grant or configure access to this capability.' : 'No records are available in the current result.')}</p>
    {state === 'unauthorized' ? <Link className="button primary" href="/auth/login">Verify session</Link> : retry ? <button type="button" className="button" onClick={retry}><Icon name="refresh" size={14} />Check again</button> : null}
    {denied && <Link className="button" href="/people">View my access</Link>}
  </div>;
}
