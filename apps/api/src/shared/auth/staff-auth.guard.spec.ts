import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StaffAuthGuard } from './staff-auth.guard';
import { validateStaffClaims, StaffTokenError } from './staff-token.policy';
const issuer = 'https://identity.example/realms/staff';
const now = 1_800_000_000_000;
const claims = { active: true, iss: issuer, sub: 'staff-1', aud: 'console', exp: now / 1000 + 60, realm_access: { roles: ['OPS'] }, tenant_ids: ['tenant-a'] };
const verify = (c: unknown = claims, tenant = 'tenant-a') => validateStaffClaims(c, tenant, issuer, 'console', ['OPS'], now);
describe('verified staff scope', () => {
  it('accepts active, correctly scoped staff', () => expect(verify().staffId).toBe('staff-1'));
  it.each([{ active: false }, { iss: 'https://other.example' }, { aud: 'another-app' }, { exp: 1 }, { sub: '' }, { nbf: now / 1000 + 60 }])('rejects invalid claims %j', (patch) => expect(() => verify({ ...claims, ...patch })).toThrow(StaffTokenError));
  it('does not grant another tenant from a request header', () => expect(() => verify(claims, 'tenant-b')).toThrow(StaffTokenError));
  it('requires an allowed role', () => expect(() => verify({ ...claims, realm_access: { roles: ['CUSTOMER'] } })).toThrow(StaffTokenError));
  it('does not accept a bearer prefix as authentication', async () => {
    const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
    const context = { getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: 'Bearer ' } }) }) } as unknown as ExecutionContext;
    await expect(new StaffAuthGuard(reflector).canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
