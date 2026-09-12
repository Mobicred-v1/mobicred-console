import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Optional, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { StaffTokenError, verifyStaffToken, type VerifiedStaff } from './staff-token.policy';
import { ConsoleSessions } from '../sessions/console-sessions.service';

export type StaffActor = VerifiedStaff;
export type StaffRequest = {
  headers: Record<string, string | string[] | undefined>;
  staff?: StaffActor;
  /** Server-only values. Never return this request object to a caller. */
  verifiedToken?: string;
  sessionId?: string;
};

@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, @Optional() private readonly sessions?: ConsoleSessions) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<StaffRequest>();
    const header = request.headers.authorization;
    const sessionId = request.headers['x-console-session'];
    const requestedTenant = request.headers['x-mobicred-tenant-id'];
    let token: string;
    let tenantId: string;
    let sessionStaffId: string | undefined;

    if (sessionId !== undefined) {
      if (header !== undefined || typeof sessionId !== 'string' || !this.sessions) throw new UnauthorizedException('A single valid authentication method is required');
      let session: Awaited<ReturnType<ConsoleSessions['resolve']>>;
      try { session = await this.sessions.resolve(sessionId); }
      catch { throw new ServiceUnavailableException('Staff session storage is unavailable'); }
      if (!session) throw new UnauthorizedException('Staff session is invalid or expired');
      if (requestedTenant !== undefined && requestedTenant !== session.tenantId) throw new ForbiddenException('The session does not authorize that tenant');
      token = session.token;
      tenantId = session.tenantId;
      sessionStaffId = session.staffId;
      request.sessionId = sessionId;
    } else {
      if (typeof header !== 'string' || !/^Bearer \S+$/i.test(header) || typeof requestedTenant !== 'string') throw new UnauthorizedException('A verified staff session and tenant are required');
      token = header.slice(7);
      tenantId = requestedTenant;
    }

    try { request.staff = await verifyStaffToken(token, tenantId); }
    catch (error) {
      if (error instanceof StaffTokenError && error.kind === 'forbidden') throw new ForbiddenException('Staff role or tenant scope denied');
      if (error instanceof StaffTokenError && error.kind === 'unavailable') throw new ServiceUnavailableException('Staff identity verification is unavailable');
      throw new UnauthorizedException('Staff session is invalid or expired');
    }
    if (sessionStaffId && sessionStaffId !== request.staff.staffId) throw new UnauthorizedException('Session identity mismatch');
    request.verifiedToken = token;
    return true;
  }
}
