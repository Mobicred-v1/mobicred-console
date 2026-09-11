import 'server-only';
import { ApiFailure, consoleRequest, currentSession } from './server-auth';
import { caseRecord, creditRecord, ownerSlices, sourceItems } from './live-records';
import type { ConsoleData, ConsoleSession, SectionId } from './console-model';

export async function loadWorkspace(section: SectionId, id?: string): Promise<{ data: ConsoleData; session?: ConsoleSession }> {
  let session: ConsoleSession | undefined;
  try {
    const current = await currentSession();
    if (!current) return { data: { state: 'unauthorized', items: [], detail: 'Sign in with your authorized staff identity to load records in your tenant.' } };
    session = current.session;
    const request = (path: string) => consoleRequest(path, { sessionId: current.id });
    if (section === 'overview' || section === 'inbox') {
      if (id) {
        if (!/^[a-f0-9-]{36}$/i.test(id)) throw new ApiFailure(404);
        const result = await request(`/api/v1/investigation-cases/${encodeURIComponent(id)}/workspace`) as { case: unknown; owners: unknown };
        const item = caseRecord(result.case, session.tenant);
        item.owners = ownerSlices(result.owners);
        return { session, data: { state: 'live', items: [item], total: 1, observedAt: new Date().toISOString() } };
      }
      const result = await request('/api/v1/investigation-cases?limit=100');
      const items = sourceItems(result).map((row) => caseRecord(row, session!.tenant));
      return { session, data: { state: 'live', items, total: items.length, observedAt: new Date().toISOString(), detail: 'First 100 authorized cases. Totals refer to this loaded result set.' } };
    }
    if (section === 'credit') {
      const result = await request('/api/v1/console-read/credit');
      const items = sourceItems(result).map((row) => creditRecord(row, session!.tenant));
      return { session, data: { state: 'live', items: id ? items.filter((row) => row.id === id) : items, observedAt: new Date().toISOString() } };
    }
    return { session, data: { state: 'unavailable', items: [], detail: 'This workspace is designed, but its permission-scoped owner read contract is not connected. No production records or statuses are invented.' } };
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 404) return { session, data: { state: 'live', items: [] } };
    const denied = error instanceof ApiFailure && [401, 403].includes(error.status);
    return { session, data: { state: denied ? 'unauthorized' : 'unavailable', items: [], detail: denied ? 'Your session has expired or the source denied access to this role or tenant.' : 'The authorized source could not be loaded. Check identity, database migrations and the relevant owner adapter. No preview data was substituted.' } };
  }
}
