'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Modal } from './primitives';
import { Icon } from './icons';
import { formatTime, statusTone, type ConsoleRecord, type SectionId } from '../lib/console-model';
const tabs: Partial<Record<SectionId, string[]>> = {
  customers: ['Overview', 'Accounts', 'KYC & identity', 'Activity'], payments: ['Investigation', 'Source states', 'Timeline'],
  credit: ['Decision & evidence', 'Execution boundary', 'Activity'], partners: ['Overview', 'Credentials', 'Access policy'],
  people: ['Profile', 'Permissions'], approvals: ['Change request', 'Before & after'],
};
export function RecordDetail({ record, section, preview, close, notify }: { record: ConsoleRecord; section: SectionId; preview: boolean; close: () => void; notify: (message: string) => void }) {
  const options = tabs[section] ?? ['Overview', 'Activity'];
  const [tab, setTab] = useState(options[0]);
  const root = preview ? '/preview' : '';
  const selectedFields = Object.entries(record.fields).filter(([key]) => {
    if (tab === 'Accounts') return /account|balance/i.test(key);
    if (tab === 'KYC & identity') return /kyc|identity|consent|phone|country/i.test(key);
    if (tab === 'Credentials') return /credential|secret|expiry|tenant|environment/i.test(key);
    if (tab === 'Access policy' || tab === 'Permissions') return /scope|allowed|permission|rate|ip |role|tenant|environment|countries/i.test(key);
    if (tab === 'Before & after') return /before|after|reason|execution|policy/i.test(key);
    if (tab === 'Execution boundary') return /application|disbursement|review|identity/i.test(key);
    return true;
  });
  const activity = tab === 'Activity' || tab === 'Timeline';
  return <Modal title={record.title} close={close} drawer><div className="drawer-body"><div className="drawer-hero"><span className="avatar">{record.title.slice(0, 2).toUpperCase()}</span><div><div className="mono muted">{record.id.toUpperCase()}</div><h2>{section === 'payments' ? record.fields.Amount ?? record.title : record.title}</h2><p>{record.owner} · {formatTime(record.updatedAt)}</p></div><div style={{ marginLeft: 'auto' }}><Badge tone={record.tone}>{record.status}</Badge></div></div>
    {preview && <div className="notice"><Icon name="info" size={16} /><div><strong>Synthetic record · design preview</strong><p>All identities, amounts and statuses on this page are fictional. No service action is executed.</p></div></div>}
    {section === 'payments' && <div className="notice warning"><Icon name="activity" size={17} /><div><strong>Provider confirmation is not ledger completion.</strong><p>Investigate each source independently before considering any financial correction.</p></div></div>}
    <div className="section-tabs" aria-label="Record views">{options.map((option) => <button key={option} className={tab === option ? 'active' : ''} aria-pressed={tab === option} onClick={() => setTab(option)}>{option}</button>)}</div>
    {section === 'credit' && tab === options[0] && <div className="score-panel"><div><span className="score-number">{record.fields.Score?.split(' ')[0] ?? '—'}</span><small>{preview ? 'Synthetic assessment' : 'Source-reported score'}</small></div><div><h3>Evidence before execution</h3><p>Reviewing this assessment does not approve or disburse a loan.</p><Badge tone="warning">{record.fields.Review ?? record.status}</Badge></div></div>}
    {activity ? record.timeline?.length ? <ol className="timeline">{record.timeline.map((event, index) => <li key={index}><strong>{event.title}</strong><p>{event.detail}</p><small>{formatTime(event.time)}</small></li>)}</ol> : <div className="empty-state"><h3>No verified activity stream is attached</h3><p>Activity is supplied by the owning service, not inferred from the current status.</p></div> : tab === 'Source states' ? <OwnerStates record={record} /> : <dl className="detail-grid">{selectedFields.map(([label, value]) => <div className="detail-field" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    {record.owners && tab !== 'Source states' && !activity && <section className="panel" style={{ marginBottom: 20 }}><div className="panel-header"><h2>Source-by-source status</h2><Badge tone="warning">Preserved separately</Badge></div><OwnerStates record={record} /></section>}
    <h3>Related workspaces</h3><div className="related-links">{record.related?.map((link) => <Link className="button" key={link.label} href={`${root}/${link.section}${link.id ? `/${link.id}` : ''}`} onClick={close}>{link.label}<Icon name="arrow" size={13} /></Link>)}<Link className="button" href={`${root}/audit`}>Audit trail<Icon name="arrow" size={13} /></Link></div>
    <section className="panel" style={{ marginTop: 22 }}><div className="panel-header"><h2>Controlled actions</h2><Badge>Owner enforced</Badge></div><div className="panel-body"><p className="muted" style={{ fontSize: 11, marginBottom: 14 }}>Financial execution, credential changes and restrictions require audited, authorized commands in the owning service.</p><div className="actions">{preview ? <button className="button" onClick={() => notify('Preview only: review intent captured for this session. No service mutation or durable audit record was created.')}><Icon name="file" size={14} />Preview review intent</button> : null}<button className="button" disabled title="An audited owner command is required">{section === 'approvals' ? 'Approve change' : section === 'payments' ? 'Request reconciliation' : section === 'credit' ? 'Submit evidence review' : 'Request a change'}</button></div></div></section>
    <p className="legal-note">Read and write permission are separate. This console never edits balances, marks provider payments successful, or bypasses the Core lending workflow.</p>
  </div></Modal>;
}
function OwnerStates({ record }: { record: ConsoleRecord }) { return <div>{record.owners?.length ? record.owners.map((owner) => <div className="owner-row" key={owner.owner}><strong>{owner.owner}</strong><span><Badge tone={statusTone(owner.status)}>{owner.status}</Badge></span><small>{owner.state} · {formatTime(owner.observedAt)}</small></div>) : <div className="panel-body"><p className="muted">No owner observations are available.</p></div>}</div>; }
