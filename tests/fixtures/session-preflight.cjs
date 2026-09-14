'use strict';
const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
(async () => {
  const verifier = randomBytes(48).toString('base64url'); const state = randomBytes(32).toString('base64url');
  const query = new URLSearchParams({ client_id: 'fixture-client', redirect_uri: 'http://127.0.0.1:3006/auth/callback', response_type: 'code', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
  const auth = await fetch(`http://127.0.0.1:4400/realms/staff/protocol/openid-connect/auth?${query}`, { redirect: 'manual' });
  const code = new URL(auth.headers.get('location')).searchParams.get('code');
  const exchange = await fetch('http://127.0.0.1:4400/realms/staff/protocol/openid-connect/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: 'fixture-client', client_secret: 'fixture-only-secret', grant_type: 'authorization_code', redirect_uri: 'http://127.0.0.1:3006/auth/callback', code, code_verifier: verifier }) });
  const token = await exchange.json(); assert.equal(exchange.status, 200);
  const session = await fetch('http://127.0.0.1:3005/api/v1/console-session', { method: 'POST', headers: { authorization: `Bearer ${token.access_token}` } });
  assert.equal(session.status, 201); const result = await session.json(); assert.match(result.sessionId, /^[A-Za-z0-9_-]{43}$/);
  const read = await fetch('http://127.0.0.1:3005/api/v1/console-session', { headers: { 'x-console-session': result.sessionId } }); const value = await read.json();
  assert.equal(read.status, 200); assert.equal(value.partnerContext, null); assert.equal(value.contextVersion, 0); assert.equal(value.tenant, '@mobicred');
  assert.equal((await fetch('http://127.0.0.1:3005/api/v1/console-session', { method: 'DELETE', headers: { 'x-console-session': result.sessionId } })).status, 204);
  console.log('PASS: platform staff authentication without tenant claims, encrypted opaque session and global context.');
})().catch((error) => { console.error(error.message); process.exit(1); });
