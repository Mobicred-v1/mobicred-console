import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { ApiFailure, authConfig, consoleRequest, currentSession } from './server-auth';
import { readLimitedText, sameOrigin } from './auth-policy';

export async function caseCommandRoute(request: NextRequest, id?: string) {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const config = authConfig();
    if (!sameOrigin(request.headers.get('origin'), config.origin)) return NextResponse.json({ error: 'Forbidden origin' }, { status: 403, headers });
    if (!request.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'JSON required' }, { status: 400, headers });
    if (id && !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid case reference' }, { status: 400, headers });
    const key = request.headers.get('idempotency-key');
    if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) return NextResponse.json({ error: 'A UUID v4 Idempotency-Key is required' }, { status: 400, headers });
    const current = await currentSession();
    if (!current) return NextResponse.json({ error: 'Staff session required' }, { status: 401, headers });
    let body: unknown;
    try { body = JSON.parse(await readLimitedText(request, 8192)); }
    catch { return NextResponse.json({ error: 'Invalid or oversized JSON body' }, { status: 400, headers }); }
    const path = id ? `/api/v1/console-cases/${encodeURIComponent(id)}/commands` : '/api/v1/console-cases';
    const result = await consoleRequest(path, { method: 'POST', sessionId: current.id, idempotencyKey: key, body });
    return NextResponse.json(result, { status: 201, headers });
  } catch (error) {
    const status = error instanceof ApiFailure && [400, 401, 403, 404, 409].includes(error.status) ? error.status : 503;
    return NextResponse.json({ error: status === 409 ? 'Case command conflict' : 'Case command could not be confirmed' }, { status, headers });
  }
}
