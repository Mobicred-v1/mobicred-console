import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { InvestigationCaseRepository } from '@modules/investigations/infrastructure/repositories/investigation-case.repository';
import { InvestigationCaseMapper } from '@modules/investigations/infrastructure/mappers/investigation-case.mapper';
export class GetInvestigationCaseByIdQuery { constructor(public readonly id: string, public readonly tenantId?: string) {} }
@QueryHandler(GetInvestigationCaseByIdQuery)
export class GetInvestigationCaseByIdHandler implements IQueryHandler<GetInvestigationCaseByIdQuery> {
  constructor(private readonly repository: InvestigationCaseRepository, private readonly mapper: InvestigationCaseMapper) {}
  async execute(query: GetInvestigationCaseByIdQuery) {
    const entity = await this.repository.findById(query.id, query.tenantId);
    if (!entity) throw new NotFoundException('Investigation case not found');
    return this.mapper.toResponseDto(entity);
  }
}
