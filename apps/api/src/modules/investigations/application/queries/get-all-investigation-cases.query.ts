import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { InvestigationCaseRepository } from "@modules/investigations/infrastructure/repositories/investigation-case.repository";
import { InvestigationCaseMapper } from "@modules/investigations/infrastructure/mappers/investigation-case.mapper";
import { InvestigationCaseResponseDto } from "@modules/investigations/application/dto/responses/investigation-case.response.dto";
import { PaginatedResponseDto } from "@modules/investigations/application/dto/responses/paginated.response.dto";
import { PaginationQueryDto } from "@modules/investigations/application/dto/requests/pagination.query.dto";

export class GetAllInvestigationCasesQuery {
  constructor(public readonly pagination: PaginationQueryDto) {}
}

@QueryHandler(GetAllInvestigationCasesQuery)
export class GetAllInvestigationCasesHandler
  implements IQueryHandler<GetAllInvestigationCasesQuery, PaginatedResponseDto<InvestigationCaseResponseDto>>
{
  constructor(
    private readonly repository: InvestigationCaseRepository,
    private readonly mapper: InvestigationCaseMapper,
  ) {}

  async execute(
    query: GetAllInvestigationCasesQuery,
  ): Promise<PaginatedResponseDto<InvestigationCaseResponseDto>> {
    const { pagination } = query;
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = pagination;

    const skip = (page - 1) * limit;
    const orderBy = InvestigationCaseRepository.isOrderByField(sortBy)
      ? sortBy
      : "createdAt";

    const [entities, total] = await this.repository.findAllPaginated({
      skip,
      take: limit,
      orderBy,
      orderDirection: sortOrder,
    });

    const items = entities.map((entity) => this.mapper.toResponseDto(entity));

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }
}
