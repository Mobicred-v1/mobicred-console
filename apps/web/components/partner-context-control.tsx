'use client';
import Link from 'next/link';
import { useStaffWorkspace } from './staff-session-provider';
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Modal } from './primitives';
import { Icon } from './icons';
import type { ConsoleSession } from '../lib/console-model';
import './operations-home.css';

type Partner = { partnerCode: string; displayName: string };
type Environment = { tenantId: string; displayName: string; environment: string; status: string };
export function PartnerContextControl({ session }: { session: ConsoleSession }) {
  const { changeContext } = useStaffWorkspace();
  const labelId = useId(); const requests = useRef<AbortController | null>(null); const mutating = useRef(false);
  const [open, setOpen] = useState(false); const [q, setQ] = useState(''); const [partners, setPartners] = useState<Partner[]>([]);
  const [selected, setSelected] = useState(''); const [environments, setEnvironments] = useState<Environment[]>([]); const [tenant, setTenant] = useState('');
  const [reading, setReading] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0 });
  const openDialog = useCallback(() => {
    if (mutating.current) return;
    requests.current?.abort(); const request = new AbortController(); requests.current = request;
    setOpen(true); setReading(true); setError(''); setQ(''); setSelected(''); setTenant(''); setEnvironments([]); setPartners([]); setPagination({ page: 1, limit: 25, total: 0 });
    void fetch('/api/partners?page=1', { cache: 'no-store', signal: request.signal }).then(async (response) => { if (!response.ok) throw new Error(); const result = await response.json(); if (!Array.isArray(result.items) || !Number.isSafeInteger(result.meta?.total)) throw new Error(); if (!request.signal.aborted) { setPartners(result.items); setPagination(result.meta); } }).catch(() => { if (!request.signal.aborted) setError('Partner directory is unavailable. Your staff session is unchanged.'); }).finally(() => { if (!request.signal.aborted) setReading(false); });
  }, []);
  useEffect(() => { window.addEventListener('mobicred:open-administration-scope', openDialog); return () => { requests.current?.abort(); window.removeEventListener('mobicred:open-administration-scope', openDialog); }; }, [openDialog]);
  async function search(page = 1, event?: FormEvent) {
    event?.preventDefault(); if (mutating.current) return;
    requests.current?.abort(); const request = new AbortController(); requests.current = request; setReading(true); setError(''); setSelected(''); setTenant(''); setEnvironments([]); setPartners([]); setPagination({ page, limit: 25, total: 0 });
    try { const response = await fetch(`/api/partners?${new URLSearchParams({ q, page: String(page) })}`, { cache: 'no-store', signal: request.signal }); if (!response.ok) throw new Error(); const result = await response.json(); if (!Array.isArray(result.items) || !Number.isSafeInteger(result.meta?.total)) throw new Error(); if (!request.signal.aborted) { setPartners(result.items); setPagination(result.meta); } }
    catch { if (!request.signal.aborted) setError('Partner directory is unavailable or your role does not permit this view.'); }
    finally { if (!request.signal.aborted) setReading(false); }
  }
  async function choose(code: string) {
    if (mutating.current) return;
    requests.current?.abort(); setSelected(code); setTenant(''); setEnvironments([]); setError('');
    if (!code) { setReading(false); return; }
    const request = new AbortController(); requests.current = request; setReading(true);
    try { const response = await fetch(`/api/partners/${encodeURIComponent(code)}/context-options`, { cache: 'no-store', signal: request.signal }); if (!response.ok) throw new Error(); const result = await response.json(); if (!Array.isArray(result.tenants)) throw new Error(); if (!request.signal.aborted) { setEnvironments(result.tenants.filter((environment: Environment) => environment.status === 'ACTIVE')); if (result.totals?.tenants > result.tenants.length) setError('Only the first 100 environments are available here. Open partner administration to review the inventory.'); } }
    catch { if (!request.signal.aborted) setError('Environments could not be loaded. Your current scope has not changed.'); }
    finally { if (!request.signal.aborted) setReading(false); }
  }
  async function change(global = false) {
    if (mutating.current) return; mutating.current = true; requests.current?.abort(); setReading(false); setSaving(true); setError('');
    try { await changeContext(global ? null : { partnerCode: selected, tenantId: tenant }); mutating.current = false; setSaving(false); setOpen(false); }
    catch (err) { setError(err instanceof Error ? err.message : 'Scope change failed.'); mutating.current = false; setSaving(false); }
  }
  function close() { if (mutating.current) return; requests.current?.abort(); setReading(false); setOpen(false); }
  return <><button className="admin-scope-trigger" aria-label="Switch partner context" onClick={openDialog}><Icon name="building" size={15} /><span><small>Administration scope · optional</small><strong>{session.partnerContext?.partnerName ?? 'All partners'}</strong></span><Icon name="down" size={11} /></button>
    {open && <Modal title="Administration scope" close={close}><div className="modal-body">
      <p>You are signed in as Mobicred staff. Select a partner environment to filter operational records, or keep the global workspace. This does not sign you into another account.</p>
      <div className="admin-global-choice"><strong>Mobicred · all partners</strong><p>Partner onboarding and the partner directory remain available in every scope.</p><button className="button" disabled={saving || !session.partnerContext} onClick={() => { void change(true); }}>Use all partners</button>{!session.partnerContext && <span className="partner-help"> Current workspace</span>}</div>
      <form className="toolbar" onSubmit={(event) => { void search(1, event); }}><label className="form-field">Find a partner<input aria-label="Find a partner" value={q} maxLength={120} onChange={(event) => setQ(event.target.value)} placeholder="Partner name or code" disabled={saving} /></label><button className="button" disabled={reading || saving}>Search</button></form>
      <div className="form-field"><label htmlFor={`${labelId}-partner`}>Partner</label><select id={`${labelId}-partner`} value={selected} disabled={reading || saving} onChange={(event) => { void choose(event.target.value); }}><option value="">Choose a partner</option>{partners.map((partner) => <option key={partner.partnerCode} value={partner.partnerCode}>{partner.displayName} · {partner.partnerCode}</option>)}</select></div>
      {pagination.total > pagination.limit && <div className="admin-scope-pagination"><button className="button" disabled={reading || saving || pagination.page <= 1} onClick={() => { void search(pagination.page - 1); }}>Previous partners</button><span>Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit)}</span><button className="button" disabled={reading || saving || pagination.page * pagination.limit >= pagination.total} onClick={() => { void search(pagination.page + 1); }}>More partners</button></div>}
      <div className="form-field"><label htmlFor={`${labelId}-environment`}>Environment</label><select id={`${labelId}-environment`} value={tenant} disabled={reading || saving || !selected} onChange={(event) => setTenant(event.target.value)}><option value="">Choose an environment</option>{environments.map((environment) => <option key={environment.tenantId} value={environment.tenantId}>{environment.displayName} · {environment.environment}</option>)}</select></div>
      {selected && !reading && !environments.length && !error && <p role="status">This partner has no active API environment. Add one from partner administration.</p>}
      {error && <div className="notice warning" role="alert">{error}</div>}
      <p className="partner-help">Changing scope updates operational records and discards unsaved forms. It does not change your staff permissions.</p>
      <div className="modal-actions"><button className="button" disabled={saving} onClick={close}>Cancel</button><button className="button primary" disabled={reading || saving || !tenant || !selected} onClick={() => { void change(); }}>{saving ? 'Applying…' : 'Use partner context'}</button></div><Link className="text-link" href="/partners" onClick={close}>Open partner administration<Icon name="arrow" size={13} /></Link>
    </div></Modal>}
  </>;
}
