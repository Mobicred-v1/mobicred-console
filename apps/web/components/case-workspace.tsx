'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { Icon } from './icons';
import { CaseDetailDialog } from './case-detail-dialog';
import { newestCase, type CaseSnapshot } from '../lib/case-detail';
import { Badge, EmptyState, Modal } from './primitives';
import { formatTime, type ConsoleRecord, type ConsoleSession } from '../lib/console-model';
import type { CaseWorkspaceData } from '../lib/case-workspace-loader';
async function sendCommand(path: string, body: unknown, key: string, contextVersion: number) {
  const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': key, 'x-console-context-version': String(contextVersion) }, body: JSON.stringify(body) });
  if (!response.ok) {
    if (response.status === 409) throw new Error('The case or workspace changed. Reload before submitting.');
    if ([401, 403].includes(response.status)) throw new Error('Your staff session does not permit this action.');
    if (response.status === 400) throw new Error('Check the form values and provide a meaningful reason.');
    throw new Error('Outcome unconfirmed. Inspect the case or retry this request unchanged.');
  }
  const result = await response.json();
  if (typeof result.id !== 'string' || typeof result.receiptId !== 'string') throw new Error('Receipt unconfirmed. Inspect the case before another request.');
  return result as { id: string; version: number; receiptId: string; replayed: boolean };
}
export function CaseWorkspace({ data, session, initialRecord, compose = false }: { data: CaseWorkspaceData; session: ConsoleSession; initialRecord?: ConsoleRecord; compose?: boolean }) {
  const router = useRouter(); const [creating, setCreating] = useState(compose && data.canWrite); const [q, setQ] = useState(data.filters.q); const [notice, setNotice] = useState('');
  const contextVersion = session.contextVersion ?? 0;
  const [confirmed, setConfirmed] = useState<CaseSnapshot | null>(null);
  const detailRecord = initialRecord ? newestCase(initialRecord, confirmed) : undefined;
  const records = data.items.map((item) => newestCase(item, confirmed));
  function navigate(page: number, status = data.filters.status) { router.push(`/inbox?${new URLSearchParams({ page: String(page), ...(q ? { q } : {}), ...(status ? { status } : {}) })}`); }
  return <>
    <div className="page-heading"><div><div className="eyebrow">Operations workspace</div><h1>Investigation inbox</h1><p>{session?.partnerContext ? `Cases for ${session.partnerContext.partnerName} · ${session.partnerContext.displayName}.` : 'Investigations across Mobicred and all partners.'}</p></div><div className="actions"><button className="button" onClick={() => router.refresh()}><Icon name="refresh" size={14} />Refresh</button><button className="button primary" disabled={!data.canWrite} onClick={() => setCreating(true)}><Icon name="plus" size={14} />New investigation</button></div></div>
    {notice && <div className="notice" role="status">{notice}</div>}
    {data.state === 'live' ? <><div className="section-tabs" aria-label="Case status filter">{[['', 'All cases'], ['open', 'Open'], ['waiting', 'Waiting'], ['resolved', 'Resolved']].map(([status, label]) => <button key={status} className={data.filters.status === status ? 'active' : ''} aria-pressed={data.filters.status === status} onClick={() => navigate(1, status)}>{label}</button>)}</div><section className="panel"><form className="toolbar" onSubmit={(e) => { e.preventDefault(); navigate(1); }}><label className="table-search"><Icon name="search" size={14} /><input aria-label="Search authorized cases" placeholder="Search case title or reference…" value={q} maxLength={120} onChange={(e) => setQ(e.target.value)} /></label><button className="button">Search cases</button><span className="filter-summary">{data.total} matching cases</span></form><div className="table-scroll"><table><thead><tr><th>INVESTIGATION</th><th>PARTNER</th><th>TYPE</th><th>STATUS</th><th>SEVERITY</th><th>UPDATED</th><th>VERSION</th></tr></thead><tbody>{records.map((item) => <tr key={item.id}><td><Link className="record-link" href={`/inbox/${item.id}`}><span className="record-avatar"><Icon name="inbox" size={15} /></span><span><strong>{item.title}</strong><small>{item.id}</small></span></Link></td><td>{item.fields.Partner}<small style={{ display: 'block' }}>{item.fields.Environment}</small></td><td>{item.category}</td><td><Badge tone={item.tone}>{item.status}</Badge></td><td>{item.fields.Severity}</td><td>{formatTime(item.updatedAt)}</td><td>{item.fields.Version}</td></tr>)}{!data.items.length && <tr><td colSpan={7} className="table-empty">No matching cases in this workspace.</td></tr>}</tbody></table></div><div className="panel-footer"><span>{data.total} cases</span><div className="actions"><button className="button" disabled={data.page <= 1} onClick={() => navigate(data.page - 1)}>Previous</button><span>Page {data.page} of {Math.max(1, data.totalPages)}</span><button className="button" disabled={data.page >= data.totalPages} onClick={() => navigate(data.page + 1)}>Next</button></div></div></section></> : <section className="panel"><EmptyState state={data.state} detail={data.detail} retry={() => router.refresh()} /></section>}
    {creating && <NewCaseDialog contextVersion={contextVersion} contextLabel={session?.partnerContext ? `${session.partnerContext.partnerName} · ${session.partnerContext.displayName}` : 'Mobicred · platform'} close={() => setCreating(false)} saved={(id) => { setCreating(false); router.push(`/inbox/${id}`); }} />}
    {detailRecord && <CaseDetailDialog key={detailRecord.id} record={detailRecord} session={session} canWrite={data.canWrite && (confirmed?.canWrite ?? true)} close={() => router.push('/inbox')} confirmed={(snapshot, receiptId) => { setConfirmed(snapshot); setNotice(`Change recorded · ${receiptId}`); }} />}
  </>;
}
function NewCaseDialog({ close, saved, contextVersion, contextLabel }: { close: () => void; saved: (id: string) => void; contextVersion: number; contextLabel: string }) {
  const attempt = useRef<{ body: string; key: string } | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return; const fields = new FormData(e.currentTarget); const customerRef = String(fields.get('customerRef') ?? '').trim();
    const body = { title: String(fields.get('title')).trim(), kind: String(fields.get('kind')), severity: String(fields.get('severity')), reason: String(fields.get('reason')).trim(), ...(customerRef ? { customerRef } : {}) };
    const serialized = JSON.stringify(body);
    if (attempt.current && attempt.current.body !== serialized) { setError('Retry this form unchanged or inspect the inbox before starting a different request.'); return; }
    attempt.current ??= { body: serialized, key: crypto.randomUUID() }; setBusy(true); setError('');
    try { const result = await sendCommand('/api/cases', body, attempt.current.key, contextVersion); saved(result.id); }
    catch (err) { setError(err instanceof Error ? err.message : 'Outcome unconfirmed.'); } finally { setBusy(false); }
  }
  return <Modal title="New investigation" close={() => { if (!busy) close(); }}><form className="modal-body" onSubmit={submit}><p>Workspace: <strong>{contextLabel}</strong></p><label className="form-field">Case title<input name="title" minLength={5} maxLength={120} required disabled={busy} /></label><div className="detail-grid"><label className="form-field">Category<select name="kind" aria-label="Category" disabled={busy}><option value="payment">Payment</option><option value="customer">Customer</option><option value="credit">Credit</option><option value="partner">Partner</option></select></label><label className="form-field">Severity<select name="severity" aria-label="Severity" disabled={busy}><option value="medium">Medium</option><option value="high">High</option><option value="low">Low</option></select></label></div><label className="form-field">Customer reference (optional)<input name="customerRef" maxLength={96} pattern="[A-Za-z0-9:_-]+" disabled={busy} /></label><label className="form-field">Reason & context<textarea name="reason" minLength={10} maxLength={1000} required disabled={busy} placeholder="Describe the issue. Do not include credentials." /></label>{error && <div className="notice warning" role="alert">{error}</div>}<div className="modal-actions"><button className="button" type="button" onClick={close} disabled={busy}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Create investigation'}</button></div></form></Modal>;
}
