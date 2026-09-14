import 'server-only';
import { ApiFailure, consoleRequest, currentSession } from './server-auth';
import type { PartnerPage } from './partner-model';
import type { ConsoleSession } from './console-model';
export async function loadPartners(code?: string, query: Record<string, string | string[] | undefined> = {}): Promise<{ data: PartnerPage; session?: ConsoleSession }> {
  const q = typeof query.q === 'string' ? query.q.slice(0, 120) : '';
  const page = typeof query.page === 'string' && /^[1-9]\d{0,3}$/.test(query.page) ? query.page : '1';
  const tab = typeof query.tab === 'string' && ['overview', 'credentials', 'customers', 'access'].includes(query.tab) ? query.tab : 'overview';
  const empty: PartnerPage = { state: 'unavailable', items: [], meta: { page: Number(page), limit: 25, total: 0 }, q, tab, permissions: { canRead: false, canCreate: false, canManageCredentials: false }, tenants: [], credentials: [], policies: [] };
  let session: ConsoleSession | undefined;
  try {
    const current = await currentSession();
    if (!current) return { data: { ...empty, state: 'unauthorized' } };
    session = current.session;
    const selectedCode = code ?? session.partnerContext?.partnerCode;
    if (selectedCode) {
      if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(selectedCode)) throw new ApiFailure(404);
      const result = await consoleRequest(`/api/v1/console-partners/${selectedCode}`, { sessionId: current.id }) as Pick<PartnerPage, 'partner' | 'tenants' | 'credentials' | 'policies' | 'totals' | 'permissions'>;
      if (!result.partner || result.partner.partnerCode !== selectedCode || !Array.isArray(result.tenants) || !Array.isArray(result.credentials)) throw new Error('Invalid partner contract');
      const data: PartnerPage = { ...empty, ...result, state: 'live' };
      if (tab === 'customers') data.customers = await consoleRequest(`/api/v1/console-partners/${selectedCode}/customers?${new URLSearchParams({ page, q })}`, { sessionId: current.id }) as PartnerPage['customers'];
      return { data, session };
    }
    const result = await consoleRequest(`/api/v1/console-partners?${new URLSearchParams({ page, q })}`, { sessionId: current.id }) as Pick<PartnerPage, 'items' | 'meta' | 'permissions'>;
    if (!Array.isArray(result.items) || !Number.isSafeInteger(result.meta?.total)) throw new Error('Invalid partner inventory');
    return { data: { ...empty, ...result, state: 'live' }, session };
  } catch (error) {
    const denied = error instanceof ApiFailure && [401, 403].includes(error.status);
    return { session, data: { ...empty, state: denied ? 'unauthorized' : 'unavailable', error: denied ? 'Your staff permissions or current partner context do not allow this view.' : 'Partner administration could not be loaded. The Core staff workspace integration must be available.' } };
  }
}
