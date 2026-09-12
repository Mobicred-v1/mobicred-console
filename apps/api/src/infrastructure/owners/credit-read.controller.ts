import { Controller, ForbiddenException, Get, Header, Req, ServiceUnavailableException } from '@nestjs/common';
import type { StaffRequest } from '../../shared/auth/staff-auth.guard';
import { scopedCreditRows } from './credit-read.policy';
import { readOwner } from './owner-read.transport';

@Controller('console-read')
export class CreditReadController {
  @Get('credit')
  @Header('Cache-Control', 'no-store')
  async credit(@Req() request: StaffRequest) {
    if (process.env.CONSOLE_CREDIT_READS_ENABLED !== 'true') throw new ServiceUnavailableException('The credit staff adapter is not enabled');
    const allowed = (process.env.CONSOLE_CREDIT_READ_ROLES ?? '').split(',').map((v) => v.trim()).filter(Boolean);
    if (!request.staff?.roles.some((role) => allowed.includes(role))) throw new ForbiddenException('Credit evidence read permission is required');
    const value = await readOwner({ origin: process.env.CONSOLE_CREDIT_URL, resource: 'credit', tenantId: request.staff.tenantId, token: request.verifiedToken });
    try {
      return { items: scopedCreditRows(value, request.staff.tenantId), observedAt: new Date().toISOString(), source: 'credit-intelligence', pageLimit: 100 };
    } catch { throw new ServiceUnavailableException('The scoped credit source is unavailable'); }
  }
}
