import { BadRequestException, ForbiddenException, HttpException, ServiceUnavailableException } from '@nestjs/common';
import { boundedOwnerJson, ownerOrigin } from './owner-read.transport';
import type { StaffRequest } from '../../shared/auth/staff-auth.guard';
import { projectCorePartnerResponse } from './core-response.policy';
import { assertPartnerCommandReceipt } from './partner-command-receipt.policy';
export const safePartnerCode = (v: unknown): string => { if (typeof v !== 'string' || !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(v)) throw new BadRequestException('Invalid partner context'); return v; };
export function partnerPermissions(request: StaffRequest) { const roles = request.staff?.roles ?? []; return { canRead: roles.some((r) => ['ADMIN', 'OPS'].includes(r)), canCreate: roles.some((r) => ['ADMIN', 'OPS'].includes(r)), canManageCredentials: roles.includes('ADMIN') }; }
export async function partnerOwner(request: StaffRequest, operation: 'list' | 'detail' | 'customers' | 'context' | 'command', args: { code?: string; tenantId?: string; page?: string; q?: string; command?: unknown; key?: string } = {}) {
  if (!partnerPermissions(request).canRead) throw new ForbiddenException('Partner administration access is not permitted');
  if (!request.verifiedToken || request.verifiedToken.length > 16384 || /\s/.test(request.verifiedToken)) throw new ForbiddenException('Verified staff delegation required');
  let url: URL;
  try { url = ownerOrigin(process.env.CONSOLE_CORE_URL); } catch { throw new ServiceUnavailableException('Partner administration is not configured'); }
  let path = '/internal/staff/partner-workspace';
  if (['detail', 'customers', 'context'].includes(operation)) path += `/${safePartnerCode(args.code)}`;
  if (operation === 'context') path += `/context/${safePartnerCode(args.tenantId)}`;
  if (operation === 'customers') path += '/customers';
  if (operation === 'command') path += '/commands';
  url.pathname = path;
  if (operation === 'list' || operation === 'customers') {
    if (args.page !== undefined && !/^[1-9]\d{0,3}$/.test(args.page)) throw new BadRequestException('Invalid page');
    url.searchParams.set('page', args.page ?? '1'); url.searchParams.set('limit', '25');
    if (args.q) { if (args.q.length > 120) throw new BadRequestException('Search is too long'); url.searchParams.set('q', args.q); }
    if (operation === 'customers' && args.tenantId) url.searchParams.set('tenantId', safePartnerCode(args.tenantId));
  }
  const headers: Record<string, string> = { authorization: `Bearer ${request.verifiedToken}`, accept: 'application/json' };
  if (operation === 'command') {
    if (!args.command || typeof args.command !== 'object' || Array.isArray(args.command)) throw new BadRequestException('Invalid command');
    const command = args.command as Record<string, unknown>;
    safePartnerCode(command.partnerCode); safePartnerCode(command.tenantId);
    if (!['create_partner', 'create_environment', 'issue_credential', 'rotate_credential', 'revoke_credential'].includes(String(command.action))) throw new BadRequestException('Unsupported partner operation');
    if (!['create_partner', 'create_environment'].includes(String(command.action)) && !partnerPermissions(request).canManageCredentials) throw new ForbiddenException('Credential administration permission required');
    // This is explicit staff administration, not a partner login. Do not inherit
    // or constrain a command's target from the optional operational filter.
    // Staff-role validation, session context-version checks and Core authorization remain mandatory.
    if (!args.key || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(args.key)) throw new BadRequestException('An idempotency key is required');
    headers['x-idempotency-key'] = args.key; headers['content-type'] = 'application/json';
  }
  try {
    const response = await fetch(url, { method: operation === 'command' ? 'POST' : 'GET', body: operation === 'command' ? JSON.stringify(args.command) : undefined, headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      await response.body?.cancel();
      if ([400, 401, 403, 404, 409, 429].includes(response.status)) throw new HttpException(response.status === 409 ? 'This operation conflicts with the owner state. Inspect the record before retrying.' : 'The owner could not authorize or complete this operation.', response.status);
      throw new Error();
    }
    const result = projectCorePartnerResponse(await boundedOwnerJson(response), operation);
    if (operation === 'command') assertPartnerCommandReceipt(result, args.command);
    if (args.code && operation !== 'detail' && result.partnerCode !== args.code) throw new Error();
    if (operation === 'context' && (result.tenantId !== args.tenantId || result.status !== 'ACTIVE')) throw new Error();
    if (operation === 'customers' && result.tenantId !== (args.tenantId ?? null)) throw new Error();
    if (operation === 'detail' && (result.partner as { partnerCode: string }).partnerCode !== args.code) throw new Error();
    return result;
  } catch (error) {
    if (error instanceof HttpException) throw error;
    throw new ServiceUnavailableException(operation === 'command' ? 'The owner outcome could not be confirmed. Retry with the same request key; do not issue another credential blindly.' : 'Partner administration is temporarily unavailable');
  }
}
