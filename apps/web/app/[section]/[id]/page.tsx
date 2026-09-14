import { notFound } from 'next/navigation';
import { Workspace } from '../../../components/workspace';
import { CaseWorkspace } from '../../../components/case-workspace';
import { PlatformWorkspace } from '../../../components/platform-workspace';
import { PartnerWorkspace } from '../../../components/partner-workspace';
import { isSection } from '../../../lib/console-model';
import { loadWorkspace } from '../../../lib/workspace-loader';
import { loadPartners } from '../../../lib/partner-loader';
import { loadCaseWorkspace, type CasePageQuery } from '../../../lib/case-workspace-loader';
export const dynamic = 'force-dynamic';
export default async function RecordPage({ params, searchParams }: { params: Promise<{ section: string; id: string }>; searchParams: Promise<CasePageQuery> }) {
  const { section, id } = await params; if (!isSection(section) || id.length > 100) notFound();
  if (section === 'partners') { const query = await searchParams; const { data, session } = await loadPartners(id, query); return <PartnerWorkspace key={id + JSON.stringify(query) + session?.contextVersion} data={data} session={session} />; }
  if (section === 'inbox') { const { data, session } = await loadCaseWorkspace(id); const item = data.items.find((r) => r.id === id); if (data.state === 'live' && !item) notFound(); return <CaseWorkspace key={id + session?.contextVersion} data={data} session={session} initialRecord={item} />; }
  const { data, session } = await loadWorkspace(section, id); const item = data.items.find((r) => r.id === id);
  if (['live', 'stale'].includes(data.state) && !item) notFound();
  if (section === 'people' || section === 'configuration' || section === 'operations') return <PlatformWorkspace key={id} section={section} data={data} session={session} initialRecord={item} />;
  return <Workspace key={id} section={section} data={data} session={session} initialRecord={item} />;
}
