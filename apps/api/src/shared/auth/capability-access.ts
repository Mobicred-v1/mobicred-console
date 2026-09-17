import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import type { VerifiedStaff } from './staff-token.policy';

export function requireConfiguredRead(actor: VerifiedStaff, setting: string): void {
  const roles = (process.env[setting] ?? '').split(',').map((role) => role.trim()).filter(Boolean);
  if (!roles.length) throw new ServiceUnavailableException({ code: 'ACCESS_NOT_CONFIGURED', message: 'This read capability has not been configured.' });
  if (!actor.roles.some((role) => roles.includes(role))) throw new ForbiddenException({ code: 'ACCESS_DENIED', message: 'Your staff role does not permit this view.' });
}
