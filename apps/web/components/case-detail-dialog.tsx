'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Badge, Modal } from './primitives';
import { formatTime, type ConsoleRecord, type ConsoleSession } from '../lib/console-model';
import { caseSnapshot, validCaseId, type CaseSnapshot } from '../lib/case-detail';
import { readHttpJson } from '../lib/http-json';

type Receipt = { id: string; version: number; receiptId: string; replayed: boolean };
type Attempt = { key: string; body: string; receipt?: Receipt };

/** Writes are acknowledged separately from the authoritative read-back. No optimistic status. */
export function CaseDetailDialog({ record, session, canWrite, close, confirmed }: {
  record: ConsoleRecord; session: ConsoleSession; canWrite: boolean; close: () => void;
  confirmed: (snapshot: CaseSnapshot, receiptId: string) => void;
}) {
  const [action, setAction] = useState('add_note');
  const [phase, setPhase] = useState<'idle' | 'writing' | 'reading'>('idle');
  const [error, setError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [committed, setCommitted] = useState(false);
  const attempt = useRef<Attempt | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const formRef = useRef<HTMLFormElement>(null);
  const busy = phase !== 'idle';
  const version = Number(record.fields.Version);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function readBack(receipt: Receipt) {
    if (mounted.current) setPhase('reading');
    const response = await fetch(`/api/cases/${record.id}`, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('The change was recorded, but the updated case could not be read. Retry the read; do not repeat the command.');
    const snapshot = caseSnapshot(await readHttpJson(response, 300000), session, receipt.id, receipt.version);
    if (!mounted.current) return;
    attempt.current = null; setAttempted(false); setCommitted(false); setError('');
    formRef.current?.reset();
    confirmed(snapshot, receipt.receiptId);
  }

  async function execute() {
    const current = attempt.current;
    if (!current || inFlight.current) return;
    inFlight.current = true; setError('');
    try {
      if (!current.receipt) {
        if (!canWrite) throw new Error('Your staff role does not permit this command.');
        setPhase('writing');
        const response = await fetch(`/api/cases/${record.id}/commands`, {
          method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
          headers: { 'content-type': 'application/json', 'idempotency-key': current.key, 'x-console-context-version': String(session.contextVersion ?? 0) }, body: current.body,
        });
        if (response.status === 400) {
          attempt.current = null; if (mounted.current) setAttempted(false);
          throw new Error('The command was rejected. Check the values and correct the form.');
        }
        if (!response.ok) throw new Error(response.status === 409 ? 'The case or scope changed. Inspect the current case before another command.' : 'Outcome unconfirmed. Retry this exact request or inspect the case.');
        const value = await readHttpJson(response, 16384) as Receipt;
        if (value.id !== record.id || !validCaseId(value.receiptId) || !Number.isSafeInteger(value.version) || value.version <= version || typeof value.replayed !== 'boolean') throw new Error('Command receipt could not be confirmed. Retry the same request.');
        current.receipt = value;
        if (mounted.current) setCommitted(true);
      }
      await readBack(current.receipt);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'The result could not be verified.');
    } finally { inFlight.current = false; if (mounted.current) setPhase('idle'); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current || !canWrite || attempt.current) return;
    const fields = new FormData(event.currentTarget);
    const body = { action, expectedVersion: version, reason: String(fields.get('reason') ?? '').trim(),
      ...(action === 'add_note' ? { note: String(fields.get('note') ?? '').trim() } : {}),
      ...(action === 'set_status' ? { status: String(fields.get('status') ?? '') } : {}) };
    attempt.current = { key: crypto.randomUUID(), body: JSON.stringify(body) };
    setAttempted(true); await execute();
  }
  return <Modal title={record.title} close={() => { if (!inFlight.current) close(); }} drawer>
    <div className="drawer-body">
      <div className="row-line" style={{ marginBottom: 20 }}><span className="mono">{record.id}</span><Badge tone={record.tone}>{record.status}</Badge></div>
      <dl className="detail-grid">{Object.entries(record.fields).map(([label, value]) => <div className="detail-field" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <h2>Investigation notes</h2><p className="legal-note">Latest 100 notes. Corrections are recorded as new notes.</p>
      <ol className="timeline">{record.timeline?.map((note, index) => <li key={index}><strong>{note.title}</strong><p style={{ whiteSpace: 'pre-wrap' }}>{note.detail}</p><small>{formatTime(note.time)}</small></li>)}</ol>
      <section className="panel"><div className="panel-header"><h2>Case commands</h2><Badge>{canWrite ? `Version ${version}` : 'Read-only'}</Badge></div>
        <form ref={formRef} className="panel-body" onSubmit={submit}>
          <fieldset className="partner-command-fields" disabled={!canWrite || busy || attempted}>
            <label className="form-field">Action<select aria-label="Action" value={action} onChange={(event) => setAction(event.target.value)}><option value="add_note">Add an investigation note</option><option value="assign_to_me">Assign this case to me</option><option value="set_status">Change case status</option></select></label>
            {action === 'add_note' && <label className="form-field">Note<textarea name="note" minLength={1} maxLength={2000} required /></label>}
            {action === 'set_status' && <label className="form-field">New status<select name="status" aria-label="New status" required>{['open', 'waiting', 'resolved'].filter((status) => status !== record.status && !(record.status === 'resolved' && status === 'waiting')).map((status) => <option key={status}>{status}</option>)}</select></label>}
            <label className="form-field">Reason<textarea name="reason" minLength={10} maxLength={1000} required /></label>
          </fieldset>
          {error && <div className="notice warning" role="alert">{error}</div>}
          {committed && <p role="status">The command is recorded. Confirming the updated case before another change.</p>}
          <p className="legal-note">Resolving an investigation does not execute a payment or approve a loan.</p>
          <div className="modal-actions">{attempted
            ? <button className="button primary" type="button" disabled={busy} onClick={() => { void execute(); }}>{busy ? phase === 'reading' ? 'Updating case…' : 'Saving…' : committed ? 'Retry case read' : 'Retry same request'}</button>
            : <button className="button primary" type="submit" disabled={!canWrite || busy || !Number.isSafeInteger(version)}>Submit audited command</button>}
          </div>
        </form>
      </section>
    </div>
  </Modal>;
}
