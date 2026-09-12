'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateRuntime, databaseUrl } = require('./runtime-config.cjs');
const base = {
  NODE_ENV: 'production', CONSOLE_ENV: 'production', CONSOLE_PREVIEW_ENABLED: 'false',
  CONSOLE_OIDC_ISSUER: 'https://identity.example.test/realms/staff', CONSOLE_OIDC_CLIENT_ID: 'console',
  CONSOLE_OIDC_CLIENT_SECRET: 'test-only-not-a-production-secret', CONSOLE_OIDC_AUDIENCE: 'console', CONSOLE_STAFF_ROLES: 'OPS',
  CONSOLE_PUBLIC_ORIGIN: 'https://console.example.test', CONSOLE_API_URL: 'http://api:3005', CONSOLE_API_TRANSPORT: 'compose',
  CONSOLE_SESSION_ENCRYPTION_KEY: 'a'.repeat(64), CONSOLE_LOGIN_COOKIE_KEY: 'b'.repeat(64),
  CONSOLE_CASE_WORKFLOWS_ENABLED: 'false', CONSOLE_CREDIT_READS_ENABLED: 'false', CONSOLE_INGESTION_READS_ENABLED: 'false',
};
test('accepts fully configured production services', () => { validateRuntime(base, 'api'); validateRuntime(base, 'web'); });
for (const service of ['api', 'web']) {
  for (const key of ['CONSOLE_OIDC_ISSUER', 'CONSOLE_OIDC_CLIENT_ID', 'CONSOLE_OIDC_CLIENT_SECRET']) {
    test(`${service} rejects missing ${key}`, () => assert.throws(() => validateRuntime({ ...base, [key]: '' }, service), new RegExp(key)));
  }
  test(`${service} cannot enable preview or development mode`, () => {
    for (const patch of [{ NODE_ENV: 'development' }, { CONSOLE_ENV: 'preview' }, { CONSOLE_PREVIEW_ENABLED: 'true' }]) assert.throws(() => validateRuntime({ ...base, ...patch }, service));
  });
  test(`${service} retains strict issuer TLS`, () => assert.throws(() => validateRuntime({ ...base, CONSOLE_OIDC_ISSUER: 'http://127.0.0.1:4400/realms/staff' }, service)));
}
test('key type matches Coolify SERVICE_HEX_64 and rejects non-hex secrets', () => {
  assert.throws(() => validateRuntime({ ...base, CONSOLE_LOGIN_COOKIE_KEY: 'Z'.repeat(64) }, 'web'));
  assert.throws(() => validateRuntime({ ...base, CONSOLE_SESSION_ENCRYPTION_KEY: 'a'.repeat(32) }, 'api'));
});
test('container web accepts only its explicit internal API origin', () => {
  for (const url of ['http://other:3005', 'http://api:3005/unapproved', 'http://api:3005?token=value', 'http://api:3005@external.example']) {
    assert.throws(() => validateRuntime({ ...base, CONSOLE_API_URL: url }, 'web'));
  }
});
test('public origin must be HTTPS and have no path or credentials', () => {
  for (const value of ['http://console.example', 'https://console.example/path', 'https://secret@console.example', 'https://console.example?a=b']) assert.throws(() => validateRuntime({ ...base, CONSOLE_PUBLIC_ORIGIN: value }, 'web'));
});
test('enabling case commands requires an explicit write role', () => {
  assert.throws(() => validateRuntime({ ...base, CONSOLE_CASE_WORKFLOWS_ENABLED: 'true' }, 'api'), /CONSOLE_CASE_WRITE_ROLES/);
  validateRuntime({ ...base, CONSOLE_CASE_WORKFLOWS_ENABLED: 'true', CONSOLE_CASE_WRITE_ROLES: 'OPS' }, 'api');
});
test('enabling an owner read requires role and HTTPS owner origin', () => {
  assert.throws(() => validateRuntime({ ...base, CONSOLE_CREDIT_READS_ENABLED: 'true' }, 'api'));
  assert.throws(() => validateRuntime({ ...base, CONSOLE_CREDIT_READS_ENABLED: 'true', CONSOLE_CREDIT_READ_ROLES: 'OPS' }, 'api'));
  validateRuntime({ ...base, CONSOLE_CREDIT_READS_ENABLED: 'true', CONSOLE_CREDIT_READ_ROLES: 'OPS', CONSOLE_CREDIT_URL: 'https://credit.example.test' }, 'api');
});
test('database URL encodes reserved password characters rather than interpolating credentials into a raw URL', () => {
  const password = 'symbols-$@:/%?#&+'.repeat(3);
  const result = new URL(databaseUrl({ DATABASE_HOST: 'postgres', DATABASE_PORT: '5432', DATABASE_USER: 'mobicred', DATABASE_NAME: 'mobicred_console', DATABASE_PASSWORD: password }));
  assert.equal(decodeURIComponent(result.password), password);
  assert.equal(result.hostname, 'postgres'); assert.equal(result.pathname, '/mobicred_console');
});
test('startup validation errors do not reveal a supplied secret', () => {
  const sentinel = 'never-log-this-secret';
  try { validateRuntime({ ...base, CONSOLE_LOGIN_COOKIE_KEY: sentinel }, 'web'); assert.fail('Expected failure'); }
  catch (error) { assert.ok(!error.message.includes(sentinel)); }
});
