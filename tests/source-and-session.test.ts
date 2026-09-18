import { describe, expect, test } from 'bun:test';
import { ApiFailure, publicErrorCode } from '../apps/web/lib/api-failure';
import { sourceFailure } from '../apps/web/lib/source-failure';
import { isCurrentView, sessionRevision } from '../apps/web/lib/session-revision';
import { statusTone } from '../apps/web/lib/console-model';
import type { StaffSession } from '../apps/web/lib/session-model';
const session: StaffSession = { staffId: 'staff-one', name: 'Operator', tenant: '@mobicred', roles: ['OPS', 'ADMIN'], contextVersion: 0, expiresAt: Date.now() + 60000, partnerContext: null };
describe('source errors never pretend that a valid operator is signed out', () => {
  test('separates authentication, permission and setup failures', () => {
    expect(sourceFailure(new ApiFailure(401)).state).toBe('unauthorized');
    expect(sourceFailure(new ApiFailure(403)).state).toBe('forbidden');
    expect(sourceFailure(new ApiFailure(503, 'ACCESS_NOT_CONFIGURED')).state).toBe('not-configured');
    expect(sourceFailure(new ApiFailure(503)).state).toBe('unavailable');
  });
  test('does not turn a missing collection endpoint into an empty successful list', () => {
    expect(sourceFailure(new ApiFailure(404)).state).toBe('unavailable');
    expect(sourceFailure(new ApiFailure(404), true).state).toBe('not-found');
  });
  test('only publishes allowlisted codes, never raw server text', () => {
    expect(publicErrorCode({ code: 'ACCESS_DENIED', message: 'private detail' })).toBe('ACCESS_DENIED');
    expect(publicErrorCode({ code: 'INTERNAL_SECRET', message: 'private detail' })).toBeUndefined();
    expect(sourceFailure(new Error('private detail')).detail).not.toContain('private detail');
  });
  test('inactive or unverified states cannot receive a success badge', () => {
    expect(statusTone('ACTIVE')).toBe('success');
    for (const state of ['INACTIVE', 'unverified', 'Not enabled']) expect(statusTone(state)).not.toBe('success');
  });
});
describe('persistent layouts do not restore stale identity, scope or role snapshots', () => {
  test('accepts the current revision independent of role ordering', () => {
    expect(isCurrentView(session, { ...session, roles: ['ADMIN', 'OPS'] })).toBe(true);
  });
  test('rejects history snapshots with another identity, scope, role or expiry', () => {
    for (const patch of [{ staffId: 'someone-else' }, { contextVersion: 1 }, { roles: ['ADMIN'] }, { expiresAt: 1 }]) expect(isCurrentView(session, { ...session, ...patch })).toBe(false);
  });
  test('distinguishes two partners sharing an environment identifier', () => {
    const base = { ...session, tenant: 'sandbox', contextVersion: 2 };
    const alpha = { ...base, partnerContext: { partnerCode: 'alpha', tenantId: 'sandbox', partnerName: 'Alpha', displayName: 'Sandbox', environment: 'SANDBOX' } };
    expect(sessionRevision(alpha)).not.toBe(sessionRevision({ ...alpha, partnerContext: { ...alpha.partnerContext, partnerCode: 'beta' } }));
  });
});
