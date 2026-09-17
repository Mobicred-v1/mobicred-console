import { renderWorkspace } from '../../../../lib/render-workspace';
import type { CasePageQuery } from '../../../../lib/case-workspace-loader';
export default async function RecordPage({ params, searchParams }: { params: Promise<{ section: string; id: string }>; searchParams: Promise<CasePageQuery> }) {
  const { section, id } = await params;
  return renderWorkspace(section, await searchParams, id);
}
