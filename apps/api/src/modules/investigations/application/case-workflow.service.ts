import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { VerifiedStaff } from '../../../shared/auth/staff-token.policy';
import { CaseWorkflowStore } from '../infrastructure/repositories/case-workflow.store';
import { hasConfiguredRole, idempotencyKey } from './case-workflow.policy';
import type { CaseCommandDto, CaseListDto, NewCaseDto } from './dto/case-workflow.dto';

@Injectable()
export class CaseWorkflowService {
  constructor(private readonly store: CaseWorkflowStore) {}
  canWrite(actor: VerifiedStaff): boolean { return process.env.CONSOLE_CASE_WORKFLOWS_ENABLED === 'true' && hasConfiguredRole(actor, 'CONSOLE_CASE_WRITE_ROLES'); }
  async list(actor: VerifiedStaff, query: CaseListDto) { return { ...await this.store.list(actor, query), canWrite: this.canWrite(actor) }; }
  async detail(actor: VerifiedStaff, id: string) { return { ...await this.store.detail(actor, id), canWrite: this.canWrite(actor) }; }
  create(actor: VerifiedStaff, key: string | undefined, body: NewCaseDto) { this.assertWrite(actor); return this.store.create(actor, idempotencyKey(key), body); }
  command(actor: VerifiedStaff, id: string, key: string | undefined, body: CaseCommandDto) { this.assertWrite(actor); return this.store.command(actor, id, idempotencyKey(key), body); }
  audit(actor: VerifiedStaff) { if (!hasConfiguredRole(actor, 'CONSOLE_AUDIT_READ_ROLES')) throw new ForbiddenException('Audit read permission required'); return this.store.auditFeed(actor); }
  reports(actor: VerifiedStaff) { if (!hasConfiguredRole(actor, 'CONSOLE_CASE_REPORT_ROLES')) throw new ForbiddenException('Case report permission required'); return this.store.reports(actor); }
  private assertWrite(actor: VerifiedStaff): void {
    if (process.env.CONSOLE_CASE_WORKFLOWS_ENABLED !== 'true') throw new ServiceUnavailableException('Case commands are not enabled');
    if (!this.canWrite(actor)) throw new ForbiddenException('Case write permission required');
  }
}
