'use strict';
const fs = require('node:fs');
const origins = ['https://staging-console.mobicred.net', 'https://console.mobicred.net'];
const paths = ['/', '/auth/login', '/overview', '/partners', '/customers', '/api/partners', '/api/session-status', '/health'];

// Anonymous, read-only observations of the two owner-provided deployments.
// Never follow external redirects, submit login, send credentials or persist HTML.
async function observe(origin, path) {
  try {
    const response = await fetch(origin + path, { redirect: 'manual', cache: 'no-store', headers: { accept: path.startsWith('/api/') || path === '/health' ? 'application/json' : 'text/html' }, signal: AbortSignal.timeout(15000) });
    let bytes = 0; let html = ''; const reader = response.body?.getReader();
    if (reader) { try { while (true) { const next = await reader.read(); if (next.done) break; bytes += next.value.length; if (bytes > 131072) break; html += Buffer.from(next.value).toString('utf8'); } } finally { await reader.cancel().catch(() => {}); } }
    const location = response.headers.get('location');
    const target = location ? new URL(location, origin) : null;
    const result = { origin, path, status: response.status, contentType: response.headers.get('content-type'), cacheControl: response.headers.get('cache-control'), redirect: target ? target.origin + target.pathname : null, hasConsoleShell: /id=["']console-navigation["']/.test(html), hasTenantLogin: path === '/auth/login' && /<input\b[^>]*(?:name|id)=["'][^"']*tenant/i.test(html), hasPlatformLogin: path === '/auth/login' && /data-staff-entry=["']platform["']/.test(html) };
    if (path === '/auth/login') result.hasSignInForm = /action=["']\/auth\/start["']/.test(html);
    return result;
  } catch (error) { return { origin, path, error: error.cause?.code || error.code || error.name }; }
}
async function main() {
  const report = { observedAt: new Date().toISOString(), observations: [] };
  for (const origin of origins) for (const path of paths) report.observations.push(await observe(origin, path));
  fs.mkdirSync('artifacts', { recursive: true });
  fs.writeFileSync('artifacts/deployed-console-boundary.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  // A network failure is inconclusive, not evidence that the application is healthy.
  const leaks = report.observations.filter((r) => r.hasConsoleShell || r.hasTenantLogin);
  const failures = report.observations.filter((r) => r.error);
  if (leaks.length || failures.length) process.exitCode = 1;
}
if (require.main === module) void main();
module.exports = { observe };
