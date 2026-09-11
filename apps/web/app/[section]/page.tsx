import { notFound } from 'next/navigation';
import { Workspace } from '../../components/workspace';
import { isSection } from '../../lib/console-model';
import { loadWorkspace } from '../../lib/workspace-loader';
export const dynamic = 'force-dynamic';
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params; if (!isSection(section)) notFound();
  const { data, session } = await loadWorkspace(section);
  return <Workspace key={section} section={section} data={data} session={session} />;
}
