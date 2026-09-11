import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StaffAuthGuard } from './staff-auth.guard';

describe('StaffAuthGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  } as unknown as Reflector;
  const guard = new StaffAuthGuard(reflector);

  const context = (headers: Record<string, string>): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    }) as ExecutionContext;

  it('denies missing bearer tokens', () => {
    expect(() => guard.canActivate(context({}))).toThrow(UnauthorizedException);
  });

  it('denies bearer without tenant', () => {
    expect(() =>
      guard.canActivate(context({ authorization: 'Bearer x' })),
    ).toThrow(UnauthorizedException);
  });

  it('allows bearer with tenant header', () => {
    expect(
      guard.canActivate(
        context({
          authorization: 'Bearer x',
          'x-mobicred-tenant-id': 'mobicred-core',
        }),
      ),
    ).toBe(true);
  });
});
