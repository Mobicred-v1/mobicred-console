import { BadRequestException, Controller, ForbiddenException, Get, Header, Query, Req, ServiceUnavailableException } from '@nestjs/common';
import type { StaffRequest } from '../../shared/auth/staff-auth.guard';
import { boundedOwnerJson, ownerOrigin } from './owner-read.transport';
import { scopedSourceQuality } from './ingestion-read.policy';

@Controller('console-read')
export class IngestionReadController {
  @Get('ingestion')
  @Header('Cache-Control', 'no-store')
  async quality(@Req() request: StaffRequest, @Query() query: Record<string, unknown>) {
    if (Object.keys(query ?? {}).length) throw new BadRequestException('Use the selected workspace context');
    if (process.env.CONSOLE_INGESTION_READS_ENABLED !== 'true') throw new ServiceUnavailableException('Ingestion reads are not connected');
    const roles = (process.env.CONSOLE_INGESTION_READ_ROLES ?? '').split(',').map((r) => r.trim()).filter(Boolean);
    if (!request.staff?.roles.some((r) => roles.includes(r))) throw new ForbiddenException('Ingestion read permission required');
    const partner = request.staff.partnerContext;
    try {
      const url = ownerOrigin(process.env.CONSOLE_CREDIT_URL);
      url.pathname = '/api/v1/ingestion/admin/data-source-quality';
      if (partner) { url.searchParams.set('tenant_id', partner.tenantId); url.searchParams.set('partner_code', partner.partnerCode); }
      const response = await fetch(url, { method: 'GET', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(6000), headers: { authorization: `Bearer ${request.verifiedToken}`, accept: 'application/json' } });
      if ([401, 403].includes(response.status)) throw new ForbiddenException('Ingestion access denied');
      if (!response.ok) throw new Error();
      return scopedSourceQuality(await boundedOwnerJson(response), partner?.tenantId, Date.now(), partner?.partnerCode);
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new ServiceUnavailableException('Ingestion data is temporarily unavailable');
    }
  }
}
