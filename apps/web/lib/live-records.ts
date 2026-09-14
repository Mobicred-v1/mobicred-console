import { statusTone, type ConsoleRecord, type OwnerSlice } from './console-model';
const text = (row: Record<string, unknown>, key: string, fallback = '') => typeof row[key] === 'string' ? (row[key] as string).slice(0, 500) : fallback;
const object = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid source'); return value as Record<string, unknown>; };
export function caseRecord(value: unknown, tenant: string, partnerCode?: string): ConsoleRecord {
  const row = object(value);
  if ((tenant !== '@mobicred' && row.tenantId !== tenant) || (partnerCode && row.partnerCode !== partnerCode) || typeof row.id !== 'string' || typeof row.title !== 'string' || typeof row.status !== 'string') throw new Error('Invalid case context');
  const kind = text(row, 'kind');
  return { id: row.id, title: row.title, subtitle: row.id, category: kind ? kind[0].toUpperCase() + kind.slice(1) : 'Case', status: row.status, tone: statusTone(row.status), owner: 'Mobicred investigations', updatedAt: text(row, 'updatedAt'), fields: { 'Customer reference': text(row, 'customerRef', 'Not linked'), 'Assigned staff': text(row, 'assignedStaffId', 'Unassigned'), Severity: text(row, 'severity'), Partner: text(row, 'partnerCode', 'Mobicred'), Environment: row.tenantId === '@mobicred' ? 'Platform' : text(row, 'tenantId', 'Not supplied'), 'Created at': text(row, 'createdAt') } };
}
export function ownerSlices(value: unknown): OwnerSlice[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => { const row = object(entry); const state = row.status; if (!['live', 'stale', 'unavailable', 'unauthorized'].includes(String(state))) throw new Error('Invalid source state'); return { owner: text(row, 'owner', 'Unknown source'), state: state as OwnerSlice['state'], status: state === 'live' ? 'Source available' : String(state), observedAt: text(row, 'observedAt'), detail: text(row, 'disagreement') }; });
}
export function creditRecord(value: unknown, tenant: string, partnerCode?: string): ConsoleRecord {
  const row = object(value);
  if ((tenant !== '@mobicred' && row.tenantid !== tenant) || (partnerCode && row.partnercode !== partnerCode) || typeof row.id !== 'string' || typeof row.score !== 'number' || !Number.isFinite(row.score)) throw new Error('Invalid score context');
  const band = text(row, 'band', 'Unspecified');
  return { id: row.id, title: `Assessment · ${text(row, 'subjectid', row.id)}`, subtitle: text(row, 'partnercode'), category: text(row, 'productcode', 'Scoring'), status: band, tone: statusTone(band), owner: 'Credit Intelligence', updatedAt: text(row, 'updatedAt', text(row, 'decidedat')), fields: { Score: String(row.score), 'Model version': text(row, 'modelversion', 'Not supplied'), Partner: text(row, 'partnercode'), Environment: text(row, 'tenantid'), 'Subject reference': text(row, 'subjectid'), 'Feature snapshot': text(row, 'featuresnapshotid'), 'Decision time': text(row, 'decidedat'), 'Core application': 'Not attached', Disbursement: 'No execution from this assessment view' } };
}
export function sourceItems(value: unknown): unknown[] { const row = object(value); if (!Array.isArray(row.items) || row.items.length > 100) throw new Error('Invalid page response'); return row.items; }
