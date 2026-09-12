import { NextRequest } from 'next/server';
import { caseCommandRoute } from '../../../lib/case-command-route';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) { return caseCommandRoute(request); }
