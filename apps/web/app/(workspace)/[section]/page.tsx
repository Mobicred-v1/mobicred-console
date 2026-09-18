import { renderWorkspace } from '../../../lib/render-workspace';
import type { CasePageQuery } from '../../../lib/case-workspace-loader';
export default async function SectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<CasePageQuery> }) {
  return renderWorkspace((await params).section, await searchParams);
}
