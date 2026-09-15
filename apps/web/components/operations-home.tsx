'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ConsoleShell } from './console-shell';
import { Badge, EmptyState } from './primitives';
import { Icon } from './icons';
import { formatTime, type ConsoleSession } from '../lib/console-model';
import type { CaseWorkspaceData } from '../lib/case-workspace-loader';
import './operations-home.css';

export function OperationsHome({ data, session }: { data: CaseWorkspaceData; session?: ConsoleSession }) {
  const router = useRouter();
  const scope = session?.partnerContext;
  const canAdminister = session?.roles.some((role) => ['ADMIN', 'OPS'].includes(role)) ?? false;
  const loaded = data.state === 'live';
  const openScope = () => window.dispatchEvent(new Event('mobicred:open-administration-scope'));
  return <ConsoleShell section="overview" preview={false} session={session}>
    <div className="page-heading"><div><div className="eyebrow">Mobicred staff workspace</div><h1>Operations overview</h1><p>Onboard partners, manage API access and follow operational investigations.</p></div><button className="button" onClick={() => router.refresh()}><Icon name="refresh" size={14} />Refresh</button></div>
    <section className="ops-welcome" aria-label="Operations workspace">
      <div><span className="eyebrow">One platform. Your operations.</span><h2>{scope ? `Working on ${scope.partnerName}` : 'Manage the whole partner network'}</h2><p>{scope ? `${scope.displayName} · ${scope.environment}. Operational records use this filter. Partner administration remains platform-wide.` : 'You are signed in as Mobicred staff. Start globally, or select a partner environment when the work calls for a focused view.'}</p>
        <div className="ops-actions">{canAdminister ? <Link className="button primary" href="/partners?onboard=1"><Icon name="plus" size={16} />Onboard a partner</Link> : <span className="muted">Partner administration requires an authorized staff role.</span>}<Link className="button" href="/partners">Partner directory<Icon name="arrow" size={14} /></Link></div>
      </div>
      <div className="ops-scope-card"><Icon name="building" size={22} /><span>Operational filter · optional</span><strong>{scope ? scope.partnerName : 'All partners'}</strong><p>{scope ? `${scope.displayName} · ${scope.tenantId}` : 'No partner selection is required to use your workspace.'}</p><button className="button" onClick={openScope}>{scope ? 'Change administration scope' : 'Select a partner to administer'}</button></div>
    </section>
    <div className="ops-entry-grid">
      <Link className="panel ops-entry" href="/partners"><span className="stat-icon"><Icon name="building" size={20} /></span><h2>Partners & API access</h2><p>Manage relationships, environments, credentials and customer connections.</p><span className="text-link">Open partner administration <Icon name="arrow" size={14} /></span></Link>
      <Link className="panel ops-entry" href="/inbox"><span className="stat-icon"><Icon name="inbox" size={20} /></span><h2>Investigations</h2><p>Assign work, record evidence and resolve cases with an audit trail.</p><span className="text-link">Open investigation inbox <Icon name="arrow" size={14} /></span></Link>
      <Link className="panel ops-entry" href="/operations"><span className="stat-icon"><Icon name="activity" size={20} /></span><h2>Platform operations</h2><p>Inspect configured capabilities and the permissions available to your account.</p><span className="text-link">Review operational access <Icon name="arrow" size={14} /></span></Link>
    </div>
    <section className="panel"><div className="panel-header"><div><h2>Recent investigations</h2><p>{scope ? `${scope.partnerName} · ${scope.displayName}` : 'Across Mobicred'} · {loaded ? `${data.total} matching investigations` : 'Source currently unavailable'}</p></div>{data.canWrite ? <Link className="button primary" href="/inbox?compose=1"><Icon name="plus" size={14} />New investigation</Link> : <Link className="button" href="/inbox">View inbox</Link>}</div>
      {loaded ? data.items.length ? <div className="table-scroll"><table><thead><tr><th>INVESTIGATION</th><th>TYPE</th><th>STATUS</th><th>ASSIGNED TO</th><th>UPDATED</th></tr></thead><tbody>{data.items.slice(0, 6).map((item) => <tr key={item.id}><td><Link className="record-link" href={`/inbox/${encodeURIComponent(item.id)}`}><strong>{item.title}</strong></Link></td><td>{item.category}</td><td><Badge tone={item.tone}>{item.status}</Badge></td><td>{item.owner}</td><td>{formatTime(item.updatedAt)}</td></tr>)}</tbody></table></div> : <div className="partner-empty"><Icon name="check" size={26} /><h3>No investigations in this view</h3><p>{scope ? 'Switch to all partners to see platform-wide work, or create an investigation in this scope.' : 'Create an investigation when an operation needs follow-up. Partner onboarding is available independently.'}</p></div> : <EmptyState state={data.state} detail={data.detail} retry={() => router.refresh()} />}
      <div className="panel-footer"><span>Case resolution does not change financial execution.</span><Link className="text-link" href="/inbox">View all investigations<Icon name="arrow" size={13} /></Link></div>
    </section>
  </ConsoleShell>;
}
