import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CoreCustomerPort,
  CreditEvidencePort,
  OwnerSlice,
  PaymentInvestigationPort,
} from './owner-ports';

const unavailable = (
  owner: OwnerSlice<Record<string, unknown>>['owner'],
  reason: string,
): OwnerSlice<Record<string, unknown>> => ({
  owner,
  status: 'unavailable',
  observedAt: new Date().toISOString(),
  data: null,
  disagreement: reason,
});

@Injectable()
export class CoreCustomerAdapter implements CoreCustomerPort {
  constructor(private readonly config: ConfigService) {}

  lookup(input: {
    customerRef: string;
    tenantId: string;
  }): Promise<OwnerSlice<Record<string, unknown>>> {
    void input;
    const url = this.config.get<string>('owners.coreUrl');
    return Promise.resolve(
      unavailable(
        'core',
        url
          ? 'Core staff composite view is not allowlisted yet'
          : 'CORE_API_URL is not configured',
      ),
    );
  }
}

@Injectable()
export class PaymentInvestigationAdapter implements PaymentInvestigationPort {
  constructor(private readonly config: ConfigService) {}

  lookup(input: {
    customerRef: string;
    tenantId: string;
  }): Promise<OwnerSlice<Record<string, unknown>>> {
    void input;
    const url = this.config.get<string>('owners.paymentGatewayUrl');
    return Promise.resolve(
      unavailable(
        'payment-gateway',
        url
          ? 'Gateway investigation API is not allowlisted yet'
          : 'PAYMENT_GATEWAY_URL is not configured',
      ),
    );
  }
}

@Injectable()
export class CreditEvidenceAdapter implements CreditEvidencePort {
  constructor(private readonly config: ConfigService) {}

  lookup(input: {
    customerRef: string;
    tenantId: string;
  }): Promise<OwnerSlice<Record<string, unknown>>> {
    void input;
    const url = this.config.get<string>('owners.creditIntelligenceUrl');
    return Promise.resolve(
      unavailable(
        'credit-intelligence',
        url
          ? 'Credit Intelligence staff read is not allowlisted yet'
          : 'CREDIT_INTELLIGENCE_URL is not configured',
      ),
    );
  }
}
