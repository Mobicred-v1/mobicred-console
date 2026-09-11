import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { NotFoundException } from "@nestjs/common";
import { InvestigationCaseRepository } from "@modules/investigations/infrastructure/repositories/investigation-case.repository";
import { InvestigationCaseMapper } from "@modules/investigations/infrastructure/mappers/investigation-case.mapper";
import { InvestigationCaseResponseDto } from "@modules/investigations/application/dto/responses/investigation-case.response.dto";

export class GetInvestigationCaseByIdQuery {
  constructor(public readonly id: string) {}
}

@QueryHandler(GetInvestigationCaseByIdQuery)
export class GetInvestigationCaseByIdHandler
  implements IQueryHandler<GetInvestigationCaseByIdQuery, InvestigationCaseResponseDto>
{
  constructor(
    private readonly repository: InvestigationCaseRepository,
    private readonly mapper: InvestigationCaseMapper,
  ) {}

  async execute(query: GetInvestigationCaseByIdQuery): Promise<InvestigationCaseResponseDto> {
    const { id } = query;

    const entity = await this.repository.findById(id);

    if (!entity) {
      throw new NotFoundException(`InvestigationCase with id '${id}' not found`);
    }

    return this.mapper.toResponseDto(entity);
  }
}
