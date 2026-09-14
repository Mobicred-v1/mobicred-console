import { NextRequest } from 'next/server';
import { listQuery, staffRoute } from '../../../lib/staff-route';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) { try { return await staffRoute(request, `/api/v1/console-partners?${listQuery(request)}`); } catch { return Response.json({ error: 'Invalid search' }, { status: 400 }); } }
