import { NextRequest, NextResponse } from 'next/server';
import { authConfig, flowCookieName } from '../../../lib/server-auth';
import { newLoginFlow, pkceChallenge, readLimitedText, sameOrigin, sealFlow } from '../../../lib/auth-policy';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    const config = authConfig();
    if (!sameOrigin(request.headers.get('origin'), config.origin)) return new NextResponse('Forbidden', { status: 403 });
    if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return new NextResponse('Invalid form', { status: 400 });
    const form = new URLSearchParams(await readLimitedText(request, 4096));
    if ([...form.keys()].length !== 0) return new NextResponse('Invalid sign-in request', { status: 400 });
    const flow = newLoginFlow();
    const target = new URL(`${config.issuer}/protocol/openid-connect/auth`);
    target.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.callback, response_type: 'code', scope: 'openid', state: flow.state, code_challenge: pkceChallenge(flow.verifier), code_challenge_method: 'S256' }).toString();
    const response = NextResponse.redirect(target, 303);
    response.headers.set('Cache-Control', 'no-store');
    response.cookies.set(flowCookieName(), sealFlow(flow, config.flowKey), { httpOnly: true, secure: config.secure, sameSite: 'lax', path: '/', maxAge: 300 });
    return response;
  } catch { return new NextResponse('Staff sign-in is temporarily unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
