'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './icons';
import type { SourceState, Tone } from '../lib/console-model';
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) { return <span className={`badge ${tone}`}>{children}</span>; }
export function Modal({ title, children, close, drawer = false }: { title: string; children: ReactNode; close: () => void; drawer?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; const previous = document.activeElement as HTMLElement | null; if (dialog && !dialog.open) dialog.showModal(); return () => { dialog?.close(); previous?.focus(); }; }, []);
  return <dialog ref={ref} className={drawer ? 'drawer-dialog' : 'modal'} aria-label={title} onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === ref.current) { const rect = ref.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(); } }}><header className={drawer ? 'drawer-header' : ''}><div><div className="eyebrow">Mobicred Console</div><h2>{title}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={close}><Icon name="close" /></button></header>{children}</dialog>;
}
export function EmptyState({ state, detail, retry }: { state: SourceState; detail?: string; retry?: () => void }) {
  const title = state === 'unauthorized' ? 'Your staff session is required' : state === 'unavailable' ? 'This source is not connected yet' : 'Nothing to show in this scope';
  return <div className="empty-state"><div className="empty-icon"><Icon name={state === 'unauthorized' ? 'lock' : 'database'} size={25} /></div><h2>{title}</h2><p>{detail ?? 'Once an authorized source is available, its records will appear here. No sample data is substituted.'}</p>{state === 'unauthorized' ? <a className="button primary" href="/auth/login"><Icon name="lock" size={14} />Sign in with Keycloak</a> : retry ? <button className="button" onClick={retry}><Icon name="refresh" size={14} />Check again</button> : null}<p className="legal-note">Source status and access scope remain explicit.</p></div>;
}
