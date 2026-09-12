import { scopedSourceQuality } from './ingestion-read.policy';
const now = Date.parse('2026-09-11T12:00:00.000Z');
const source = { tenant_id: 'tenant-a', partner_code: 'partner-a', source_code: 'monthly', owner: 'Partner A', ingestion_mode: 'BATCH', consent_basis: 'consent', trust_level: 0.8, is_active: true, ingestion_job_count: 12, accepted_job_count: 10, failed_job_count: 2, latest_received_at: '2026-09-10T12:00:00.000Z' };
const sample = () => ({ generated_at: new Date(now).toISOString(), filters: { tenant_id: 'tenant-a', partner_code: null }, sources: [{ ...source }] });
describe('source quality isolation and normalization', () => {
  it('preserves aggregate counts and source timestamps', () => {
    const result = scopedSourceQuality(sample(), 'tenant-a', now);
    expect(result.items[0]).toEqual(expect.objectContaining({ tenantId: 'tenant-a', total: 12, accepted: 10, failed: 2 }));
    expect(result.state).toBe('live'); expect(result.items[0].id).toMatch(/^[a-f0-9]{64}$/);
  });
  it('fails closed on a different echoed tenant', () => expect(() => scopedSourceQuality(sample(), 'tenant-b', now)).toThrow());
  it('rejects the whole response, rather than filtering foreign rows', () => {
    const data = sample(); data.sources.push({ ...source, tenant_id: 'tenant-b' });
    expect(() => scopedSourceQuality(data, 'tenant-a', now)).toThrow();
  });
  it.each([{ ingestion_job_count: -1 }, { failed_job_count: 3 }, { accepted_job_count: 1.5 }, { source_code: '../secret' }, { is_active: 'true' }, { latest_received_at: 'not-a-date' }, { trust_level: Infinity }])('rejects malformed source fields %j', (patch) => {
    expect(() => scopedSourceQuality({ ...sample(), sources: [{ ...source, ...patch }] }, 'tenant-a', now)).toThrow();
  });
  it('rejects duplicate sources and excessive inventories', () => {
    expect(() => scopedSourceQuality({ ...sample(), sources: [source, source] }, 'tenant-a', now)).toThrow();
    expect(() => scopedSourceQuality({ ...sample(), sources: Array(501).fill(source) }, 'tenant-a', now)).toThrow();
  });
  it('does not invent freshness for an old snapshot or a never-used source', () => {
    const data = { ...sample(), generated_at: new Date(now - 600_000).toISOString(), sources: [{ ...source, latest_received_at: null }] };
    const result = scopedSourceQuality(data, 'tenant-a', now);
    expect(result.state).toBe('stale'); expect(result.items[0].latestReceivedAt).toBeNull();
  });
  it('drops unapproved fields including raw payloads and credentials', () => {
    const result = scopedSourceQuality({ ...sample(), sources: [{ ...source, secret: 'never-return', payload: { phone: 'never-return' } }] }, 'tenant-a', now);
    expect(JSON.stringify(result)).not.toContain('never-return');
  });
  it('accepts a legitimately empty scoped inventory', () => expect(scopedSourceQuality({ ...sample(), sources: [] }, 'tenant-a', now).items).toEqual([]));
});
