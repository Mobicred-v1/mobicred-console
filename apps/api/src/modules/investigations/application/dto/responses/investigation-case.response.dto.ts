import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class InvestigationCaseResponseDto {
  @ApiProperty({ description: "Unique identifier", format: "uuid" })
  @Expose()
  id: string;

  @ApiProperty({ description: "The title of the entity", example: "Sample text" })
  @Expose()
  title: string;

  @ApiProperty({ description: "The kind of the entity" })
  @Expose()
  kind: 'customer' | 'payment' | 'credit' | 'partner';

  @ApiProperty({ description: "The status of the entity" })
  @Expose()
  status: 'open' | 'waiting' | 'resolved';

  @ApiProperty({ description: "The severity of the entity" })
  @Expose()
  severity: 'low' | 'medium' | 'high';

  @ApiProperty({ description: "The customer ref of the entity", example: "Sample text" })
  @Expose()
  customerRef: string;

  @ApiProperty({ description: "The assigned staff id of the entity", example: "Sample text" })
  @Expose()
  assignedStaffId: string;

  @ApiProperty({ description: "The source refs of the entity" })
  @Expose()
  sourceRefs: Record<string, any>;

  @ApiProperty({ description: "The tenant id of the entity", example: "Sample text" })
  @Expose()
  tenantId: string;

  @ApiProperty({ description: "Whether the record is active" })
  @Expose()
  isActive: boolean;

  @ApiProperty({ description: "Creation timestamp" })
  @Expose()
  createdAt: Date;

  @ApiProperty({ description: "Last update timestamp" })
  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<InvestigationCaseResponseDto>) {
    Object.assign(this, partial);
  }
}
