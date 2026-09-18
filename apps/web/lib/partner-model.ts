export const partnerScopes = ['customers:read', 'customers:write', 'users:read', 'users:write', 'credit-lines:read', 'credit-applications:read', 'credit-applications:write', 'scores:write'] as const;
export type Partner = { partnerId: string; partnerCode: string; displayName: string; legalName: string | null; status: string; countryCodes: string[]; updatedAt: string };
export type PartnerEnvironment = { partnerCode: string; tenantId: string; displayName: string; environment: string; status: string; countryCodes: string[] };
export type PartnerCredential = { partnerCode: string; tenantId: string; credentialId: string; credentialKey: string; status: string; scopes: string[]; expiresAt: string | null; lastUsedAt: string | null };
export type PartnerPolicy = { policyId: string; tenantId: string; name: string; status: string; scopes: string[]; ipAllowlist: string[]; countryCodes: string[] };
export type PartnerCustomer = { referenceId: string; partnerCode: string; tenantId: string; partnerCustomerRef: string; customerId: string; status: string; customerStatus: string | null; kycLevel: string | null; createdAt: string };
export type PartnerPage = {
  state: import('./console-model').SourceState; error?: string; items: Partner[];
  meta: { page: number; limit: number; total: number }; q: string; tab: string;
  permissions: { canRead: boolean; canCreate: boolean; canManageCredentials: boolean };
  partner?: Partner; tenants: PartnerEnvironment[]; credentials: PartnerCredential[]; policies: PartnerPolicy[];
  totals?: { tenants: number; credentials: number; policies: number };
  customers?: { items: PartnerCustomer[]; meta: { page: number; limit: number; total: number } };
};
