import { NextRequest, NextResponse } from 'next/server';

/** Reject before React streaming starts, so disabled preview routes return a real HTTP 404. */
export function proxy(_request: NextRequest) {
  const enabled = process.env.CONSOLE_PREVIEW_ENABLED === 'true' && ['preview', 'development'].includes(process.env.CONSOLE_ENV ?? '');
  if (!enabled) return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  return NextResponse.next();
}

export const config = { matcher: ['/preview/:path*'] };
