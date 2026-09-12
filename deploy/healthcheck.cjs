'use strict';
// Internal readiness only: no staff token or credential is required or printed.
(async () => {
  try {
    const response = await fetch(process.argv[2], { redirect: 'error', signal: AbortSignal.timeout(3500) });
    if (!response.ok) throw new Error('Not ready');
    const body = await response.json();
    if (body.status !== 'ok') throw new Error('Not ready');
  } catch { process.exitCode = 1; }
})();
