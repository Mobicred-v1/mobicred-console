'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const origin = 'http://127.0.0.1:3006';
const api = 'http://127.0.0.1:3005/api/v1';
const identity = 'http://127.0.0.1:4400';
const owner = 'http://127.0.0.1:4500';
const sections = ['overview', 'inbox', 'customers', 'payments', 'credit', 'partners', 'ingestion', 'aliases', 'operations', 'configuration', 'approvals', 'people', 'audit', 'reports'];
(async () => {
  fs.mkdirSync('artifacts', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1512, height: 1050 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(20000);
  const mode = async (name) => assert.equal((await page.request.post(`${identity}/__fixture/mode?value=${name}`)).status(), 200);
  const coreMode = async (name) => assert.equal((await page.request.post(`${owner}/__fixture/core-mode?value=${name}`)).status(), 200);
  const ingestionMode = async (name) => assert.equal((await page.request.post(`${owner}/__fixture/mode?value=${name}`)).status(), 200);
  const sessionCookie = async () => (await context.cookies()).find((c) => c.name === 'mobicred_session');
  const visit = async (path) => { await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' }); await page.locator('#main-content .page-heading h1').waitFor(); };
  async function login() {
    await page.goto(`${origin}/auth/login`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('input').count(), 0, 'staff login must not ask for a tenant');
    assert.ok(!/keycloak/i.test(await page.locator('body').innerText()), 'no identity-provider branding');
    await page.getByRole('button', { name: 'Continue securely', exact: true }).click();
    await page.waitForURL(`${origin}/overview`);
    await page.locator('#main-content .page-heading h1').waitFor();
    const cookie = await sessionCookie();
    assert.ok(cookie?.httpOnly && cookie.sameSite === 'Lax');
    return cookie;
  }
  const csrf = (version) => ({ origin, 'content-type': 'application/json', 'x-console-context-version': String(version) });
  async function current() {
    const cookie = await sessionCookie();
    const response = await page.request.get(`${api}/console-session`, { headers: { 'x-console-session': cookie.value } });
    assert.equal(response.status(), 200); return response.json();
  }
  async function createCase(title) {
    await visit('/inbox');
    await page.getByRole('button', { name: 'New investigation', exact: true }).click();
    await page.getByLabel('Case title', { exact: true }).fill(title);
    await page.getByLabel('Reason & context', { exact: true }).fill('Synthetic operational evidence for the authenticated integration test.');
    await page.getByRole('button', { name: 'Create investigation', exact: true }).click();
    await page.waitForURL(/\/inbox\/[a-f0-9-]{36}$/);
    await page.getByRole('dialog').getByRole('heading', { name: title, exact: true }).waitFor();
    return page.url().split('/').pop();
  }
  async function noOverflow(label) { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: viewport overflow`); }
  try {
    for (const path of [...sections.map((s) => `/${s}`), '/partners/alpha', '/inbox/a.json', '/not-a-real-page', '/overview.css']) {
      const response = await page.request.get(`${origin}${path}`, { maxRedirects: 0 });
      assert.equal(response.status(), 303, `${path}: must redirect before rendering protected content`);
      assert.ok(response.headers().location, 'login redirect must include Location');
      const target = new URL(response.headers().location, origin);
      assert.equal(target.origin, origin, 'redirect must remain on the configured origin');
      assert.equal(target.pathname, '/auth/login');
      assert.ok(!(await response.text()).includes('console-navigation'));
    }
    assert.equal((await page.request.get(`${origin}/api/partners`, { maxRedirects: 0 })).status(), 401);
    assert.equal((await page.request.get(`${origin}/overview?_rsc=fixture`, { headers: { RSC: '1', 'Next-Router-Prefetch': '1' }, maxRedirects: 0 })).status(), 303);
    assert.equal((await page.request.get(`${origin}/overview`, { headers: { 'x-middleware-subrequest': 'proxy:proxy:proxy:proxy:proxy' }, maxRedirects: 0 })).status(), 303);
    await context.addCookies([{ name: 'mobicred_session', value: 'a'.repeat(43), url: origin }]);
    assert.equal((await page.request.get(`${origin}/partners/alpha`, { maxRedirects: 0 })).status(), 303, 'forged opaque cookie is not a session');
    await context.clearCookies();
    const cookie = await login();
    const initial = await current();
    assert.equal(initial.partnerContext, null); assert.equal(initial.contextVersion, 0);
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    assert.ok(!(await page.content()).includes(cookie.value));
    for (const section of sections) {
      await visit(`/${section}`);
      assert.ok(!/keycloak/i.test(await page.locator('body').innerText()), `${section}: provider name leaked`);
    }
    const caseId = await createCase('Browser-verified global investigation');
    await page.getByLabel('Note', { exact: true }).fill('Append-only browser verification note.');
    await page.getByLabel('Reason', { exact: true }).fill('Document the evidence reviewed during this test.');
    await page.getByRole('button', { name: 'Submit audited command' }).click();
    await page.getByRole('dialog').getByText('Append-only browser verification note.', { exact: true }).waitFor();
    await page.getByLabel('Action', { exact: true }).selectOption('set_status');
    await page.getByLabel('New status', { exact: true }).selectOption('resolved');
    await page.getByLabel('Reason', { exact: true }).fill('The synthetic investigation is now complete.');
    await page.getByRole('button', { name: 'Submit audited command' }).click();
    await page.getByRole('dialog').locator('.badge').filter({ hasText: /^resolved$/ }).waitFor();
    await page.screenshot({ path: 'artifacts/platform-case.png', fullPage: true });
    await visit('/audit'); await page.locator('tbody').getByText('case.created', { exact: true }).waitFor();
    await visit('/reports'); await page.getByRole('heading', { name: 'payment cases · resolved', exact: true }).waitFor();
    const foreignOrigin = await page.request.post(`${origin}/api/partners/commands`, { headers: { ...csrf(0), origin: 'https://other.example', 'idempotency-key': randomUUID() }, data: {} });
    assert.equal(foreignOrigin.status(), 403);

    // Partner context is selected AFTER global staff authentication, using actual UI controls.
    await visit('/partners/alpha');
    await page.getByRole('button', { name: 'Work in this context', exact: true }).click();
    await page.waitForURL(`${origin}/partners/alpha`); await page.getByText('Current context', { exact: true }).waitFor();
    assert.equal((await current()).partnerContext.partnerCode, 'alpha');
    const alphaId = await createCase('Alpha partner investigation');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Switch partner context' }).click();
    await page.getByRole('dialog').getByLabel('Partner', { exact: true }).selectOption('beta');
    await page.getByRole('dialog').getByLabel('Environment', { exact: true }).selectOption('sandbox');
    await page.getByRole('button', { name: 'Use partner context', exact: true }).click();
    await page.waitForURL(`${origin}/overview`); await page.locator('#main-content .page-heading h1').waitFor();
    const betaContext = await current(); assert.equal(betaContext.partnerContext.partnerCode, 'beta'); assert.equal(betaContext.partnerContext.tenantId, 'sandbox');
    await visit('/inbox'); assert.equal(await page.getByText('Alpha partner investigation', { exact: true }).count(), 0);
    const betaId = await createCase('Beta partner investigation');
    const crossCase = await page.request.get(`${api}/console-cases/${alphaId}`, { headers: { 'x-console-session': cookie.value } }); assert.equal(crossCase.status(), 404);
    const stale = await page.request.post(`${origin}/api/cases`, { headers: { ...csrf(1), 'idempotency-key': randomUUID() }, data: { title: 'Stale form', kind: 'payment', severity: 'low', reason: 'A stale context form must not create a case.' } }); assert.equal(stale.status(), 409);
    await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Switch partner context' }).click();
    await page.getByRole('button', { name: 'Use all partners', exact: true }).click();
    await page.waitForURL(`${origin}/overview`); await page.locator('#main-content .page-heading h1').waitFor();
    assert.equal((await current()).partnerContext, null);
    await visit('/inbox'); await page.getByText('Alpha partner investigation', { exact: true }).waitFor(); await page.getByText('Beta partner investigation', { exact: true }).waitFor();
    assert.notEqual(alphaId, betaId); assert.ok(caseId);

    // Native partner onboarding UI, initial access policy and one-time credentials.
    await visit('/partners'); await page.getByRole('button', { name: 'New partner', exact: true }).click();
    await page.getByLabel('Partner code', { exact: true }).fill('browser-partner');
    await page.getByLabel('Display name', { exact: true }).fill('Browser Partner');
    await page.getByLabel('Environment identifier', { exact: true }).fill('browser-sandbox');
    await page.getByLabel('Allowed source IPs', { exact: true }).fill('203.0.113.8/32');
    await page.getByLabel('Reason', { exact: true }).fill('Onboard the synthetic browser integration partner.');
    await page.getByRole('dialog').getByRole('button', { name: 'New partner', exact: true }).click();
    await page.waitForURL(/\/partners\/browser-partner\?tab=credentials$/);
    await page.getByRole('heading', { name: 'API credentials', exact: true }).waitFor();
    const receiptDialog = page.getByRole('dialog'); if (await receiptDialog.count()) await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Issue credential', exact: true }).click();
    await page.getByLabel('API environment', { exact: true }).selectOption('browser-sandbox');
    await page.getByLabel('Reason', { exact: true }).fill('Issue a scoped credential for the synthetic integration.');
    const issuance = page.waitForResponse((r) => r.url().endsWith('/api/partners/commands') && r.request().method() === 'POST');
    await page.getByRole('dialog').getByRole('button', { name: 'Issue API credential', exact: true }).click();
    const issuedResponse = await issuance; assert.equal(issuedResponse.status(), 201);
    const issued = await issuedResponse.json(); assert.match(issued.apiKey, /^mk_[A-Za-z0-9_-]{43}$/);
    await page.getByTestId('issued-api-secret').waitFor();
    assert.equal(await page.getByTestId('issued-api-secret').innerText(), issued.apiKey);
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    const replay = await page.request.post(`${origin}/api/partners/commands`, { headers: { ...csrf((await current()).contextVersion), 'idempotency-key': issuedResponse.request().headers()['idempotency-key'] }, data: issuedResponse.request().postDataJSON() });
    assert.equal(replay.status(), 201); assert.equal((await replay.json()).replayed, true); assert.ok(!(await replay.text()).includes(issued.apiKey));
    await page.getByRole('button', { name: 'I have stored the secret', exact: true }).click();
    assert.ok(!(await page.content()).includes(issued.apiKey), 'closing modal must remove secret');
    await page.getByRole('button', { name: 'Rotate', exact: true }).click();
    await page.getByLabel('Reason', { exact: true }).fill('Rotate the synthetic integration credential.');
    await page.getByRole('dialog').getByRole('button', { name: 'Rotate API credential', exact: true }).click();
    await page.getByTestId('issued-api-secret').waitFor();
    const rotatedKey = await page.getByTestId('issued-api-secret').innerText(); assert.notEqual(rotatedKey, issued.apiKey);
    await page.getByRole('button', { name: 'I have stored the secret', exact: true }).click();
    const active = page.locator('tbody tr').filter({ has: page.locator('.badge', { hasText: /^ACTIVE$/ }) });
    await active.getByRole('button', { name: 'Revoke', exact: true }).click();
    await page.getByLabel('Reason', { exact: true }).fill('Revoke the synthetic integration credential.');
    await page.getByRole('dialog').getByRole('button', { name: 'Revoke API credential', exact: true }).click();
    await page.getByRole('dialog').getByRole('heading', { name: 'Operation recorded', exact: true }).waitFor(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('tbody .badge').filter({ hasText: /^REVOKED$/ }).count(), 2);
    await page.screenshot({ path: 'artifacts/partner-credential-lifecycle.png', fullPage: true });
    await visit('/partners/alpha?tab=customers');
    await page.getByText('alpha-customer-one', { exact: true }).waitFor(); assert.equal(await page.getByText('beta-customer-one', { exact: true }).count(), 0);
    await page.screenshot({ path: 'artifacts/partner-customers.png', fullPage: true });
    await visit('/partners/alpha'); await page.screenshot({ path: 'artifacts/partner-overview.png', fullPage: true });

    // Global owner reads, then a strict partner+environment view and failure handling.
    const version = (await current()).contextVersion;
    assert.equal((await page.request.post(`${origin}/api/partners/context`, { headers: csrf(version), data: { partnerCode: 'alpha', tenantId: 'sandbox' } })).status(), 201);
    await visit('/ingestion'); await page.getByRole('button', { name: 'Open fixture-monthly', exact: true }).click();
    await page.getByRole('dialog').getByText('Failed jobs', { exact: true }).waitFor();
    assert.ok(!(await page.content()).includes('never-serialize-fixture'));
    await page.screenshot({ path: 'artifacts/partner-ingestion.png', fullPage: true }); await page.keyboard.press('Escape');
    for (const [name, status] of [['foreign', 503], ['malformed', 503], ['denied', 403], ['unavailable', 503], ['redirect', 503]]) {
      await ingestionMode(name);
      assert.equal((await page.request.get(`${api}/console-read/ingestion`, { headers: { 'x-console-session': cookie.value } })).status(), status, name);
      await visit('/ingestion'); assert.equal(await page.getByText('fixture-monthly', { exact: true }).count(), 0, `${name}: no fallback`);
    }
    await ingestionMode('stale'); await visit('/ingestion'); await page.getByText(/Stale source/).waitFor(); await ingestionMode('valid');
    await coreMode('unavailable'); await visit('/partners/alpha'); assert.equal(await page.getByRole('button', { name: 'Issue credential', exact: true }).count(), 0);
    const clear = await page.request.post(`${origin}/api/partners/context`, { headers: csrf((await current()).contextVersion), data: { partnerCode: null } }); assert.equal(clear.status(), 201, 'global return must work even during owner outage');
    await coreMode('valid');
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['/partners', '/partners/alpha', '/partners/alpha?tab=customers', '/partners/browser-partner?tab=credentials', '/configuration', '/people', '/operations']) { await visit(path); await noOverflow(path); }
    await page.screenshot({ path: 'artifacts/partner-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1512, height: 1050 });
    await mode('unavailable');
    const outage = await page.request.get(`${origin}/partners/alpha`, { maxRedirects: 0 }); assert.equal(outage.status(), 503); assert.ok(!(await outage.text()).includes('console-navigation'));
    await mode('staff');
    await page.request.post(`${identity}/__fixture/revoke`);
    assert.equal((await page.request.get(`${origin}/inbox/${caseId}`, { maxRedirects: 0 })).status(), 303);
    await context.clearCookies(); await login();
    await page.getByRole('button', { name: 'Profile and access', exact: true }).click(); await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await page.waitForURL(`${origin}/auth/login`);
    assert.ok(!(await sessionCookie()));
    assert.equal((await page.request.get(`${origin}/api/partners`, { maxRedirects: 0 })).status(), 401);
    await mode('non-staff'); await page.getByRole('button', { name: 'Continue securely', exact: true }).click(); await page.waitForURL(`${origin}/auth/login?error=signin`); assert.ok(!(await sessionCookie()));
    await mode('short'); await login(); await page.waitForURL(`${origin}/auth/login`, { timeout: 15000 });
    assert.deepEqual(errors, [], 'browser exceptions');
    console.log('PASS: global staff login without tenant claims; protected pages/RSC/API; forged and revoked sessions; expiry/outage; case audit; optional partner/environment context and stale-form denial; onboarding; one-time credential issue/replay/rotate/revoke; partner customer lists; owner failure/redaction; mobile layouts. All identity/owner fixtures are synthetic.');
  } catch (error) {
    await page.screenshot({ path: 'artifacts/staff-console-failure.png', fullPage: true }).catch(() => {});
    console.error('Page at failure:', page.url()); throw error;
  } finally { await mode('staff').catch(() => {}); await coreMode('valid').catch(() => {}); await ingestionMode('valid').catch(() => {}); await browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
