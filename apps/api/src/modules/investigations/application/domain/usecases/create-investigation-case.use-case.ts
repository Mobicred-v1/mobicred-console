import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { InvestigationCaseEntity, InvestigationCaseEntityProps } from "@modules/investigations/application/domain/entities/investigation-case.entity";
import { InvestigationCaseRepository } from "@modules/investigations/infrastructure/repositories/investigation-case.repository";
import { InvestigationCaseMapper } from "@modules/investigations/infrastructure/mappers/investigation-case.mapper";
import { CreateInvestigationCaseDto } from "@modules/investigations/application/dto/requests/create-investigation-case.dto";
import { InvestigationCaseResponseDto } from "@modules/investigations/application/dto/responses/investigation-case.response.dto";

export type CreateInvestigationCaseServerOwnedFields = Pick<
  InvestigationCaseEntityProps,
  | "tenantId"
>;

@Injectable()
export class CreateInvestigationCaseUseCase {
  constructor(
    private readonly repository: InvestigationCaseRepository,
    private readonly mapper: InvestigationCaseMapper,
  ) {}

  async execute(
    dto: CreateInvestigationCaseDto,
    serverOwnedFields?: CreateInvestigationCaseServerOwnedFields,
  ): Promise<InvestigationCaseResponseDto> {
    if (!serverOwnedFields) {
      throw new InternalServerErrorException(
        "Trusted server-owned fields are required to create InvestigationCase: tenantId",
      );
    }

    const entity = new InvestigationCaseEntity({
      title: dto.title,
      kind: dto.kind,
      status: dto.status,
      severity: dto.severity,
      customerRef: dto.customerRef,
      assignedStaffId: dto.assignedStaffId,
      sourceRefs: dto.sourceRefs,
      tenantId: serverOwnedFields.tenantId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const savedEntity = await this.repository.create(entity);
    return this.mapper.toResponseDto(savedEntity);
  }
}
