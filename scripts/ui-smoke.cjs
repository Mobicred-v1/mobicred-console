const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const sections = ['overview','inbox','customers','payments','credit','partners','ingestion','aliases','operations','configuration','approvals','people','audit','reports'];
(async () => {
  fs.mkdirSync('artifacts', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1512, height: 1050 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  async function visit(path, port = 3006) {
    const response = await page.goto(`http://localhost:${port}${path}`, { waitUntil: 'networkidle' });
    // Next.js streams its loading boundary and page concurrently. Scope assertions to
    // the actual workspace instead of racing an unrelated loading-state heading.
    await page.locator('#main-content .page-heading h1').waitFor({ state: 'visible' });
    return response;
  }
  try {
    for (const section of sections) {
      const response = await visit(`/preview/${section}`);
      assert.equal(response.status(), 200, section);
      assert.ok(await page.getByText('Synthetic data only · no production actions', { exact: true }).isVisible());
      assert.ok((await page.locator('#main-content .page-heading h1').innerText()).length > 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${section}: desktop overflow`);
    }
    await visit('/preview/overview');
    await page.screenshot({ path: 'artifacts/overview-desktop.png', fullPage: true });
    await page.keyboard.press('Control+k');
    await page.getByLabel('Search workspaces', { exact: true }).fill('payments');
    await page.getByRole('dialog').getByRole('link', { name: 'Payments Workspace' }).click();
    await page.waitForURL('**/preview/payments');
    await page.locator('#main-content').getByRole('heading', { name: 'Payments', exact: true }).waitFor();
    await page.getByLabel('Search payments', { exact: true }).fill('Amina');
    assert.equal(await page.locator('tbody tr').count(), 1);
    await page.getByRole('button', { name: 'Open Mobile Money deposit', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    assert.ok(await page.getByText('Financial ledger', { exact: true }).isVisible());
    await page.screenshot({ path: 'artifacts/payment-investigation.png', fullPage: true });
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await visit('/preview/customers/demo-customer-001');
    await page.getByRole('dialog').waitFor();
    await page.screenshot({ path: 'artifacts/customer-workspace.png', fullPage: true });
    await visit('/preview/inbox');
    await page.getByRole('button', { name: 'New investigation' }).click();
    await page.getByLabel('Case title', { exact: true }).fill('Synthetic reconciliation test');
    await page.getByLabel('Reason & context', { exact: true }).fill('Synthetic evidence for a preview-only test case.');
    await page.getByRole('button', { name: 'Create preview case' }).click();
    await page.getByRole('dialog').getByText('Synthetic reconciliation test', { exact: true }).first().waitFor();
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await visit('/preview/overview');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile overflow');
    await page.screenshot({ path: 'artifacts/overview-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Partners', exact: true }).click();
    await page.waitForURL('**/preview/partners');
    await page.locator('#main-content').getByRole('heading', { name: 'Partners', exact: true }).waitFor();
    const deniedPreview = await page.request.get('http://localhost:3007/preview/overview');
    assert.equal(deniedPreview.status(), 404, 'preview must be absent in production even if the flag is true');
    await visit('/overview', 3007);
    assert.equal(await page.getByText('Amina K.', { exact: true }).count(), 0, 'production leaked preview records');
    assert.ok(await page.getByRole('button', { name: 'New investigation' }).isDisabled());
    assert.deepEqual(errors, [], 'browser exceptions');
    console.log('PASS: 14 workspaces, search, filters, record dialogs, preview case form, mobile navigation and production preview denial.');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
