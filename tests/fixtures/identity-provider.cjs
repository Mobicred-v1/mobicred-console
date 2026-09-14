'use strict';
const http = require('node:http');
const { randomBytes, createHash, timingSafeEqual } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.CONSOLE_DATABASE_TESTS !== 'true') throw new Error('Identity fixture is restricted to isolated tests');
const origin = 'http://127.0.0.1:4400'; const issuer = `${origin}/realms/staff`; const callback = 'http://127.0.0.1:3006/auth/callback';
const clientId = 'fixture-client'; const clientSecret = 'fixture-only-secret';
const codes = new Map(); const tokens = new Map(); let mode = 'staff';
const random = () => randomBytes(32).toString('base64url');
const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
async function form(req) { let text = ''; for await (const part of req) { text += part.toString(); if (text.length > 65536) throw new Error(); } return new URLSearchParams(text); }
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin);
    if (url.pathname === '/health') return json(res, 200, { fixture: true });
    if (req.method === 'POST' && url.pathname === '/__fixture/mode' && ['staff', 'non-staff', 'short', 'unavailable'].includes(url.searchParams.get('value'))) { mode = url.searchParams.get('value'); return json(res, 200, {}); }
    if (req.method === 'POST' && url.pathname === '/__fixture/revoke') { for (const token of tokens.values()) token.active = false; return json(res, 200, {}); }
    if (req.method === 'GET' && url.pathname === '/realms/staff/protocol/openid-connect/auth') {
      const q = url.searchParams;
      if (q.get('client_id') !== clientId || q.get('redirect_uri') !== callback || q.get('response_type') !== 'code' || q.get('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(q.get('state') || '') || !/^[A-Za-z0-9_-]{43}$/.test(q.get('code_challenge') || '')) return json(res, 400, {});
      const code = random(); codes.set(code, { challenge: q.get('code_challenge'), expires: Date.now() + 60000 });
      res.writeHead(302, { location: `${callback}?${new URLSearchParams({ code, state: q.get('state') })}`, 'cache-control': 'no-store' }); return res.end();
    }
    if (req.method === 'POST' && url.pathname === '/realms/staff/protocol/openid-connect/token') {
      const body = await form(req); const entry = codes.get(body.get('code')); codes.delete(body.get('code'));
      const challenge = createHash('sha256').update(body.get('code_verifier') || '').digest('base64url');
      if (body.get('client_id') !== clientId || body.get('client_secret') !== clientSecret || body.get('grant_type') !== 'authorization_code' || body.get('redirect_uri') !== callback || !entry || entry.expires <= Date.now() || !timingSafeEqual(Buffer.from(entry.challenge), Buffer.from(challenge))) return json(res, 400, {});
      const token = random(); const lifetime = mode === 'short' ? 8 : 900;
      // Deliberately NO tenant claims. Staff identity belongs to Mobicred.
      tokens.set(token, { active: true, iss: issuer, aud: 'console', sub: 'fixture-operator', exp: Math.floor(Date.now() / 1000) + lifetime, realm_access: { roles: mode === 'non-staff' ? ['CUSTOMER'] : ['OPS', 'ADMIN'] } });
      return json(res, 200, { access_token: token, token_type: 'Bearer', expires_in: lifetime });
    }
    if (req.method === 'POST' && url.pathname === '/realms/staff/protocol/openid-connect/token/introspect') {
      if (mode === 'unavailable') return json(res, 503, {});
      const body = await form(req); if (body.get('client_id') !== clientId || body.get('client_secret') !== clientSecret) return json(res, 401, {});
      const claims = tokens.get(body.get('token')); return json(res, 200, claims && claims.exp > Date.now() / 1000 ? claims : { active: false });
    }
    return json(res, 404, {});
  } catch { return json(res, 400, {}); }
});
server.listen(4400, '127.0.0.1', () => console.log('Isolated staff identity fixture ready'));
process.on('SIGTERM', () => server.close());
