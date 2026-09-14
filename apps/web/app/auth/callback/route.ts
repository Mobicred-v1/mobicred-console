import { NextRequest, NextResponse } from 'next/server';
import { ApiFailure, authConfig, consoleRequest, flowCookieName, sessionCookieName } from '../../../lib/server-auth';
import { openFlow, readLimitedText, validSessionId } from '../../../lib/auth-policy';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  let config: ReturnType<typeof authConfig>;
  try { config = authConfig(); } catch { return new NextResponse('Staff sign-in is temporarily unavailable', { status: 503 }); }
  const finish = (path: string) => {
    const response = NextResponse.redirect(new URL(path, config.origin), 303);
    response.headers.set('Cache-Control', 'no-store');
    response.cookies.set(flowCookieName(), '', { httpOnly: true, secure: config.secure, sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  };
  let stage = 'authorization_response';
  try {
    const params = request.nextUrl.searchParams; const code = params.get('code'); const state = params.get('state'); const sealed = request.cookies.get(flowCookieName())?.value;
    if (params.has('error') || !code || code.length > 4096 || !state || !sealed || params.getAll('code').length !== 1 || params.getAll('state').length !== 1) throw new Error();
    stage = 'flow_verification'; const flow = openFlow(sealed, state, config.flowKey);
    stage = 'code_exchange';
    const response = await fetch(`${config.issuer}/protocol/openid-connect/token`, { method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(6000), headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.callback, code, code_verifier: flow.verifier }) });
    if (!response.ok) throw new Error();
    stage = 'token_response'; const tokens = JSON.parse(await readLimitedText(response, 65536)) as Record<string, unknown>;
    if (typeof tokens.access_token !== 'string' || String(tokens.token_type).toLowerCase() !== 'bearer') throw new Error();
    stage = 'session_creation';
    const created = await consoleRequest('/api/v1/console-session', { method: 'POST', bearer: tokens.access_token }) as { sessionId?: unknown; expiresAt?: unknown };
    if (typeof created.sessionId !== 'string' || !validSessionId(created.sessionId) || typeof created.expiresAt !== 'string') throw new Error();
    const ttl = Math.floor((Date.parse(created.expiresAt) - Date.now()) / 1000);
    if (!Number.isFinite(ttl) || ttl <= 0) throw new Error();
    const result = finish('/overview');
    result.cookies.set(sessionCookieName(), created.sessionId, { httpOnly: true, secure: config.secure, sameSite: 'lax', path: '/', maxAge: Math.min(ttl, 28800) });
    return result;
  } catch (error) { console.warn('Staff sign-in failed', { stage, status: error instanceof ApiFailure ? error.status : undefined }); return finish('/auth/login?error=signin'); }
}
