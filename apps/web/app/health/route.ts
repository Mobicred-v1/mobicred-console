import { consoleApiOrigin } from '../../lib/api-origin';
import { readLimitedText } from '../../lib/auth-policy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Public minimal readiness; does not introspect identity or return upstream diagnostic details. */
export async function GET() {
  const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
  try {
    const response = await fetch(`${consoleApiOrigin()}/api/v1/health/ready`, {
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(2500), headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error('API not ready');
    const body = JSON.parse(await readLimitedText(response, 16384)) as { status?: string };
    if (body.status !== 'ok') throw new Error('API not ready');
    return Response.json({ status: 'ok' }, { headers });
  } catch { return Response.json({ status: 'unavailable' }, { status: 503, headers }); }
}
