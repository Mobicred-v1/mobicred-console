import { requireConfiguredRead } from './capability-access';
import type { VerifiedStaff } from './staff-token.policy';
import { CaseWorkflowService } from '../../modules/investigations/application/case-workflow.service';
import type { CaseWorkflowStore } from '../../modules/investigations/infrastructure/repositories/case-workflow.store';
const actor: VerifiedStaff = { staffId: 'operator', tenantId: '@mobicred', roles: ['OPS'], expiresAt: Date.now() + 60000 };
describe('audit/report capability gates are separate from staff authentication', () => {
  const before = { ...process.env };
  afterEach(() => { process.env = { ...before }; });
  test.each(['CONSOLE_AUDIT_READ_ROLES', 'CONSOLE_CASE_REPORT_ROLES'])('missing %s is setup failure, not signed out', (setting) => {
    delete process.env[setting];
    try { requireConfiguredRead(actor, setting); throw new Error('expected rejection'); }
    catch (error) { expect(error).toMatchObject({ status: 503, response: expect.objectContaining({ code: 'ACCESS_NOT_CONFIGURED' }) }); }
  });
  test.each(['CONSOLE_AUDIT_READ_ROLES', 'CONSOLE_CASE_REPORT_ROLES'])('explicit roles in %s still deny other staff', (setting) => {
    process.env[setting] = 'AUDITOR';
    expect(() => requireConfiguredRead(actor, setting)).toThrow('staff role');
    process.env[setting] = 'AUDITOR, OPS';
    expect(() => requireConfiguredRead(actor, setting)).not.toThrow();
  });
  test('denied and missing access cannot query any audit/report records', () => {
    const store = { auditFeed: jest.fn(), reports: jest.fn() };
    const service = new CaseWorkflowService(store as unknown as CaseWorkflowStore);
    process.env.CONSOLE_AUDIT_READ_ROLES = 'AUDITOR'; delete process.env.CONSOLE_CASE_REPORT_ROLES;
    expect(() => service.audit(actor)).toThrow(); expect(() => service.reports(actor)).toThrow();
    expect(store.auditFeed).not.toHaveBeenCalled(); expect(store.reports).not.toHaveBeenCalled();
  });
});
