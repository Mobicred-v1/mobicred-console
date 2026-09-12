'use strict';
const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const origin = 'https://console.example.test:8443';
const composeArgs = ['compose', '--project-name', 'console-ci', '--env-file', '.compose-test/env', '-f', 'docker-compose.yml', '-f', 'tests/compose/compose.test.yml'];
const compose = (...args) => execFileSync('docker', [...composeArgs, ...args], { encoding: 'utf8' });
const sql = (query) => compose('exec', '-T', 'postgres', 'psql', '-U', 'mobicred', '-d', 'mobicred_console', '-Atc', query).trim();
const internal = (path) => compose('exec', '-T', 'api', 'node', '-e', `fetch('http://127.0.0.1:3005${path}', {signal:AbortSignal.timeout(5000)}).then(r=>console.log(r.status))`).trim();
const migrationCount = () => sql('SELECT count(*) FROM migrations');

(async () => {
  fs.mkdirSync('artifacts/compose', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  // Only this synthetic test client ignores the fixture cert. Application containers trust the explicit test CA normally.
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1512, height: 1050 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(20000);
  try {
    assert.equal((await page.request.get(`${origin}/health`)).status(), 200);
    assert.equal(internal('/api/v1/console-session'), '401');
    assert.equal(internal('/api/v1/console-cases'), '401');
    assert.equal((await page.request.get(`${origin}/preview/overview`)).status(), 404);
    await page.goto(`${origin}/auth/login`, { waitUntil: 'networkidle' });
    await page.getByLabel('Workspace tenant', { exact: true }).fill('tenant-a');
    await page.getByRole('button', { name: 'Continue with Keycloak' }).click();
    await page.waitForURL(`${origin}/overview`);
    await page.locator('#main-content .page-heading h1').waitFor();
    const cookie = (await context.cookies()).find((cookie) => cookie.name === '__Host-mobicred_session');
    assert.ok(cookie?.secure && cookie.httpOnly && cookie.sameSite === 'Lax');
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    const assets = await page.locator('script[src], link[rel=stylesheet]').evaluateAll((elements) => elements.map((el) => el.getAttribute('src') || el.getAttribute('href')).filter((url) => url.includes('/_next/static/')));
    assert.ok(assets.length > 0, 'Standalone image must serve built static assets');
    for (const asset of assets) assert.equal((await page.request.get(new URL(asset, origin).toString())).status(), 200);
    await page.goto(`${origin}/inbox`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'New investigation', exact: true }).click();
    await page.getByLabel('Case title', { exact: true }).fill('Compose persistence verification');
    await page.getByLabel('Reason & context', { exact: true }).fill('Synthetic case created against the actual production Compose containers.');
    await page.getByRole('button', { name: 'Create investigation', exact: true }).click();
    await page.waitForURL(/\/inbox\/[0-9a-f-]{36}$/);
    const caseUrl = page.url();
    await page.getByRole('dialog').getByRole('heading', { name: 'Compose persistence verification', exact: true }).waitFor();
    const beforeMigrations = migrationCount();
    assert.ok(Number(beforeMigrations) >= 4, 'Fresh database must migrate automatically');
    assert.equal(sql('SELECT count(*) FROM console_audit_records'), '1');
    await page.screenshot({ path: 'artifacts/compose/persisted-case.png', fullPage: true });

    // Recreate both application containers: no volume deletion and no manual migration commands.
    compose('up', '-d', '--no-deps', '--force-recreate', '--wait', '--wait-timeout', '180', 'api', 'web');
    assert.equal(migrationCount(), beforeMigrations, 'Restart must not reapply migrations');
    await page.goto(caseUrl, { waitUntil: 'networkidle' });
    await page.getByRole('dialog').getByRole('heading', { name: 'Compose persistence verification', exact: true }).waitFor();
    assert.ok((await context.cookies()).some((item) => item.value === cookie.value), 'Encrypted server session must survive container recreation');

    // Recreate Postgres too: the named volume must preserve cases, sessions and migration history.
    compose('up', '-d', '--no-deps', '--force-recreate', '--wait', '--wait-timeout', '120', 'postgres');
    assert.equal(migrationCount(), beforeMigrations);
    assert.equal(sql('SELECT count(*) FROM investigation_cases'), '1');
    await page.goto(caseUrl, { waitUntil: 'networkidle' });
    await page.getByRole('dialog').getByRole('heading', { name: 'Compose persistence verification', exact: true }).waitFor();

    compose('stop', 'postgres');
    assert.equal(internal('/api/v1/health/ready'), '503', 'API must lose readiness when database is down');
    assert.equal((await page.request.get(`${origin}/health`)).status(), 503, 'Web readiness must include its API/database chain');
    compose('up', '-d', '--wait', '--wait-timeout', '180', 'postgres', 'api', 'web');
    assert.equal((await page.request.get(`${origin}/health`)).status(), 200);
    await page.goto(`${origin}/inbox`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Profile and access', exact: true }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.waitForURL(`${origin}/auth/login`);
    assert.ok(!(await context.cookies()).some((item) => item.name === '__Host-mobicred_session'));
    assert.deepEqual(errors, [], 'No browser exceptions');
    fs.writeFileSync('artifacts/compose/summary.txt', 'PASS: real Docker image builds, ordered cold start, automatic migrations, static assets, HTTPS fixture PKCE login, secure opaque sessions, persisted audited case, app/database recreation, database failure/recovery readiness, logout. Identity is synthetic; no production deployment performed.\n');
    console.log(fs.readFileSync('artifacts/compose/summary.txt', 'utf8'));
  } catch (error) {
    await page.screenshot({ path: 'artifacts/compose/failure.png', fullPage: true }).catch(() => {});
    throw error;
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
