import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { IngestionReadController } from './ingestion-read.controller';
import type { StaffRequest } from '../../shared/auth/staff-auth.guard';
import { readOwner } from './owner-read.transport';
jest.mock('./owner-read.transport', () => ({ readOwner: jest.fn() }));
const request: StaffRequest = { headers: {}, staff: { staffId: 'staff-a', tenantId: 'tenant-a', roles: ['OPS'], expiresAt: Date.now() + 60000 }, verifiedToken: 'verified-token' };
describe('ingestion adapter authorization', () => {
  const controller = new IngestionReadController();
  const original = { ...process.env };
  beforeEach(() => { jest.clearAllMocks(); process.env.CONSOLE_INGESTION_READS_ENABLED = 'true'; process.env.CONSOLE_INGESTION_READ_ROLES = 'OPS'; });
  afterEach(() => { process.env = { ...original }; });
  it('defaults to disabled before any owner request', async () => {
    delete process.env.CONSOLE_INGESTION_READS_ENABLED;
    await expect(controller.quality(request, {})).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(readOwner).not.toHaveBeenCalled();
  });
  it('denies missing or non-matching role grants before any owner request', async () => {
    process.env.CONSOLE_INGESTION_READ_ROLES = '';
    await expect(controller.quality(request, {})).rejects.toBeInstanceOf(ForbiddenException);
    process.env.CONSOLE_INGESTION_READ_ROLES = 'OTHER';
    await expect(controller.quality(request, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(readOwner).not.toHaveBeenCalled();
  });
  it('rejects client tenant or path overrides before any owner request', async () => {
    await expect(controller.quality(request, { tenant_id: 'tenant-b' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.quality(request, { path: '/unapproved' })).rejects.toBeInstanceOf(BadRequestException);
    expect(readOwner).not.toHaveBeenCalled();
  });
  it('passes only the verified scope and rejects invalid owner output', async () => {
    (readOwner as jest.Mock).mockResolvedValue({});
    await expect(controller.quality(request, {})).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(readOwner).toHaveBeenCalledWith(expect.objectContaining({ resource: 'ingestion', tenantId: 'tenant-a', token: 'verified-token' }));
  });
});
