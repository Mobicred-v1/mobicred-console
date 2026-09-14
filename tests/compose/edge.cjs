'use strict';
const https = require('node:https'); const http = require('node:http'); const fs = require('node:fs');
const { createHash, randomBytes, timingSafeEqual } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.CONSOLE_COMPOSE_TESTS !== 'true') throw new Error('Compose fixture is test-only');
const issuer = 'https://identity.example.test:8443/realms/staff'; const callback = 'https://console.example.test:8443/auth/callback';
const codes = new Map(); const tokens = new Map(); const random = () => randomBytes(32).toString('base64url');
const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
async function form(req) { let body = ''; for await (const chunk of req) { body += chunk.toString(); if (body.length > 65536) throw new Error(); } return new URLSearchParams(body); }
https.createServer({ key: fs.readFileSync('/fixtures/tls.key'), cert: fs.readFileSync('/fixtures/tls.crt') }, async (req, res) => {
  try {
    if (req.headers.host === 'console.example.test:8443') {
      const upstream = http.request({ hostname: 'web', port: 3006, path: req.url, method: req.method, headers: { ...req.headers, 'x-forwarded-proto': 'https', 'x-forwarded-host': req.headers.host } }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
      upstream.on('error', () => { if (!res.headersSent) json(res, 502, { status: 'unavailable' }); else res.destroy(); }); req.pipe(upstream); return;
    }
    if (req.headers.host !== 'identity.example.test:8443') return json(res, 404, {});
    const url = new URL(req.url, issuer);
    if (req.method === 'GET' && url.pathname === '/realms/staff/protocol/openid-connect/auth') {
      const q = url.searchParams;
      if (q.get('client_id') !== 'mobicred-console' || q.get('redirect_uri') !== callback || q.get('response_type') !== 'code' || q.get('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(q.get('state') || '') || !/^[A-Za-z0-9_-]{43}$/.test(q.get('code_challenge') || '')) return json(res, 400, {});
      const code = random(); codes.set(code, { challenge: q.get('code_challenge'), expires: Date.now() + 60000 }); res.writeHead(302, { location: `${callback}?${new URLSearchParams({ code, state: q.get('state') })}`, 'cache-control': 'no-store' }); return res.end();
    }
    if (req.method === 'POST' && url.pathname === '/realms/staff/protocol/openid-connect/token') {
      const body = await form(req); const entry = codes.get(body.get('code')); codes.delete(body.get('code')); const challenge = createHash('sha256').update(body.get('code_verifier') || '').digest('base64url');
      if (body.get('client_id') !== 'mobicred-console' || body.get('client_secret') !== process.env.TEST_CLIENT_SECRET || body.get('grant_type') !== 'authorization_code' || body.get('redirect_uri') !== callback || !entry || entry.expires <= Date.now() || !timingSafeEqual(Buffer.from(entry.challenge), Buffer.from(challenge))) return json(res, 400, {});
      const token = random(); tokens.set(token, { active: true, iss: issuer, aud: 'mobicred-console', sub: 'compose-test-staff', exp: Math.floor(Date.now() / 1000) + 900, realm_access: { roles: ['OPS'] } });
      return json(res, 200, { access_token: token, token_type: 'Bearer', expires_in: 900 });
    }
    if (req.method === 'POST' && url.pathname === '/realms/staff/protocol/openid-connect/token/introspect') {
      const body = await form(req); if (body.get('client_id') !== 'mobicred-console' || body.get('client_secret') !== process.env.TEST_CLIENT_SECRET) return json(res, 401, {});
      const claims = tokens.get(body.get('token')); return json(res, 200, claims && claims.exp > Date.now() / 1000 ? claims : { active: false });
    }
    return json(res, 404, {});
  } catch { return json(res, 400, {}); }
}).listen(8443, '0.0.0.0', () => console.log('Isolated TLS edge and global staff identity fixture ready'));
