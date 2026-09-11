export type OwnerReadStatus = 'live' | 'stale' | 'unavailable' | 'unauthorized';

export type OwnerSlice<T> = {
  owner: 'core' | 'payment-gateway' | 'credit-intelligence' | 'alias';
  status: OwnerReadStatus;
  observedAt: string;
  data: T | null;
  disagreement?: string;
};

export const CORE_CUSTOMER_PORT = Symbol('CORE_CUSTOMER_PORT');
export const PAYMENT_INVESTIGATION_PORT = Symbol('PAYMENT_INVESTIGATION_PORT');
export const CREDIT_EVIDENCE_PORT = Symbol('CREDIT_EVIDENCE_PORT');

export interface CoreCustomerPort {
  lookup(input: {
    customerRef: string;
    tenantId: string;
  }): Promise<OwnerSlice<Record<string, unknown>>>;
}

export interface PaymentInvestigationPort {
  lookup(input: {
    customerRef: string;
    tenantId: string;
  }): Promise<OwnerSlice<Record<string, unknown>>>;
}

export interface CreditEvidencePort {
  lookup(input: {
    customerRef: string;
    tenantId: string;
  }): Promise<OwnerSlice<Record<string, unknown>>>;
}
