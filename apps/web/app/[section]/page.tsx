import { notFound } from 'next/navigation';
import { Workspace } from '../../components/workspace';
import { CaseWorkspace } from '../../components/case-workspace';
import { isSection } from '../../lib/console-model';
import { loadWorkspace } from '../../lib/workspace-loader';
import { loadCaseWorkspace, type CasePageQuery } from '../../lib/case-workspace-loader';
export const dynamic = 'force-dynamic';
export default async function SectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<CasePageQuery> }) {
  const { section } = await params;
  if (!isSection(section)) notFound();
  if (section === 'inbox') {
    const query = await searchParams;
    const { data, session } = await loadCaseWorkspace(undefined, query);
    return <CaseWorkspace key={JSON.stringify(data.filters) + data.page} data={data} session={session} compose={query.compose === '1'} />;
  }
  const { data, session } = await loadWorkspace(section);
  return <Workspace key={section} section={section} data={data} session={session} />;
}
