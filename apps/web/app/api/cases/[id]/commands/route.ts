import { NextRequest } from 'next/server';
import { caseCommandRoute } from '../../../../../lib/case-command-route';
export const runtime = 'nodejs';
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return caseCommandRoute(request, id);
}
