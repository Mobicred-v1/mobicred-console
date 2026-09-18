import { randomUUID } from 'node:crypto';
import { PartnerWorkspaceController } from './partner-workspace.controller';
import { partnerOwner } from './partner-workspace.client';
import type { StaffRequest } from '../../shared/auth/staff-auth.guard';
import type { ConsoleSessions } from '../../shared/sessions/console-sessions.service';

const stamp = new Date().toISOString();
const beta = { partnerId: randomUUID(), partnerCode: 'beta', displayName: 'Beta', legalName: null, status: 'ACTIVE', countryCodes: ['CI'], updatedAt: stamp };
const environment = { partnerCode: 'gamma', tenantId: 'gamma-sandbox', displayName: 'Gamma', environment: 'SANDBOX', status: 'ACTIVE', countryCodes: ['CI'] };
const request = (roles = ['ADMIN']) => ({ headers: {}, verifiedToken: 'verified-staff-fixture', staff: { staffId: 'staff-a', roles, tenantId: 'sandbox', expiresAt: Date.now() + 60000, contextVersion: 4, partnerContext: { partnerCode: 'alpha', tenantId: 'sandbox', partnerName: 'Alpha', displayName: 'Sandbox', environment: 'SANDBOX' } } }) as StaffRequest;
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data, meta: { requestId: 'fixture', timestamp: stamp } }), { status, headers: { 'content-type': 'application/json' } });

describe('global staff administration remains separate from operational context', () => {
  const controller = new PartnerWorkspaceController({} as ConsoleSessions);
  let previous: string | undefined;
  beforeEach(() => { previous = process.env.CONSOLE_CORE_URL; process.env.CONSOLE_CORE_URL = 'https://core.example.test'; });
  afterEach(() => { jest.restoreAllMocks(); if (previous === undefined) delete process.env.CONSOLE_CORE_URL; else process.env.CONSOLE_CORE_URL = previous; });
  it('opens another partner profile without impersonation or changing the session', async () => {
    const req = request(); const before = JSON.stringify(req.staff);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(response({ schemaVersion: 1, partner: beta, tenants: [], credentials: [], policies: [], totals: { tenants: 0, credentials: 0, policies: 0 }, observedAt: stamp }));
    const result = await controller.detail(req, 'beta');
    expect((result.partner as typeof beta).partnerCode).toBe('beta'); expect(JSON.stringify(req.staff)).toBe(before);
  });
  it('does not apply Alpha operational scope to Beta administration customer links', async () => {
    const transport = jest.spyOn(globalThis, 'fetch').mockResolvedValue(response({ schemaVersion: 1, partnerCode: 'beta', tenantId: null, items: [], meta: { page: 1, limit: 25, total: 0 }, observedAt: stamp }));
    await controller.customers(request(), 'beta');
    expect(String(transport.mock.calls[0][0])).toContain('/beta/customers'); expect(String(transport.mock.calls[0][0])).not.toContain('tenantId=');
  });
  it('onboards a new explicit partner while an operational filter is active', async () => {
    const req = request(['OPS']); const before = JSON.stringify(req.staff);
    const command = { action: 'create_partner', partnerCode: 'gamma', tenantId: 'gamma-sandbox', displayName: 'Gamma', environment: 'SANDBOX', scopes: ['customers:read'], countryCodes: ['CI'], ipAllowlist: ['203.0.113.8/32'], reason: 'Create a synthetic partner from global administration.' };
    const transport = jest.spyOn(globalThis, 'fetch').mockResolvedValue(response({ schemaVersion: 1, ...command, partner: { ...beta, partnerCode: 'gamma' }, environment, receiptId: randomUUID(), replayed: false, secretAvailable: false }, 201));
    const result = await partnerOwner(req, 'command', { key: randomUUID(), command });
    expect(result.partnerCode).toBe('gamma'); expect(JSON.parse(transport.mock.calls[0][1]?.body as string).tenantId).toBe('gamma-sandbox'); expect(JSON.stringify(req.staff)).toBe(before);
  });
  it('still rejects credential administration without the required role', async () => {
    const transport = jest.spyOn(globalThis, 'fetch');
    await expect(partnerOwner(request(['OPS']), 'command', { key: randomUUID(), command: { action: 'issue_credential', partnerCode: 'beta', tenantId: 'sandbox' } })).rejects.toMatchObject({ status: 403 });
    expect(transport).not.toHaveBeenCalled();
  });
  it('never treats selecting a partner as a staff role grant', async () => {
    const transport = jest.spyOn(globalThis, 'fetch');
    await expect(controller.detail(request(['customers:read']), 'beta')).rejects.toMatchObject({ status: 403 });
    expect(transport).not.toHaveBeenCalled();
  });
  it('retains owner-pair validation even for global staff administration', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(response({ schemaVersion: 1, partner: beta, tenants: [], credentials: [], policies: [], totals: { tenants: 0, credentials: 0, policies: 0 }, observedAt: stamp }));
    await expect(controller.detail(request(), 'gamma')).rejects.toMatchObject({ status: 503 });
  });
});
