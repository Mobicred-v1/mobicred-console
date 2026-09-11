const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const origin = 'http://127.0.0.1:3006';

(async () => {
  fs.mkdirSync('artifacts', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1512, height: 1050 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(15000);
  try {
    await page.goto(`${origin}/auth/login`, { waitUntil: 'networkidle' });
    await page.getByLabel('Workspace tenant', { exact: true }).fill('tenant-a');
    await page.getByRole('button', { name: 'Continue with Keycloak' }).click();
    await page.waitForURL(`${origin}/overview`);
    await page.locator('#main-content .page-heading h1').waitFor();
    const session = (await context.cookies()).find((cookie) => cookie.name === 'mobicred_session');
    assert.ok(session && session.httpOnly && session.sameSite === 'Lax', 'session cookie must be opaque and HttpOnly');
    assert.match(session.value, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(await page.evaluate(() => localStorage.length), 0, 'no access tokens in localStorage');
    assert.equal(await page.evaluate(() => sessionStorage.length), 0, 'no access tokens in sessionStorage');
    assert.ok(!(await page.content()).includes(session.value), 'opaque cookie must not be serialized into the page');

    await page.goto(`${origin}/inbox`, { waitUntil: 'networkidle' });
    assert.ok(await page.getByRole('button', { name: 'New investigation', exact: true }).isEnabled());
    await page.getByRole('button', { name: 'New investigation', exact: true }).click();
    await page.getByLabel('Case title', { exact: true }).fill('Browser-verified investigation');
    await page.getByLabel('Reason & context', { exact: true }).fill('Synthetic evidence from the isolated browser integration test.');
    await page.getByRole('button', { name: 'Create investigation', exact: true }).click();
    await page.waitForURL(/\/inbox\/[0-9a-f-]{36}$/);
    const caseId = page.url().split('/').pop();
    await page.getByRole('dialog').getByRole('heading', { name: 'Browser-verified investigation', exact: true }).waitFor();
    await page.getByLabel('Note', { exact: true }).fill('Browser-tested immutable investigation note.');
    await page.getByLabel('Reason', { exact: true }).fill('Document the isolated test evidence review.');
    const noteResponse = page.waitForResponse((response) => response.url().endsWith(`/api/cases/${caseId}/commands`) && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Submit audited command' }).click();
    assert.equal((await noteResponse).status(), 201);
    await page.getByRole('dialog').getByText('Browser-tested immutable investigation note.', { exact: true }).waitFor();
    await page.getByLabel('Action', { exact: true }).selectOption('set_status');
    await page.getByLabel('New status', { exact: true }).selectOption('resolved');
    await page.getByLabel('Reason', { exact: true }).fill('The isolated investigation is complete, with no financial action.');
    const statusResponse = page.waitForResponse((response) => response.url().endsWith(`/api/cases/${caseId}/commands`) && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Submit audited command' }).click();
    assert.equal((await statusResponse).status(), 201);
    await page.getByRole('dialog').locator('.badge').filter({ hasText: /^resolved$/ }).waitFor();
    await page.screenshot({ path: 'artifacts/authenticated-case-workflow.png', fullPage: true });

    const denied = await page.request.post(`${origin}/api/cases`, { headers: { origin: 'https://untrusted.example', 'content-type': 'application/json', 'idempotency-key': randomUUID() }, data: { title: 'Forbidden browser request' } });
    assert.equal(denied.status(), 403, 'cross-origin mutation must fail');

    await page.goto(`${origin}/audit`, { waitUntil: 'networkidle' });
    await page.locator('tbody').getByText('case.created', { exact: true }).waitFor();
    await page.locator('tbody').getByText('case.add_note', { exact: true }).waitFor();
    await page.locator('tbody').getByText('case.set_status', { exact: true }).waitFor();
    await page.screenshot({ path: 'artifacts/authenticated-audit.png', fullPage: true });
    await page.goto(`${origin}/reports`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'payment cases · resolved', exact: true }).waitFor();
    await page.goto(`${origin}/inbox?q=Browser-verified&status=resolved`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('tbody tr').count(), 1);
    await page.screenshot({ path: 'artifacts/authenticated-inbox.png', fullPage: true });

    await page.getByRole('button', { name: 'Profile and access', exact: true }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.waitForURL(`${origin}/auth/login`);
    assert.ok(!(await context.cookies()).some((cookie) => cookie.name === 'mobicred_session'), 'logout must clear the browser cookie');
    const revoked = await page.request.get('http://127.0.0.1:3005/api/v1/console-session', { headers: { 'x-console-session': session.value } });
    assert.equal(revoked.status(), 401, 'logout must revoke the server session');

    await page.getByLabel('Workspace tenant', { exact: true }).fill('tenant-b');
    await page.getByRole('button', { name: 'Continue with Keycloak' }).click();
    await page.waitForURL(`${origin}/auth/login?error=signin`);
    assert.ok(!(await context.cookies()).some((cookie) => cookie.name === 'mobicred_session'), 'form selection must not grant a foreign tenant');
    assert.deepEqual(errors, [], 'browser exceptions');
    console.log('PASS: real production-build startup; PKCE fixture login; opaque server session; persisted create/note/resolve; audit/report reads; CSRF denial; tenant denial; logout revocation. Identity provider is an isolated fixture, not production Keycloak.');
  } catch (error) {
    await page.screenshot({ path: 'artifacts/authenticated-failure.png', fullPage: true }).catch(() => {});
    console.error('Browser URL at failure:', page.url());
    throw error;
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
