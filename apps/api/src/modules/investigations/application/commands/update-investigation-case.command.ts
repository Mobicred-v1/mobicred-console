import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { NotFoundException } from "@nestjs/common";
import { UpdateInvestigationCaseUseCase } from "@modules/investigations/application/domain/usecases/update-investigation-case.use-case";
import { UpdateInvestigationCaseDto } from "@modules/investigations/application/dto/requests/update-investigation-case.dto";
import { InvestigationCaseResponseDto } from "@modules/investigations/application/dto/responses/investigation-case.response.dto";

export class UpdateInvestigationCaseCommand {
  constructor(
    public readonly id: string,
    public readonly data: UpdateInvestigationCaseDto,
  ) {}
}

@CommandHandler(UpdateInvestigationCaseCommand)
export class UpdateInvestigationCaseHandler
  implements ICommandHandler<UpdateInvestigationCaseCommand, InvestigationCaseResponseDto>
{
  constructor(private readonly useCase: UpdateInvestigationCaseUseCase) {}

  async execute(command: UpdateInvestigationCaseCommand): Promise<InvestigationCaseResponseDto> {
    const { id, data } = command;
    return this.useCase.execute(id, data);
  }
}
