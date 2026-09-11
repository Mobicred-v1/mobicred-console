import { Controller, ForbiddenException, Get, Header, Req, ServiceUnavailableException } from '@nestjs/common';
import type { StaffRequest } from '../../shared/auth/staff-auth.guard';
import { scopedCreditRows } from './credit-read.policy';

@Controller('console-read')
export class CreditReadController {
  @Get('credit')
  @Header('Cache-Control', 'no-store')
  async credit(@Req() request: StaffRequest) {
    if (process.env.CONSOLE_CREDIT_READS_ENABLED !== 'true') throw new ServiceUnavailableException('The credit staff adapter is not enabled');
    const allowed = (process.env.CONSOLE_CREDIT_READ_ROLES ?? '').split(',').map((v) => v.trim()).filter(Boolean);
    if (!request.staff?.roles.some((role) => allowed.includes(role))) throw new ForbiddenException('Credit evidence read permission is required');
    const base = process.env.CONSOLE_CREDIT_URL;
    if (!base) throw new ServiceUnavailableException('The credit staff adapter is not configured');
    let url: URL;
    try {
      url = new URL(base);
      const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && loopback && url.protocol === 'http:'))) throw new Error();
    } catch { throw new ServiceUnavailableException('Invalid credit adapter configuration'); }
    // Fixed path and read-only method: never forward a caller-selected path or an internal API key.
    url.pathname = '/api/v1/score-decisions/admin/search';
    url.searchParams.set('tenant_id', request.staff.tenantId);
    url.searchParams.set('limit', '100');
    try {
      const response = await fetch(url, { method: 'GET', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(6000), headers: { authorization: `Bearer ${request.verifiedToken}`, accept: 'application/json' } });
      if (response.status === 401 || response.status === 403) throw new ForbiddenException('The credit owner denied this staff session');
      if (!response.ok) throw new Error('Owner unavailable');
      const text = await response.text();
      if (text.length > 1_000_000) throw new Error('Oversized owner response');
      return { items: scopedCreditRows(JSON.parse(text), request.staff.tenantId), observedAt: new Date().toISOString(), source: 'credit-intelligence', pageLimit: 100 };
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new ServiceUnavailableException('The scoped credit source is unavailable');
    }
  }
}
