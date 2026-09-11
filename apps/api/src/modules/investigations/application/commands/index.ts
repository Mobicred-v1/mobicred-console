export * from './create-investigation-case.command';
export * from './update-investigation-case.command';
import { CreateInvestigationCaseHandler } from './create-investigation-case.command';
import { UpdateInvestigationCaseHandler } from './update-investigation-case.command';
export const CommandHandlers = [
  CreateInvestigationCaseHandler,
  UpdateInvestigationCaseHandler,
];
