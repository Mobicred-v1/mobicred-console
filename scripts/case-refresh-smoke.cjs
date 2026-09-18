'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.CONSOLE_DATABASE_TESTS !== 'true') throw new Error('Isolated local fixture test only');
const origin = 'http://127.0.0.1:3006';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(); const page = await context.newPage(); page.setDefaultTimeout(20000);
  try {
    assert.equal((await page.request.get(`${origin}/api/cases/00000000-0000-4000-8000-000000000001`)).status(), 401);
    await page.goto(`${origin}/auth/login`);
    await page.getByRole('button', { name: 'Continue securely', exact: true }).click();
    await page.waitForURL(`${origin}/overview`);
    await page.getByRole('link', { name: 'New investigation', exact: true }).click();
    await page.getByLabel('Case title', { exact: true }).fill('Sequential navigation-refresh regression');
    await page.getByLabel('Reason & context', { exact: true }).fill('Synthetic case for ordered command and read-back verification.');
    await page.getByRole('button', { name: 'Create investigation', exact: true }).click();
    await page.waitForURL(/\/inbox\/[a-f0-9-]{36}$/);
    const id = new URL(page.url()).pathname.split('/').pop();
    const cookie = (await context.cookies()).find((value) => value.name === 'mobicred_session'); assert.ok(cookie);
    const documents = []; page.on('request', (request) => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url()); });
    const detailUrl = `${origin}/api/cases/${id}`;
    await page.route(detailUrl, async (route) => {
      const response = await route.fetch(); await new Promise((resolve) => setTimeout(resolve, 150));
      await route.fulfill({ response });
    });
    let version = 1;
    for (const status of ['waiting', 'resolved', 'open', 'waiting', 'resolved', 'open']) {
      await page.getByLabel('Action', { exact: true }).selectOption('set_status');
      await page.getByLabel('New status', { exact: true }).selectOption(status);
      await page.getByLabel('Reason', { exact: true }).fill(`Verify ordered transition to ${status}, expected revision ${version}.`);
      const completed = page.waitForResponse((response) => response.url().endsWith(`/api/cases/${id}/commands`) && response.request().method() === 'POST');
      await page.getByRole('button', { name: 'Submit audited command', exact: true }).click();
      const result = await completed; assert.equal(result.status(), 201);
      const sent = result.request().postDataJSON(); assert.equal(sent.status, status); assert.equal(sent.expectedVersion, version);
      const receipt = await result.json(); assert.equal(receipt.version, ++version);
      await page.getByRole('dialog').getByText(`Version ${version}`, { exact: true }).waitFor();
      await page.getByRole('dialog').locator('.badge').filter({ hasText: new RegExp(`^${status}$`) }).waitFor();
      const authoritative = await page.request.get(`http://127.0.0.1:3005/api/v1/console-cases/${id}`, { headers: { 'x-console-session': cookie.value } });
      assert.equal(authoritative.status(), 200); const detail = await authoritative.json();
      assert.equal(detail.case.version, version); assert.equal(detail.case.status, status);
    }
    await page.unroute(detailUrl);
    let writes = 0;
    page.on('request', (request) => { if (request.method() === 'POST' && request.url().endsWith(`/api/cases/${id}/commands`)) writes++; });
    await page.route(detailUrl, (route) => route.fulfill({ status: 503, json: { error: 'Synthetic read outage' } }));
    await page.getByLabel('Action', { exact: true }).selectOption('add_note');
    await page.getByLabel('Note', { exact: true }).fill('Read-back recovery must not repeat a committed command.');
    await page.getByLabel('Reason', { exact: true }).fill('Verify read-only recovery after a confirmed mutation.');
    await page.getByRole('button', { name: 'Submit audited command', exact: true }).click();
    await page.getByRole('button', { name: 'Retry case read', exact: true }).waitFor();
    assert.equal(writes, 1);
    await page.unroute(detailUrl);
    await page.getByRole('button', { name: 'Retry case read', exact: true }).click();
    await page.getByRole('dialog').getByText(`Version ${++version}`, { exact: true }).waitFor();
    await page.getByRole('dialog').getByText('Read-back recovery must not repeat a committed command.', { exact: true }).waitFor();
    assert.equal(writes, 1, 'Retry after confirmed commit must be a GET, not another mutation');
    assert.deepEqual(documents, []);
    await page.screenshot({ path: 'artifacts/case-authoritative-readback.png', fullPage: true });
    console.log('PASS: six sequential audited transitions match authoritative versions with delayed reads; failed read-back recovers with GET only and no duplicate command; no document navigation; anonymous case reads denied.');
  } catch (error) { await page.screenshot({ path: 'artifacts/case-refresh-failure.png', fullPage: true }).catch(() => {}); throw error; }
  finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
