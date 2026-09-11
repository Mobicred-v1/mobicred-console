export const sections = [
  { id: 'overview', label: 'Overview', group: 'Workspace', icon: 'home', description: 'The operational picture, without losing the detail.' },
  { id: 'inbox', label: 'Investigation inbox', group: 'Workspace', icon: 'inbox', description: 'Assign, investigate and resolve work across service boundaries.' },
  { id: 'customers', label: 'Customers', group: 'Workspace', icon: 'users', description: 'One customer. Their accounts, identity, evidence and activity.' },
  { id: 'payments', label: 'Payments', group: 'Workspace', icon: 'wallet', description: 'Trace money movement. Keep provider and ledger states distinct.' },
  { id: 'credit', label: 'Credit & risk', group: 'Workspace', icon: 'shield', description: 'Review evidence, understand decisions and follow credit execution.' },
  { id: 'partners', label: 'Partners', group: 'Workspace', icon: 'building', description: 'Manage partner relationships, tenant boundaries and API access.' },
  { id: 'ingestion', label: 'Data ingestion', group: 'Platform', icon: 'database', description: 'Follow source freshness, lineage and ingestion exceptions.' },
  { id: 'aliases', label: 'Alias directory', group: 'Platform', icon: 'link', description: 'Investigate directory mappings without changing financial records.' },
  { id: 'operations', label: 'Service operations', group: 'Platform', icon: 'activity', description: 'Service readiness, recovery queues and integration health.' },
  { id: 'configuration', label: 'Configuration', group: 'Platform', icon: 'sliders', description: 'Effective settings, scoped changes and controlled activation.' },
  { id: 'approvals', label: 'Approvals', group: 'Governance', icon: 'check', description: 'Review changes with clear intent, scope and separation of duties.' },
  { id: 'people', label: 'People & access', group: 'Governance', icon: 'user', description: 'Staff access, agency assignments and least-privilege roles.' },
  { id: 'audit', label: 'Audit trail', group: 'Governance', icon: 'file', description: 'Who did what, to which record, in which scope.' },
  { id: 'reports', label: 'Reports', group: 'Governance', icon: 'chart', description: 'Operational reporting with explicit sources and freshness.' },
] as const;
export type SectionId = (typeof sections)[number]['id'];
export type SourceState = 'live' | 'stale' | 'unavailable' | 'unauthorized' | 'preview';
export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';
export type OwnerSlice = { owner: string; state: SourceState; status: string; observedAt?: string; detail?: string };
export type ConsoleRecord = {
  id: string; title: string; subtitle: string; status: string; tone: Tone;
  category: string; owner: string; updatedAt: string;
  fields: Record<string, string>; owners?: OwnerSlice[];
  timeline?: { title: string; detail: string; time: string }[];
  related?: { label: string; section: SectionId; id?: string }[];
};
export type ConsoleData = {
  state: SourceState; items: ConsoleRecord[]; detail?: string;
  observedAt?: string; total?: number; page?: number; hasNextPage?: boolean;
};
export type ConsoleSession = { name: string; tenant: string; roles: string[] };
export function isSection(value: string): value is SectionId { return sections.some((s) => s.id === value); }
export function sectionFor(id: SectionId) { return sections.find((s) => s.id === id)!; }
export function formatTime(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not observed';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date(value)) + ' UTC';
}
export function statusTone(status: string): Tone {
  if (/failed|rejected|blocked|critical/i.test(status)) return 'danger';
  if (/pending|review|waiting|degraded|unmatched|expiring|open/i.test(status)) return 'warning';
  if (/active|verified|healthy|completed|resolved|approved|success|enabled/i.test(status)) return 'success';
  return 'neutral';
}
