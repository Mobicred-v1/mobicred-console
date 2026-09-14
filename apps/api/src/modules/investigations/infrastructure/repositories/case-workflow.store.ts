import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { PLATFORM_SCOPE, type VerifiedStaff } from '../../../../shared/auth/staff-token.policy';
import { assertActor, assertTransition, commandDigest, type CaseStatus } from '../../application/case-workflow.policy';
import type { CaseCommandDto, CaseListDto, NewCaseDto } from '../../application/dto/case-workflow.dto';

type CaseRow = { id: string; title: string; kind: string; status: CaseStatus; severity: string; customer_ref: string | null; assigned_staff_id: string | null; tenant_id: string; partner_code: string | null; version: number; created_at: Date; updated_at: Date };
type Receipt = { id: string; version: number; receiptId: string };
const caseDto = (r: CaseRow) => ({ id: r.id, title: r.title, kind: r.kind, status: r.status, severity: r.severity, customerRef: r.customer_ref, assignedStaffId: r.assigned_staff_id, tenantId: r.tenant_id, partnerCode: r.partner_code, version: r.version, createdAt: r.created_at, updatedAt: r.updated_at });
const scope = (actor: VerifiedStaff) => [actor.partnerContext?.partnerCode ?? null, actor.partnerContext?.tenantId ?? null];
const predicate = '($1::varchar IS NULL OR (partner_code = $1 AND tenant_id = $2))';

@Injectable()
export class CaseWorkflowStore {
  constructor(private readonly database: DataSource) {}
  async list(actor: VerifiedStaff, query: CaseListDto) {
    assertActor(actor);
    const where = `${predicate} AND deleted_at IS NULL AND ($3::text IS NULL OR status = $3) AND ($4::text IS NULL OR title ILIKE '%' || $4 || '%' OR id::text ILIKE '%' || $4 || '%')`;
    const values = [...scope(actor), query.status ?? null, query.q?.trim() || null];
    const rows: CaseRow[] = await this.database.query(`SELECT * FROM investigation_cases WHERE ${where} ORDER BY updated_at DESC, id LIMIT $5 OFFSET $6`, [...values, query.limit, (query.page - 1) * query.limit]);
    const counts = await this.database.query(`SELECT count(*)::text AS total FROM investigation_cases WHERE ${where}`, values);
    const total = Number(counts[0].total);
    return { items: rows.map(caseDto), meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) }, contextVersion: actor.contextVersion ?? 0 };
  }
  async detail(actor: VerifiedStaff, id: string) {
    assertActor(actor);
    const rows: CaseRow[] = await this.database.query(`SELECT * FROM investigation_cases WHERE ${predicate} AND id = $3 AND deleted_at IS NULL`, [...scope(actor), id]);
    if (!rows[0]) throw new NotFoundException('Case not found in this workspace');
    const notes = await this.database.query('SELECT id, author_id, body, created_at FROM console_case_notes WHERE case_id = $1 ORDER BY created_at DESC, id LIMIT 100', [id]);
    return { case: caseDto(rows[0]), notes, contextVersion: actor.contextVersion ?? 0 };
  }
  async create(actor: VerifiedStaff, key: string, input: NewCaseDto) {
    assertActor(actor);
    const body = { title: input.title.trim(), kind: input.kind, severity: input.severity, reason: input.reason.trim(), customerRef: input.customerRef || null };
    if (body.title.length < 5 || body.reason.length < 10) throw new BadRequestException('A meaningful title and reason are required');
    return this.withReceipt(actor, key, commandDigest('case.create', null, body), async (manager) => {
      const id = randomUUID();
      const tenant = actor.partnerContext?.tenantId ?? PLATFORM_SCOPE;
      const partner = actor.partnerContext?.partnerCode ?? null;
      await manager.query('INSERT INTO investigation_cases (id, title, kind, status, severity, customer_ref, assigned_staff_id, source_refs, tenant_id, partner_code, version) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1)', [id, body.title, body.kind, 'open', body.severity, body.customerRef, actor.staffId, JSON.stringify({}), tenant, partner]);
      await manager.query('INSERT INTO console_case_notes (id, case_id, tenant_id, author_id, body) VALUES ($1,$2,$3,$4,$5)', [randomUUID(), id, tenant, actor.staffId, body.reason]);
      const receiptId = await this.audit(manager, actor, id, tenant, partner, 'case.created', body.reason, { status: 'open', severity: body.severity, version: 1 });
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
      const rows: CaseRow[] = await manager.query(`SELECT * FROM investigation_cases WHERE ${predicate} AND id = $3 AND deleted_at IS NULL FOR UPDATE`, [...scope(actor), id]);
      const current = rows[0];
      if (!current) throw new NotFoundException('Case not found in this workspace');
      if (current.version !== body.expectedVersion) throw new ConflictException('Case changed. Reload before submitting.');
      let nextStatus = current.status;
      let nextAssignee = current.assigned_staff_id;
      let noteId: string | undefined;
      if (body.action === 'set_status') { assertTransition(current.status, body.status!); nextStatus = body.status!; }
      if (body.action === 'assign_to_me') nextAssignee = actor.staffId;
      if (body.action === 'add_note') {
        noteId = randomUUID();
        await manager.query('INSERT INTO console_case_notes (id, case_id, tenant_id, author_id, body) VALUES ($1,$2,$3,$4,$5)', [noteId, id, current.tenant_id, actor.staffId, body.note]);
      }
      const version = current.version + 1;
      await manager.query('UPDATE investigation_cases SET status = $1, assigned_staff_id = $2, version = $3, updated_at = now() WHERE id = $4', [nextStatus, nextAssignee, version, id]);
      const receiptId = await this.audit(manager, actor, id, current.tenant_id, current.partner_code, `case.${body.action}`, body.reason, { before: { status: current.status, assignedStaffId: current.assigned_staff_id, version: current.version }, after: { status: nextStatus, assignedStaffId: nextAssignee, version }, ...(noteId ? { noteId } : {}) });
      return { id, version, receiptId };
    });
  }
  async auditFeed(actor: VerifiedStaff) {
    assertActor(actor);
    return { items: await this.database.query(`SELECT id, actor_id, action, target_id, reason, metadata, created_at, partner_code, tenant_id FROM console_audit_records WHERE ${predicate} ORDER BY created_at DESC, id LIMIT 100`, scope(actor)) };
  }
  async reports(actor: VerifiedStaff) {
    assertActor(actor);
    const rows: { kind: string; status: string; count: string }[] = await this.database.query(`SELECT kind, status, count(*)::text AS count FROM investigation_cases WHERE ${predicate} AND deleted_at IS NULL GROUP BY kind, status ORDER BY kind, status`, scope(actor));
    return { generatedAt: new Date().toISOString(), tenantId: actor.tenantId, partnerCode: actor.partnerContext?.partnerCode ?? null, source: 'console-case-database', items: rows.map((row) => ({ kind: row.kind, status: row.status, count: Number(row.count) })) };
  }
  private async withReceipt(actor: VerifiedStaff, key: string, digest: string, execute: (manager: EntityManager) => Promise<Receipt>) {
    return this.database.transaction(async (manager) => {
      if (actor.sessionHash) {
        // Context switching cannot race an already-verified case command into a different partition.
        const session = await manager.query('SELECT context_version FROM console_sessions WHERE id_hash = $1 AND staff_id = $2 AND expires_at > now() FOR SHARE', [actor.sessionHash, actor.staffId]);
        if (!session[0] || session[0].context_version !== actor.contextVersion) throw new ConflictException('Workspace context changed. Reload before submitting.');
      }
      const partner = actor.partnerContext?.partnerCode ?? '';
      const tenant = actor.partnerContext?.tenantId ?? PLATFORM_SCOPE;
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [JSON.stringify([partner, tenant, actor.staffId, key])]);
      const previous: { request_hash: string; result: Receipt }[] = await manager.query('SELECT request_hash, result FROM console_command_receipts WHERE partner_code = $1 AND tenant_id = $2 AND actor_id = $3 AND idempotency_key = $4', [partner, tenant, actor.staffId, key]);
      if (previous[0]) {
        if (previous[0].request_hash !== digest) throw new ConflictException('This request key was already used for a different command');
        return { ...previous[0].result, replayed: true };
      }
      const result = await execute(manager);
      await manager.query('INSERT INTO console_command_receipts (partner_code, tenant_id, actor_id, idempotency_key, request_hash, result) VALUES ($1,$2,$3,$4,$5,$6)', [partner, tenant, actor.staffId, key, digest, JSON.stringify(result)]);
      return { ...result, replayed: false };
    });
  }
  private async audit(manager: EntityManager, actor: VerifiedStaff, targetId: string, tenant: string, partner: string | null, action: string, reason: string, metadata: Record<string, unknown>): Promise<string> {
    const id = randomUUID();
    await manager.query('INSERT INTO console_audit_records (id, tenant_id, partner_code, actor_id, action, target_id, reason, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [id, tenant, partner, actor.staffId, action, targetId, reason, JSON.stringify(metadata)]);
    return id;
  }
}
