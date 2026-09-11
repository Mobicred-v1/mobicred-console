export * from './create-investigation-case.use-case';
export * from './update-investigation-case.use-case';
import { CreateInvestigationCaseUseCase } from './create-investigation-case.use-case';
import { UpdateInvestigationCaseUseCase } from './update-investigation-case.use-case';
export const UseCases = [
  CreateInvestigationCaseUseCase,
  UpdateInvestigationCaseUseCase,
];
