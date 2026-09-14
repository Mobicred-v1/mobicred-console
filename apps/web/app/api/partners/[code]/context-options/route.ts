import { NextRequest } from 'next/server';
import { partnerPath, staffRoute } from '../../../../../lib/staff-route';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) { try { return await staffRoute(request, `${partnerPath((await params).code)}/context-options`); } catch { return Response.json({ error: 'Invalid partner' }, { status: 400 }); } }
