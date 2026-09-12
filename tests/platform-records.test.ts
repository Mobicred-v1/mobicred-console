import { describe, expect, test } from 'bun:test';
import { capabilityData, sourceQualityData } from '../apps/web/lib/platform-records';
const observedAt = '2026-09-11T12:00:00Z';
const source = { id: 'a'.repeat(64), tenantId: 'tenant-a', sourceCode: 'monthly', partnerCode: 'partner-a', mode: 'BATCH', owner: 'Partner', consentBasis: 'consent', trustLevel: 0.9, active: true, total: 5, accepted: 4, failed: 1, latestReceivedAt: observedAt };
describe('platform records', () => {
  test('maps live source quality without asserting current service health', () => {
    const data = sourceQualityData({ tenantId: 'tenant-a', state: 'live', observedAt, items: [source] }, 'tenant-a');
    expect(data.items[0].status).toBe('Failures recorded');
    expect(data.items[0].fields['Failed jobs']).toBe('1');
  });
  test('retains stale snapshots and never-observed deliveries', () => {
    const data = sourceQualityData({ tenantId: 'tenant-a', state: 'stale', observedAt, items: [{ ...source, latestReceivedAt: null }] }, 'tenant-a');
    expect(data.state).toBe('stale'); expect(data.items[0].updatedAt).toBe(''); expect(data.items[0].status).toBe('No deliveries');
  });
  test('rejects foreign tenant records', () => {
    expect(() => sourceQualityData({ tenantId: 'tenant-a', state: 'live', observedAt, items: [{ ...source, tenantId: 'tenant-b' }] }, 'tenant-a')).toThrow();
  });
  test('operations policy is never represented as a healthy-service probe', () => {
    const value = { tenantId: 'tenant-a', observedAt, items: [{ id: 'ingestion', label: 'Ingestion reads', owner: 'Credit', enabled: true, configured: true, granted: true, status: 'Permitted', observation: 'No health probe' }] };
    expect(capabilityData(value, 'tenant-a', 'operations').items[0].status).toBe('Reachability untested');
  });
  test('people view only describes the signed-in identity', () => {
    const value = { tenantId: 'tenant-a', staffId: 'staff-1', roles: ['OPS'], expiresAt: Date.now() + 60000, observedAt, items: [] };
    const data = capabilityData(value, 'tenant-a', 'people');
    expect(data.items).toHaveLength(1); expect(data.items[0].fields['Directory scope']).toContain('not connected');
  });
});
