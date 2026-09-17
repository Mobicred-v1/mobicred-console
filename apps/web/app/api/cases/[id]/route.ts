import { NextRequest } from 'next/server';
import { staffRoute } from '../../../../lib/staff-route';
import { validCaseId } from '../../../../lib/case-detail';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!validCaseId(id) || request.nextUrl.search) return Response.json({ error: 'Invalid case read' }, { status: 400, headers });
  return staffRoute(request, `/api/v1/console-cases/${id}`);
}
