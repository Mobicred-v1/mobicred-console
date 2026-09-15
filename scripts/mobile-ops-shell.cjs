'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.CONSOLE_DATABASE_TESTS !== 'true') throw new Error('Local fixture verification only');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage(); page.setDefaultTimeout(20000);
  try {
    await page.goto('http://127.0.0.1:3006/auth/login');
    await page.getByRole('button', { name: 'Continue securely', exact: true }).click();
    await page.waitForURL('http://127.0.0.1:3006/overview');
    await page.getByRole('heading', { name: 'Operations overview', exact: true }).waitFor();
    for (const width of [320, 390, 760]) {
      await page.setViewportSize({ width, height: 844 });
      const search = page.getByRole('button', { name: /Find a workspace/ });
      const icon = await search.locator('svg').boundingBox();
      assert.ok(icon && icon.width >= 15 && icon.height >= 15, `Search icon remains visible at ${width}px`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No overflow at ${width}px`);
      await search.click();
      await page.getByRole('dialog').getByLabel('Search workspaces', { exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Switch partner context', exact: true }).click();
      await page.getByRole('dialog').getByRole('heading', { name: 'Administration scope', exact: true }).waitFor();
      await page.keyboard.press('Escape');
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'artifacts/ops-overview-mobile.png', fullPage: true });
    console.log('PASS: visible, accessible search and optional scope controls at 320px, 390px and 760px.');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
