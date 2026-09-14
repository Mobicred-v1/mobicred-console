export type CreditRow = { id: string; tenantid: string; partnercode: string; subjectid: string; productcode: string; score: number; band: string; modelversion: string; featuresnapshotid: string; decidedat: string; updatedAt: string };
export function scopedCreditRows(value: unknown, tenantId?: string): CreditRow[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { items?: unknown }).items)) throw new Error('Invalid scoring response');
  const items = (value as { items: unknown[] }).items;
  if (items.length > 100) throw new Error('Scoring response exceeded the page limit');
  return items.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid scoring row');
    const row = item as Record<string, unknown>;
    if ((tenantId !== undefined && row.tenantid !== tenantId) || typeof row.tenantid !== 'string' || typeof row.id !== 'string' || typeof row.score !== 'number' || !Number.isFinite(row.score)) throw new Error('Invalid scoring scope');
    const text = (key: string) => typeof row[key] === 'string' ? (row[key] as string).slice(0, 255) : '';
    return { id: text('id'), tenantid: text('tenantid'), partnercode: text('partnercode'), subjectid: text('subjectid'), productcode: text('productcode'), score: row.score, band: text('band'), modelversion: text('modelversion'), featuresnapshotid: text('featuresnapshotid'), decidedat: text('decidedat'), updatedAt: text('updatedAt') };
  });
