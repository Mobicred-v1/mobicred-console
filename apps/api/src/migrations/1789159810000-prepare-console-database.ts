import { MigrationInterface, QueryRunner } from 'typeorm';
export class PrepareConsoleDatabase1789159810000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  }
  async down(): Promise<void> { /* Shared extension intentionally retained. */ }
}
