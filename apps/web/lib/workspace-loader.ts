import 'server-only';
import { ApiFailure, consoleRequest, currentSession } from './server-auth';
import { caseRecord, creditRecord, ownerSlices, sourceItems } from './live-records';
import type { ConsoleData, ConsoleRecord, ConsoleSession, SectionId } from './console-model';

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
      return { session, data: { state: 'live', items, total: items.length, observedAt: new Date().toISOString(), detail: 'Latest 100 authorized cases. Use the investigation inbox for server-side search and pagination.' } };
    }
    if (section === 'credit') {
      const result = await request('/api/v1/console-read/credit');
      const items = sourceItems(result).map((row) => creditRecord(row, session!.tenant));
      return { session, data: { state: 'live', items: id ? items.filter((row) => row.id === id) : items, observedAt: new Date().toISOString() } };
    }
    if (section === 'audit') {
      const result = await request('/api/v1/console-cases/audit');
      const items: ConsoleRecord[] = sourceItems(result).map((value) => {
        const row = value as Record<string, unknown>;
        if (typeof row.id !== 'string' || typeof row.action !== 'string' || typeof row.target_id !== 'string') throw new Error('Invalid audit record');
        return { id: row.id, title: row.action, subtitle: row.target_id, category: 'Case command', status: 'Recorded', tone: 'neutral', owner: 'Console audit', updatedAt: String(row.created_at), fields: { Actor: String(row.actor_id), Target: row.target_id, Tenant: current.session.tenant, Reason: String(row.reason), 'Audit scope': 'Console case mutations only', Integrity: 'Append-only application records; not a substitute for external immutable archival' }, related: [{ label: 'Investigation case', section: 'inbox', id: row.target_id }] };
      });
      return { session, data: { state: 'live', items: id ? items.filter((item) => item.id === id) : items, observedAt: new Date().toISOString() } };
    }
    if (section === 'reports') {
      const result = await request('/api/v1/console-cases/reports') as { tenantId?: unknown; generatedAt?: unknown; items?: unknown };
      if (result.tenantId !== session.tenant || !Array.isArray(result.items)) throw new Error('Invalid report scope');
      const items: ConsoleRecord[] = result.items.map((value) => {
        const row = value as Record<string, unknown>;
        if (typeof row.kind !== 'string' || typeof row.status !== 'string' || typeof row.count !== 'number') throw new Error('Invalid report row');
        return { id: `cases-${row.kind}-${row.status}`, title: `${row.kind} cases · ${row.status}`, subtitle: 'Tenant-scoped case workload', category: 'Operations', status: 'Current snapshot', tone: 'info', owner: 'Console case database', updatedAt: String(result.generatedAt), fields: { Cases: String(row.count), Tenant: current.session.tenant, Source: 'Authoritative console case database', Scope: 'All non-deleted cases in this tenant', 'Financial meaning': 'None. These are investigation counts, not payment or ledger reports.' } };
      });
      return { session, data: { state: 'live', items: id ? items.filter((item) => item.id === id) : items, observedAt: String(result.generatedAt) } };
    }
    return { session, data: { state: 'unavailable', items: [], detail: 'This workspace is designed, but its permission-scoped owner read contract is not connected. No production records or statuses are invented.' } };
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 404) return { session, data: { state: 'live', items: [] } };
    const denied = error instanceof ApiFailure && [401, 403].includes(error.status);
    return { session, data: { state: denied ? 'unauthorized' : 'unavailable', items: [], detail: denied ? 'Your session has expired or the source denied access to this role or tenant.' : 'The authorized source could not be loaded. Check identity, database migrations and the relevant owner adapter. No preview data was substituted.' } };
  }
}
