import { MigrationInterface, QueryRunner } from 'typeorm';
export class AuditedCaseWorkflows1789167000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE investigation_cases ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0)');
    await queryRunner.query(`CREATE TABLE console_case_notes (
      id uuid PRIMARY KEY,
      case_id uuid NOT NULL REFERENCES investigation_cases(id),
      tenant_id varchar(96) NOT NULL,
      author_id varchar(255) NOT NULL,
      body text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query('CREATE INDEX console_case_notes_scope_idx ON console_case_notes (tenant_id, case_id, created_at DESC)');
    await queryRunner.query(`CREATE TABLE console_audit_records (
      id uuid PRIMARY KEY,
      tenant_id varchar(96) NOT NULL,
      actor_id varchar(255) NOT NULL,
      action varchar(100) NOT NULL,
      target_id uuid NOT NULL,
      reason text NOT NULL,
      metadata jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query('CREATE INDEX console_audit_scope_time_idx ON console_audit_records (tenant_id, created_at DESC)');
    await queryRunner.query(`CREATE TABLE console_command_receipts (
      tenant_id varchar(96) NOT NULL,
      actor_id varchar(255) NOT NULL,
      idempotency_key uuid NOT NULL,
      request_hash varchar(64) NOT NULL,
      result jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (tenant_id, actor_id, idempotency_key)
    )`);
    await queryRunner.query(`CREATE FUNCTION console_deny_audit_changes() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Console audit records and case notes are append-only'; END; $$`);
    await queryRunner.query('CREATE TRIGGER console_audit_append_only BEFORE UPDATE OR DELETE ON console_audit_records FOR EACH ROW EXECUTE FUNCTION console_deny_audit_changes()');
    await queryRunner.query('CREATE TRIGGER console_notes_append_only BEFORE UPDATE OR DELETE ON console_case_notes FOR EACH ROW EXECUTE FUNCTION console_deny_audit_changes()');
  }
  async down(): Promise<void> {
    throw new Error('Automatic downgrade would discard audit history. Use a reviewed forward migration and retention plan.');
  }
}
