import { describe, expect, test } from 'bun:test';
import { newLoginFlow, openFlow, pkceChallenge, sealFlow, sameOrigin, trustedUrl } from '../apps/web/lib/auth-policy';
import { previewEnabled } from '../apps/web/lib/preview-data';
import { caseRecord, sourceItems } from '../apps/web/lib/live-records';
import { recordsCsv } from '../apps/web/lib/csv';
const key = '12'.repeat(32);
describe('login flow policies', () => {
  test('binds the state and PKCE verifier to a short-lived encrypted flow', () => { const flow = newLoginFlow('tenant-a'); expect(openFlow(sealFlow(flow, key), flow.state, key)).toEqual(flow); expect(pkceChallenge(flow.verifier)).toHaveLength(43); });
  test('rejects state substitution', () => { const flow = newLoginFlow('tenant-a'); expect(() => openFlow(sealFlow(flow, key), 'a'.repeat(43), key)).toThrow(); });
  test('rejects expired flows', () => { const flow = newLoginFlow('tenant-a'); expect(() => openFlow(sealFlow(flow, key), flow.state, key, flow.issuedAt + 300001)).toThrow(); });
  test('rejects weak cookie keys and foreign origins', () => { expect(() => sealFlow(newLoginFlow('tenant-a'), 'weak')).toThrow(); expect(sameOrigin('https://evil.example', 'https://console.example')).toBe(false); });
  test('requires trusted HTTPS except explicit local development', () => { expect(() => trustedUrl('http://identity.example', true)).toThrow(); expect(() => trustedUrl('http://localhost:3005', false)).toThrow(); expect(trustedUrl('http://localhost:3005', true).hostname).toBe('localhost'); expect(() => trustedUrl('https://user:password@example.com', false)).toThrow(); });
});
describe('data boundaries', () => {
  test('preview is denied for production even with its switch enabled', () => expect(previewEnabled({ CONSOLE_ENV: 'production', CONSOLE_PREVIEW_ENABLED: 'true' })).toBe(false));
  test('preview needs two explicit switches', () => { expect(previewEnabled({ CONSOLE_PREVIEW_ENABLED: 'true' })).toBe(false); expect(previewEnabled({ CONSOLE_ENV: 'preview', CONSOLE_PREVIEW_ENABLED: 'true' })).toBe(true); });
  test('case responses cannot cross tenant scope', () => expect(() => caseRecord({ id: 'c', title: 'Case', status: 'open', tenantId: 'tenant-b' }, 'tenant-a')).toThrow());
  test('malformed pages are not silent empty states', () => expect(() => sourceItems({})).toThrow());
  test('CSV export neutralizes formulas', () => { const row = caseRecord({ id: 'c', title: '=HYPERLINK("bad")', status: 'open', tenantId: 'tenant-a' }, 'tenant-a'); expect(recordsCsv([row])).toContain("'=HYPERLINK"); });
});
