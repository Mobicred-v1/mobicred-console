import { createHash } from 'node:crypto';

type Row = Record<string, unknown>;
function record(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid source record');
  return value as Row;
}
function text(value: unknown, max = 160): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('Invalid source field');
  return value;
}
function code(value: unknown): string {
  const result = text(value, 100);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(result)) throw new Error('Invalid source code');
  return result;
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid source count');
  return value;
}
function timestamp(value: unknown, now: number): string {
  if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value)) || Date.parse(value) > now + 60_000) throw new Error('Invalid source timestamp');
  return new Date(value).toISOString();
}

/** The owner query must be scoped and every aggregate row must retain that scope. */
export function scopedSourceQuality(value: unknown, tenantId: string, now = Date.now()) {
  const data = record(value);
  const filters = record(data.filters);
  if (filters.tenant_id !== tenantId || filters.partner_code !== null) throw new Error('Source scope mismatch');
  if (!Array.isArray(data.sources) || data.sources.length > 500) throw new Error('Invalid source inventory');
  const observedAt = timestamp(data.generated_at, now);
  const ids = new Set<string>();
  const items = data.sources.map((value) => {
    const row = record(value);
    if (row.tenant_id !== tenantId) throw new Error('Source tenant mismatch');
    const sourceCode = code(row.source_code);
    const partnerCode = code(row.partner_code);
    const id = createHash('sha256').update(JSON.stringify([tenantId, partnerCode, sourceCode])).digest('hex');
    if (ids.has(id)) throw new Error('Duplicate source');
    ids.add(id);
    const total = count(row.ingestion_job_count);
    const accepted = count(row.accepted_job_count);
    const failed = count(row.failed_job_count);
    if (accepted > total || failed > total - accepted) throw new Error('Inconsistent source counts');
    if (typeof row.is_active !== 'boolean' || typeof row.trust_level !== 'number' || !Number.isFinite(row.trust_level) || row.trust_level < 0) throw new Error('Invalid source state');
    return {
      id, tenantId, sourceCode, partnerCode, owner: text(row.owner), mode: text(row.ingestion_mode, 80),
      consentBasis: text(row.consent_basis), trustLevel: row.trust_level, active: row.is_active,
      total, accepted, failed,
      latestReceivedAt: row.latest_received_at === null ? null : timestamp(row.latest_received_at, now),
    };
  });
  return { source: 'credit-intelligence', tenantId, observedAt, fetchedAt: new Date(now).toISOString(),
    state: now - Date.parse(observedAt) > 300_000 ? 'stale' as const : 'live' as const, items };
}
