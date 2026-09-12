import { BadRequestException, Controller, ForbiddenException, Get, Header, Query, Req, ServiceUnavailableException } from '@nestjs/common';
import type { StaffRequest } from '../../shared/auth/staff-auth.guard';
import { readOwner } from './owner-read.transport';
import { scopedSourceQuality } from './ingestion-read.policy';

@Controller('console-read')
export class IngestionReadController {
  @Get('ingestion')
  @Header('Cache-Control', 'no-store')
  async quality(@Req() request: StaffRequest, @Query() query: Record<string, unknown>) {
    // There is deliberately no caller-supplied tenant, URL, token, path or partner override.
    if (Object.keys(query ?? {}).length) throw new BadRequestException('This inventory uses only the verified tenant scope');
    if (process.env.CONSOLE_INGESTION_READS_ENABLED !== 'true') throw new ServiceUnavailableException('Ingestion reads are not enabled');
    const roles = (process.env.CONSOLE_INGESTION_READ_ROLES ?? '').split(',').map((r) => r.trim()).filter(Boolean);
    if (!request.staff?.roles.some((r) => roles.includes(r))) throw new ForbiddenException('Ingestion read permission is required');
    const value = await readOwner({ origin: process.env.CONSOLE_CREDIT_URL, resource: 'ingestion', tenantId: request.staff.tenantId, token: request.verifiedToken });
    try { return scopedSourceQuality(value, request.staff.tenantId); }
    catch { throw new ServiceUnavailableException('The owner returned an invalid or mismatched source inventory'); }
  }
}
