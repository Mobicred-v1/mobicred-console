import 'server-only';
import { ApiFailure, consoleRequest, currentSession } from './server-auth';
import { caseRecord, ownerSlices, sourceItems } from './live-records';
import type { ConsoleRecord, ConsoleSession, SourceState } from './console-model';

export type CaseWorkspaceData = {
  state: SourceState;
  items: ConsoleRecord[];
  total: number;
  page: number;
  totalPages: number;
  canWrite: boolean;
  filters: { q: string; status: string };
  detail?: string;
};
export type CasePageQuery = Record<string, string | string[] | undefined>;

export async function loadCaseWorkspace(id?: string, params: CasePageQuery = {}): Promise<{ data: CaseWorkspaceData; session?: ConsoleSession }> {
  const q = typeof params.q === 'string' ? params.q.slice(0, 120) : '';
  const status = typeof params.status === 'string' && ['open', 'waiting', 'resolved'].includes(params.status) ? params.status : '';
  const page = Math.max(1, Math.min(10000, Number.parseInt(typeof params.page === 'string' ? params.page : '1', 10) || 1));
  const empty: CaseWorkspaceData = { state: 'unauthorized', items: [], total: 0, page, totalPages: 0, canWrite: false, filters: { q, status } };
  let session: ConsoleSession | undefined;
  try {
    const current = await currentSession();
    if (!current) return { data: empty };
    session = current.session;
    const request = (path: string) => consoleRequest(path, { sessionId: current.id });
    const normalize = (value: unknown): ConsoleRecord => {
      const row = value as Record<string, unknown>;
      const record = caseRecord(value, current.session.tenant);
      if (typeof row.version !== 'number' || !Number.isInteger(row.version) || row.version < 1) throw new Error('Invalid case version');
      record.fields.Version = String(row.version);
      return record;
    };
    if (id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiFailure(404);
      const result = await request(`/api/v1/console-cases/${encodeURIComponent(id)}`) as { case: unknown; notes?: unknown; canWrite?: boolean };
      const record = normalize(result.case);
      if (Array.isArray(result.notes)) record.timeline = result.notes.slice(0, 100).map((value) => {
        const note = value as Record<string, unknown>;
        return { title: `Staff note · ${typeof note.author_id === 'string' ? note.author_id : 'unknown'}`, detail: typeof note.body === 'string' ? note.body.slice(0, 2000) : '', time: typeof note.created_at === 'string' ? note.created_at : '' };
      });
      try {
        const workspace = await request(`/api/v1/investigation-cases/${encodeURIComponent(id)}/workspace`) as { owners?: unknown };
        record.owners = ownerSlices(workspace.owners);
      } catch { record.owners = [{ owner: 'Linked owner services', state: 'unavailable', status: 'Source observations unavailable' }]; }
      return { session, data: { ...empty, state: 'live', items: [record], total: 1, totalPages: 1, canWrite: result.canWrite === true } };
    }
    const search = new URLSearchParams({ page: String(page), limit: '25', ...(q ? { q } : {}), ...(status ? { status } : {}) });
    const result = await request(`/api/v1/console-cases?${search}`) as { meta?: { total?: unknown; totalPages?: unknown }; canWrite?: boolean };
    const total = Number(result.meta?.total);
    const totalPages = Number(result.meta?.totalPages);
    if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(totalPages) || totalPages < 0) throw new Error('Invalid case pagination');
    return { session, data: { ...empty, state: 'live', items: sourceItems(result).map(normalize), total, totalPages, canWrite: result.canWrite === true } };
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 404) return { session, data: { ...empty, state: 'live' } };
    const denied = error instanceof ApiFailure && [401, 403].includes(error.status);
    return { session, data: { ...empty, state: denied ? 'unauthorized' : 'unavailable', detail: denied ? 'Your staff session does not authorize this view.' : 'The case database or identity service is unavailable. No sample records were substituted.' } };
  }
}
