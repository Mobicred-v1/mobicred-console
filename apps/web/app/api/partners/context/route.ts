import { NextRequest } from 'next/server';
import { staffRoute } from '../../../../lib/staff-route';
export async function POST(request: NextRequest) { return staffRoute(request, '/api/v1/console-partners/context', true); }
