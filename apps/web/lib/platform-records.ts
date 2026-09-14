import type { ConsoleData, ConsoleRecord } from './console-model';
type Row = Record<string, unknown>;
function row(v: unknown): Row { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid response'); return v as Row; }
function str(v: unknown, max = 500): string { if (typeof v !== 'string' || v.length > max) throw new Error('Invalid field'); return v; }
function bool(v: unknown): boolean { if (typeof v !== 'boolean') throw new Error('Invalid flag'); return v; }
function num(v: unknown): number { if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error('Invalid metric'); return v; }
function time(v: unknown): string { const t = str(v, 40); if (!Number.isFinite(Date.parse(t))) throw new Error('Invalid time'); return t; }
function list(v: unknown): unknown[] { if (!Array.isArray(v) || v.length > 500) throw new Error('Invalid inventory'); return v; }
export function sourceQualityData(value: unknown, tenant: string, partnerCode?: string): ConsoleData {
  const d = row(value);
  if (d.tenantId !== tenant || !['live', 'stale'].includes(String(d.state))) throw new Error('Invalid source scope');
  const observedAt = time(d.observedAt);
  const items: ConsoleRecord[] = list(d.items).map((value) => {
    const s = row(value);
    if ((tenant !== '@mobicred' && s.tenantId !== tenant) || (partnerCode && s.partnerCode !== partnerCode)) throw new Error('Foreign source');
    const id = str(s.id, 64); if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Invalid source ID');
    const active = bool(s.active); const failed = num(s.failed); const received = s.latestReceivedAt === null ? '' : time(s.latestReceivedAt);
    const status = !active ? 'Inactive' : !received ? 'No deliveries' : failed > 0 ? 'Failures recorded' : 'Deliveries recorded';
    return { id, title: str(s.sourceCode, 100), subtitle: str(s.partnerCode, 100), category: str(s.mode, 80), status, tone: failed > 0 && active ? 'warning' : 'neutral', owner: str(s.owner, 160), updatedAt: received,
      fields: { Partner: str(s.partnerCode), Environment: str(s.tenantId), 'Source code': str(s.sourceCode), 'Ingestion mode': str(s.mode), 'Consent basis': str(s.consentBasis), 'Trust level (owner scale)': String(num(s.trustLevel)), 'Source active': active ? 'Yes' : 'No', 'Total jobs': String(num(s.total)), 'Accepted jobs': String(num(s.accepted)), 'Failed jobs': String(failed), 'Last received': received || 'Never observed', 'Snapshot generated': observedAt, 'Metric scope': 'Historical source totals; failures are not a measurement of a current outage.' },
      owners: [{ owner: 'Credit Intelligence', state: d.state === 'stale' ? 'stale' : 'live', status: 'Source quality snapshot', observedAt }] };
  });
  return { state: d.state === 'stale' ? 'stale' : 'live', items, observedAt, total: items.length };
}
export function capabilityData(value: unknown, tenant: string, section: 'people' | 'configuration' | 'operations'): ConsoleData {
  const d = row(value); if (d.tenantId !== tenant) throw new Error('Invalid capability scope'); const observedAt = time(d.observedAt);
  const capabilities = list(d.items).map((value) => { const r = row(value); return { id: str(r.id, 80), label: str(r.label, 120), owner: str(r.owner, 120), enabled: bool(r.enabled), configured: bool(r.configured), granted: bool(r.granted), status: str(r.status, 80), observation: str(r.observation) }; });
  if (section === 'people') {
    const roles = list(d.roles).map((r) => str(r, 120)); const staffId = str(d.staffId, 255); const expiry = num(d.expiresAt);
    return { state: 'live', observedAt, items: [{ id: 'current-session', title: 'Your verified staff session', subtitle: staffId, category: 'Current staff identity', status: 'Verified session', tone: 'info', owner: 'Mobicred staff access', updatedAt: observedAt, fields: { 'Staff subject': staffId, Organization: 'Mobicred', Roles: roles.join(', '), 'Expires at': new Date(expiry).toISOString(), 'Directory scope': 'Current identity only. The full staff directory is not connected.', 'Working context': tenant === '@mobicred' ? 'All partners' : tenant, ...Object.fromEntries(capabilities.map((c) => [c.label, c.status])) } }] };
  }
  const items: ConsoleRecord[] = capabilities.map((c) => ({ id: c.id, title: c.label, subtitle: c.owner, category: 'Console capability', status: section === 'operations' ? 'Reachability untested' : c.status, tone: 'neutral', owner: c.owner, updatedAt: observedAt, fields: { Workspace: tenant === '@mobicred' ? 'Mobicred · all partners' : tenant, Enabled: c.enabled ? 'Yes' : 'No', Configured: c.configured ? 'Yes' : 'No', 'Permitted for your session': c.granted ? 'Yes' : 'No', 'Effective policy': c.status, Observation: c.observation } }));
  return { state: 'live', items, observedAt, total: items.length };
}
