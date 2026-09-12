import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InvestigationCaseRepository } from '@modules/investigations/infrastructure/repositories/investigation-case.repository';
import { InvestigationCaseMapper } from '@modules/investigations/infrastructure/mappers/investigation-case.mapper';
import { PaginationQueryDto } from '@modules/investigations/application/dto/requests/pagination.query.dto';
export class GetAllInvestigationCasesQuery { constructor(public readonly pagination: PaginationQueryDto, public readonly tenantId?: string) {} }
@QueryHandler(GetAllInvestigationCasesQuery)
export class GetAllInvestigationCasesHandler implements IQueryHandler<GetAllInvestigationCasesQuery> {
  constructor(private readonly repository: InvestigationCaseRepository, private readonly mapper: InvestigationCaseMapper) {}
  async execute(query: GetAllInvestigationCasesQuery) {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'DESC' } = query.pagination;
    const [entities, total] = await this.repository.findAllPaginated({ tenantId: query.tenantId, skip: (page - 1) * limit, take: limit, orderBy: InvestigationCaseRepository.isOrderByField(sortBy) ? sortBy : 'createdAt', orderDirection: sortOrder });
    return { items: entities.map((e) => this.mapper.toResponseDto(e)), meta: { total, page, limit, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 } };
  }
}
