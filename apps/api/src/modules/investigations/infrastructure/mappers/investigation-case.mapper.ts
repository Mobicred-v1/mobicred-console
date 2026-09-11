import { Injectable } from "@nestjs/common";
import { InvestigationCaseEntity } from "@modules/investigations/application/domain/entities/investigation-case.entity";
import { InvestigationCaseOrmEntity } from "@modules/investigations/infrastructure/orm-entities/investigation-case.orm-entity";
import { InvestigationCaseResponseDto } from "@modules/investigations/application/dto/responses/investigation-case.response.dto";

@Injectable()
export class InvestigationCaseMapper {
  toDomainEntity(ormEntity: InvestigationCaseOrmEntity): InvestigationCaseEntity {
    if (!ormEntity) {
      throw new Error("ORM entity is required");
    }

    return new InvestigationCaseEntity({
      id: ormEntity.id,
      isActive: ormEntity.isActive,
      createdAt: ormEntity.createdAt,
      updatedAt: ormEntity.updatedAt,
      deletedAt: ormEntity.deletedAt ?? undefined,
      // Map additional fields from ORM entity (snake_case) to domain entity (camelCase)
      title: ormEntity.title,
      kind: ormEntity.kind,
      status: ormEntity.status,
      severity: ormEntity.severity,
      customerRef: ormEntity.customer_ref,
      assignedStaffId: ormEntity.assigned_staff_id,
      sourceRefs: ormEntity.source_refs,
      tenantId: ormEntity.tenant_id,
    });
  }

  toOrmEntity(domainEntity: InvestigationCaseEntity): Partial<InvestigationCaseOrmEntity> {
    if (!domainEntity) {
      throw new Error("Domain entity is required");
    }

    const ormEntity: Partial<InvestigationCaseOrmEntity> = {
      id: domainEntity.id,
      isActive: domainEntity.isActive,
      createdAt: domainEntity.createdAt,
      updatedAt: domainEntity.updatedAt,
      deletedAt: domainEntity.deletedAt,
      // Map additional fields from domain entity (camelCase) to ORM entity (snake_case)
      title: domainEntity.title,
      kind: domainEntity.kind,
      status: domainEntity.status,
      severity: domainEntity.severity,
      customer_ref: domainEntity.customerRef,
      assigned_staff_id: domainEntity.assignedStaffId,
      source_refs: domainEntity.sourceRefs,
      tenant_id: domainEntity.tenantId,
    };

    return ormEntity;
  }

  toResponseDto(entity: InvestigationCaseEntity): InvestigationCaseResponseDto {
    return new InvestigationCaseResponseDto({
      id: entity.id,
      isActive: entity.isActive,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      // Map additional fields for response
      title: entity.title,
      kind: entity.kind,
      status: entity.status,
      severity: entity.severity,
      customerRef: entity.customerRef,
      assignedStaffId: entity.assignedStaffId,
      sourceRefs: entity.sourceRefs,
      tenantId: entity.tenantId,
    });
  }

  toResponseDtoList(entities: InvestigationCaseEntity[]): InvestigationCaseResponseDto[] {
    return entities.map((entity) => this.toResponseDto(entity));
  }
}
