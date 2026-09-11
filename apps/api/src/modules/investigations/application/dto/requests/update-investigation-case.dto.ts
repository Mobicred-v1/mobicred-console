import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsBoolean } from "class-validator";
import { PartialType } from "@nestjs/swagger";
import { CreateInvestigationCaseDto } from "./create-investigation-case.dto";

export class UpdateInvestigationCaseDto extends PartialType(CreateInvestigationCaseDto) {
  @ApiPropertyOptional({ description: "Whether the record is active" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
