import { Global, Module } from '@nestjs/common';
import {
  CORE_CUSTOMER_PORT,
  CREDIT_EVIDENCE_PORT,
  PAYMENT_INVESTIGATION_PORT,
} from './owner-ports';
import {
  CoreCustomerAdapter,
  CreditEvidenceAdapter,
  PaymentInvestigationAdapter,
} from './fail-closed.adapters';

@Global()
@Module({
  providers: [
    { provide: CORE_CUSTOMER_PORT, useClass: CoreCustomerAdapter },
    { provide: PAYMENT_INVESTIGATION_PORT, useClass: PaymentInvestigationAdapter },
    { provide: CREDIT_EVIDENCE_PORT, useClass: CreditEvidenceAdapter },
  ],
  exports: [
    CORE_CUSTOMER_PORT,
    PAYMENT_INVESTIGATION_PORT,
    CREDIT_EVIDENCE_PORT,
  ],
})
export class OwnersModule {}
