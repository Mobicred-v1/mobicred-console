import { NextRequest } from 'next/server';
import { listQuery, partnerPath, staffRoute } from '../../../../../lib/staff-route';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) { try { return await staffRoute(request, `${partnerPath((await params).code)}/customers?${listQuery(request)}`); } catch { return Response.json({ error: 'Invalid customer search' }, { status: 400 }); } }
