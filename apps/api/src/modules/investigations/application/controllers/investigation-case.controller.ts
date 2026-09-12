import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, ParseUUIDPipe, Post, Put, Query, Req, ServiceUnavailableException } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateInvestigationCaseCommand } from '@modules/investigations/application/commands/create-investigation-case.command';
import { GetInvestigationCaseByIdQuery } from '@modules/investigations/application/queries/get-investigation-case-by-id.query';
import { GetAllInvestigationCasesQuery } from '@modules/investigations/application/queries/get-all-investigation-cases.query';
import { CreateInvestigationCaseDto } from '@modules/investigations/application/dto/requests/create-investigation-case.dto';
import { UpdateInvestigationCaseDto } from '@modules/investigations/application/dto/requests/update-investigation-case.dto';
import { PaginationQueryDto } from '@modules/investigations/application/dto/requests/pagination.query.dto';
import { ComposeInvestigationWorkspaceQuery } from '@modules/investigations/application/queries/compose-investigation-workspace.handler';
import type { StaffRequest } from '../../../../shared/auth/staff-auth.guard';

/** The global staff guard verifies identity and tenant before any controller executes. */
@ApiTags('InvestigationCases')
@Controller('investigation-cases')
export class InvestigationCaseController {
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}
  @Get()
  @ApiOperation({ summary: 'List cases in the verified staff tenant' })
  findAll(@Query() pagination: PaginationQueryDto, @Req() request: StaffRequest) { return this.queryBus.execute(new GetAllInvestigationCasesQuery(pagination, request.staff!.tenantId)); }
  @Get(':id/workspace')
  async workspace(@Param('id', ParseUUIDPipe) id: string, @Req() request: StaffRequest) {
    const result = await this.queryBus.execute(new ComposeInvestigationWorkspaceQuery(id, request.staff!.tenantId));
    if (!result) throw new NotFoundException('Investigation case not found');
    return result;
  }
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() request: StaffRequest) { return this.queryBus.execute(new GetInvestigationCaseByIdQuery(id, request.staff!.tenantId)); }
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() _dto: CreateInvestigationCaseDto) { throw new ServiceUnavailableException('Case writes await durable audit and concurrency controls. Reads remain available.'); }
  @Put(':id')
  update(@Param('id', ParseUUIDPipe) _id: string, @Body() _dto: UpdateInvestigationCaseDto) { throw new ServiceUnavailableException('Generic case updates are disabled until audited commands are installed.'); }
}
