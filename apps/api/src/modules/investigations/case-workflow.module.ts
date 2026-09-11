import { Module } from '@nestjs/common';
import { ConsoleCasesController } from './application/controllers/console-cases.controller';
import { CaseWorkflowService } from './application/case-workflow.service';
import { CaseWorkflowStore } from './infrastructure/repositories/case-workflow.store';
@Module({ controllers: [ConsoleCasesController], providers: [CaseWorkflowService, CaseWorkflowStore], exports: [CaseWorkflowService] })
export class CaseWorkflowModule {}
