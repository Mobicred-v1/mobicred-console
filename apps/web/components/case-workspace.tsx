'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { ConsoleShell } from './console-shell';
import { Icon } from './icons';
import { Badge, EmptyState, Modal } from './primitives';
import { formatTime, type ConsoleRecord, type ConsoleSession } from '../lib/console-model';
import type { CaseWorkspaceData } from '../lib/case-workspace-loader';

async function sendCommand(path: string, body: unknown, key: string) {
  const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': key }, body: JSON.stringify(body) });
  if (!response.ok) {
    if (response.status === 409) throw new Error('The record or idempotency state changed. Reload the case before submitting a revised command.');
    if (response.status === 401 || response.status === 403) throw new Error('Your staff session does not permit this action. Sign in with an authorized identity.');
    if (response.status === 400) throw new Error('Check the form values and provide a meaningful reason.');
    throw new Error('The result could not be confirmed. Check the inbox or retry this form unchanged to reuse its idempotency key.');
  }
  const result = await response.json() as { id?: unknown; version?: unknown; receiptId?: unknown; replayed?: unknown };
  if (typeof result.id !== 'string' || typeof result.receiptId !== 'string') throw new Error('The command receipt could not be confirmed. Check the inbox before starting another request.');
  return result as { id: string; version: number; receiptId: string; replayed: boolean };
}

export function CaseWorkspace({ data, session, initialRecord, compose = false }: { data: CaseWorkspaceData; session?: ConsoleSession; initialRecord?: ConsoleRecord; compose?: boolean }) {
  const router = useRouter();
  const [creating, setCreating] = useState(compose && data.canWrite);
  const [query, setQuery] = useState(data.filters.q);
  const [status, setStatus] = useState(data.filters.status);
  const [notice, setNotice] = useState('');
  function navigate(page: number, nextStatus = status) {
    const params = new URLSearchParams({ page: String(page), ...(query ? { q: query } : {}), ...(nextStatus ? { status: nextStatus } : {}) });
    router.push(`/inbox?${params}`);
  }
  return <ConsoleShell section="inbox" preview={false} session={session}>
    <div className="page-heading"><div><div className="eyebrow">Operations workspace</div><h1>Investigation inbox</h1><p>Tenant-scoped cases, durable notes and independently verifiable command receipts.</p></div><div className="actions"><button className="button" onClick={() => router.refresh()}><Icon name="refresh" size={14} />Refresh</button><button className="button primary" disabled={!data.canWrite} onClick={() => setCreating(true)} title={!data.canWrite ? 'An enabled case workflow and an authorized write role are required' : undefined}><Icon name="plus" size={14} />New investigation</button></div></div>
    <div className="notice"><Icon name="shield" size={17} /><div><strong>Case resolution is not financial execution.</strong><p>These commands change only this console’s investigation records. They never move money, approve credit, or change provider states.</p></div></div>
    {notice && <div className="notice" role="status"><Icon name="check" size={17} /><p>{notice}</p></div>}
    {data.state === 'live' ? <>
      <div className="section-tabs" aria-label="Case status filter">{[['', 'All cases'], ['open', 'Open'], ['waiting', 'Waiting'], ['resolved', 'Resolved']].map(([value, label]) => <button key={value} className={data.filters.status === value ? 'active' : ''} aria-pressed={data.filters.status === value} onClick={() => { setStatus(value); navigate(1, value); }}>{label}</button>)}</div>
      <section className="panel"><form className="toolbar" onSubmit={(event) => { event.preventDefault(); navigate(1); }}><label className="table-search"><Icon name="search" size={14} /><input aria-label="Search authorized cases" placeholder="Search case title or reference…" value={query} maxLength={120} onChange={(event) => setQuery(event.target.value)} /></label><div className="actions"><button className="button" type="submit">Search all scoped cases</button><span className="filter-summary">{data.total} matching cases</span></div></form>
        <div className="table-scroll"><table><thead><tr><th>INVESTIGATION</th><th>TYPE</th><th>STATUS</th><th>SEVERITY</th><th>UPDATED</th><th>VERSION</th></tr></thead><tbody>{data.items.length ? data.items.map((item) => <tr key={item.id}><td><Link className="record-link" href={`/inbox/${item.id}`}><span className="record-avatar"><Icon name="inbox" size={15} /></span><span><strong>{item.title}</strong><small>{item.id}</small></span></Link></td><td>{item.category}</td><td><Badge tone={item.tone}>{item.status}</Badge></td><td>{item.fields.Severity}</td><td>{formatTime(item.updatedAt)}</td><td>{item.fields.Version}</td></tr>) : <tr><td colSpan={6} className="table-empty">No cases match this authorized scope.</td></tr>}</tbody></table></div>
        <div className="panel-footer"><span>Server-filtered and paginated · {data.total} cases</span><div className="actions"><button className="button" disabled={data.page <= 1} onClick={() => navigate(data.page - 1)}>Previous</button><span>Page {data.page} of {Math.max(1, data.totalPages)}</span><button className="button" disabled={data.page >= data.totalPages} onClick={() => navigate(data.page + 1)}>Next</button></div></div>
      </section>
    </> : <section className="panel"><EmptyState state={data.state} detail={data.detail} retry={() => router.refresh()} /></section>}
    {creating && <NewCaseDialog close={() => setCreating(false)} saved={(id, receipt) => { setCreating(false); setNotice(`Case saved. Audit receipt ${receipt}.`); router.push(`/inbox/${id}`); }} />}
    {initialRecord && <LiveCaseDetail record={initialRecord} canWrite={data.canWrite} close={() => router.push('/inbox')} saved={(receipt) => { setNotice(`Command committed with audit receipt ${receipt}.`); router.refresh(); }} />}
  </ConsoleShell>;
}

function NewCaseDialog({ close, saved }: { close: () => void; saved: (id: string, receipt: string) => void }) {
  const key = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const customerRef = String(fields.get('customerRef') ?? '').trim();
    key.current ??= crypto.randomUUID();
    setBusy(true); setError('');
    try {
      const result = await sendCommand('/api/cases', { title: String(fields.get('title')).trim(), kind: String(fields.get('kind')), severity: String(fields.get('severity')), reason: String(fields.get('reason')).trim(), ...(customerRef ? { customerRef } : {}) }, key.current);
      saved(result.id, result.receiptId);
    } catch (err) { setError(err instanceof Error ? err.message : 'The command result is unconfirmed.'); }
    finally { setBusy(false); }
  }
  return <Modal title="New investigation" close={close}><form className="modal-body" onSubmit={submit}>
    <label className="form-field">Case title<input name="title" minLength={5} maxLength={120} required placeholder="What needs investigating?" /></label>
    <div className="detail-grid"><label className="form-field">Category<select name="kind"><option value="payment">Payment</option><option value="customer">Customer</option><option value="credit">Credit</option><option value="partner">Partner</option></select></label><label className="form-field">Severity<select name="severity"><option value="medium">Medium</option><option value="high">High</option><option value="low">Low</option></select></label></div>
    <label className="form-field">Customer reference <span className="muted">(optional)</span><input name="customerRef" maxLength={96} pattern="[A-Za-z0-9:_-]+" placeholder="Internal reference, not a phone number" /></label>
    <label className="form-field">Reason & context<textarea name="reason" minLength={10} maxLength={1000} required placeholder="Describe the observed issue. Never include passwords or credentials." /></label>
    {error && <div className="notice warning" role="alert">{error}</div>}
    <p className="legal-note">The verified staff identity and tenant are assigned by the server. The case, initial note, audit event and idempotency receipt commit atomically.</p>
    <div className="modal-actions"><button className="button" type="button" onClick={close} disabled={busy}>Cancel</button><button className="button primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Create investigation'}</button></div>
  </form></Modal>;
}

function LiveCaseDetail({ record, canWrite, close, saved }: { record: ConsoleRecord; canWrite: boolean; close: () => void; saved: (receipt: string) => void }) {
  const [action, setAction] = useState('add_note');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const attempt = useRef<{ body: string; key: string } | null>(null);
  const version = Number(record.fields.Version);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !canWrite) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const body = { action, expectedVersion: version, reason: String(fields.get('reason')).trim(), ...(action === 'add_note' ? { note: String(fields.get('note')).trim() } : {}), ...(action === 'set_status' ? { status: String(fields.get('status')) } : {}) };
    const serialized = JSON.stringify(body);
    if (!attempt.current || attempt.current.body !== serialized) attempt.current = { body: serialized, key: crypto.randomUUID() };
    setBusy(true); setError('');
    try { const result = await sendCommand(`/api/cases/${record.id}/commands`, body, attempt.current.key); attempt.current = null; form.reset(); saved(result.receiptId); }
    catch (err) { setError(err instanceof Error ? err.message : 'The command result is unconfirmed.'); }
    finally { setBusy(false); }
  }
  return <Modal title={record.title} close={close} drawer><div className="drawer-body">
    <div className="row-line" style={{ marginBottom: 20 }}><span className="mono">{record.id}</span><Badge tone={record.tone}>{record.status}</Badge></div>
    <dl className="detail-grid">{Object.entries(record.fields).map(([label, value]) => <div className="detail-field" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {record.owners?.length ? <section className="panel" style={{ marginBottom: 22 }}><div className="panel-header"><h2>Linked owner availability</h2></div>{record.owners.map((owner) => <div className="owner-row" key={owner.owner}><strong>{owner.owner}</strong><span>{owner.status}</span><small>{owner.state} · {formatTime(owner.observedAt)}</small></div>)}</section> : <div className="notice"><Icon name="info" size={16} /><p>No linked customer reference or verified owner observation is attached to this case.</p></div>}
    <h2>Investigation notes</h2><p className="legal-note">Latest 100 notes. Notes are append-only; corrections are added as new notes.</p>
    <ol className="timeline">{record.timeline?.map((note, index) => <li key={index}><strong>{note.title}</strong><p style={{ whiteSpace: 'pre-wrap' }}>{note.detail}</p><small>{formatTime(note.time)}</small></li>)}</ol>
    <section className="panel"><div className="panel-header"><h2>Case commands</h2><Badge>{canWrite ? `Version ${version}` : 'Read-only role'}</Badge></div><form className="panel-body" onSubmit={submit}>
      <label className="form-field">Action<select value={action} onChange={(event) => setAction(event.target.value)} disabled={!canWrite || busy}><option value="add_note">Add an investigation note</option><option value="assign_to_me">Assign this case to me</option><option value="set_status">Change case status</option></select></label>
      {action === 'add_note' && <label className="form-field">Note<textarea name="note" minLength={1} maxLength={2000} required disabled={!canWrite || busy} /></label>}
      {action === 'set_status' && <label className="form-field">New status<select name="status" required disabled={!canWrite || busy}>{(['open', 'waiting', 'resolved'] as const).filter((status) => status !== record.status && !(record.status === 'resolved' && status === 'waiting')).map((status) => <option key={status}>{status}</option>)}</select></label>}
      <label className="form-field">Reason<textarea name="reason" minLength={10} maxLength={1000} required disabled={!canWrite || busy} placeholder="Explain why this case change is needed." /></label>
      {error && <div className="notice warning" role="alert">{error}</div>}
      <p className="legal-note">The service checks your write role and current case version. A stale version returns a conflict rather than overwriting someone else’s work.</p>
      <div className="modal-actions"><button className="button primary" type="submit" disabled={!canWrite || busy || !Number.isInteger(version)}>{busy ? 'Committing…' : 'Submit audited command'}</button></div>
    </form></section>
  </div></Modal>;
}
