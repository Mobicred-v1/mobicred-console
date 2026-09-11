export interface InvestigationCaseEntityProps {
  id?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
  title: string;
  kind: 'customer' | 'payment' | 'credit' | 'partner';
  status: 'open' | 'waiting' | 'resolved';
  severity: 'low' | 'medium' | 'high';
  customerRef?: string;
  assignedStaffId?: string;
  sourceRefs?: Record<string, any>;
  tenantId: string;
}

export class InvestigationCaseEntity {
  public readonly id?: string;
  public readonly isActive?: boolean;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
  public readonly deletedAt?: Date;
  public readonly title: string;
  public readonly kind: 'customer' | 'payment' | 'credit' | 'partner';
  public readonly status: 'open' | 'waiting' | 'resolved';
  public readonly severity: 'low' | 'medium' | 'high';
  public readonly customerRef?: string;
  public readonly assignedStaffId?: string;
  public readonly sourceRefs?: Record<string, any>;
  public readonly tenantId: string;

  constructor(props: InvestigationCaseEntityProps) {
    Object.assign(this, props);
  }

  /**
   * Create a copy of the entity with updated properties
   */
  public update(props: Partial<InvestigationCaseEntityProps>): InvestigationCaseEntity {
    return new InvestigationCaseEntity({
      ...this,
      ...props,
      updatedAt: new Date(),
    });
  }

  /**
   * Check if the entity is valid for persistence
   */
  public isValid(): boolean {
    // Add your validation logic here
    return true;
  }
}
