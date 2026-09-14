import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StaffAuthGuard } from './staff-auth.guard';
import { PLATFORM_SCOPE, StaffTokenError, validateStaffClaims } from './staff-token.policy';
const now = 1800000000000;
const issuer = 'https://identity.example/realms/staff';
const claims = { active: true, iss: issuer, sub: 'staff-1', aud: 'console', exp: now / 1000 + 60, realm_access: { roles: ['OPS'] } };
const verify = (c: unknown = claims, oldContext?: string) => validateStaffClaims(c, oldContext, issuer, 'console', ['OPS'], now);
describe('platform staff identity', () => {
  it('authenticates staff without tenant claims or a login tenant', () => expect(verify()).toEqual(expect.objectContaining({ staffId: 'staff-1', tenantId: PLATFORM_SCOPE })));
  it('never converts an old caller-selected context into an identity grant', () => expect(verify({ ...claims, tenant_ids: ['arbitrary'] }, 'arbitrary').tenantId).toBe(PLATFORM_SCOPE));
  it.each([{ active: false }, { iss: 'https://other.example/realms/staff' }, { aud: 'another-app' }, { exp: 1 }, { sub: '' }, { exp: NaN }, { nbf: now / 1000 + 60 }])('rejects invalid claims %j', (patch) => expect(() => verify({ ...claims, ...patch })).toThrow(StaffTokenError));
  it('requires an allowed staff role even if the caller supplies tenant claims', () => expect(() => verify({ ...claims, tenant_ids: ['*'], realm_access: { roles: ['CUSTOMER'] } })).toThrow(StaffTokenError));
  it('rejects header-based partner selection before contacting identity', async () => {
    const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
    const context = { getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: 'Bearer token', 'x-mobicred-tenant-id': 'other' } }) }) } as unknown as ExecutionContext;
    await expect(new StaffAuthGuard(reflector).canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('does not accept bearer-header presence as authentication', async () => {
    const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
    const context = { getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: 'Bearer ' } }) }) } as unknown as ExecutionContext;
    await expect(new StaffAuthGuard(reflector).canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
