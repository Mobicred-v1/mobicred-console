'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const origin = 'http://127.0.0.1:3006';
const api = 'http://127.0.0.1:3005/api/v1';
const owner = 'http://127.0.0.1:4500';

(async () => {
  fs.mkdirSync('artifacts', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1512, height: 1050 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(15000);
  const setMode = async (mode) => assert.equal((await page.request.post(`${owner}/__fixture/mode?value=${mode}`)).status(), 200);
  const visit = async (section) => {
    await page.goto(`${origin}/${section}`, { waitUntil: 'networkidle' });
    await page.locator('#main-content .page-heading h1').waitFor();
  };
  try {
    assert.equal((await page.request.get(`${api}/console-read/ingestion`)).status(), 401);
    assert.equal((await page.request.get(`${api}/console-capabilities`)).status(), 401);
    await page.goto(`${origin}/auth/login`, { waitUntil: 'networkidle' });
    await page.getByLabel('Workspace tenant', { exact: true }).fill('tenant-a');
    await page.getByRole('button', { name: 'Continue with Keycloak' }).click();
    await page.waitForURL(`${origin}/overview`);
    const session = (await context.cookies()).find((cookie) => cookie.name === 'mobicred_session');
    assert.ok(session?.httpOnly);
    const headers = { 'x-console-session': session.value };
    const scoped = await page.request.get(`${api}/console-read/ingestion`, { headers });
    assert.equal(scoped.status(), 200);
    const data = await scoped.json();
    assert.equal(data.tenantId, 'tenant-a');
    assert.equal(data.items[0].total, 12);
    assert.equal(data.items[0].failed, 2);
    assert.ok(!(await scoped.text()).includes('never-serialize-fixture'));
    assert.equal((await page.request.get(`${api}/console-read/ingestion?tenant_id=tenant-b`, { headers })).status(), 400);
    assert.equal((await page.request.get(`${api}/console-read/ingestion?url=https://untrusted.example`, { headers })).status(), 400);

    await visit('ingestion');
    await page.getByLabel('Search data ingestion', { exact: true }).fill('fixture-monthly');
    assert.equal(await page.locator('tbody tr').count(), 1);
    await page.getByRole('button', { name: 'Open fixture-monthly', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByText('Failed jobs', { exact: true }).waitFor();
    assert.equal(await dialog.locator('.detail-field').filter({ has: page.locator('dt', { hasText: /^Failed jobs$/ }) }).locator('dd').innerText(), '2');
    assert.ok(await dialog.getByRole('button', { name: 'Request a change', exact: true }).isDisabled());
    assert.ok(!(await page.content()).includes('never-serialize-fixture'));
    await page.screenshot({ path: 'artifacts/live-ingestion-quality.png', fullPage: true });
    await page.keyboard.press('Escape');

    const capabilities = await page.request.get(`${api}/console-capabilities`, { headers });
    assert.equal(capabilities.status(), 200);
    const policy = await capabilities.json();
    assert.equal(policy.items.find((item) => item.id === 'ingestion-read').granted, true);
    assert.ok(!(await capabilities.text()).includes('fixture-only-secret'));
    assert.ok(!(await capabilities.text()).includes('127.0.0.1'));
    await visit('configuration');
    await page.getByRole('heading', { name: 'Ingestion quality reads', exact: true }).waitFor();
    await page.screenshot({ path: 'artifacts/effective-console-configuration.png', fullPage: true });
    await visit('people');
    await page.getByRole('heading', { name: 'Your verified staff session', exact: true }).waitFor();
    await visit('operations');
    assert.equal(await page.getByText('Reachability untested', { exact: true }).count(), 6);
    assert.equal(await page.getByText('Healthy', { exact: true }).count(), 0);

    for (const [mode, status] of [['foreign', 503], ['malformed', 503], ['denied', 403], ['unavailable', 503], ['redirect', 503]]) {
      await setMode(mode);
      assert.equal((await page.request.get(`${api}/console-read/ingestion`, { headers })).status(), status, mode);
      await visit('ingestion');
      assert.equal(await page.getByText('fixture-monthly', { exact: true }).count(), 0, `${mode}: no fixture fallback`);
    }
    await setMode('stale');
    const stale = await page.request.get(`${api}/console-read/ingestion`, { headers });
    assert.equal((await stale.json()).state, 'stale');
    await visit('ingestion');
    await page.getByText(/Stale source/).waitFor();
    await setMode('valid');
    await page.setViewportSize({ width: 390, height: 844 });
    for (const section of ['ingestion', 'configuration', 'people', 'operations']) {
      await visit(section);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${section}: mobile overflow`);
    }
    await page.screenshot({ path: 'artifacts/live-platform-mobile.png', fullPage: true });
    assert.deepEqual(errors, [], 'browser exceptions');
    console.log('PASS: delegated owner bearer, verified tenant scope, read-only ingestion, response redaction, owner denials/failures/redirects, stale snapshots, effective capabilities, self access and mobile platform views. All owner and identity data are isolated fixtures.');
  } catch (error) {
    await page.screenshot({ path: 'artifacts/ingestion-failure.png', fullPage: true }).catch(() => {});
    console.error('Page at failure:', page.url());
    throw error;
  } finally { await setMode('valid').catch(() => {}); await browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
