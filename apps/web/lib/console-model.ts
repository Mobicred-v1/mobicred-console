import type { StaffSession } from './session-model';
export const sections = [
  { id: 'overview', label: 'Overview', group: 'Workspace', icon: 'home', description: 'Mobicred operations across partners and services.' },
  { id: 'inbox', label: 'Investigation inbox', group: 'Workspace', icon: 'inbox', description: 'Assign, investigate and resolve operational cases.' },
  { id: 'customers', label: 'Customers', group: 'Workspace', icon: 'users', description: 'Customer records, identity and partner relationships.' },
  { id: 'payments', label: 'Payments', group: 'Workspace', icon: 'wallet', description: 'Investigate payments and reconciliation exceptions.' },
  { id: 'credit', label: 'Credit & risk', group: 'Workspace', icon: 'shield', description: 'Review credit assessments and supporting evidence.' },
  { id: 'partners', label: 'Partners', group: 'Workspace', icon: 'building', description: 'Onboard partners and manage environments, API access and customers.' },
  { id: 'ingestion', label: 'Data ingestion', group: 'Platform', icon: 'database', description: 'Source freshness, ingestion history and data quality.' },
  { id: 'aliases', label: 'Alias directory', group: 'Platform', icon: 'link', description: 'Account-directory mappings and consistency.' },
  { id: 'operations', label: 'Service operations', group: 'Platform', icon: 'activity', description: 'Service readiness and integration operations.' },
  { id: 'configuration', label: 'Configuration', group: 'Platform', icon: 'sliders', description: 'Effective settings and operational capabilities.' },
  { id: 'approvals', label: 'Approvals', group: 'Governance', icon: 'check', description: 'Review pending changes and approval decisions.' },
  { id: 'people', label: 'People & access', group: 'Governance', icon: 'user', description: 'Staff access and permissions.' },
  { id: 'audit', label: 'Audit trail', group: 'Governance', icon: 'file', description: 'Recorded staff actions and their context.' },
  { id: 'reports', label: 'Reports', group: 'Governance', icon: 'chart', description: 'Operational workload and reporting.' },
] as const;
export type SectionId = (typeof sections)[number]['id'];
export type SourceState = 'live' | 'stale' | 'unavailable' | 'unauthorized' | 'forbidden' | 'not-configured' | 'not-found' | 'preview';
export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';
export type OwnerSlice = { owner: string; state: SourceState; status: string; observedAt?: string; detail?: string };
export type ConsoleRecord = { id: string; title: string; subtitle: string; status: string; tone: Tone; category: string; owner: string; updatedAt: string; fields: Record<string, string>; owners?: OwnerSlice[]; timeline?: { title: string; detail: string; time: string }[]; related?: { label: string; section: SectionId; id?: string }[] };
export type ConsoleData = { state: SourceState; items: ConsoleRecord[]; detail?: string; observedAt?: string; total?: number; page?: number; hasNextPage?: boolean };
export type ConsoleSession = StaffSession;
export function isSection(value: string): value is SectionId { return sections.some((s) => s.id === value); }
export function sectionFor(id: SectionId) { return sections.find((s) => s.id === id)!; }
export function formatTime(value?: string) { if (!value || !Number.isFinite(Date.parse(value))) return 'Not observed'; return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date(value)) + ' UTC'; }
export function statusTone(status: string): Tone { if (/failed|rejected|blocked|critical|revoked/i.test(status)) return 'danger'; if (/pending|review|waiting|degraded|unmatched|expiring|open/i.test(status)) return 'warning'; if (/^(active|verified|healthy|completed|resolved|approved|success|enabled)$/i.test(status)) return 'success'; return 'neutral'; }
