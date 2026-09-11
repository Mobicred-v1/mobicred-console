// Local test fixture only. This is not an alternative production authentication path.
const http = require('node:http');
const { randomBytes, createHash, timingSafeEqual } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.CONSOLE_DATABASE_TESTS !== 'true') {
  throw new Error('The fixture identity provider can run only in an explicitly isolated test environment');
}
const origin = 'http://127.0.0.1:4400';
const issuer = `${origin}/realms/staff`;
const callback = 'http://127.0.0.1:3006/auth/callback';
const clientId = 'fixture-client';
const clientSecret = 'fixture-only-secret';
const codes = new Map();
const tokens = new Map();
const random = () => randomBytes(32).toString('base64url');
const json = (response, status, body) => { response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(JSON.stringify(body)); };
async function form(request) {
  let result = '';
  for await (const chunk of request) { result += chunk.toString(); if (result.length > 65536) throw new Error('Body too large'); }
  return new URLSearchParams(result);
}
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, origin);
    if (url.pathname === '/health') return json(response, 200, { fixture: true });
    if (request.method === 'GET' && url.pathname === '/realms/staff/protocol/openid-connect/auth') {
      const q = url.searchParams;
      if (q.get('client_id') !== clientId || q.get('redirect_uri') !== callback || q.get('response_type') !== 'code' || q.get('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(q.get('state') || '') || !/^[A-Za-z0-9_-]{43}$/.test(q.get('code_challenge') || '')) return json(response, 400, { error: 'Invalid fixture authorization request' });
      const code = random();
      codes.set(code, { challenge: q.get('code_challenge'), expires: Date.now() + 60000 });
      const target = new URL(callback);
      target.search = new URLSearchParams({ code, state: q.get('state') }).toString();
      response.writeHead(302, { location: target.toString(), 'cache-control': 'no-store' });
      return response.end();
    }
    if (request.method === 'POST' && url.pathname === '/realms/staff/protocol/openid-connect/token') {
      const body = await form(request);
      const code = body.get('code');
      const entry = codes.get(code);
      codes.delete(code);
      const challenge = createHash('sha256').update(body.get('code_verifier') || '').digest('base64url');
      if (body.get('client_id') !== clientId || body.get('client_secret') !== clientSecret || body.get('grant_type') !== 'authorization_code' || body.get('redirect_uri') !== callback || !entry || entry.expires <= Date.now() || !timingSafeEqual(Buffer.from(entry.challenge), Buffer.from(challenge))) return json(response, 400, { error: 'Invalid fixture code or verifier' });
      const token = random();
      tokens.set(token, { active: true, iss: issuer, aud: 'console', sub: 'fixture-operator', exp: Math.floor(Date.now() / 1000) + 600, tenant_ids: ['tenant-a'], realm_access: { roles: ['OPS'] } });
      return json(response, 200, { access_token: token, token_type: 'Bearer', expires_in: 600 });
    }
    if (request.method === 'POST' && url.pathname === '/realms/staff/protocol/openid-connect/token/introspect') {
      const body = await form(request);
      if (body.get('client_id') !== clientId || body.get('client_secret') !== clientSecret) return json(response, 401, { error: 'Fixture client denied' });
      const claims = tokens.get(body.get('token'));
      return json(response, 200, claims && claims.exp > Date.now() / 1000 ? claims : { active: false });
    }
    return json(response, 404, { error: 'Fixture route not found' });
  } catch { return json(response, 400, { error: 'Invalid fixture request' }); }
});
server.listen(4400, '127.0.0.1', () => console.log('Isolated identity fixture listening on loopback')); 
process.on('SIGTERM', () => server.close());
