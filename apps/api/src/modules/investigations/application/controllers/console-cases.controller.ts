import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { CaseWorkflowService } from '../case-workflow.service';
import { CaseCommandDto, CaseListDto, NewCaseDto } from '../dto/case-workflow.dto';
import type { StaffRequest } from '../../../../shared/auth/staff-auth.guard';

@Controller('console-cases')
export class ConsoleCasesController {
  constructor(private readonly workflow: CaseWorkflowService) {}
  @Get() list(@Req() req: StaffRequest, @Query() query: CaseListDto) { return this.workflow.list(req.staff!, query); }
  @Get('audit') audit(@Req() req: StaffRequest) { return this.workflow.audit(req.staff!); }
  @Get('reports') reports(@Req() req: StaffRequest) { return this.workflow.reports(req.staff!); }
  @Get(':id') detail(@Req() req: StaffRequest, @Param('id', ParseUUIDPipe) id: string) { return this.workflow.detail(req.staff!, id); }
  @Post() create(@Req() req: StaffRequest, @Headers('idempotency-key') key: string | undefined, @Body() body: NewCaseDto) { return this.workflow.create(req.staff!, key, body); }
  @Post(':id/commands') command(@Req() req: StaffRequest, @Param('id', ParseUUIDPipe) id: string, @Headers('idempotency-key') key: string | undefined, @Body() body: CaseCommandDto) { return this.workflow.command(req.staff!, id, key, body); }
}
