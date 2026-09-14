import { Controller, ForbiddenException, Get, Header, Req, ServiceUnavailableException } from '@nestjs/common';
import type { StaffRequest } from '../../shared/auth/staff-auth.guard';
import { scopedCreditRows } from './credit-read.policy';
import { boundedOwnerJson, ownerOrigin } from './owner-read.transport';

@Controller('console-read')
export class CreditReadController {
  @Get('credit')
  @Header('Cache-Control', 'no-store')
  async credit(@Req() request: StaffRequest) {
    if (process.env.CONSOLE_CREDIT_READS_ENABLED !== 'true') throw new ServiceUnavailableException('Credit reads are not connected');
    const roles = (process.env.CONSOLE_CREDIT_READ_ROLES ?? '').split(',').map((r) => r.trim()).filter(Boolean);
    if (!request.staff?.roles.some((r) => roles.includes(r))) throw new ForbiddenException('Credit read permission required');
    try {
      const url = ownerOrigin(process.env.CONSOLE_CREDIT_URL);
      url.pathname = '/api/v1/score-decisions/admin/search'; url.searchParams.set('limit', '100');
      const partner = request.staff.partnerContext;
      if (partner) { url.searchParams.set('tenant_id', partner.tenantId); url.searchParams.set('partner_code', partner.partnerCode); }
      const response = await fetch(url, { method: 'GET', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(6000), headers: { authorization: `Bearer ${request.verifiedToken}`, accept: 'application/json' } });
      if ([401, 403].includes(response.status)) throw new ForbiddenException('Credit access denied');
      if (!response.ok) throw new Error();
      const value = await boundedOwnerJson(response);
      const items = scopedCreditRows(value, partner?.tenantId);
      if (partner && items.some((row) => row.partnercode !== partner.partnerCode)) throw new Error();
      return { items, source: 'credit-intelligence', observedAt: new Date().toISOString(), pageLimit: 100 };
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new ServiceUnavailableException('Credit data is temporarily unavailable');
    }
  }
}
