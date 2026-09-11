import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CreateInvestigationCaseCommand } from "@modules/investigations/application/commands/create-investigation-case.command";
import { UpdateInvestigationCaseCommand } from "@modules/investigations/application/commands/update-investigation-case.command";
import { GetInvestigationCaseByIdQuery } from "@modules/investigations/application/queries/get-investigation-case-by-id.query";
import { GetAllInvestigationCasesQuery } from "@modules/investigations/application/queries/get-all-investigation-cases.query";
import { CreateInvestigationCaseDto } from "@modules/investigations/application/dto/requests/create-investigation-case.dto";
import { UpdateInvestigationCaseDto } from "@modules/investigations/application/dto/requests/update-investigation-case.dto";
import { InvestigationCaseResponseDto } from "@modules/investigations/application/dto/responses/investigation-case.response.dto";
import { PaginatedResponseDto } from "@modules/investigations/application/dto/responses/paginated.response.dto";
import { PaginationQueryDto } from "@modules/investigations/application/dto/requests/pagination.query.dto";
import { ComposeInvestigationWorkspaceQuery } from "@modules/investigations/application/queries/compose-investigation-workspace.handler";
import { StaffAuthGuard } from "../../../../shared/auth/staff-auth.guard";

@ApiTags("InvestigationCases")
@Controller("investigation-cases")
@UseGuards(StaffAuthGuard)
export class InvestigationCaseController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new investigationCase" })
  @ApiResponse({ status: 201, description: "InvestigationCase created successfully", type: InvestigationCaseResponseDto })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  async create(
    @Body() dto: CreateInvestigationCaseDto,
    @Headers("x-mobicred-tenant-id") tenantId: string,
  ): Promise<InvestigationCaseResponseDto> {
    const command = new CreateInvestigationCaseCommand(dto, { tenantId });
    return this.commandBus.execute(command);
  }

  @Get()
  @ApiOperation({ summary: "Get all investigationCases with pagination" })
  @ApiResponse({ status: 200, description: "List of investigationCases", type: PaginatedResponseDto })
  async findAll(
    @Query() pagination: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<InvestigationCaseResponseDto>> {
    const query = new GetAllInvestigationCasesQuery(pagination);
    return this.queryBus.execute(query);
  }

  @Get(":id/workspace")
  @ApiOperation({
    summary: "Compose an investigation workspace without collapsing owner statuses",
  })
  @ApiParam({ name: "id", description: "InvestigationCase ID", type: "string", format: "uuid" })
  async workspace(
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("x-mobicred-tenant-id") tenantId: string,
  ) {
    const composed = await this.queryBus.execute(
      new ComposeInvestigationWorkspaceQuery(id, tenantId),
    );
    if (!composed) {
      throw new NotFoundException(`InvestigationCase with id '${id}' not found`);
    }
    return composed;
  }

  @Get(":id")
  @ApiOperation({ summary: "Get investigationCase by ID" })
  @ApiParam({ name: "id", description: "InvestigationCase ID", type: "string", format: "uuid" })
  @ApiResponse({ status: 200, description: "InvestigationCase found", type: InvestigationCaseResponseDto })
  @ApiResponse({ status: 404, description: "InvestigationCase not found" })
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<InvestigationCaseResponseDto> {
    const query = new GetInvestigationCaseByIdQuery(id);
    return this.queryBus.execute(query);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update investigationCase" })
  @ApiParam({ name: "id", description: "InvestigationCase ID", type: "string", format: "uuid" })
  @ApiResponse({ status: 200, description: "InvestigationCase updated successfully", type: InvestigationCaseResponseDto })
  @ApiResponse({ status: 404, description: "InvestigationCase not found" })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvestigationCaseDto,
  ): Promise<InvestigationCaseResponseDto> {
    const command = new UpdateInvestigationCaseCommand(id, dto);
    return this.commandBus.execute(command);
  }

}
