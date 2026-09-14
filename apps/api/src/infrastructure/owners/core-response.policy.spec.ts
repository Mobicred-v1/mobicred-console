import { randomUUID } from 'node:crypto';
import { projectCorePartnerResponse } from './core-response.policy';
import { partnerOwner } from './partner-workspace.client';
import { assertPartnerCommandReceipt } from './partner-command-receipt.policy';
import type { StaffRequest } from '../../shared/auth/staff-auth.guard';

const now = new Date().toISOString();
const partner = { partnerId: randomUUID(), partnerCode: 'alpha', displayName: 'Alpha', legalName: null, status: 'ACTIVE', countryCodes: ['CI'], updatedAt: now };
const list = { schemaVersion: 1, items: [partner], meta: { total: 1, page: 1, limit: 25 }, observedAt: now };
const credential = { partnerCode: 'alpha', tenantId: 'sandbox', credentialId: randomUUID(), credentialKey: 'pk_fixture', status: 'ACTIVE', scopes: ['customers:read'], expiresAt: null, lastUsedAt: null };
const wrap = (data: unknown) => ({ success: true, data, meta: { requestId: 'fixture', correlationId: 'fixture', timestamp: now, internalSecret: 'never-forward' }, token: 'never-forward' });
const issued = () => ({ schemaVersion: 1, action: 'issue_credential', partnerCode: 'alpha', tenantId: 'sandbox', receiptId: randomUUID(), replayed: false, secretAvailable: true, apiKey: `mk_${'a'.repeat(43)}`, credential: { ...credential } });
const issueCommand = { action: 'issue_credential', partnerCode: 'alpha', tenantId: 'sandbox', scopes: ['customers:read'], reason: 'Synthetic contract verification' };

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
    const data = issued();
    expect(projectCorePartnerResponse(wrap(data), 'command').apiKey).toBe(data.apiKey);
    expect(() => projectCorePartnerResponse(wrap({ ...data, replayed: true }), 'command')).toThrow();
  });
});

describe('partner HTTP adapter uses the Core envelope contract', () => {
  let original: string | undefined;
  const request = { headers: {}, verifiedToken: 'verified-fixture-token', staff: { staffId: 'staff-a', tenantId: '@mobicred', roles: ['ADMIN'], expiresAt: Date.now() + 60000 } } as StaffRequest;
  beforeEach(() => { original = process.env.CONSOLE_CORE_URL; process.env.CONSOLE_CORE_URL = 'https://core.example.test'; });
  afterEach(() => { jest.restoreAllMocks(); if (original === undefined) delete process.env.CONSOLE_CORE_URL; else process.env.CONSOLE_CORE_URL = original; });
  const response = (data: unknown) => new Response(JSON.stringify(wrap(data)), { status: 201, headers: { 'content-type': 'application/json' } });
  it('accepts the response as emitted by Core global middleware', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(response(list));
    expect((await partnerOwner(request, 'list')).items).toEqual([partner]);
  });
  it('does not silently accept the old unwrapped fixture shape', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(list), { headers: { 'content-type': 'application/json' } }));
    await expect(partnerOwner(request, 'list')).rejects.toMatchObject({ status: 503 });
  });
  it('delegates command keys through the standard X-Idempotency-Key header', async () => {
    const key = randomUUID();
    const receipt = { schemaVersion: 1, action: 'revoke_credential', partnerCode: 'alpha', tenantId: 'sandbox', receiptId: randomUUID(), replayed: false, secretAvailable: false, credential: { ...credential, status: 'REVOKED' } };
    const transport = jest.spyOn(globalThis, 'fetch').mockResolvedValue(response(receipt));
    await partnerOwner(request, 'command', { key, command: { action: 'revoke_credential', partnerCode: 'alpha', tenantId: 'sandbox', credentialKey: 'pk_fixture', reason: 'Synthetic contract verification' } });
    expect(transport.mock.calls[0][1]?.headers).toEqual(expect.objectContaining({ 'x-idempotency-key': key }));
    expect(transport.mock.calls[0][1]?.headers).not.toHaveProperty('idempotency-key');
  });
  it.each([
    { action: 'rotate_credential' }, { partnerCode: 'beta' }, { tenantId: 'production' },
    { secretAvailable: false, apiKey: undefined },
    { credential: { ...credential, scopes: ['users:write'] } },
  ])('does not confirm a mismatched or incomplete command result %j', async (patch) => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(response({ ...issued(), ...patch }));
    await expect(partnerOwner(request, 'command', { key: randomUUID(), command: issueCommand })).rejects.toMatchObject({ status: 503 });
  });
  it('returns a valid first issuance and a legitimate replay without a secret', async () => {
    const transport = jest.spyOn(globalThis, 'fetch');
    transport.mockResolvedValueOnce(response(issued()));
    expect((await partnerOwner(request, 'command', { key: randomUUID(), command: issueCommand })).secretAvailable).toBe(true);
    transport.mockResolvedValueOnce(response({ ...issued(), replayed: true, secretAvailable: false, apiKey: undefined }));
    const replay = await partnerOwner(request, 'command', { key: randomUUID(), command: issueCommand });
    expect(replay.replayed).toBe(true); expect(replay.apiKey).toBeUndefined();
  });
});

describe('action-specific owner receipts', () => {
  it('requires rotation to acknowledge exactly the requested old credential', () => {
    const command = { ...issueCommand, action: 'rotate_credential', credentialKey: 'pk_old' };
    const result = { ...issued(), action: 'rotate_credential', replacedCredentialKey: 'pk_old' };
    expect(() => assertPartnerCommandReceipt(result, command)).not.toThrow();
    expect(() => assertPartnerCommandReceipt({ ...result, replacedCredentialKey: 'pk_other' }, command)).toThrow();
    expect(() => assertPartnerCommandReceipt({ ...result, credential: { ...credential, credentialKey: 'pk_old' } }, command)).toThrow();
  });
  it('requires a revoked receipt for the exact credential, with no secret', () => {
    const command = { ...issueCommand, action: 'revoke_credential', credentialKey: 'pk_fixture' };
    const result = { ...issued(), action: 'revoke_credential', secretAvailable: false, apiKey: undefined, credential: { ...credential, status: 'REVOKED' } };
    expect(() => assertPartnerCommandReceipt(result, command)).not.toThrow();
    expect(() => assertPartnerCommandReceipt({ ...result, credential }, command)).toThrow();
    expect(() => assertPartnerCommandReceipt({ ...result, credential: { ...result.credential, credentialKey: 'pk_other' } }, command)).toThrow();
  });
  it('requires partner and environment creation results', () => {
    const command = { ...issueCommand, action: 'create_partner', environment: 'SANDBOX' };
    const result = { ...issued(), action: 'create_partner', secretAvailable: false, apiKey: undefined, partner, environment: { environment: 'SANDBOX', status: 'ACTIVE' } };
    expect(() => assertPartnerCommandReceipt(result, command)).not.toThrow();
    expect(() => assertPartnerCommandReceipt({ ...result, partner: undefined }, command)).toThrow();
    expect(() => assertPartnerCommandReceipt({ ...result, environment: { environment: 'PRODUCTION', status: 'ACTIVE' } }, command)).toThrow();
  });
});
