import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import type { VerifiedStaff } from '../../../../shared/auth/staff-token.policy';
import { assertActor, assertTransition, commandDigest, type CaseStatus } from '../../application/case-workflow.policy';
import type { CaseCommandDto, CaseListDto, NewCaseDto } from '../../application/dto/case-workflow.dto';

type CaseRow = { id: string; title: string; kind: string; status: CaseStatus; severity: string; customer_ref: string | null; assigned_staff_id: string | null; tenant_id: string; version: number; created_at: Date; updated_at: Date };
type Receipt = { id: string; version: number; receiptId: string };
const caseDto = (row: CaseRow) => ({ id: row.id, title: row.title, kind: row.kind, status: row.status, severity: row.severity, customerRef: row.customer_ref, assignedStaffId: row.assigned_staff_id, tenantId: row.tenant_id, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at });

@Injectable()
export class CaseWorkflowStore {
  constructor(private readonly database: DataSource) {}

  async list(actor: VerifiedStaff, query: CaseListDto) {
    assertActor(actor);
    const where = `tenant_id = $1 AND deleted_at IS NULL AND ($2::text IS NULL OR status = $2) AND ($3::text IS NULL OR title ILIKE '%' || $3 || '%' OR id::text ILIKE '%' || $3 || '%')`;
    const values = [actor.tenantId, query.status ?? null, query.q?.trim() || null];
    const rows: CaseRow[] = await this.database.query(`SELECT * FROM investigation_cases WHERE ${where} ORDER BY updated_at DESC, id LIMIT $4 OFFSET $5`, [...values, query.limit, (query.page - 1) * query.limit]);
    const counts: { total: string }[] = await this.database.query(`SELECT count(*)::text AS total FROM investigation_cases WHERE ${where}`, values);
    const total = Number(counts[0].total);
    return { items: rows.map(caseDto), meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } };
  }

  async detail(actor: VerifiedStaff, id: string) {
    assertActor(actor);
    const rows: CaseRow[] = await this.database.query('SELECT * FROM investigation_cases WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL', [id, actor.tenantId]);
    if (!rows[0]) throw new NotFoundException('Case not found');
    const notes = await this.database.query('SELECT id, author_id, body, created_at FROM console_case_notes WHERE case_id = $1 AND tenant_id = $2 ORDER BY created_at DESC, id LIMIT 100', [id, actor.tenantId]);
    return { case: caseDto(rows[0]), notes };
  }

  async create(actor: VerifiedStaff, key: string, input: NewCaseDto) {
    assertActor(actor);
    const body = { title: input.title.trim(), kind: input.kind, severity: input.severity, reason: input.reason.trim(), customerRef: input.customerRef || null };
    if (body.title.length < 5 || body.reason.length < 10) throw new BadRequestException('Title and reason must contain meaningful text');
    return this.withReceipt(actor, key, commandDigest('case.create', null, body), async (manager) => {
      const id = randomUUID();
      await manager.query('INSERT INTO investigation_cases (id, title, kind, status, severity, customer_ref, assigned_staff_id, source_refs, tenant_id, version) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1)', [id, body.title, body.kind, 'open', body.severity, body.customerRef, actor.staffId, JSON.stringify({}), actor.tenantId]);
      await manager.query('INSERT INTO console_case_notes (id, case_id, tenant_id, author_id, body) VALUES ($1,$2,$3,$4,$5)', [randomUUID(), id, actor.tenantId, actor.staffId, body.reason]);
      const receiptId = await this.audit(manager, actor, id, 'case.created', body.reason, { status: 'open', severity: body.severity, version: 1 });
      return { id, version: 1, receiptId };
    });
  }

  async command(actor: VerifiedStaff, id: string, key: string, input: CaseCommandDto) {
    assertActor(actor);
    const body = { action: input.action, expectedVersion: input.expectedVersion, reason: input.reason.trim(), status: input.status, note: input.note?.trim() };
    if (body.reason.length < 10) throw new BadRequestException('A meaningful reason is required');
    if (body.action === 'set_status' && (!body.status || body.note)) throw new BadRequestException('A status command requires a status, not a note');
    if (body.action === 'add_note' && (!body.note || body.status)) throw new BadRequestException('A note command requires a note, not a status');
    if (body.action === 'assign_to_me' && (body.note || body.status)) throw new BadRequestException('Assignment accepts no extra mutation fields');
    return this.withReceipt(actor, key, commandDigest(`case.${body.action}`, id, body), async (manager) => {
      const rows: CaseRow[] = await manager.query('SELECT * FROM investigation_cases WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE', [id, actor.tenantId]);
      const current = rows[0];
      if (!current) throw new NotFoundException('Case not found');
      if (current.version !== body.expectedVersion) throw new ConflictException('Case version changed. Reload before submitting another command.');
      let nextStatus = current.status;
      let nextAssignee = current.assigned_staff_id;
      let noteId: string | undefined;
      if (body.action === 'set_status') { assertTransition(current.status, body.status!); nextStatus = body.status!; }
      if (body.action === 'assign_to_me') nextAssignee = actor.staffId;
      if (body.action === 'add_note') {
        noteId = randomUUID();
        await manager.query('INSERT INTO console_case_notes (id, case_id, tenant_id, author_id, body) VALUES ($1,$2,$3,$4,$5)', [noteId, id, actor.tenantId, actor.staffId, body.note]);
      }
      const version = current.version + 1;
      await manager.query('UPDATE investigation_cases SET status = $1, assigned_staff_id = $2, version = $3, updated_at = now() WHERE id = $4 AND tenant_id = $5', [nextStatus, nextAssignee, version, id, actor.tenantId]);
      const receiptId = await this.audit(manager, actor, id, `case.${body.action}`, body.reason, { before: { status: current.status, assignedStaffId: current.assigned_staff_id, version: current.version }, after: { status: nextStatus, assignedStaffId: nextAssignee, version }, ...(noteId ? { noteId } : {}) });
      return { id, version, receiptId };
    });
  }

  async auditFeed(actor: VerifiedStaff) {
    assertActor(actor);
    return { items: await this.database.query('SELECT id, actor_id, action, target_id, reason, metadata, created_at FROM console_audit_records WHERE tenant_id = $1 ORDER BY created_at DESC, id LIMIT 100', [actor.tenantId]) };
  }

  async reports(actor: VerifiedStaff) {
    assertActor(actor);
    const rows: { kind: string; status: string; count: string }[] = await this.database.query('SELECT kind, status, count(*)::text AS count FROM investigation_cases WHERE tenant_id = $1 AND deleted_at IS NULL GROUP BY kind, status ORDER BY kind, status', [actor.tenantId]);
    return { generatedAt: new Date().toISOString(), tenantId: actor.tenantId, source: 'console-case-database', items: rows.map((row) => ({ kind: row.kind, status: row.status, count: Number(row.count) })) };
  }

  private async withReceipt(actor: VerifiedStaff, key: string, digest: string, execute: (manager: EntityManager) => Promise<Receipt>) {
    return this.database.transaction(async (manager) => {
      // Serialize retries for this actor and tenant. Different request bodies cannot reuse a key.
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${actor.tenantId}:${actor.staffId}:${key}`]);
      const previous: { request_hash: string; result: Receipt }[] = await manager.query('SELECT request_hash, result FROM console_command_receipts WHERE tenant_id = $1 AND actor_id = $2 AND idempotency_key = $3', [actor.tenantId, actor.staffId, key]);
      if (previous[0]) {
        if (previous[0].request_hash !== digest) throw new ConflictException('This idempotency key was already used for a different command');
        return { ...previous[0].result, replayed: true };
      }
      const result = await execute(manager);
      await manager.query('INSERT INTO console_command_receipts (tenant_id, actor_id, idempotency_key, request_hash, result) VALUES ($1,$2,$3,$4,$5)', [actor.tenantId, actor.staffId, key, digest, JSON.stringify(result)]);
      return { ...result, replayed: false };
    });
  }

  private async audit(manager: EntityManager, actor: VerifiedStaff, targetId: string, action: string, reason: string, metadata: Record<string, unknown>): Promise<string> {
    const id = randomUUID();
    // Same transaction as the case mutation. An audit insertion failure rolls back the command.
    await manager.query('INSERT INTO console_audit_records (id, tenant_id, actor_id, action, target_id, reason, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, actor.tenantId, actor.staffId, action, targetId, reason, JSON.stringify(metadata)]);
    return id;
  }
}
