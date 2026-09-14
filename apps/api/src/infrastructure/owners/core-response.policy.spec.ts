import { randomUUID } from 'node:crypto';
import { projectCorePartnerResponse } from './core-response.policy';
import { partnerOwner } from './partner-workspace.client';
import type { StaffRequest } from '../../shared/auth/staff-auth.guard';

const now = new Date().toISOString();
const partner = { partnerId: randomUUID(), partnerCode: 'alpha', displayName: 'Alpha', legalName: null, status: 'ACTIVE', countryCodes: ['CI'], updatedAt: now };
const list = { schemaVersion: 1, items: [partner], meta: { total: 1, page: 1, limit: 25 }, observedAt: now };
const wrap = (data: unknown) => ({ success: true, data, meta: { requestId: 'fixture', correlationId: 'fixture', timestamp: now, internalSecret: 'never-forward' }, token: 'never-forward' });

describe('actual Core success envelope', () => {
  it('unwraps the standard owner envelope and retains strict inner projection', () => {
    const result = projectCorePartnerResponse(wrap(list), 'list');
    expect(result.items).toEqual([partner]);
    expect(JSON.stringify(result)).not.toContain('never-forward');
    expect(result).not.toHaveProperty('success');
  });
  it('rejects unwrapped data, error envelopes and malformed wrappers', () => {
    for (const value of [list, null, {}, { ...wrap(list), success: false }, { ...wrap(list), success: 'true' }, { ...wrap(list), meta: [] }, wrap(null), wrap({ ...list, schemaVersion: 2 })]) {
      expect(() => projectCorePartnerResponse(value, 'list')).toThrow();
    }
  });
  it('keeps the first-issuance-only rule inside the envelope', () => {
    const data = { schemaVersion: 1, action: 'issue_credential', partnerCode: 'alpha', tenantId: 'sandbox', receiptId: randomUUID(), replayed: false, secretAvailable: true,
      apiKey: `mk_${'a'.repeat(43)}`, credential: { partnerCode: 'alpha', tenantId: 'sandbox', credentialId: randomUUID(), credentialKey: 'pk_fixture', status: 'ACTIVE', scopes: ['customers:read'], expiresAt: null, lastUsedAt: null } };
    expect(projectCorePartnerResponse(wrap(data), 'command').apiKey).toBe(data.apiKey);
    expect(() => projectCorePartnerResponse(wrap({ ...data, replayed: true }), 'command')).toThrow();
  });
});

describe('partner HTTP adapter uses the Core envelope contract', () => {
  let original: string | undefined;
  const request = { headers: {}, verifiedToken: 'verified-fixture-token', staff: { staffId: 'staff-a', tenantId: '@mobicred', roles: ['ADMIN'], expiresAt: Date.now() + 60000 } } as StaffRequest;
  beforeEach(() => { original = process.env.CONSOLE_CORE_URL; process.env.CONSOLE_CORE_URL = 'https://core.example.test'; });
  afterEach(() => { jest.restoreAllMocks(); if (original === undefined) delete process.env.CONSOLE_CORE_URL; else process.env.CONSOLE_CORE_URL = original; });
  it('accepts the response as emitted by Core global middleware', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(wrap(list)), { headers: { 'content-type': 'application/json' } }));
    expect((await partnerOwner(request, 'list')).items).toEqual([partner]);
  });
  it('does not silently accept the old unwrapped fixture shape', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(list), { headers: { 'content-type': 'application/json' } }));
    await expect(partnerOwner(request, 'list')).rejects.toMatchObject({ status: 503 });
  });
  it('delegates command keys through the standard X-Idempotency-Key header', async () => {
    const key = randomUUID();
    const receipt = { schemaVersion: 1, action: 'revoke_credential', partnerCode: 'alpha', tenantId: 'sandbox', receiptId: randomUUID(), replayed: false, secretAvailable: false };
    const transport = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(wrap(receipt)), { status: 201, headers: { 'content-type': 'application/json' } }));
    await partnerOwner(request, 'command', { key, command: { action: 'revoke_credential', partnerCode: 'alpha', tenantId: 'sandbox', credentialKey: 'pk_fixture', reason: 'Synthetic contract verification' } });
    expect(transport.mock.calls[0][1]?.headers).toEqual(expect.objectContaining({ 'x-idempotency-key': key }));
    expect(transport.mock.calls[0][1]?.headers).not.toHaveProperty('idempotency-key');
  });
});
