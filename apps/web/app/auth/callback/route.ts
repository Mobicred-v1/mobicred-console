import { NextRequest, NextResponse } from 'next/server';
import { authConfig, consoleRequest, flowCookieName, sessionCookieName } from '../../../lib/server-auth';
import { openFlow, readLimitedText, validSessionId } from '../../../lib/auth-policy';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  let config: ReturnType<typeof authConfig>;
  try { config = authConfig(); } catch { return new NextResponse('Staff sign-in is unavailable', { status: 503 }); }
  const finish = (path: string) => {
    const response = NextResponse.redirect(new URL(path, config.origin), 303);
    response.headers.set('Cache-Control', 'no-store');
    response.cookies.set(flowCookieName(), '', { httpOnly: true, secure: config.secure, sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  };
  try {
    const params = request.nextUrl.searchParams;
    const code = params.get('code');
    const state = params.get('state');
    const sealed = request.cookies.get(flowCookieName())?.value;
    if (params.has('error') || !code || code.length > 4096 || !state || !sealed || params.getAll('code').length !== 1 || params.getAll('state').length !== 1) throw new Error('Invalid authorization response');
    const flow = openFlow(sealed, state, config.flowKey);
    const tokens = await fetch(`${config.issuer}/protocol/openid-connect/token`, {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(6000),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.callback, code, code_verifier: flow.verifier }),
    });
    if (!tokens.ok) throw new Error('Code exchange failed');
    const tokenBody = JSON.parse(await readLimitedText(tokens, 65536)) as Record<string, unknown>;
    if (typeof tokenBody.access_token !== 'string' || String(tokenBody.token_type).toLowerCase() !== 'bearer') throw new Error('Invalid access token response');
    // Identity is established by the BFF's authoritative introspection, never by decoding an ID token in the browser.
    const created = await consoleRequest('/api/v1/console-session', { method: 'POST', bearer: tokenBody.access_token, tenant: flow.tenant }) as { sessionId?: unknown; expiresAt?: unknown };
    if (typeof created.sessionId !== 'string' || !validSessionId(created.sessionId) || typeof created.expiresAt !== 'string') throw new Error('Invalid session response');
    const ttl = Math.floor((Date.parse(created.expiresAt) - Date.now()) / 1000);
    if (!Number.isFinite(ttl) || ttl <= 0) throw new Error('Expired session');
    const response = finish('/overview');
    response.cookies.set(sessionCookieName(), created.sessionId, { httpOnly: true, secure: config.secure, sameSite: 'lax', path: '/', maxAge: Math.min(ttl, 28800) });
    return response;
  } catch { return finish('/auth/login?error=signin'); }
}
