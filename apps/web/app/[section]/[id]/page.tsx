import { notFound } from 'next/navigation';
import { Workspace } from '../../../components/workspace';
import { isSection } from '../../../lib/console-model';
import { loadWorkspace } from '../../../lib/workspace-loader';
export const dynamic = 'force-dynamic';
export default async function RecordPage({ params }: { params: Promise<{ section: string; id: string }> }) {
  const { section, id } = await params;
  if (!isSection(section) || id.length > 100) notFound();
  const { data, session } = await loadWorkspace(section, id);
  const item = data.items.find((row) => row.id === id);
  if (data.state === 'live' && !item) notFound();
  return <Workspace key={`${section}/${id}`} section={section} data={data} session={session} initialRecord={item} />;
}
