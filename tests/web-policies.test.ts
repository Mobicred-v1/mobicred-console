import { describe, expect, test } from 'bun:test';
import { newLoginFlow, openFlow, pkceChallenge, sealFlow, sameOrigin, trustedUrl } from '../apps/web/lib/auth-policy';
import { previewEnabled } from '../apps/web/lib/preview-data';
import { caseRecord, sourceItems } from '../apps/web/lib/live-records';
import { recordsCsv } from '../apps/web/lib/csv';
import { routeAccess } from '../apps/web/lib/route-access';
import { sessionFrom } from '../apps/web/lib/session-model';
const key = '12'.repeat(32);
describe('platform sign-in', () => {
  test('has no tenant selection and binds short-lived PKCE state', () => { const f = newLoginFlow(); expect(f).not.toHaveProperty('tenant'); expect(openFlow(sealFlow(f, key), f.state, key)).toEqual(f); expect(pkceChallenge(f.verifier)).toHaveLength(43); });
  test('rejects state substitution, expiry and weak encryption', () => { const f = newLoginFlow(); expect(() => openFlow(sealFlow(f, key), 'a'.repeat(43), key)).toThrow(); expect(() => openFlow(sealFlow(f, key), f.state, key, f.issuedAt + 300001)).toThrow(); expect(() => sealFlow(f, 'weak')).toThrow(); });
  test('requires exact origins and HTTPS outside loopback development', () => { expect(sameOrigin('https://evil.example', 'https://console.example')).toBe(false); expect(() => trustedUrl('http://identity.example', true)).toThrow(); expect(() => trustedUrl('http://localhost:3005', false)).toThrow(); expect(trustedUrl('http://localhost:3005', true).hostname).toBe('localhost'); expect(() => trustedUrl('https://user:password@example.com', false)).toThrow(); });
});
describe('default-deny routes and contexts', () => {
  test('protects every workspace, nested route, RSC path and extension-shaped API request', () => { for (const path of ['/overview', '/partners/alpha', '/api/cases', '/api/partners', '/unknown', '/overview.css', '/api/cases.json', '/auth/login/extra', '/_next/image']) expect(routeAccess(path, 'GET', false)).toBe('protected'); });
  test('only exact public paths/methods and actual build assets bypass session lookup', () => { expect(routeAccess('/auth/login', 'GET', false)).toBe('public'); expect(routeAccess('/auth/start', 'POST', false)).toBe('public'); expect(routeAccess('/auth/start', 'GET', false)).toBe('protected'); expect(routeAccess('/_next/static/chunk.js', 'GET', false)).toBe('public'); });
  test('production cannot enable preview with one flag', () => { expect(previewEnabled({ CONSOLE_ENV: 'production', CONSOLE_PREVIEW_ENABLED: 'true' })).toBe(false); expect(routeAccess('/preview/overview', 'GET', false)).toBe('not-found'); expect(previewEnabled({ CONSOLE_PREVIEW_ENABLED: 'true' })).toBe(false); expect(previewEnabled({ CONSOLE_ENV: 'preview', CONSOLE_PREVIEW_ENABLED: 'true' })).toBe(true); });
  test('global data preserves actual partner identity while focused contexts check both keys', () => { const r = { id: 'c', title: 'Case', status: 'open', tenantId: 'sandbox', partnerCode: 'beta' }; expect(caseRecord(r, '@mobicred').fields.Partner).toBe('beta'); expect(() => caseRecord(r, 'sandbox', 'alpha')).toThrow(); expect(() => caseRecord(r, 'production')).toThrow(); });
  test('session responses require expiry and a consistent server context', () => { const s = { name: 'Staff', tenant: '@mobicred', roles: ['OPS'], expiresAt: Date.now() + 60000, contextVersion: 0, partnerContext: null }; expect(sessionFrom(s).partnerContext).toBeNull(); expect(() => sessionFrom({ ...s, expiresAt: 1 })).toThrow(); expect(() => sessionFrom({ ...s, tenant: 'caller-tenant' })).toThrow(); });
  test('malformed pages are not silent success and CSV formulas are neutralized', () => { expect(() => sourceItems({})).toThrow(); expect(recordsCsv([caseRecord({ id: 'c', title: '=HYPERLINK("bad")', status: 'open', tenantId: '@mobicred' }, '@mobicred')])).toContain("'=HYPERLINK"); });
});
