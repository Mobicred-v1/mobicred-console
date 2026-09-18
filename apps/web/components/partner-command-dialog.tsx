'use client';
import { useRef, useState, type FormEvent } from 'react';
import { Modal } from './primitives';
import { partnerScopes, type PartnerPage } from '../lib/partner-model';
import { partnerCommandFromForm, type PartnerOperation, type PartnerReceipt } from '../lib/partner-command-form';
import type { ConsoleSession } from '../lib/console-model';

export function PartnerCommandDialog({ operation, data, session, close, saved }: { operation: PartnerOperation; data: PartnerPage; session: ConsoleSession; close: () => void; saved: (receipt: PartnerReceipt) => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [attempted, setAttempted] = useState(false);
  const [scopes, setScopes] = useState<string[]>(operation.credential?.scopes ?? ['customers:read']);
  const attempt = useRef<{ key: string; body: string; partnerCode: string; tenantId: string } | null>(null);
  const inFlight = useRef(false);
  const creating = operation.action === 'create_partner' || operation.action === 'create_environment';
  const secretAction = operation.action === 'issue_credential' || operation.action === 'rotate_credential';
  const title = { create_partner: 'New partner', create_environment: 'Add environment', issue_credential: 'Issue API credential', rotate_credential: 'Rotate API credential', revoke_credential: 'Revoke API credential' }[operation.action];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current) return;
    if (!attempt.current) {
      try { const command = partnerCommandFromForm(operation, new FormData(event.currentTarget), scopes, data.partner?.partnerCode); attempt.current = { key: crypto.randomUUID(), body: JSON.stringify(command), partnerCode: command.partnerCode as string, tenantId: command.tenantId as string }; }
      catch (err) { setError(err instanceof Error ? err.message : 'Check the required fields.'); return; }
    }
    inFlight.current = true; setBusy(true); setAttempted(true); setError('');
    try {
      const response = await fetch('/api/partners/commands', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': attempt.current.key, 'x-console-context-version': String(session.contextVersion ?? 0) }, body: attempt.current.body });
      const result = await response.json();
      if (response.status === 400) { attempt.current = null; setAttempted(false); throw new Error('The request was rejected without a change. Check the partner, environment, source IPs and reason, then correct the form.'); }
      if (!response.ok) throw new Error(response.status === 409 ? 'The request conflicts with the current state. Close this form, refresh and inspect the partner before starting another operation.' : typeof result.error === 'string' ? result.error : 'The request could not be confirmed. Retry the same request or inspect the partner.');
      if (typeof result.receiptId !== 'string' || result.partnerCode !== attempt.current.partnerCode || result.tenantId !== attempt.current.tenantId || result.action !== operation.action) throw new Error('The response could not be confirmed. Retry the same request.');
      saved(result as PartnerReceipt);
    } catch (err) { setError(err instanceof Error ? err.message : 'Outcome unconfirmed. Retry the same request.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <Modal title={title} close={() => { if (!inFlight.current) close(); }} drawer><form className="drawer-body" onSubmit={submit}>
    {operation.action === 'create_partner' ? <><div className="partner-onboarding-summary"><span><strong>1 · Partner</strong>Register the relationship.</span><span><strong>2 · API environment</strong>Set its first access policy.</span><span><strong>3 · Credentials</strong>Issue API access after creation.</span></div><p>Onboarding is a Mobicred administration action. It does not change your login or your selected operational filter.</p></> : <div className="partner-access-target"><strong>{data.partner?.displayName}</strong><div>Partner: {data.partner?.partnerCode}{operation.credential ? ` · Environment: ${operation.credential.tenantId}` : ''}</div></div>}
    <fieldset className="partner-command-fields" disabled={busy || attempted}>
      {operation.action === 'create_partner' && <label className="form-field">Partner code<input name="partnerCode" required pattern="[a-z0-9][a-z0-9_-]{1,63}" placeholder="partner-code" maxLength={64} autoComplete="off" /></label>}
      {creating && <><label className="form-field">Display name<input name="displayName" required minLength={2} maxLength={128} /></label>{operation.action === 'create_partner' && <label className="form-field">Legal name (optional)<input name="legalName" maxLength={160} /></label>}<h2 className="partner-form-section">{operation.action === 'create_partner' ? 'First API environment' : 'New API environment'}</h2><label className="form-field">Environment identifier<input name="tenantId" required pattern="[a-z0-9][a-z0-9_-]{1,63}" placeholder="partner-sandbox" maxLength={64} autoComplete="off" /></label><label className="form-field">Environment type<select aria-label="Environment type" name="environment" defaultValue="SANDBOX"><option>SANDBOX</option><option>PRODUCTION</option></select></label><label className="form-field">Countries<input name="countryCodes" required defaultValue={data.partner?.countryCodes.join(', ') || 'CI'} placeholder="CI, SN" /></label><label className="form-field">Allowed source IPs<textarea name="ipAllowlist" required placeholder="Partner server egress IPs or IPv4 CIDRs, one per line" /></label><p className="partner-help">These are the partner application servers, not the operator’s browser. Broad universal ranges are not permitted.</p></>}
      {operation.action === 'issue_credential' && <label className="form-field">API environment<select aria-label="API environment" name="tenantId" required defaultValue=""><option value="">Select an active environment</option>{data.tenants.filter((environment) => environment.status === 'ACTIVE').map((environment) => <option key={environment.tenantId} value={environment.tenantId}>{environment.displayName} · {environment.environment} · {environment.tenantId}</option>)}</select></label>}
      {operation.action !== 'revoke_credential' && <><h2 className="partner-form-section">API permissions</h2><div className="scope-grid">{partnerScopes.map((scope) => <label className="scope-option" key={scope}><input type="checkbox" checked={scopes.includes(scope)} onChange={(event) => setScopes(event.target.checked ? [...scopes, scope] : scopes.filter((value) => value !== scope))} />{scope}</label>)}</div></>}
      {secretAction && <><label className="form-field">Expiry (optional)<input name="expiresAt" type="datetime-local" /></label>{operation.credential?.expiresAt && <p className="partner-help">Leave blank to preserve the existing expiry: {operation.credential.expiresAt}. Enter a future date to replace it.</p>}</>}
      {operation.credential && <div className="partner-form-warning">{operation.action === 'rotate_credential' ? 'Rotation immediately revokes the previous credential. Its replacement secret is shown once.' : 'Revocation prevents future API calls using this credential.'}<p className="partner-code">{operation.credential.credentialKey}</p></div>}
      <label className="form-field">Reason<textarea name="reason" required minLength={10} maxLength={1000} placeholder="Why is this partner change needed? Do not paste secrets." /></label>
    </fieldset>
    {error && <div className="notice warning" role="alert">{error}</div>}
    <p className="partner-help">Your staff identity, the explicit partner/environment and a command receipt are recorded. API secrets are never stored in these receipts.</p>
    {attempted && <p className="partner-help">This request is locked to its original target and values. A retry uses exactly the same request key and body.</p>}
    <div className="modal-actions"><button className="button" type="button" disabled={busy} onClick={close}>Cancel</button><button className="button primary" disabled={busy || (!attempted && operation.action !== 'revoke_credential' && !scopes.length)}>{busy ? 'Submitting…' : attempted ? 'Retry same request' : title}</button></div>
  </form></Modal>;
}
