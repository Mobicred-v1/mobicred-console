'use client';
import { useState, type FormEvent } from 'react';
import { Modal } from './primitives';
import { Icon } from './icons';
import type { ConsoleSession } from '../lib/console-model';

type Partner = { partnerCode: string; displayName: string };
type Environment = { tenantId: string; displayName: string; environment: string; status: string };
export function PartnerContextControl({ session }: { session: ConsoleSession }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState(''); const [partners, setPartners] = useState<Partner[]>([]);
  const [selected, setSelected] = useState(''); const [environments, setEnvironments] = useState<Environment[]>([]); const [tenant, setTenant] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function search(event?: FormEvent) {
    event?.preventDefault(); setBusy(true); setError('');
    try { const response = await fetch(`/api/partners?${new URLSearchParams({ q })}`, { cache: 'no-store' }); if (!response.ok) throw new Error(); const result = await response.json(); if (!Array.isArray(result.items)) throw new Error(); setPartners(result.items); }
    catch { setError('Partner directory is unavailable or your role does not permit this view.'); }
    finally { setBusy(false); }
  }
  async function choose(code: string) {
    setSelected(code); setTenant(''); setEnvironments([]); setBusy(true); setError('');
    try { const response = await fetch(`/api/partners/${code}/context-options`, { cache: 'no-store' }); if (!response.ok) throw new Error(); const result = await response.json(); setEnvironments(result.tenants.filter((e: Environment) => e.status === 'ACTIVE')); }
    catch { setError('This partner has no available environment or could not be loaded.'); }
    finally { setBusy(false); }
  }
  async function change(global = false) {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/partners/context', { method: 'POST', headers: { 'content-type': 'application/json', 'x-console-context-version': String(session.contextVersion ?? 0) }, body: JSON.stringify(global ? { partnerCode: null } : { partnerCode: selected, tenantId: tenant }) });
      if (!response.ok) throw new Error(response.status === 409 ? 'Workspace changed in another tab. Reload before switching.' : 'The selected context could not be verified.');
      window.location.assign('/overview');
    } catch (err) { setError(err instanceof Error ? err.message : 'Context change failed.'); setBusy(false); }
  }
  return <><button className="tenant" aria-label="Switch partner context" onClick={() => { setOpen(true); void search(); }}>{session.partnerContext ? session.partnerContext.partnerName : 'Mobicred · all partners'}<Icon name="down" size={11} /></button>
    {open && <Modal title="Workspace context" close={() => { if (!busy) setOpen(false); }}><div className="modal-body">
      <p>Work across Mobicred or focus on a partner environment. Switching reloads your workspace and discards unsaved forms.</p>
      <button className="button" disabled={busy || !session.partnerContext} onClick={() => { void change(true); }}><Icon name="building" size={15} />Use all partners</button>
      <form className="toolbar" onSubmit={search}><label className="form-field">Find a partner<input value={q} maxLength={120} onChange={(e) => setQ(e.target.value)} placeholder="Partner name or code" /></label><button className="button" disabled={busy}>Search</button></form>
      <label className="form-field">Partner<select value={selected} disabled={busy} onChange={(e) => { void choose(e.target.value); }}><option value="">Choose a partner</option>{partners.map((p) => <option key={p.partnerCode} value={p.partnerCode}>{p.displayName} · {p.partnerCode}</option>)}</select></label>
      <label className="form-field">Environment<select value={tenant} disabled={busy || !selected} onChange={(e) => setTenant(e.target.value)}><option value="">Choose an environment</option>{environments.map((e) => <option key={e.tenantId} value={e.tenantId}>{e.displayName} · {e.environment}</option>)}</select></label>
      {error && <div className="notice warning" role="alert">{error}</div>}
      <div className="modal-actions"><button className="button primary" disabled={busy || !tenant || !selected} onClick={() => { void change(); }}>{busy ? 'Checking…' : 'Use partner context'}</button></div>
    </div></Modal>}
  </>;
}
