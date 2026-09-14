'use strict';
const http = require('node:http');
const { randomBytes, randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.CONSOLE_DATABASE_TESTS !== 'true') throw new Error('Owner fixtures are restricted to isolated tests');
const origin = 'http://127.0.0.1:4500'; let mode = 'valid'; let coreMode = 'valid';
const partners = new Map(); const receipts = new Map();
const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
const stamp = () => new Date().toISOString();
function seed(code, name) {
  const p = { partnerId: randomUUID(), partnerCode: code, displayName: name, legalName: null, status: 'ACTIVE', countryCodes: ['CI'], updatedAt: stamp() };
  partners.set(code, { partner: p, tenants: [{ partnerCode: code, tenantId: 'sandbox', displayName: 'Sandbox', environment: 'SANDBOX', status: 'ACTIVE', countryCodes: ['CI'] }], credentials: [], policies: [{ policyId: randomUUID(), partnerCode: code, tenantId: 'sandbox', name: 'Initial access', status: 'ACTIVE', scopes: ['customers:read', 'users:read'], ipAllowlist: ['203.0.113.8/32'], countryCodes: ['CI'] }], customers: [{ referenceId: randomUUID(), partnerCode: code, tenantId: 'sandbox', partnerCustomerRef: `${code}-customer-one`, customerId: randomUUID(), status: 'ACTIVE', customerStatus: 'ACTIVE', kycLevel: 'FULL', createdAt: stamp() }] });
}
seed('alpha', 'Alpha Retail'); seed('beta', 'Beta Distribution');
async function payload(req) { let value = ''; for await (const part of req) { value += part.toString(); if (value.length > 16384) throw new Error(); } return value ? JSON.parse(value) : {}; }
async function staff(req) {
  if (req.headers['x-api-key'] || req.headers['x-console-session']) return null;
  const match = /^Bearer (\S+)$/.exec(req.headers.authorization ?? ''); if (!match) return null;
  const response = await fetch('http://127.0.0.1:4400/realms/staff/protocol/openid-connect/token/introspect', { method: 'POST', signal: AbortSignal.timeout(3000), headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: 'fixture-client', client_secret: 'fixture-only-secret', token: match[1] }) });
  const actor = await response.json(); return response.ok && actor.active === true && actor.realm_access?.roles?.some((r) => ['OPS', 'ADMIN'].includes(r)) ? actor : null;
}
const paginate = (items, url) => { const page = Number(url.searchParams.get('page') || 1); const limit = Number(url.searchParams.get('limit') || 25); return { items: items.slice((page - 1) * limit, page * limit), meta: { page, limit, total: items.length } }; };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin);
    if (url.pathname === '/health') return json(res, 200, { fixture: true });
    if (req.method === 'POST' && url.pathname === '/__fixture/mode' && ['valid', 'foreign', 'denied', 'unavailable', 'stale', 'malformed', 'redirect'].includes(url.searchParams.get('value'))) { mode = url.searchParams.get('value'); return json(res, 200, {}); }
    if (req.method === 'POST' && url.pathname === '/__fixture/core-mode' && ['valid', 'denied', 'unavailable'].includes(url.searchParams.get('value'))) { coreMode = url.searchParams.get('value'); return json(res, 200, {}); }
    const actor = await staff(req); if (!actor) return json(res, 403, {});
    if (req.method === 'GET' && url.pathname === '/api/v1/ingestion/admin/data-source-quality') {
      if (mode === 'denied') return json(res, 403, {}); if (mode === 'unavailable') return json(res, 503, {});
      if (mode === 'redirect') { res.writeHead(302, { location: '/unexpected' }); return res.end(); }
      const tenant = url.searchParams.get('tenant_id'); const partner = url.searchParams.get('partner_code');
      if (Boolean(tenant) !== Boolean(partner)) return json(res, 400, {});
      const sources = [...partners.keys()].filter((code) => !partner || partner === code).map((code) => ({ tenant_id: tenant || 'sandbox', partner_code: mode === 'foreign' ? 'foreign-partner' : code, source_code: 'fixture-monthly', owner: partners.get(code).partner.displayName, ingestion_mode: 'BATCH', consent_basis: 'synthetic-test-consent', trust_level: 0.8, is_active: true, ingestion_job_count: 12, accepted_job_count: 10, failed_job_count: mode === 'malformed' ? 99 : 2, latest_received_at: new Date(Date.now() - 3600000).toISOString(), credential: 'never-serialize-fixture-secret', payload: { phone: 'never-serialize-fixture-phone' } }));
      return json(res, 200, { generated_at: new Date(Date.now() - (mode === 'stale' ? 600000 : 0)).toISOString(), filters: { tenant_id: tenant, partner_code: partner }, sources });
    }
    const prefix = '/internal/staff/partner-workspace';
    if (!url.pathname.startsWith(prefix)) return json(res, 404, {});
    if (coreMode !== 'valid') return json(res, coreMode === 'denied' ? 403 : 503, {});
    const tail = url.pathname.slice(prefix.length).split('/').filter(Boolean);
    if (req.method === 'GET' && tail.length === 0) {
      const q = (url.searchParams.get('q') || '').toLowerCase(); const items = [...partners.values()].map((p) => p.partner).filter((p) => `${p.displayName} ${p.partnerCode}`.toLowerCase().includes(q));
      return json(res, 200, { schemaVersion: 1, ...paginate(items, url), observedAt: stamp() });
    }
    if (req.method === 'POST' && tail[0] === 'commands') {
      const command = await payload(req); const key = req.headers['idempotency-key'];
      if (!/^[0-9a-f-]{36}$/i.test(key || '') || !command.partnerCode || !command.tenantId || !command.reason || command.reason.length < 10) return json(res, 400, {});
      const keyScope = `${actor.sub}:${key}`; const serialized = JSON.stringify(command);
      if (receipts.has(keyScope)) { const old = receipts.get(keyScope); return old.body === serialized ? json(res, 201, { ...old.result, replayed: true, secretAvailable: false }) : json(res, 409, {}); }
      const code = command.partnerCode; let p = partners.get(code); let apiKey;
      const result = { schemaVersion: 1, action: command.action, partnerCode: code, tenantId: command.tenantId, receiptId: randomUUID() };
      if (command.action === 'create_partner') {
        if (p) return json(res, 409, {});
        p = { partner: { partnerId: randomUUID(), partnerCode: code, displayName: command.displayName, legalName: command.legalName || null, status: 'ACTIVE', countryCodes: command.countryCodes, updatedAt: stamp() }, tenants: [], credentials: [], policies: [], customers: [] };
        partners.set(code, p); result.partner = p.partner;
      }
      if (!p) return json(res, 404, {});
      if (['create_partner', 'create_environment'].includes(command.action)) {
        if (p.tenants.some((e) => e.tenantId === command.tenantId)) return json(res, 409, {});
        const environment = { partnerCode: code, tenantId: command.tenantId, displayName: command.displayName, environment: command.environment, status: 'ACTIVE', countryCodes: command.countryCodes };
        p.tenants.push(environment); p.policies.push({ policyId: randomUUID(), partnerCode: code, tenantId: command.tenantId, name: 'Console initial access', status: 'ACTIVE', ipAllowlist: command.ipAllowlist, scopes: command.scopes, countryCodes: command.countryCodes }); result.environment = environment;
      } else {
        if (!actor.realm_access.roles.includes('ADMIN')) return json(res, 403, {});
        const old = command.credentialKey ? p.credentials.find((c) => c.credentialKey === command.credentialKey && c.tenantId === command.tenantId) : null;
        if (command.credentialKey && !old) return json(res, 404, {});
        if (command.action === 'revoke_credential') { old.status = 'REVOKED'; result.credential = { ...old }; }
        else if (['issue_credential', 'rotate_credential'].includes(command.action)) {
          if (!p.tenants.some((e) => e.tenantId === command.tenantId) || (old && old.status !== 'ACTIVE')) return json(res, 409, {});
          if (old) old.status = 'REVOKED';
          const credential = { partnerCode: code, tenantId: command.tenantId, credentialId: randomUUID(), credentialKey: `pk_${randomBytes(16).toString('hex')}`, status: 'ACTIVE', scopes: command.scopes, expiresAt: command.expiresAt || null, lastUsedAt: null };
          p.credentials.push(credential); result.credential = credential; result.replacedCredentialKey = old?.credentialKey || null;
          apiKey = `mk_${randomBytes(32).toString('base64url')}`;
        } else return json(res, 400, {});
      }
      receipts.set(keyScope, { body: serialized, result: structuredClone(result) });
      return json(res, 201, { ...result, ...(apiKey ? { apiKey } : {}), replayed: false, secretAvailable: Boolean(apiKey) });
    }
    const p = partners.get(tail[0]); if (!p) return json(res, 404, {});
    if (req.method === 'GET' && tail.length === 1) return json(res, 200, { schemaVersion: 1, partner: p.partner, tenants: p.tenants, credentials: p.credentials, policies: p.policies, totals: { tenants: p.tenants.length, credentials: p.credentials.length, policies: p.policies.length }, observedAt: stamp() });
    if (req.method === 'GET' && tail[1] === 'context') { const e = p.tenants.find((e) => e.tenantId === tail[2] && e.status === 'ACTIVE'); return e ? json(res, 200, { schemaVersion: 1, ...e, partnerName: p.partner.displayName }) : json(res, 404, {}); }
    if (req.method === 'GET' && tail[1] === 'customers') { const tenant = url.searchParams.get('tenantId'); const q = url.searchParams.get('q') || ''; const items = p.customers.filter((c) => (!tenant || c.tenantId === tenant) && c.partnerCustomerRef.includes(q)); return json(res, 200, { schemaVersion: 1, partnerCode: tail[0], tenantId: tenant, ...paginate(items, url), observedAt: stamp() }); }
    return json(res, 404, {});
  } catch { return json(res, 503, {}); }
});
server.listen(4500, '127.0.0.1', () => console.log('Isolated Core and ingestion contract fixtures ready'));
process.on('SIGTERM', () => server.close());
