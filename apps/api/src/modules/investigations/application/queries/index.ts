export * from './get-investigation-case-by-id.query';
export * from './get-all-investigation-cases.query';
import { GetInvestigationCaseByIdHandler } from './get-investigation-case-by-id.query';
import { GetAllInvestigationCasesHandler } from './get-all-investigation-cases.query';
export * from './compose-investigation-workspace.handler';
import { ComposeInvestigationWorkspaceHandler } from './compose-investigation-workspace.handler';
export const Queries = [
  GetInvestigationCaseByIdHandler,
  GetAllInvestigationCasesHandler,
  ComposeInvestigationWorkspaceHandler,
];
