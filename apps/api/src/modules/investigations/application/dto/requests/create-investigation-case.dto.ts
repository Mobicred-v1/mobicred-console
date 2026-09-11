import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsDecimal,
  IsDefined,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  ArrayMaxSize,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateInvestigationCaseDto {
  @ApiProperty({ description: "The title of the entity", example: "Sample text" })
  @IsNotEmpty()
  @IsDefined()
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: "The kind of the entity" })
  @IsNotEmpty()
  @IsDefined()
  @IsIn(['customer', 'payment', 'credit', 'partner'])
  kind: 'customer' | 'payment' | 'credit' | 'partner';

  @ApiProperty({ description: "The status of the entity" })
  @IsNotEmpty()
  @IsDefined()
  @IsIn(['open', 'waiting', 'resolved'])
  status: 'open' | 'waiting' | 'resolved';

  @ApiProperty({ description: "The severity of the entity" })
  @IsNotEmpty()
  @IsDefined()
  @IsIn(['low', 'medium', 'high'])
  severity: 'low' | 'medium' | 'high';

  @ApiPropertyOptional({ description: "The customer ref of the entity", example: "Sample text" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  customerRef?: string;

  @ApiPropertyOptional({ description: "The assigned staff id of the entity", example: "Sample text" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  assignedStaffId?: string;

  @ApiPropertyOptional({ description: "The source refs of the entity" })
  @IsOptional()
  @IsObject()
  sourceRefs?: Record<string, any>;

}
