import type { PartnerCredential } from './partner-model';
export type PartnerAction = 'create_partner' | 'create_environment' | 'issue_credential' | 'rotate_credential' | 'revoke_credential';
export type PartnerOperation = { action: PartnerAction; credential?: PartnerCredential };
export type PartnerReceipt = { receiptId: string; action: PartnerAction; partnerCode: string; tenantId: string; apiKey?: string; secretAvailable: boolean; replayed: boolean; credential?: PartnerCredential };

/** Administration targets are explicit. A staff session/filter is deliberately not an input. */
export function partnerCommandFromForm(operation: PartnerOperation, form: FormData, scopes: string[], existingPartnerCode?: string, now = Date.now()): Record<string, unknown> {
  const field = (name: string) => String(form.get(name) ?? '').trim();
  const creating = operation.action === 'create_partner' || operation.action === 'create_environment';
  const partnerCode = operation.action === 'create_partner' ? field('partnerCode') : existingPartnerCode;
  const tenantId = operation.credential?.tenantId ?? field('tenantId');
  if (!partnerCode || !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(partnerCode)) throw new Error('Enter a valid partner code.');
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(tenantId)) throw new Error('Select or enter the API environment for this operation.');
  if (operation.credential && operation.credential.partnerCode !== partnerCode) throw new Error('The credential does not belong to this partner.');
  const reason = field('reason').replace(/[\r\n\t]+/g, ' ');
  if (reason.length < 10 || reason.length > 1000) throw new Error('Provide a reason between 10 and 1,000 characters.');
  const command: Record<string, unknown> = { action: operation.action, partnerCode, tenantId, reason };
  if (creating) {
    command.displayName = field('displayName'); command.environment = field('environment');
    command.countryCodes = [...new Set(field('countryCodes').split(',').map((value) => value.trim().toUpperCase()).filter(Boolean))];
    command.ipAllowlist = [...new Set(field('ipAllowlist').split(/[\n,]+/).map((value) => value.trim()).filter(Boolean))];
    if (field('legalName')) command.legalName = field('legalName');
  }
  if (operation.action !== 'revoke_credential') { if (!scopes.length) throw new Error('Choose at least one API permission.'); command.scopes = [...new Set(scopes)]; }
  if (operation.credential) command.credentialKey = operation.credential.credentialKey;
  if (operation.action === 'issue_credential' || operation.action === 'rotate_credential') {
    const expiry = field('expiresAt') || operation.credential?.expiresAt;
    if (expiry) { const stamp = Date.parse(expiry); if (!Number.isFinite(stamp) || stamp <= now) throw new Error('Credential expiry must be a valid future date.'); command.expiresAt = new Date(stamp).toISOString(); }
  }
  return command;
}
