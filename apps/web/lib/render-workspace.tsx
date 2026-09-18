import { notFound } from 'next/navigation';
import { Workspace } from '../components/workspace';
import { CaseWorkspace } from '../components/case-workspace';
import { PlatformWorkspace } from '../components/platform-workspace';
import { PartnerWorkspace } from '../components/partner-workspace';
import { OperationsHome } from '../components/operations-home';
import { StaffView } from '../components/staff-view';
import { isSection } from './console-model';
import { loadWorkspace } from './workspace-loader';
import { loadPartners } from './partner-loader';
import { loadCaseWorkspace, type CasePageQuery } from './case-workspace-loader';
import { requirePageSession } from './server-auth';

export async function renderWorkspace(section: string, query: CasePageQuery, id?: string) {
  if (!isSection(section) || (id && id.length > 100)) notFound();
  const { session } = await requirePageSession();
  let content;
  if (section === 'partners') {
    const { data } = await loadPartners(id, query);
    content = <PartnerWorkspace key={JSON.stringify(query) + id} data={data} session={session} onboard={!id && query.onboard === '1'} />;
  } else if (section === 'overview' && !id) {
    const { data } = await loadCaseWorkspace();
    content = <OperationsHome data={data} session={session} />;
  } else if (section === 'inbox') {
    const { data } = await loadCaseWorkspace(id, query);
    if (data.state === 'not-found') notFound();
    const item = id ? data.items.find((record) => record.id === id) : undefined;
    content = <CaseWorkspace key={JSON.stringify(query) + id} data={data} session={session} initialRecord={item} compose={query.compose === '1'} />;
  } else {
    const { data } = await loadWorkspace(section, id);
    const item = id ? data.items.find((record) => record.id === id) : undefined;
    if (data.state === 'not-found' || (id && ['live', 'stale'].includes(data.state) && !item)) notFound();
    content = ['people', 'configuration', 'operations'].includes(section)
      ? <PlatformWorkspace key={section + id} section={section as 'people' | 'configuration' | 'operations'} data={data} session={session} initialRecord={item} />
      : <Workspace key={section + id} section={section} data={data} initialRecord={item} />;
  }
  return <StaffView key={section + (id ?? '') + (session.contextVersion ?? 0)} snapshot={session}>{content}</StaffView>;
}
