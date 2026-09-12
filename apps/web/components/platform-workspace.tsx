'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConsoleShell } from './console-shell';
import { Badge, EmptyState, Modal } from './primitives';
import { Icon } from './icons';
import { formatTime, sectionFor, type ConsoleData, type ConsoleRecord, type ConsoleSession } from '../lib/console-model';

type PlatformSection = 'people' | 'configuration' | 'operations';
export function PlatformWorkspace({ section, data, session, initialRecord }: { section: PlatformSection; data: ConsoleData; session?: ConsoleSession; initialRecord?: ConsoleRecord }) {
  const router = useRouter();
  const [selected, setSelected] = useState<ConsoleRecord | null>(initialRecord ?? null);
  const meta = sectionFor(section);
  const description = section === 'people' ? 'Your verified identity and effective console permissions. This is not a staff directory.' : section === 'configuration' ? 'Read-only effective console configuration. Secrets and infrastructure origins are never displayed.' : 'Adapter policy and integration readiness. Configuration is not a service-health measurement.';
  const close = () => { setSelected(null); if (initialRecord) router.push(`/${section}`); };
  return <ConsoleShell section={section} preview={false} session={session}>
    <div className="page-heading"><div><div className="eyebrow">{meta.group}</div><h1>{meta.label}</h1><p>{description}</p></div><button className="button" onClick={() => router.refresh()}><Icon name="refresh" size={14} />Refresh</button></div>
    <div className="notice"><Icon name="shield" size={18} /><div><strong>{section === 'operations' ? 'No owner health is inferred from a feature flag.' : 'Effective policy, not a new authorization grant.'}</strong><p>Owner services independently verify every delegated request. This view cannot grant roles, change credentials or execute financial operations.</p></div></div>
    {data.state === 'live' ? <><div className="cards-grid">{data.items.map((item) => <article className="panel service-card" key={item.id}>
      <div className="row-line"><span className="stat-icon"><Icon name={meta.icon} size={19} /></span><Badge tone={item.tone}>{item.status}</Badge></div>
      <h2>{item.title}</h2><p>{item.subtitle}</p>
      <p>{section === 'operations' ? `Console policy: ${item.fields['Effective policy']}. No reachability probe has run.` : section === 'configuration' ? `Enabled: ${item.fields.Enabled} · Configured: ${item.fields.Configured} · Permitted: ${item.fields['Permitted for your session']}` : `Tenant: ${item.fields.Tenant}`}</p>
      <button className="button" onClick={() => setSelected(item)}>View details<Icon name="arrow" size={13} /></button>
    </article>)}</div><p className="legal-note">Policy observed {formatTime(data.observedAt)}. No mutable owner configuration or production-health feed is connected.</p></> : <section className="panel"><EmptyState state={data.state} detail={data.detail} retry={() => router.refresh()} /></section>}
    {selected && <Modal title={selected.title} close={close} drawer><div className="drawer-body"><dl className="detail-grid">{Object.entries(selected.fields).map(([label, value]) => <div className="detail-field" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div></Modal>}
  </ConsoleShell>;
}
