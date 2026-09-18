import 'server-only';
import { sourceFailure } from './source-failure';
import { consoleRequest, requirePageSession } from './server-auth';
import { caseRecord, creditRecord, sourceItems } from './live-records';
import { capabilityData, sourceQualityData } from './platform-records';
import type { ConsoleData, ConsoleRecord, ConsoleSession, SectionId } from './console-model';
export async function loadWorkspace(section: SectionId, id?: string): Promise<{ data: ConsoleData; session?: ConsoleSession }> {
  const current = await requirePageSession();
  const session = current.session;
  try {
    const request = (path: string) => consoleRequest(path, { sessionId: current.id });
    const filter = (data: ConsoleData) => ({ session, data: id ? { ...data, items: data.items.filter((item) => item.id === id) } : data });
    if (section === 'ingestion') return filter(sourceQualityData(await request('/api/v1/console-read/ingestion'), session.tenant, session.partnerContext?.partnerCode));
    if (section === 'people' || section === 'configuration' || section === 'operations') return filter(capabilityData(await request('/api/v1/console-capabilities'), session.tenant, section));
    if (section === 'overview' || section === 'inbox') {
      const result = await request('/api/v1/console-cases?limit=100');
      const items = sourceItems(result).map((row) => caseRecord(row, session!.tenant, session!.partnerContext?.partnerCode));
      return filter({ state: 'live', items, total: items.length, observedAt: new Date().toISOString(), detail: 'Latest 100 investigations in this workspace. Open the inbox for full search and pagination.' });
    }
    if (section === 'credit') {
      const result = await request('/api/v1/console-read/credit');
      return filter({ state: 'live', items: sourceItems(result).map((row) => creditRecord(row, session!.tenant, session!.partnerContext?.partnerCode)), observedAt: new Date().toISOString() });
    }
    if (section === 'audit') {
      const result = await request('/api/v1/console-cases/audit');
      const items: ConsoleRecord[] = sourceItems(result).map((value) => {
        const r = value as Record<string, unknown>;
        if (typeof r.id !== 'string' || typeof r.action !== 'string' || typeof r.target_id !== 'string') throw new Error('Invalid audit');
        return { id: r.id, title: r.action, subtitle: r.target_id, category: 'Investigation', status: 'Recorded', tone: 'neutral', owner: 'Mobicred audit', updatedAt: String(r.created_at), fields: { Actor: String(r.actor_id), Target: r.target_id, Partner: typeof r.partner_code === 'string' ? r.partner_code : 'Mobicred', Environment: r.tenant_id === '@mobicred' ? 'Platform' : String(r.tenant_id), Reason: String(r.reason), Scope: 'Investigation actions' }, related: [{ label: 'Investigation', section: 'inbox', id: r.target_id }] };
      });
      return filter({ state: 'live', items, observedAt: new Date().toISOString() });
    }
    if (section === 'reports') {
      const result = await request('/api/v1/console-cases/reports') as { tenantId?: unknown; partnerCode?: unknown; generatedAt?: unknown; items?: unknown };
      if (result.tenantId !== session.tenant || result.partnerCode !== (session.partnerContext?.partnerCode ?? null) || !Array.isArray(result.items)) throw new Error('Invalid report scope');
      const items: ConsoleRecord[] = result.items.map((value) => {
        const r = value as Record<string, unknown>;
        if (typeof r.kind !== 'string' || typeof r.status !== 'string' || typeof r.count !== 'number') throw new Error('Invalid report');
        return { id: `cases-${r.kind}-${r.status}`, title: `${r.kind} cases · ${r.status}`, subtitle: 'Investigation workload', category: 'Operations', status: 'Current snapshot', tone: 'info', owner: 'Mobicred investigations', updatedAt: String(result.generatedAt), fields: { Cases: String(r.count), Workspace: session!.partnerContext ? `${session!.partnerContext.partnerName} · ${session!.partnerContext.displayName}` : 'Mobicred · all partners', Scope: 'All current investigations in this workspace', 'Report type': 'Operational workload, not a financial statement' } };
      });
      return filter({ state: 'live', items, observedAt: String(result.generatedAt) });
    }
    return { session, data: { state: 'unavailable', items: [], detail: 'This workspace’s service integration is not yet connected. No sample records are used.' } };
  } catch (error) {
    return { session, data: { items: [], ...sourceFailure(error, Boolean(id)) } };
  }
}
