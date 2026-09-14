import { ApiFailure, currentSession } from '../../../lib/server-auth';
export const dynamic = 'force-dynamic';
export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const current = await currentSession();
    if (!current) return Response.json({ authenticated: false }, { status: 401, headers });
    return Response.json({ authenticated: true, expiresAt: current.session.expiresAt, contextVersion: current.session.contextVersion }, { headers });
  } catch (error) { return Response.json({ authenticated: false }, { status: error instanceof ApiFailure && [401, 403].includes(error.status) ? 401 : 503, headers }); }
}
