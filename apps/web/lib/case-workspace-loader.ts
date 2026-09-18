import 'server-only';
import { sourceFailure } from './source-failure';
import { ApiFailure, consoleRequest, requirePageSession } from './server-auth';
import { caseRecord, sourceItems } from './live-records';
import { caseSnapshot, validCaseId } from './case-detail';
import type { ConsoleRecord, ConsoleSession, SourceState } from './console-model';
export type CaseWorkspaceData = { state: SourceState; items: ConsoleRecord[]; total: number; page: number; totalPages: number; canWrite: boolean; filters: { q: string; status: string }; detail?: string };
export type CasePageQuery = Record<string, string | string[] | undefined>;
export async function loadCaseWorkspace(id?: string, params: CasePageQuery = {}): Promise<{ data: CaseWorkspaceData; session?: ConsoleSession }> {
  const q = typeof params.q === 'string' ? params.q.slice(0, 120) : '';
  const status = typeof params.status === 'string' && ['open', 'waiting', 'resolved'].includes(params.status) ? params.status : '';
  const page = Math.max(1, Math.min(10000, Number.parseInt(typeof params.page === 'string' ? params.page : '1', 10) || 1));
  const empty: CaseWorkspaceData = { state: 'unauthorized', items: [], total: 0, page, totalPages: 0, canWrite: false, filters: { q, status } };
  const current = await requirePageSession();
  const session = current.session;
  try {
    const request = (path: string) => consoleRequest(path, { sessionId: current.id });
    const normalize = (value: unknown) => {
      const row = value as Record<string, unknown>; const record = caseRecord(value, current.session.tenant, current.session.partnerContext?.partnerCode);
      if (typeof row.version !== 'number' || !Number.isInteger(row.version) || row.version < 1) throw new Error('Invalid case version');
      record.fields.Version = String(row.version); return record;
    };
    if (id) {
      if (!validCaseId(id)) throw new ApiFailure(404);
      const snapshot = caseSnapshot(await request(`/api/v1/console-cases/${id}`), session, id);
      return { session, data: { ...empty, state: 'live', items: [snapshot.record], total: 1, totalPages: 1, canWrite: snapshot.canWrite } };
    }
    const result = await request(`/api/v1/console-cases?${new URLSearchParams({ page: String(page), limit: '25', ...(q ? { q } : {}), ...(status ? { status } : {}) })}`) as { meta?: { total?: unknown; totalPages?: unknown }; canWrite?: boolean };
    const total = Number(result.meta?.total); const totalPages = Number(result.meta?.totalPages);
    if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(totalPages) || totalPages < 0) throw new Error('Invalid pagination');
    return { session, data: { ...empty, state: 'live', items: sourceItems(result).map(normalize), total, totalPages, canWrite: result.canWrite === true } };
  } catch (error) {
    return { session, data: { ...empty, ...sourceFailure(error, Boolean(id)) } };
  }
}
