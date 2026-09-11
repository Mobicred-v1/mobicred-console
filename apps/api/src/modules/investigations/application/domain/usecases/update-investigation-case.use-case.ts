import { Injectable, NotFoundException } from "@nestjs/common";
import { InvestigationCaseEntity, InvestigationCaseEntityProps } from "@modules/investigations/application/domain/entities/investigation-case.entity";
import { InvestigationCaseRepository } from "@modules/investigations/infrastructure/repositories/investigation-case.repository";
import { InvestigationCaseMapper } from "@modules/investigations/infrastructure/mappers/investigation-case.mapper";
import { UpdateInvestigationCaseDto } from "@modules/investigations/application/dto/requests/update-investigation-case.dto";
import { InvestigationCaseResponseDto } from "@modules/investigations/application/dto/responses/investigation-case.response.dto";

@Injectable()
export class UpdateInvestigationCaseUseCase {
  constructor(
    private readonly repository: InvestigationCaseRepository,
    private readonly mapper: InvestigationCaseMapper,
  ) {}

  async execute(id: string, dto: UpdateInvestigationCaseDto): Promise<InvestigationCaseResponseDto> {
    const existingEntity = await this.repository.findById(id);

    if (!existingEntity) {
      throw new NotFoundException(`InvestigationCase with id '${id}' not found`);
    }

    const updates: Partial<InvestigationCaseEntityProps> = {};
    if (dto.title !== undefined) {
      updates.title = dto.title;
    }
    if (dto.kind !== undefined) {
      updates.kind = dto.kind;
    }
    if (dto.status !== undefined) {
      updates.status = dto.status;
    }
    if (dto.severity !== undefined) {
      updates.severity = dto.severity;
    }
    if (dto.customerRef !== undefined) {
      updates.customerRef = dto.customerRef;
    }
    if (dto.assignedStaffId !== undefined) {
      updates.assignedStaffId = dto.assignedStaffId;
    }
    if (dto.sourceRefs !== undefined) {
      updates.sourceRefs = dto.sourceRefs;
    }
    if (dto.isActive !== undefined) {
      updates.isActive = dto.isActive;
    }

    const updatedEntity = existingEntity.update(updates);

    const savedEntity = await this.repository.update(id, updatedEntity);
    return this.mapper.toResponseDto(savedEntity);
  }
}
