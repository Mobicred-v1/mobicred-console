import type { ConsoleData, ConsoleRecord } from './console-model';

type Row = Record<string, unknown>;
function row(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid platform response');
  return value as Row;
}
function str(value: unknown, max = 500): string {
  if (typeof value !== 'string' || value.length > max) throw new Error('Invalid platform field');
  return value;
}
function bool(value: unknown): boolean { if (typeof value !== 'boolean') throw new Error('Invalid flag'); return value; }
function num(value: unknown): number { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Invalid metric'); return value; }
function time(value: unknown): string { const result = str(value, 40); if (!Number.isFinite(Date.parse(result))) throw new Error('Invalid timestamp'); return result; }
function items(value: unknown): unknown[] { if (!Array.isArray(value) || value.length > 500) throw new Error('Invalid inventory'); return value; }

export function sourceQualityData(value: unknown, tenant: string): ConsoleData {
  const data = row(value);
  if (data.tenantId !== tenant || !['live', 'stale'].includes(String(data.state))) throw new Error('Invalid quality scope');
  const observedAt = time(data.observedAt);
  const records: ConsoleRecord[] = items(data.items).map((value) => {
    const source = row(value);
    if (source.tenantId !== tenant) throw new Error('Foreign quality source');
    const id = str(source.id, 64);
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Invalid source identity');
    const active = bool(source.active);
    const failed = num(source.failed);
    const lastReceived = source.latestReceivedAt === null ? '' : time(source.latestReceivedAt);
    const status = !active ? 'Inactive' : !lastReceived ? 'No deliveries' : failed > 0 ? 'Failures recorded' : 'Deliveries recorded';
    return {
      id, title: str(source.sourceCode, 100), subtitle: str(source.partnerCode, 100), category: str(source.mode, 80), status,
      tone: !active || !lastReceived ? 'neutral' : failed > 0 ? 'warning' : 'info', owner: str(source.owner, 160), updatedAt: lastReceived,
      fields: {
        Tenant: tenant, Partner: str(source.partnerCode), 'Source code': str(source.sourceCode),
        'Ingestion mode': str(source.mode), 'Consent basis': str(source.consentBasis), 'Trust level (owner scale)': String(num(source.trustLevel)),
        'Source active': active ? 'Yes' : 'No', 'Total jobs': String(num(source.total)), 'Accepted jobs': String(num(source.accepted)), 'Failed jobs': String(failed),
        'Last received': lastReceived || 'Never observed', 'Snapshot generated': observedAt,
        'Metric scope': 'Historical owner aggregates for this source; failures do not imply a current outage.',
        'Available actions': 'Read-only investigation. Reprocessing and source edits remain in the owner service.',
      },
      owners: [{ owner: 'Credit Intelligence', state: data.state === 'stale' ? 'stale' : 'live', status: 'Source quality snapshot', observedAt }],
    };
  });
  return { state: data.state === 'stale' ? 'stale' : 'live', items: records, observedAt, total: records.length };
}

export function capabilityData(value: unknown, tenant: string, section: 'people' | 'configuration' | 'operations'): ConsoleData {
  const data = row(value);
  if (data.tenantId !== tenant) throw new Error('Foreign capability scope');
  const observedAt = time(data.observedAt);
  const capabilities = items(data.items).map((value) => {
    const item = row(value);
    return { id: str(item.id, 80), label: str(item.label, 120), owner: str(item.owner, 120), enabled: bool(item.enabled), configured: bool(item.configured), granted: bool(item.granted), status: str(item.status, 80), observation: str(item.observation) };
  });
  if (section === 'people') {
    const roles = items(data.roles).map((role) => str(role, 120));
    const staffId = str(data.staffId, 200);
    const expires = num(data.expiresAt);
    return { state: 'live', observedAt, items: [{
      id: 'current-session', title: 'Your verified staff session', subtitle: staffId, category: 'Current identity only',
      status: 'Verified session', tone: 'info', owner: 'Keycloak', updatedAt: observedAt,
      fields: { 'Staff subject': staffId, Tenant: tenant, Roles: roles.join(', '), 'Expires at': new Date(expires).toISOString(),
        'Directory scope': 'Only the current identity is shown. Full staff and agency directories are not connected.',
        ...Object.fromEntries(capabilities.map((capability) => [capability.label, capability.status])),
      },
    }] };
  }
  const records: ConsoleRecord[] = capabilities.map((capability) => ({
    id: capability.id, title: capability.label, subtitle: capability.owner, category: 'Console capability policy',
    status: section === 'operations' ? 'Reachability untested' : capability.status, tone: 'neutral', owner: capability.owner, updatedAt: observedAt,
    fields: { Tenant: tenant, Enabled: capability.enabled ? 'Yes' : 'No', Configured: capability.configured ? 'Yes' : 'No',
      'Permitted for your session': capability.granted ? 'Yes' : 'No', 'Effective policy': capability.status,
      Observation: capability.observation, 'Change mechanism': 'Reviewed deployment configuration; no direct edits from this view.',
    },
  }));
  return { state: 'live', items: records, observedAt, total: records.length };
}
