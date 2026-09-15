import { notFound } from 'next/navigation';
import { Workspace } from '../../components/workspace';
import { CaseWorkspace } from '../../components/case-workspace';
import { PlatformWorkspace } from '../../components/platform-workspace';
import { PartnerWorkspace } from '../../components/partner-workspace';
import { OperationsHome } from '../../components/operations-home';
import { isSection } from '../../lib/console-model';
import { loadWorkspace } from '../../lib/workspace-loader';
import { loadPartners } from '../../lib/partner-loader';
import { loadCaseWorkspace, type CasePageQuery } from '../../lib/case-workspace-loader';
export const dynamic = 'force-dynamic';
export default async function SectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<CasePageQuery> }) {
  const { section } = await params; if (!isSection(section)) notFound(); const query = await searchParams;
  if (section === 'partners') { const { data, session } = await loadPartners(undefined, query); return <PartnerWorkspace key={JSON.stringify(query) + session?.contextVersion} data={data} session={session} onboard={query.onboard === '1'} />; }
  if (section === 'overview') { const { data, session } = await loadCaseWorkspace(); return <OperationsHome key={session?.contextVersion} data={data} session={session} />; }
  if (section === 'inbox') { const { data, session } = await loadCaseWorkspace(undefined, query); return <CaseWorkspace key={JSON.stringify(query) + session?.contextVersion} data={data} session={session} compose={query.compose === '1'} />; }
  const { data, session } = await loadWorkspace(section);
  if (section === 'people' || section === 'configuration' || section === 'operations') return <PlatformWorkspace section={section} data={data} session={session} />;
  return <Workspace key={section + session?.contextVersion} section={section} data={data} session={session} />;
}
