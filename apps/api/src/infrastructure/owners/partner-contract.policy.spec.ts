import { randomUUID } from 'node:crypto';
import { projectPartnerResponse } from './partner-contract.policy';
const stamp = new Date().toISOString();
const p = { partnerId: randomUUID(), partnerCode: 'alpha', displayName: 'Alpha', legalName: null, status: 'ACTIVE', countryCodes: ['CI'], updatedAt: stamp };
const c = { partnerCode: 'alpha', tenantId: 'sandbox', credentialId: randomUUID(), credentialKey: 'pk_fixture', status: 'ACTIVE', scopes: ['customers:read'], expiresAt: null, lastUsedAt: null };
describe('strict partner contract projection', () => {
  it('drops arbitrary provider fields, internal IDs and secret material on inventory reads', () => {
    const result = projectPartnerResponse({ schemaVersion: 1, items: [{ ...p, id: 'internal', apiKey: 'NEVER', secretHash: 'NEVER', metadata: { password: 'NEVER' } }], meta: { total: 1, page: 1, limit: 25 }, observedAt: stamp, token: 'NEVER' }, 'list');
    expect(JSON.stringify(result)).not.toContain('NEVER'); expect(JSON.stringify(result)).not.toContain('internal');
  });
  it('returns a secret only on the first successful credential command', () => {
    const key = `mk_${'a'.repeat(43)}`;
    const base = { schemaVersion: 1, action: 'issue_credential', partnerCode: 'alpha', tenantId: 'sandbox', receiptId: randomUUID(), credential: c, secretAvailable: true, replayed: false, apiKey: key };
    expect(projectPartnerResponse(base, 'command').apiKey).toBe(key);
    expect(() => projectPartnerResponse({ ...base, replayed: true }, 'command')).toThrow();
    expect(() => projectPartnerResponse({ ...base, secretAvailable: false }, 'command')).toThrow();
  });
  it('rejects foreign partner customer links and invalid schema versions', () => {
    const value = { schemaVersion: 1, partnerCode: 'alpha', tenantId: 'sandbox', meta: { total: 1, page: 1, limit: 25 }, observedAt: stamp, items: [{ referenceId: randomUUID(), customerId: randomUUID(), partnerCode: 'beta', tenantId: 'sandbox', partnerCustomerRef: 'one', status: 'ACTIVE', customerStatus: null, kycLevel: null, createdAt: stamp }] };
    expect(() => projectPartnerResponse(value, 'customers')).toThrow();
    expect(() => projectPartnerResponse({ ...value, schemaVersion: 2 }, 'customers')).toThrow();
  });
  it('rejects malformed response shapes rather than displaying invented empty records', () => {
    for (const value of [null, {}, { schemaVersion: 1, items: [] }, { schemaVersion: 1, items: Array(101).fill(p) }]) expect(() => projectPartnerResponse(value, 'list')).toThrow();
  });
});
