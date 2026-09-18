import { caseRecord } from './live-records';
import type { ConsoleRecord, ConsoleSession } from './console-model';

export type CaseSnapshot = { record: ConsoleRecord; canWrite: boolean };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validCaseId(id: string): boolean { return uuid.test(id); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid case response');
  return value as Record<string, unknown>;
}
/** Shared projection for initial SSR and post-command authoritative reads. */
export function caseSnapshot(value: unknown, session: ConsoleSession, id: string, minimumVersion = 1): CaseSnapshot {
  const result = object(value);
  const row = object(result.case);
  if (!validCaseId(id) || row.id !== id || result.contextVersion !== (session.contextVersion ?? 0) ||
      typeof result.canWrite !== 'boolean' || !Number.isSafeInteger(row.version) || Number(row.version) < minimumVersion ||
      !Array.isArray(result.notes) || result.notes.length > 100 || !['open', 'waiting', 'resolved'].includes(String(row.status))) {
    throw new Error('Case identity, context or committed revision could not be confirmed');
  }
  const record = caseRecord(row, session.tenant, session.partnerContext?.partnerCode);
  record.fields.Version = String(row.version);
  record.timeline = result.notes.map((value) => {
    const note = object(value);
    if (typeof note.author_id !== 'string' || typeof note.body !== 'string' || note.body.length > 2000 ||
        typeof note.created_at !== 'string' || !Number.isFinite(Date.parse(note.created_at))) throw new Error('Invalid case note');
    return { title: `Staff note · ${note.author_id}`, detail: note.body, time: note.created_at };
  });
  return { record, canWrite: result.canWrite };
}
/** A delayed router response cannot overwrite an already confirmed newer revision. */
export function newestCase(initial: ConsoleRecord, confirmed: CaseSnapshot | null): ConsoleRecord {
  return confirmed?.record.id === initial.id && Number(confirmed.record.fields.Version) >= Number(initial.fields.Version)
    ? confirmed.record : initial;
}
