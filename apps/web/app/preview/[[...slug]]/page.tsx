import { notFound } from 'next/navigation';
import { Workspace } from '../../../components/workspace';
import { isSection } from '../../../lib/console-model';
import { previewData, previewEnabled } from '../../../lib/preview-data';
export const dynamic = 'force-dynamic';
export default async function PreviewPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  if (!previewEnabled()) notFound();
  const { slug = ['overview'] } = await params; const [section, id] = slug;
  if (!isSection(section) || slug.length > 2) notFound();
  const data = previewData(section); const selected = id ? data.items.find((item) => item.id === id) : undefined;
  if (id && !selected) notFound();
  return <Workspace key={slug.join('/')} section={section} data={data} preview initialRecord={selected} health={previewData('operations').items} />;
}
