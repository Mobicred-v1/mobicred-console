import { NextRequest, NextResponse } from 'next/server';
import { authConfig, consoleRequest, sessionCookieName } from '../../../lib/server-auth';
import { sameOrigin, validSessionId } from '../../../lib/auth-policy';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let config: ReturnType<typeof authConfig>;
  try { config = authConfig(); } catch { return new NextResponse('Sign-out is unavailable', { status: 503 }); }
  if (!sameOrigin(request.headers.get('origin'), config.origin)) return new NextResponse('Forbidden', { status: 403 });
  const id = request.cookies.get(sessionCookieName())?.value;
  if (id && validSessionId(id)) {
    try { await consoleRequest('/api/v1/console-session', { method: 'DELETE', sessionId: id }); }
    catch { /* Always clear the browser cookie; inaccessible rows expire with their access token. */ }
  }
  const response = NextResponse.redirect(new URL('/auth/login', config.origin), 303);
  response.cookies.set(sessionCookieName(), '', { httpOnly: true, secure: config.secure, sameSite: 'lax', path: '/', maxAge: 0 });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
