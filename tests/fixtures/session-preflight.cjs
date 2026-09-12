const { randomBytes, createHash } = require('node:crypto');
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.CONSOLE_DATABASE_TESTS !== 'true') throw new Error('Isolated test environment required');
(async () => {
  const issuer = 'http://127.0.0.1:4400/realms/staff';
  const callback = 'http://127.0.0.1:3006/auth/callback';
  const verifier = randomBytes(48).toString('base64url');
  const query = new URLSearchParams({ client_id: 'fixture-client', redirect_uri: callback, response_type: 'code', code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url'), state: randomBytes(32).toString('base64url') });
  const authorization = await fetch(`${issuer}/protocol/openid-connect/auth?${query}`, { redirect: 'manual' });
  assert.equal(authorization.status, 302);
  const code = new URL(authorization.headers.get('location')).searchParams.get('code');
  const tokenResponse = await fetch(`${issuer}/protocol/openid-connect/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: 'fixture-client', client_secret: 'fixture-only-secret', redirect_uri: callback, code, code_verifier: verifier }) });
  assert.equal(tokenResponse.status, 200);
  const { access_token } = await tokenResponse.json();
  for (const withBody of [false, true]) {
    const response = await fetch('http://127.0.0.1:3005/api/v1/console-session', { method: 'POST', headers: { authorization: `Bearer ${access_token}`, 'x-mobicred-tenant-id': 'tenant-a', ...(withBody ? { 'content-type': 'application/json' } : {}) }, ...(withBody ? { body: '{}' } : {}) });
    const text = await response.text();
    // This fixture uses no real credentials. Even here, never log a successful session response.
    console.log('Isolated session transport check:', { withBody, status: response.status, ...(response.ok ? {} : { diagnostic: text.slice(0, 500) }) });
    assert.equal(response.status, 201);
    const session = JSON.parse(text);
    await fetch('http://127.0.0.1:3005/api/v1/console-session', { method: 'DELETE', headers: { 'x-console-session': session.sessionId } });
  }
})().catch((error) => { console.error(error); process.exit(1); });
