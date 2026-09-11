import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  CORE_CUSTOMER_PORT,
  CREDIT_EVIDENCE_PORT,
  PAYMENT_INVESTIGATION_PORT,
  type CoreCustomerPort,
  type CreditEvidencePort,
  type PaymentInvestigationPort,
} from '../../../../infrastructure/owners/owner-ports';
import { InvestigationCaseRepository } from '@modules/investigations/infrastructure/repositories/investigation-case.repository';
import { InvestigationCaseMapper } from '@modules/investigations/infrastructure/mappers/investigation-case.mapper';

export class ComposeInvestigationWorkspaceQuery {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
  ) {}
}

@QueryHandler(ComposeInvestigationWorkspaceQuery)
export class ComposeInvestigationWorkspaceHandler
  implements IQueryHandler<ComposeInvestigationWorkspaceQuery>
{
  constructor(
    private readonly cases: InvestigationCaseRepository,
    private readonly mapper: InvestigationCaseMapper,
    @Inject(CORE_CUSTOMER_PORT) private readonly core: CoreCustomerPort,
    @Inject(PAYMENT_INVESTIGATION_PORT)
    private readonly payments: PaymentInvestigationPort,
    @Inject(CREDIT_EVIDENCE_PORT) private readonly credit: CreditEvidencePort,
  ) {}

  async execute(query: ComposeInvestigationWorkspaceQuery) {
    const investigationCase = await this.cases.findById(query.id);
    if (!investigationCase) {
      return null;
    }

    const customerRef = investigationCase.customerRef;
    const slices = customerRef
      ? await Promise.all([
          this.core.lookup({ customerRef, tenantId: query.tenantId }),
          this.payments.lookup({ customerRef, tenantId: query.tenantId }),
          this.credit.lookup({ customerRef, tenantId: query.tenantId }),
        ])
      : [];

    return {
      case: this.mapper.toResponseDto(investigationCase),
      owners: slices,
      rule: 'Owners may disagree. The console never collapses statuses into one label.',
    };
  }
}
