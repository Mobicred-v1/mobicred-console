const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const sections = ['overview','inbox','customers','payments','credit','partners','ingestion','aliases','operations','configuration','approvals','people','audit','reports'];
(async () => {
  fs.mkdirSync('artifacts', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1512, height: 1050 }, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  async function visit(path) { const r = await page.goto(`http://localhost:3006${path}`, { waitUntil: 'networkidle' }); await page.locator('#main-content .page-heading h1').waitFor(); return r; }
  async function noOverflow(label) { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: document overflow`); }
  try {
    for (const section of sections) { assert.equal((await visit(`/preview/${section}`)).status(), 200); await noOverflow(`${section}: desktop`); await page.getByText('Synthetic data only · no production actions', { exact: true }).waitFor(); }
    await visit('/preview/overview'); await page.screenshot({ path: 'artifacts/overview-desktop.png', fullPage: true });
    await page.keyboard.press('Control+k'); await page.getByLabel('Search workspaces', { exact: true }).fill('payments'); await page.getByRole('dialog').getByRole('link', { name: 'Payments Workspace' }).click();
    await page.waitForURL('**/preview/payments'); await page.getByLabel('Search payments', { exact: true }).fill('Amina'); assert.equal(await page.locator('tbody tr').count(), 1);
    await page.getByRole('button', { name: 'Open Mobile Money deposit', exact: true }).click(); await page.getByRole('dialog').waitFor(); await page.getByText('Financial ledger', { exact: true }).waitFor();
    await page.screenshot({ path: 'artifacts/payment-investigation.png', fullPage: true }); await page.keyboard.press('Escape');
    await visit('/preview/customers/demo-customer-001'); await page.getByRole('dialog').waitFor(); await page.screenshot({ path: 'artifacts/customer-workspace.png', fullPage: true });
    await visit('/preview/inbox'); await page.getByRole('button', { name: 'New investigation' }).click(); await page.getByLabel('Case title', { exact: true }).fill('Synthetic reconciliation test'); await page.getByLabel('Reason & context', { exact: true }).fill('Synthetic evidence for a preview-only test case.'); await page.getByRole('button', { name: 'Create preview case' }).click(); await page.getByRole('dialog').getByText('Synthetic reconciliation test', { exact: true }).first().waitFor(); await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    for (const section of sections) { await visit(`/preview/${section}`); await noOverflow(`${section}: mobile`); }
    await visit('/preview/overview'); await page.screenshot({ path: 'artifacts/overview-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click(); await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Partners', exact: true }).click(); await page.waitForURL('**/preview/partners');
    assert.equal((await page.request.get('http://localhost:3007/preview/overview')).status(), 404);
    const protectedPage = await page.request.get('http://localhost:3007/overview', { maxRedirects: 0 });
    assert.equal(protectedPage.status(), 303, 'production must not render its shell without a verified session');
    assert.equal((await page.request.get('http://localhost:3007/api/partners', { maxRedirects: 0 })).status(), 401);
    assert.ok(!(await protectedPage.text()).includes('console-navigation'));
    assert.deepEqual(errors, [], 'browser exceptions');
    console.log('PASS: 14 desktop/mobile preview workspaces, interactive filters/search/dialogs, mobile navigation; production preview denial and session-required shell/API.');
  } catch (error) { await page.screenshot({ path: 'artifacts/preview-failure.png', fullPage: true }).catch(() => {}); console.error('Page at failure:', page.url()); throw error; }
  finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
