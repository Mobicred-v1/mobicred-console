import { BadRequestException, Body, Controller, Get, Header, Headers, Param, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import { ConsoleSessions } from '../../shared/sessions/console-sessions.service';
import type { StaffRequest } from '../../shared/auth/staff-auth.guard';
import type { PartnerContext } from '../../shared/auth/staff-token.policy';
import { partnerOwner, partnerPermissions, safePartnerCode } from './partner-workspace.client';

/** Global staff administration. The optional session context filters operations, not staff grants. */
@Controller('console-partners')
export class PartnerWorkspaceController {
  constructor(private readonly sessions: ConsoleSessions) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@Req() req: StaffRequest, @Query('page') page?: string, @Query('q') q?: string) { return { ...await partnerOwner(req, 'list', { page, q }), permissions: partnerPermissions(req) }; }
  @Post('context')
  @Header('Cache-Control', 'no-store')
  async context(@Req() req: StaffRequest, @Body() body: unknown) {
    if (!req.sessionId || !req.staff) throw new UnauthorizedException('A console session is required');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Invalid context');
    const row = body as Record<string, unknown>;
    if (Object.keys(row).some((key) => !['partnerCode', 'tenantId'].includes(key))) throw new BadRequestException('Invalid context');
    let partner: PartnerContext | null = null;
    if (row.partnerCode !== null) {
      const code = safePartnerCode(row.partnerCode); const tenant = safePartnerCode(row.tenantId);
      const result = await partnerOwner(req, 'context', { code, tenantId: tenant });
      if (typeof result.partnerName !== 'string' || typeof result.displayName !== 'string' || typeof result.environment !== 'string') throw new BadRequestException('Invalid owner context');
      partner = { partnerCode: code, tenantId: tenant, partnerName: result.partnerName.slice(0, 128), displayName: result.displayName.slice(0, 128), environment: result.environment };
    } else if (row.tenantId !== undefined && row.tenantId !== null) throw new BadRequestException('Invalid global context');
    return this.sessions.setContext(req.sessionId, req.staff, partner);
  }
  @Post('commands')
  @Header('Cache-Control', 'no-store')
  command(@Req() req: StaffRequest, @Headers('idempotency-key') key: string, @Body() command: unknown) { return partnerOwner(req, 'command', { key, command }); }
  @Get(':code/context-options')
  @Header('Cache-Control', 'no-store')
  async options(@Req() req: StaffRequest, @Param('code') code: string) { const detail = await partnerOwner(req, 'detail', { code }); return { partner: detail.partner, tenants: detail.tenants, totals: detail.totals }; }
  @Get(':code/customers')
  @Header('Cache-Control', 'no-store')
  customers(@Req() req: StaffRequest, @Param('code') code: string, @Query('page') page?: string, @Query('q') q?: string) { return partnerOwner(req, 'customers', { code, page, q }); }
  @Get(':code')
  @Header('Cache-Control', 'no-store')
  async detail(@Req() req: StaffRequest, @Param('code') code: string) { return { ...await partnerOwner(req, 'detail', { code }), permissions: partnerPermissions(req) }; }
}
