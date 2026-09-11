import { Controller, Delete, Get, Header, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ConsoleSessions } from './console-sessions.service';
import type { StaffRequest } from '../auth/staff-auth.guard';

@Controller('console-session')
export class ConsoleSessionController {
  constructor(private readonly sessions: ConsoleSessions) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  create(@Req() request: StaffRequest) {
    if (!request.staff || !request.verifiedToken || request.sessionId) throw new UnauthorizedException('A verified authorization-code access token is required');
    return this.sessions.create(request.staff, request.verifiedToken);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  context(@Req() request: StaffRequest) {
    const actor = request.staff!;
    return { staffId: actor.staffId, name: 'Staff operator', tenant: actor.tenantId, roles: actor.roles, expiresAt: actor.expiresAt };
  }

  @Delete()
  @HttpCode(204)
  async revoke(@Req() request: StaffRequest) {
    if (!request.sessionId) throw new UnauthorizedException('A console session is required');
    await this.sessions.revoke(request.sessionId);
  }
}
