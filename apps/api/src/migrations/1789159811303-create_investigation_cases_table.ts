import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateInvestigationCaseTable1789159811303 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "investigation_cases",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "title",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "kind",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "status",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "severity",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "customer_ref",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "assigned_staff_id",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "source_refs",
            type: "jsonb",
            isNullable: true,
          },
          {
            name: "tenant_id",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "is_active",
            type: "boolean",
            default: true,
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "updated_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "deleted_at",
            type: "timestamp",
            isNullable: true,
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("investigation_cases");
  }
}
