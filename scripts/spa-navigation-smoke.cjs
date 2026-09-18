'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
if (process.env.NODE_ENV !== 'test' || process.env.CONSOLE_DATABASE_TESTS !== 'true') throw new Error('Isolated local fixtures only');
const origin = 'http://127.0.0.1:3006';
const identity = 'http://127.0.0.1:4400';
const sections = ['overview','inbox','customers','payments','credit','partners','ingestion','aliases','operations','configuration','approvals','people','audit','reports'];
(async () => {
  fs.mkdirSync('artifacts', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let context = await browser.newContext({ viewport: { width: 1512, height: 1050 } });
  let page = await context.newPage();
  const errors = []; page.on('pageerror', (error) => errors.push(error.message)); page.setDefaultTimeout(20000);
  const mode = async (value) => assert.equal((await page.request.post(`${identity}/__fixture/mode?value=${value}`)).status(), 200);
  async function login() {
    await page.goto(`${origin}/auth/login`);
    await page.getByRole('button', { name: 'Continue securely', exact: true }).click();
    await page.waitForURL(`${origin}/overview`);
    await page.getByRole('heading', { name: 'Operations overview', exact: true }).waitFor();
  }
  async function clickSection(section) {
    await page.locator(`#console-navigation .nav-link[href="/${section}"]`).first().click();
    await page.waitForURL(`${origin}/${section}`);
    await page.locator('#main-content .page-heading h1').waitFor();
  }
  try {
    await mode('staff'); await login();
    const navigations = []; page.on('request', (request) => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations.push(request.url()); });
    await page.evaluate(() => { window.__shell = document.getElementById('console-navigation'); window.__header = document.querySelector('.topbar'); window.__spaSentinel = 'same-document'; });
    for (const section of sections) {
      await clickSection(section);
      assert.equal(await page.evaluate(() => window.__spaSentinel), 'same-document', `${section}: same document`);
      assert.ok(await page.evaluate(() => window.__shell === document.getElementById('console-navigation')), `${section}: persistent sidebar`);
      assert.ok(await page.evaluate(() => window.__header === document.querySelector('.topbar')), `${section}: persistent header`);
      assert.equal(await page.locator(`.nav-link[href="/${section}"][aria-current="page"]`).count(), 1);
      assert.equal(await page.locator('#main-content').getByRole('link', { name: 'Sign in', exact: true }).count(), 0);
    }
    assert.equal(navigations.length, 0, 'Menu navigation must not request a new document');
    await clickSection('audit'); await page.locator('tbody').getByText('case.created', { exact: true }).first().waitFor();
    await page.screenshot({ path: 'artifacts/spa-audit-authorized.png', fullPage: true });
    await clickSection('reports'); await page.locator('.service-card').first().waitFor();
    await page.screenshot({ path: 'artifacts/spa-reports-authorized.png', fullPage: true });
    await page.goBack(); await page.waitForURL(`${origin}/audit`); await page.locator('#main-content .page-heading h1').waitFor();
    assert.equal(navigations.length, 0, 'Back navigation must stay in the existing document');
    await clickSection('partners'); await page.getByRole('button', { name: 'New partner', exact: true }).click();
    await page.getByLabel('Partner code', { exact: true }).fill('unsaved-staff-work');
    const status = page.waitForResponse((response) => response.url() === `${origin}/api/session-status`);
    await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await status;
    assert.equal(await page.getByLabel('Partner code', { exact: true }).inputValue(), 'unsaved-staff-work');
    await page.waitForLoadState('networkidle');
    await page.route('**/api/session-status', (route) => route.fulfill({ status: 503, json: { authenticated: false } }));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.locator('[data-session-lock="true"]').waitFor();
    assert.equal(await page.locator('dialog[open]').count(), 0);
    await page.unroute('**/api/session-status');
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.locator('#console-navigation').waitFor(); assert.equal(await page.locator('dialog[open]').count(), 0);
    assert.equal(navigations.length, 0, 'Outage recovery does not reload the browser');
    await clickSection('partners'); await page.locator('a.record-link[href="/partners/alpha"]').click();
    await page.waitForURL(`${origin}/partners/alpha`); await page.getByRole('button', { name: 'Work in this context', exact: true }).click();
    await page.getByRole('button', { name: 'Current context', exact: true }).waitFor();
    assert.equal(navigations.length, 0, 'Context selection must use client routing');
    await clickSection('audit'); await clickSection('reports');
    await page.getByRole('button', { name: 'Switch partner context', exact: true }).click();
    await page.getByRole('button', { name: 'Use all partners', exact: true }).click();
    await page.waitForURL(`${origin}/overview`); await page.getByRole('heading', { name: 'Operations overview', exact: true }).waitFor();
    assert.equal(navigations.length, 0, 'Returning globally must not replace the document');
    await page.goto(`${origin}/inbox/00000000-0000-4000-8000-000000000001`);
    await page.getByRole('heading', { name: 'Record not found', exact: true }).waitFor(); await page.locator('#console-navigation').waitFor();
    await context.close();
    context = await browser.newContext({ viewport: { width: 1512, height: 1050 } }); page = await context.newPage(); page.setDefaultTimeout(20000); page.on('pageerror', (error) => errors.push(error.message));
    await mode('staff-admin-only'); await login();
    const cookie = (await context.cookies()).find((value) => value.name === 'mobicred_session'); assert.ok(cookie);
    for (const section of ['audit', 'reports']) {
      await clickSection(section); await page.getByRole('heading', { name: 'Access restricted', exact: true }).waitFor();
      assert.equal(page.url(), `${origin}/${section}`); assert.equal(await page.locator('#console-navigation').count(), 1);
      assert.equal(await page.getByRole('link', { name: 'Sign in', exact: true }).count(), 0);
      const verification = await page.request.get(`${origin}/api/session-status`); assert.equal(verification.status(), 200); assert.equal((await verification.json()).authenticated, true);
      assert.ok((await context.cookies()).some((value) => value.value === cookie.value));
    }
    await page.screenshot({ path: 'artifacts/spa-reports-permission.png', fullPage: true });
    await page.waitForLoadState('networkidle');
    await page.request.post(`${identity}/__fixture/revoke`);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForURL(`${origin}/auth/login`); assert.equal(await page.locator('#console-navigation').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: 14 menu routes and browser history without document reloads; persistent sidebar/header; authorized audit/reports; permission denials preserve sessions; modal-safe outage recovery; SPA context changes; unknown-record recovery; final revoked-session denial. All identities and records are synthetic.');
  } catch (error) { await page.screenshot({ path: 'artifacts/spa-navigation-failure.png', fullPage: true, mask: [page.getByTestId('issued-api-secret')] }).catch(() => {}); console.error('SPA journey failed at', page.url()); throw error; }
  finally { await mode('staff').catch(() => {}); await browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
