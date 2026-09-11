import { CanActivate, ExecutionContext, ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { StaffTokenError, verifyStaffToken, type VerifiedStaff } from './staff-token.policy';
export type StaffActor = VerifiedStaff;
export type StaffRequest = { headers: Record<string, string | string[] | undefined>; staff?: StaffActor };

@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<StaffRequest>();
    const header = request.headers.authorization;
    const tenantId = request.headers['x-mobicred-tenant-id'];
    if (typeof header !== 'string' || !/^Bearer \S+$/i.test(header) || typeof tenantId !== 'string') throw new UnauthorizedException('A verified staff session and tenant are required');
    try { request.staff = await verifyStaffToken(header.slice(7), tenantId); }
    catch (error) {
      if (error instanceof StaffTokenError && error.kind === 'forbidden') throw new ForbiddenException('Staff role or tenant scope denied');
      if (error instanceof StaffTokenError && error.kind === 'unavailable') throw new ServiceUnavailableException('Staff identity verification is unavailable');
      throw new UnauthorizedException('Staff session is invalid or expired');
    }
    return true;
  }
}
