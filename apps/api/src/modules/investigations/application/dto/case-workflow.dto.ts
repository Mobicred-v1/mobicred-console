import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { CaseAction, CaseStatus } from '../case-workflow.policy';

export class CaseListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsIn(['open', 'waiting', 'resolved']) status?: CaseStatus;
}
export class NewCaseDto {
  @IsString() @MinLength(5) @MaxLength(120) title!: string;
  @IsIn(['customer', 'payment', 'credit', 'partner']) kind!: 'customer' | 'payment' | 'credit' | 'partner';
  @IsIn(['low', 'medium', 'high']) severity!: 'low' | 'medium' | 'high';
  @IsString() @MinLength(10) @MaxLength(1000) reason!: string;
  @IsOptional() @IsString() @MaxLength(96) @Matches(/^[A-Za-z0-9:_-]+$/) customerRef?: string;
}
export class CaseCommandDto {
  @IsIn(['assign_to_me', 'set_status', 'add_note']) action!: CaseAction;
  @IsInt() @Min(1) expectedVersion!: number;
  @IsString() @MinLength(10) @MaxLength(1000) reason!: string;
  @IsOptional() @IsIn(['open', 'waiting', 'resolved']) status?: CaseStatus;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(2000) note?: string;
}
