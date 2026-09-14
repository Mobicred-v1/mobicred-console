import { BadRequestException, ForbiddenException, HttpException, ServiceUnavailableException } from '@nestjs/common';
import { boundedOwnerJson, ownerOrigin } from './owner-read.transport';
import type { StaffRequest } from '../../shared/auth/staff-auth.guard';

export const safePartnerCode = (value: unknown): string => { if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(value)) throw new BadRequestException('Invalid partner context'); return value; };
const record = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid owner contract'); return value as Record<string, unknown>; };
function safeOutput(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeOutput);
  if (!value || typeof value !== 'object') return value;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (/secret|hash|token|password|metadata|payload|identityEvidence|consent/i.test(key) && key !== 'secretAvailable') continue;
    output[key] = safeOutput(item);
  }
  return output;
}
export function partnerPermissions(request: StaffRequest) {
  const roles = request.staff?.roles ?? [];
  return { canRead: roles.some((r) => ['ADMIN', 'OPS'].includes(r)), canCreate: roles.some((r) => ['ADMIN', 'OPS'].includes(r)), canManageCredentials: roles.includes('ADMIN') };
}

/** Explicit owner operations only. No caller-selected URL, service key, or arbitrary path. */
export async function partnerOwner(request: StaffRequest, operation: 'list' | 'detail' | 'customers' | 'context' | 'command', args: { code?: string; tenantId?: string; page?: string; q?: string; command?: unknown; key?: string } = {}) {
  if (!partnerPermissions(request).canRead) throw new ForbiddenException('Partner administration access is not permitted');
  if (!process.env.CONSOLE_CORE_URL) throw new ServiceUnavailableException('Partner administration is not connected');
  const url = ownerOrigin(process.env.CONSOLE_CORE_URL);
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
    const command = record(args.command);
    safePartnerCode(command.partnerCode);
    safePartnerCode(command.tenantId);
    const actions = ['create_partner', 'create_environment', 'issue_credential', 'rotate_credential', 'revoke_credential'];
    if (!actions.includes(String(command.action))) throw new BadRequestException('Unsupported partner operation');
    if (!['create_partner', 'create_environment'].includes(String(command.action)) && !partnerPermissions(request).canManageCredentials) throw new ForbiddenException('Credential administration permission required');
    if (request.staff?.partnerContext && (request.staff.partnerContext.partnerCode !== command.partnerCode || request.staff.partnerContext.tenantId !== command.tenantId)) throw new ForbiddenException('Leave partner context before changing another environment');
    if (!args.key || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(args.key)) throw new BadRequestException('An idempotency key is required');
    headers['idempotency-key'] = args.key;
    headers['content-type'] = 'application/json';
  }
  try {
    const response = await fetch(url, { method: operation === 'command' ? 'POST' : 'GET', body: operation === 'command' ? JSON.stringify(args.command) : undefined, headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      await response.body?.cancel();
      if ([400, 401, 403, 404, 409, 429].includes(response.status)) throw new HttpException(response.status === 409 ? 'The operation conflicts with the current owner state. Inspect the record before retrying.' : 'The owner could not authorize or complete this operation.', response.status);
      throw new Error();
    }
    const result = record(await boundedOwnerJson(response));
    if (result.schemaVersion !== 1) throw new Error();
    if (args.code && operation !== 'detail' && result.partnerCode !== args.code) throw new Error();
    if (operation === 'context' && (result.tenantId !== args.tenantId || result.status !== 'ACTIVE')) throw new Error();
    if (operation === 'customers' && Array.isArray(result.items) && result.items.some((item) => { const row = record(item); return row.partnerCode !== args.code || (args.tenantId && row.tenantId !== args.tenantId); })) throw new Error();
    if (operation === 'detail' && record(result.partner).partnerCode !== args.code) throw new Error();
    // apiKey is accepted only on this single command response, never on reads.
    if (operation !== 'command') delete result.apiKey;
    return safeOutput(result) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpException) throw error;
    throw new ServiceUnavailableException(operation === 'command' ? 'The owner outcome could not be confirmed. Retry with the same request key; do not issue another credential blindly.' : 'Partner administration is temporarily unavailable');
  }
}
