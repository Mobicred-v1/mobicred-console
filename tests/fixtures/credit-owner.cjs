'use strict';
// Isolated CI fixture. No production adapter can select this fixture through request input.
const http = require('node:http');
if (process.env.NODE_ENV !== 'test' || process.env.CONSOLE_DATABASE_TESTS !== 'true') {
  throw new Error('The owner fixture requires an explicitly isolated test environment');
}
const origin = 'http://127.0.0.1:4500';
const modes = new Set(['valid', 'foreign', 'denied', 'unavailable', 'stale', 'malformed', 'redirect']);
let mode = 'valid';
const json = (response, status, body) => {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
};
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, origin);
    if (request.method === 'GET' && url.pathname === '/health') return json(response, 200, { fixture: true });
    if (request.method === 'POST' && url.pathname === '/__fixture/mode' && modes.has(url.searchParams.get('value'))) {
      mode = url.searchParams.get('value');
      return json(response, 200, { mode });
    }
    if (request.method !== 'GET' || url.pathname !== '/api/v1/ingestion/admin/data-source-quality') return json(response, 404, { error: 'Unapproved fixture route' });
    if (url.search !== '?tenant_id=tenant-a' || request.headers['x-api-key'] || request.headers['x-console-session']) return json(response, 403, { error: 'Invalid delegated scope' });
    const match = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '');
    if (!match) return json(response, 401, { error: 'Verified staff bearer required' });
    const verification = await fetch('http://127.0.0.1:4400/realms/staff/protocol/openid-connect/token/introspect', {
      method: 'POST', signal: AbortSignal.timeout(3000),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: 'fixture-client', client_secret: 'fixture-only-secret', token: match[1] }),
    });
    const actor = await verification.json();
    if (!verification.ok || actor.active !== true || !actor.tenant_ids?.includes('tenant-a') || !actor.realm_access?.roles?.includes('OPS')) return json(response, 403, { error: 'Owner policy denied' });
    if (mode === 'denied') return json(response, 403, { error: 'Fixture owner denied' });
    if (mode === 'unavailable') return json(response, 503, { error: 'Fixture source unavailable' });
    if (mode === 'redirect') { response.writeHead(302, { location: '/unexpected' }); return response.end(); }
    const generated = new Date(Date.now() - (mode === 'stale' ? 600000 : 0)).toISOString();
    const source = { tenant_id: 'tenant-a', partner_code: 'fixture-partner', source_code: 'fixture-monthly', owner: 'Fixture partner', ingestion_mode: 'BATCH', consent_basis: 'synthetic-test-consent', trust_level: 0.8, is_active: true, ingestion_job_count: 12, accepted_job_count: 10, failed_job_count: 2, latest_received_at: new Date(Date.now() - 3600000).toISOString(), credential: 'never-serialize-fixture-secret', payload: { phone: 'never-serialize-fixture-phone' } };
    if (mode === 'foreign') source.tenant_id = 'tenant-b';
    if (mode === 'malformed') source.failed_job_count = 99;
    return json(response, 200, { generated_at: generated, filters: { tenant_id: 'tenant-a', partner_code: null }, sources: [source] });
  } catch { return json(response, 503, { error: 'Fixture unavailable' }); }
});
server.listen(4500, '127.0.0.1', () => console.log('Isolated owner fixture listening on loopback'));
process.on('SIGTERM', () => server.close());
