import 'server-only';
import { NextRequest } from 'next/server';
import { staffRoute } from './staff-route';
/** Compatibility entry for the explicit existing case routes. */
export async function caseCommandRoute(request: NextRequest, path: string) {
  if (!/^\/api\/v1\/console-cases(?:\/[0-9a-f-]{36}\/commands)?$/i.test(path)) return Response.json({ error: 'Invalid case operation' }, { status: 400 });
  return staffRoute(request, path, true);
}
