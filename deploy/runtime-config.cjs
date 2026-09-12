'use strict';

function required(env, key) {
  const value = env[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Set ${key} before deploying`);
  return value;
}
function httpsUrl(value, key, originOnly = false) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`Invalid ${key}`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search || (originOnly && url.pathname !== '/')) {
    throw new Error(`${key} must be an HTTPS ${originOnly ? 'origin without a path' : 'URL without credentials, query or fragment'}`);
  }
  return url;
}
function hexKey(env, key) {
  if (!/^[a-f0-9]{64}$/i.test(required(env, key))) throw new Error(`${key} must contain 64 hexadecimal characters`);
}
function validateRuntime(env, service) {
  if (!['api', 'web'].includes(service)) throw new Error('Unknown runtime service');
  if (env.NODE_ENV !== 'production' || env.CONSOLE_ENV !== 'production' || env.CONSOLE_PREVIEW_ENABLED !== 'false') {
    throw new Error('Container deployments require production mode with preview explicitly disabled');
  }
  httpsUrl(required(env, 'CONSOLE_OIDC_ISSUER'), 'CONSOLE_OIDC_ISSUER');
  required(env, 'CONSOLE_OIDC_CLIENT_ID');
  required(env, 'CONSOLE_OIDC_CLIENT_SECRET');
  if (service === 'web') {
    httpsUrl(required(env, 'CONSOLE_PUBLIC_ORIGIN'), 'CONSOLE_PUBLIC_ORIGIN', true);
    if (env.CONSOLE_API_TRANSPORT !== 'compose' || env.CONSOLE_API_URL !== 'http://api:3005') {
      throw new Error('Compose web must use its fixed internal API origin');
    }
    hexKey(env, 'CONSOLE_LOGIN_COOKIE_KEY');
    return;
  }
  hexKey(env, 'CONSOLE_SESSION_ENCRYPTION_KEY');
  required(env, 'CONSOLE_OIDC_AUDIENCE');
  if (!required(env, 'CONSOLE_STAFF_ROLES').split(',').some((role) => role.trim())) throw new Error('CONSOLE_STAFF_ROLES needs an explicit role');
  for (const [flag, roles] of [
    ['CONSOLE_CASE_WORKFLOWS_ENABLED', 'CONSOLE_CASE_WRITE_ROLES'],
    ['CONSOLE_CREDIT_READS_ENABLED', 'CONSOLE_CREDIT_READ_ROLES'],
    ['CONSOLE_INGESTION_READS_ENABLED', 'CONSOLE_INGESTION_READ_ROLES'],
  ]) {
    if (!['true', 'false'].includes(env[flag])) throw new Error(`${flag} must be true or false`);
    if (env[flag] === 'true' && !(env[roles] ?? '').split(',').some((role) => role.trim())) throw new Error(`Set ${roles} before enabling ${flag}`);
  }
  if (env.CONSOLE_CREDIT_READS_ENABLED === 'true' || env.CONSOLE_INGESTION_READS_ENABLED === 'true') {
    httpsUrl(required(env, 'CONSOLE_CREDIT_URL'), 'CONSOLE_CREDIT_URL', true);
  }
}
function databaseUrl(env) {
  if (env.DATABASE_HOST !== 'postgres' || env.DATABASE_PORT !== '5432') throw new Error('Compose database must use the internal postgres service');
  for (const key of ['DATABASE_USER', 'DATABASE_NAME']) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(required(env, key))) throw new Error(`Invalid ${key}`);
  }
  const password = required(env, 'DATABASE_PASSWORD');
  if (password.length < 32) throw new Error('DATABASE_PASSWORD must have at least 32 characters');
  return `postgresql://${encodeURIComponent(env.DATABASE_USER)}:${encodeURIComponent(password)}@postgres:5432/${env.DATABASE_NAME}`;
}
module.exports = { validateRuntime, databaseUrl };
