type Row = Record<string, unknown>;
const row = (v: unknown): Row => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid partner response'); return v as Row; };
const str = (v: unknown, max = 255): string => { if (typeof v !== 'string' || !v.length || v.length > max || /[\u0000-\u001f\u007f]/.test(v)) throw new Error('Invalid field'); return v; };
const code = (v: unknown) => { const value = str(v, 64); if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(value)) throw new Error('Invalid code'); return value; };
const uuid = (v: unknown) => { const value = str(v, 36); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error('Invalid ID'); return value; };
const num = (v: unknown) => { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) throw new Error('Invalid count'); return v; };
const bool = (v: unknown) => { if (typeof v !== 'boolean') throw new Error('Invalid flag'); return v; };
const list = (v: unknown, max = 100): unknown[] => { if (!Array.isArray(v) || v.length > max) throw new Error('Invalid list'); return v; };
const strings = (v: unknown) => list(v).map((x) => str(x, 128));
const time = (v: unknown): string => { const value = str(v, 40); if (!Number.isFinite(Date.parse(value))) throw new Error('Invalid time'); return value; };
const optional = (v: unknown) => v === null ? null : str(v);
function partner(value: unknown) { const r = row(value); return { partnerId: uuid(r.partnerId), partnerCode: code(r.partnerCode), displayName: str(r.displayName, 128), legalName: optional(r.legalName), status: str(r.status, 32), countryCodes: strings(r.countryCodes), updatedAt: time(r.updatedAt) }; }
function environment(value: unknown) { const r = row(value); return { partnerCode: code(r.partnerCode), tenantId: code(r.tenantId), displayName: str(r.displayName, 128), environment: str(r.environment, 32), status: str(r.status, 32), countryCodes: strings(r.countryCodes) }; }
function credential(value: unknown) { const r = row(value); return { partnerCode: code(r.partnerCode), tenantId: code(r.tenantId), credentialId: uuid(r.credentialId), credentialKey: str(r.credentialKey, 96), status: str(r.status, 32), scopes: strings(r.scopes), expiresAt: r.expiresAt === null ? null : time(r.expiresAt), lastUsedAt: r.lastUsedAt === null ? null : time(r.lastUsedAt) }; }
function policy(value: unknown) { const r = row(value); return { policyId: uuid(r.policyId), partnerCode: code(r.partnerCode), tenantId: code(r.tenantId), name: str(r.name, 128), status: str(r.status, 32), scopes: strings(r.scopes), ipAllowlist: strings(r.ipAllowlist), countryCodes: strings(r.countryCodes) }; }
function customer(value: unknown) { const r = row(value); return { referenceId: uuid(r.referenceId), partnerCode: code(r.partnerCode), tenantId: code(r.tenantId), partnerCustomerRef: str(r.partnerCustomerRef), customerId: uuid(r.customerId), status: str(r.status, 32), customerStatus: optional(r.customerStatus), kycLevel: optional(r.kycLevel), createdAt: time(r.createdAt) }; }
function meta(value: unknown) { const r = row(value); const page = num(r.page); const limit = num(r.limit); const total = num(r.total); if (page < 1 || limit < 1 || limit > 100) throw new Error('Invalid pagination'); return { page, limit, total }; }

/** Strict projections: only documented fields may ever reach the browser. */
export function projectPartnerResponse(value: unknown, operation: 'list' | 'detail' | 'customers' | 'context' | 'command'): Record<string, unknown> {
  const r = row(value); if (r.schemaVersion !== 1) throw new Error('Unsupported contract version');
  if (operation === 'list') return { schemaVersion: 1, items: list(r.items).map(partner), meta: meta(r.meta), observedAt: time(r.observedAt) };
  if (operation === 'context') return { schemaVersion: 1, ...environment(r), partnerName: str(r.partnerName, 128) };
  if (operation === 'detail') {
    const p = partner(r.partner); const tenants = list(r.tenants).map(environment); const credentials = list(r.credentials).map(credential); const policies = list(r.policies).map(policy);
    if ([...tenants, ...credentials, ...policies].some((item) => item.partnerCode !== p.partnerCode)) throw new Error('Foreign partner data');
    const t = row(r.totals); const totals = { tenants: num(t.tenants), credentials: num(t.credentials), policies: num(t.policies) };
    if (totals.tenants < tenants.length || totals.credentials < credentials.length || totals.policies < policies.length) throw new Error('Invalid totals');
    return { schemaVersion: 1, partner: p, tenants, credentials, policies, totals, observedAt: time(r.observedAt) };
  }
  if (operation === 'customers') {
    const partnerCode = code(r.partnerCode); const tenantId = r.tenantId === null ? null : code(r.tenantId); const items = list(r.items).map(customer);
    if (items.some((c) => c.partnerCode !== partnerCode || (tenantId && c.tenantId !== tenantId))) throw new Error('Foreign customer data');
    return { schemaVersion: 1, partnerCode, tenantId, items, meta: meta(r.meta), observedAt: time(r.observedAt) };
  }
  const partnerCode = code(r.partnerCode); const tenantId = code(r.tenantId);
  const result: Record<string, unknown> = { schemaVersion: 1, action: str(r.action, 64), partnerCode, tenantId, receiptId: uuid(r.receiptId), replayed: bool(r.replayed), secretAvailable: bool(r.secretAvailable) };
  if (r.partner) { const p = partner(r.partner); if (p.partnerCode !== partnerCode) throw new Error('Foreign partner result'); result.partner = p; }
  if (r.environment) { const e = environment(r.environment); if (e.partnerCode !== partnerCode || e.tenantId !== tenantId) throw new Error('Foreign environment result'); result.environment = e; }
  if (r.credential) { const c = credential(r.credential); if (c.partnerCode !== partnerCode || c.tenantId !== tenantId) throw new Error('Foreign credential result'); result.credential = c; }
  if (r.replacedCredentialKey !== undefined) result.replacedCredentialKey = optional(r.replacedCredentialKey);
  if (r.secretAvailable === true) {
    if (r.replayed !== false || typeof r.apiKey !== 'string' || !/^mk_[A-Za-z0-9_-]{43}$/.test(r.apiKey) || !r.credential) throw new Error('Invalid issuance response');
    result.apiKey = r.apiKey;
  } else if (r.apiKey !== undefined) throw new Error('Unexpected secret');
  return result;
}
