import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';

export type StaffActor = {
  staffId: string;
  tenantId: string;
  roles: string[];
};

@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      staff?: StaffActor;
    }>();
    const authorization = request.headers.authorization ?? '';
    if (!authorization.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException(
        'Staff session required. Use Keycloak authorization-code tokens; do not paste internal API keys in the browser.',
      );
    }

    const tenantId = request.headers['x-mobicred-tenant-id'];
    if (!tenantId?.trim()) {
      throw new UnauthorizedException(
        'x-mobicred-tenant-id is required for staff operations',
      );
    }

    request.staff = {
      staffId: 'unverified-until-oidc',
      tenantId: tenantId.trim(),
      roles: [],
    };
    return true;
  }
}
