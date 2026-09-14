import { NextRequest, NextResponse } from 'next/server';
import { consoleApiOrigin } from './lib/api-origin';
import { trustedUrl, validSessionId, readLimitedText } from './lib/auth-policy';
import { sessionFrom } from './lib/session-model';
import { routeAccess } from './lib/route-access';

/** Global page/RSC/API boundary. A syntactically valid cookie is never authentication. */
export async function proxy(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' };
  const enabled = process.env.CONSOLE_PREVIEW_ENABLED === 'true' && ['preview', 'development'].includes(process.env.CONSOLE_ENV ?? '');
  const access = routeAccess(request.nextUrl.pathname, request.method, enabled);
  if (access === 'not-found') return new NextResponse('Not found', { status: 404, headers });
  if (access === 'public') return NextResponse.next();
  const cookieName = process.env.CONSOLE_PUBLIC_ORIGIN?.startsWith('https:') ? '__Host-mobicred_session' : 'mobicred_session';
  const id = request.cookies.get(cookieName)?.value;
  const denied = (status: number) => {
    if (status === 503) return new NextResponse('Staff access is temporarily unavailable. Please retry.', { status, headers });
    const api = request.nextUrl.pathname.startsWith('/api/');
    let response: NextResponse;
    if (api || !['GET', 'HEAD'].includes(request.method)) response = NextResponse.json({ error: 'Staff sign-in required' }, { status, headers });
    else {
      let origin: string;
      try { origin = trustedUrl(process.env.CONSOLE_PUBLIC_ORIGIN, process.env.CONSOLE_ENV === 'development', true).origin; }
      catch { return new NextResponse('Staff sign-in required', { status: 401, headers }); }
      response = NextResponse.redirect(new URL('/auth/login', origin), 303);
      for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
    }
    response.cookies.set(cookieName, '', { httpOnly: true, secure: cookieName.startsWith('__Host-'), sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  };
  if (!id || !validSessionId(id)) return denied(401);
  try {
    const result = await fetch(`${consoleApiOrigin()}/api/v1/console-session`, { headers: { 'x-console-session': id, accept: 'application/json' }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(6000) });
    if (!result.ok) return denied([401, 403].includes(result.status) ? result.status : 503);
    sessionFrom(JSON.parse(await readLimitedText(result, 16384)));
    const response = NextResponse.next();
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
    return response;
  } catch { return denied(503); }
}
export const config = { matcher: ['/:path*'] };
