import type { MigrationInterface, QueryRunner } from 'typeorm';
export class PlatformStaffContext1789398000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    // Authentication semantics changed; invalidate old sessions, not operational history.
    await runner.query('DELETE FROM console_sessions');
    await runner.query('ALTER TABLE console_sessions ADD COLUMN partner_context jsonb NULL, ADD COLUMN context_version integer NOT NULL DEFAULT 0 CHECK (context_version >= 0)');
    await runner.query('ALTER TABLE investigation_cases ADD COLUMN partner_code varchar(64) NULL');
    await runner.query('CREATE INDEX console_case_partner_scope ON investigation_cases(partner_code, tenant_id, updated_at DESC)');
    await runner.query('ALTER TABLE console_audit_records ADD COLUMN partner_code varchar(64) NULL');
    await runner.query('ALTER TABLE console_command_receipts ADD COLUMN partner_code varchar(64) NOT NULL DEFAULT \'\'');
    await runner.query('ALTER TABLE console_command_receipts DROP CONSTRAINT console_command_receipts_pkey');
    await runner.query('ALTER TABLE console_command_receipts ADD PRIMARY KEY (partner_code, tenant_id, actor_id, idempotency_key)');
  }
  async down(): Promise<void> { throw new Error('Use a reviewed forward migration; never discard case or audit history.'); }
}
