import 'server-only';
import { NextRequest } from 'next/server';
import { ApiFailure, authConfig, consoleRequest, currentSession } from './server-auth';
import { readLimitedText, sameOrigin } from './auth-policy';

/** Used only by explicit routes. The browser never chooses a service URL/path. */
export async function staffRoute(request: NextRequest, path: string, mutation = false) {
  const headers = { 'Cache-Control': 'private, no-store', Pragma: 'no-cache' };
  try {
    if (mutation && !sameOrigin(request.headers.get('origin'), authConfig().origin)) return Response.json({ error: 'Forbidden' }, { status: 403, headers });
    const current = await currentSession();
    if (!current) return Response.json({ error: 'Staff sign-in required' }, { status: 401, headers });
    let body: unknown;
    let contextVersion: string | undefined;
    if (mutation) {
      if (!request.headers.get('content-type')?.startsWith('application/json')) return Response.json({ error: 'JSON required' }, { status: 400, headers });
      contextVersion = request.headers.get('x-console-context-version') ?? undefined;
      if (!contextVersion || !/^\d{1,9}$/.test(contextVersion) || Number(contextVersion) !== (current.session.contextVersion ?? 0)) return Response.json({ error: 'Workspace changed. Reload and retry.' }, { status: 409, headers });
      try { body = JSON.parse(await readLimitedText(request, 16384)); } catch { return Response.json({ error: 'Invalid request' }, { status: 400, headers }); }
    }
    const result = await consoleRequest(path, { sessionId: current.id, method: mutation ? 'POST' : 'GET', body, contextVersion, idempotencyKey: request.headers.get('idempotency-key') ?? undefined });
    return Response.json(result, { status: mutation ? 201 : 200, headers });
  } catch (error) {
    const status = error instanceof ApiFailure && [400, 401, 403, 404, 409, 429].includes(error.status) ? error.status : 503;
    return Response.json({ error: status === 409 ? 'The record or workspace changed. Inspect it before submitting again.' : status === 503 && mutation ? 'Outcome unconfirmed. Retry the same request, not a new credential operation.' : 'This operation could not be completed.' }, { status, headers });
  }
}
export function partnerPath(code: string) { if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(code)) throw new ApiFailure(400); return `/api/v1/console-partners/${code}`; }
export function listQuery(request: NextRequest): string {
  const q = request.nextUrl.searchParams.get('q') ?? ''; const page = request.nextUrl.searchParams.get('page') ?? '1';
  if (q.length > 120 || !/^[1-9]\d{0,3}$/.test(page) || [...request.nextUrl.searchParams.keys()].some((key) => !['q', 'page'].includes(key))) throw new ApiFailure(400);
  return new URLSearchParams({ page, ...(q ? { q } : {}) }).toString();
}
