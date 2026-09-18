'use strict';
const fs = require('node:fs');
const origins = ['https://staging-console.mobicred.net', 'https://console.mobicred.net'];
const paths = ['/', '/auth/login', '/overview', '/partners', '/customers', '/api/partners', '/api/session-status', '/health'];

async function observe(origin, path) {
  if (!origins.includes(origin) || !paths.includes(path)) throw new Error('Unapproved observation target');
  try {
    const response = await fetch(origin + path, { redirect: 'manual', cache: 'no-store', headers: { accept: path.startsWith('/api/') || path === '/health' ? 'application/json' : 'text/html' }, signal: AbortSignal.timeout(10000) });
    let bytes = 0; let html = ''; const reader = response.body?.getReader();
    if (reader) { try { while (true) { const next = await reader.read(); if (next.done) break; bytes += next.value.length; if (bytes > 131072) break; html += Buffer.from(next.value).toString('utf8'); } } finally { await reader.cancel().catch(() => {}); } }
    const location = response.headers.get('location'); const target = location ? new URL(location, origin) : null;
    const result = { origin, path, status: response.status, contentType: response.headers.get('content-type'), cacheControl: response.headers.get('cache-control'), redirect: target ? target.origin + target.pathname : null, hasConsoleShell: /id=["']console-navigation["']/.test(html), hasTenantLogin: path === '/auth/login' && /<input\b[^>]*(?:name|id)=["'][^"']*tenant/i.test(html), hasPlatformLogin: path === '/auth/login' && /data-staff-entry=["']platform["']/.test(html), truncated: bytes > 131072 };
    if (path === '/auth/login') result.hasSignInForm = /action=["']\/auth\/start["']/.test(html);
    return result;
  } catch (error) { return { origin, path, error: error.cause?.code || error.code || error.name }; }
}
function validObservation(result) {
  if (result.error || result.truncated || result.hasConsoleShell || result.hasTenantLogin) return false;
  if (!/no-store/.test(result.cacheControl || '')) return false;
  if (result.path === '/auth/login') return result.status === 200 && result.hasSignInForm === true;
  if (result.path === '/health') return result.status === 200;
  if (result.path.startsWith('/api/')) return result.status === 401;
  return result.status === 303 && result.redirect === `${result.origin}/auth/login`;
}
async function main() {
  const target = process.env.DEPLOYED_TIER === 'staging' ? origins[0] : process.env.DEPLOYED_TIER === 'main' ? origins[1] : null;
  if (!target) throw new Error('Select staging or main after redeploying that Coolify resource.');
  const report = { observedAt: new Date().toISOString(), deploymentTarget: target, observations: [] };
  for (const path of paths) report.observations.push(await observe(target, path));
  fs.mkdirSync('artifacts', { recursive: true });
  fs.writeFileSync('artifacts/deployed-console-boundary.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.observations.some((result) => !validObservation(result))) process.exitCode = 1;
}
if (require.main === module) void main();
module.exports = { observe, validObservation };
