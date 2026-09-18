'use strict';
// Diagnostic preload for isolated browser tests only. Never log form text, tokens,
// headers, keys, owner bodies, or session identifiers.
if (process.env.NODE_ENV !== 'test' || process.env.CONSOLE_DATABASE_TESTS !== 'true') throw new Error('Isolated browser diagnostics only');
const { chromium } = require('playwright');
const launch = chromium.launch.bind(chromium);
chromium.launch = async (...args) => {
  const browser = await launch(...args);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...options) => {
    const context = await newContext(...options);
    context.on('page', (page) => {
      page.on('console', (message) => { if (message.text().startsWith('case-form-observation:')) console.log(message.text()); });
      page.on('response', async (response) => {
        const req = response.request();
        if (req.method() !== 'POST' || !/\/api\/cases\/[^/]+\/commands$/.test(new URL(response.url()).pathname)) return;
        try {
          const body = req.postDataJSON(); const result = await response.json();
          console.log('case-command-observation:', JSON.stringify({ action: body.action, requestedStatus: body.status, expectedVersion: body.expectedVersion, httpStatus: response.status(), resultVersion: result.version, replayed: result.replayed }));
        } catch { console.log('case-command-observation: response unavailable'); }
      });
    });
    await context.addInitScript(() => {
      document.addEventListener('invalid', (event) => {
        if (!location.pathname.startsWith('/inbox/')) return;
        console.info('case-form-observation: invalid ' + event.target.name);
      }, true);
      document.addEventListener('reset', (event) => {
        if (!location.pathname.startsWith('/inbox/')) return;
        console.info('case-form-observation: reset status=' + (event.target.elements?.namedItem('status')?.value || 'none'));
      }, true);
    });
    return context;
  };
  return browser;
};
