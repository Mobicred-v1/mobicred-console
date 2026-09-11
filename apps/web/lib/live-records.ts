import { statusTone, type ConsoleRecord, type OwnerSlice } from './console-model';
const text = (row: Record<string, unknown>, key: string, fallback = '') => typeof row[key] === 'string' ? (row[key] as string).slice(0, 500) : fallback;
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid source object');
  return value as Record<string, unknown>;
};

export function caseRecord(value: unknown, tenant: string): ConsoleRecord {
  const row = object(value);
  if (row.tenantId !== tenant || typeof row.id !== 'string' || typeof row.title !== 'string' || typeof row.status !== 'string') throw new Error('Invalid or out-of-scope case');
  const kind = text(row, 'kind');
  return { id: row.id, title: row.title, subtitle: row.id, category: kind ? kind[0].toUpperCase() + kind.slice(1) : 'Case', status: row.status, tone: statusTone(row.status), owner: 'Console case management', updatedAt: text(row, 'updatedAt'), fields: { 'Customer reference': text(row, 'customerRef', 'Not linked'), 'Assigned staff': text(row, 'assignedStaffId', 'Unassigned'), Severity: text(row, 'severity'), Tenant: tenant, 'Created at': text(row, 'createdAt') }, related: [{ label: 'Customer workspace', section: 'customers' }] };
}

export function ownerSlices(value: unknown): OwnerSlice[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const row = object(entry);
    const state = row.status;
    if (!['live', 'stale', 'unavailable', 'unauthorized'].includes(String(state))) throw new Error('Invalid owner state');
    // Never invent a business status from transport availability.
    return { owner: text(row, 'owner', 'Unknown source'), state: state as OwnerSlice['state'], status: state === 'live' ? 'Source available; inspect owner record' : String(state), observedAt: text(row, 'observedAt'), detail: text(row, 'disagreement') };
  });
}

export function creditRecord(value: unknown, tenant: string): ConsoleRecord {
  const row = object(value);
  if (row.tenantid !== tenant || typeof row.id !== 'string' || typeof row.score !== 'number' || !Number.isFinite(row.score)) throw new Error('Invalid or out-of-scope score');
  const band = text(row, 'band', 'Unspecified');
  return { id: row.id, title: `Assessment · ${text(row, 'subjectid', row.id)}`, subtitle: text(row, 'partnercode'), category: text(row, 'productcode', 'Scoring'), status: band, tone: statusTone(band), owner: 'Credit Intelligence', updatedAt: text(row, 'updatedAt', text(row, 'decidedat')), fields: { Score: String(row.score), 'Model version': text(row, 'modelversion', 'Not supplied'), 'Partner reference': text(row, 'partnercode'), 'Subject reference': text(row, 'subjectid'), 'Feature snapshot': text(row, 'featuresnapshotid'), 'Decision time': text(row, 'decidedat'), 'Core application': 'Not observed by this read endpoint', Disbursement: 'Not observed; no execution authority' } };
}

export function sourceItems(value: unknown): unknown[] {
  const row = object(value);
  if (!Array.isArray(row.items) || row.items.length > 100) throw new Error('Invalid page response');
  return row.items;
}
