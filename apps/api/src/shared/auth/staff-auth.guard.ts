import { CanActivate, ConflictException, ExecutionContext, ForbiddenException, Injectable, Optional, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { PLATFORM_SCOPE, StaffTokenError, verifyStaffToken, type VerifiedStaff } from './staff-token.policy';
import { ConsoleSessions } from '../sessions/console-sessions.service';
import { sessionHash } from '../sessions/session-crypto';

export type StaffActor = VerifiedStaff;
export type StaffRequest = {
  headers: Record<string, string | string[] | undefined>; method?: string;
  staff?: StaffActor; verifiedToken?: string; sessionId?: string;
};

/** Default-deny global guard. A request header can never choose a partner context. */
@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, @Optional() private readonly sessions?: ConsoleSessions) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<StaffRequest>();
    if (request.headers['x-mobicred-tenant-id'] !== undefined || request.headers['x-partner-code'] !== undefined) throw new ForbiddenException('Select operational context through your staff session');
    const header = request.headers.authorization;
    const id = request.headers['x-console-session'];
    let token: string;
    let session: Awaited<ReturnType<ConsoleSessions['resolve']>> = null;
    if (id !== undefined) {
      if (header !== undefined || typeof id !== 'string' || !this.sessions) throw new UnauthorizedException('A single staff authentication method is required');
      try { session = await this.sessions.resolve(id); }
      catch { throw new ServiceUnavailableException('Staff session verification is temporarily unavailable'); }
      if (!session) throw new UnauthorizedException('Staff session is invalid or expired');
      token = session.token;
      request.sessionId = id;
    } else {
      if (typeof header !== 'string' || !/^Bearer \S+$/i.test(header)) throw new UnauthorizedException('A verified staff session is required');
      token = header.slice(7);
    }
    let actor: VerifiedStaff;
    try { actor = await verifyStaffToken(token); }
    catch (error) {
      if (error instanceof StaffTokenError && error.kind === 'forbidden') throw new ForbiddenException('Staff access is not permitted');
      if (error instanceof StaffTokenError && error.kind === 'unavailable') throw new ServiceUnavailableException('Staff session verification is temporarily unavailable');
      throw new UnauthorizedException('Staff session is invalid or expired');
    }
    if (session) {
      if (session.staffId !== actor.staffId) throw new UnauthorizedException('Staff session is invalid');
      actor = { ...actor, tenantId: session.partnerContext?.tenantId ?? PLATFORM_SCOPE, partnerContext: session.partnerContext ?? undefined, contextVersion: session.contextVersion, sessionHash: sessionHash(request.sessionId!), expiresAt: Math.min(actor.expiresAt, session.expiresAt) };
      if (['POST', 'PUT', 'PATCH'].includes(request.method ?? '')) {
        const expected = request.headers['x-console-context-version'];
        if (typeof expected !== 'string' || !/^\d{1,9}$/.test(expected) || Number(expected) !== actor.contextVersion) throw new ConflictException('Workspace context changed. Reload before submitting.');
      }
    }
    request.staff = actor;
    request.verifiedToken = token;
    return true;
  }
}
