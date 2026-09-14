import { createHash } from 'node:crypto';
import { PLATFORM_SCOPE } from '../../shared/auth/staff-token.policy';
type Row = Record<string, unknown>;
function record(v: unknown): Row { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid source'); return v as Row; }
function text(v: unknown, max = 160): string { if (typeof v !== 'string' || !v.trim() || v.length > max || /[\u0000-\u001f\u007f]/.test(v)) throw new Error('Invalid field'); return v; }
function code(v: unknown): string { const s = text(v, 100); if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(s)) throw new Error('Invalid code'); return s; }
function count(v: unknown): number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) throw new Error('Invalid count'); return v; }
function timestamp(v: unknown, now: number): string { if (typeof v !== 'string' || v.length > 40 || !Number.isFinite(Date.parse(v)) || Date.parse(v) > now + 60000) throw new Error('Invalid time'); return new Date(v).toISOString(); }
export function scopedSourceQuality(value: unknown, tenantId?: string, now = Date.now(), partnerCode?: string) {
  const data = record(value); const filters = record(data.filters);
  if (filters.tenant_id !== (tenantId ?? null) || filters.partner_code !== (partnerCode ?? null)) throw new Error('Scope mismatch');
  if (!Array.isArray(data.sources) || data.sources.length > 500) throw new Error('Invalid inventory');
  const observedAt = timestamp(data.generated_at, now); const ids = new Set<string>();
  const items = data.sources.map((value) => {
    const r = record(value); const tenant = code(r.tenant_id); const partner = code(r.partner_code); const source = code(r.source_code);
    if ((tenantId && tenantId !== tenant) || (partnerCode && partnerCode !== partner)) throw new Error('Foreign source');
    const id = createHash('sha256').update(JSON.stringify([tenant, partner, source])).digest('hex');
    if (ids.has(id)) throw new Error('Duplicate source'); ids.add(id);
    const total = count(r.ingestion_job_count); const accepted = count(r.accepted_job_count); const failed = count(r.failed_job_count);
    if (accepted > total || failed > total - accepted || typeof r.is_active !== 'boolean' || typeof r.trust_level !== 'number' || !Number.isFinite(r.trust_level) || r.trust_level < 0) throw new Error('Invalid state');
    return { id, tenantId: tenant, sourceCode: source, partnerCode: partner, owner: text(r.owner), mode: text(r.ingestion_mode, 80), consentBasis: text(r.consent_basis), trustLevel: r.trust_level, active: r.is_active, total, accepted, failed, latestReceivedAt: r.latest_received_at === null ? null : timestamp(r.latest_received_at, now) };
  });
  return { source: 'credit-intelligence', tenantId: tenantId ?? PLATFORM_SCOPE, partnerCode: partnerCode ?? null, observedAt, fetchedAt: new Date(now).toISOString(), state: now - Date.parse(observedAt) > 300000 ? 'stale' as const : 'live' as const, items };
}
