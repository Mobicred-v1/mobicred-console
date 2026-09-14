import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { IngestionReadController } from './ingestion-read.controller';
import type { StaffRequest } from '../../shared/auth/staff-auth.guard';
const request: StaffRequest = { headers: {}, staff: { staffId: 'staff-a', tenantId: '@mobicred', roles: ['OPS'], expiresAt: Date.now() + 60000 }, verifiedToken: 'verified-token' };
describe('global and partner ingestion authorization', () => {
  const controller = new IngestionReadController(); const original = { ...process.env }; let transport: jest.SpyInstance;
  beforeEach(() => { process.env.CONSOLE_INGESTION_READS_ENABLED = 'true'; process.env.CONSOLE_INGESTION_READ_ROLES = 'OPS'; process.env.CONSOLE_CREDIT_URL = 'https://credit.example.test'; transport = jest.spyOn(globalThis, 'fetch'); });
  afterEach(() => { process.env = { ...original }; transport.mockRestore(); });
  it('defaults disabled and denies missing role grants before contacting an owner', async () => {
    delete process.env.CONSOLE_INGESTION_READS_ENABLED;
    await expect(controller.quality(request, {})).rejects.toBeInstanceOf(ServiceUnavailableException);
    process.env.CONSOLE_INGESTION_READS_ENABLED = 'true'; process.env.CONSOLE_INGESTION_READ_ROLES = '';
    await expect(controller.quality(request, {})).rejects.toBeInstanceOf(ForbiddenException); expect(transport).not.toHaveBeenCalled();
  });
  it('does not accept caller-selected tenant or service paths', async () => { await expect(controller.quality(request, { tenant_id: 'other' })).rejects.toBeInstanceOf(BadRequestException); expect(transport).not.toHaveBeenCalled(); });
  it('global staff request contains no artificial tenant filter', async () => {
    transport.mockResolvedValue(new Response(JSON.stringify({ generated_at: new Date().toISOString(), filters: { tenant_id: null, partner_code: null }, sources: [] }), { headers: { 'content-type': 'application/json' } }));
    const result = await controller.quality(request, {}); expect(result.tenantId).toBe('@mobicred');
    expect((transport.mock.calls[0][0] as URL).search).toBe('');
  });
  it('selected context adds both partner and environment and validates both', async () => {
    const context = { partnerCode: 'alpha', tenantId: 'sandbox', partnerName: 'Alpha', displayName: 'Sandbox', environment: 'SANDBOX' };
    transport.mockResolvedValue(new Response(JSON.stringify({ generated_at: new Date().toISOString(), filters: { tenant_id: 'sandbox', partner_code: 'alpha' }, sources: [] }), { headers: { 'content-type': 'application/json' } }));
    await controller.quality({ ...request, staff: { ...request.staff!, partnerContext: context, tenantId: 'sandbox' } }, {});
    const url = transport.mock.calls[0][0] as URL; expect(url.searchParams.get('tenant_id')).toBe('sandbox'); expect(url.searchParams.get('partner_code')).toBe('alpha');
  });
});
