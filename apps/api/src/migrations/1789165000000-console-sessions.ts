import { MigrationInterface, QueryRunner } from 'typeorm';
export class ConsoleSessions1789165000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE console_sessions (
      id_hash varchar(64) PRIMARY KEY,
      staff_id varchar(255) NOT NULL,
      tenant_id varchar(96) NOT NULL,
      token_ciphertext text NOT NULL,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query('CREATE INDEX console_sessions_expiry_idx ON console_sessions (expires_at)');
    await queryRunner.query('CREATE INDEX investigation_cases_tenant_created_idx ON investigation_cases (tenant_id, created_at DESC) WHERE deleted_at IS NULL');
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS investigation_cases_tenant_created_idx');
    await queryRunner.query('DROP TABLE console_sessions');
  }
}
