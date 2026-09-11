import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { CreateInvestigationCaseUseCase, CreateInvestigationCaseServerOwnedFields } from "@modules/investigations/application/domain/usecases/create-investigation-case.use-case";
import { CreateInvestigationCaseDto } from "@modules/investigations/application/dto/requests/create-investigation-case.dto";
import { InvestigationCaseResponseDto } from "@modules/investigations/application/dto/responses/investigation-case.response.dto";

export class CreateInvestigationCaseCommand {
  constructor(
    public readonly data: CreateInvestigationCaseDto,
    public readonly serverOwnedFields?: CreateInvestigationCaseServerOwnedFields,
  ) {}
}

@CommandHandler(CreateInvestigationCaseCommand)
export class CreateInvestigationCaseHandler
  implements ICommandHandler<CreateInvestigationCaseCommand, InvestigationCaseResponseDto>
{
  constructor(private readonly useCase: CreateInvestigationCaseUseCase) {}

  async execute(command: CreateInvestigationCaseCommand): Promise<InvestigationCaseResponseDto> {
    return this.useCase.execute(command.data, command.serverOwnedFields);
  }
}
