import { NextRequest } from 'next/server';
import { staffRoute } from '../../../../../lib/staff-route';
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) return Response.json({ error: 'Invalid case' }, { status: 400 });
  return staffRoute(request, `/api/v1/console-cases/${id}/commands`, true);
}
