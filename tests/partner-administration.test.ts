import { describe, expect, it } from 'bun:test';
import { partnerCommandFromForm } from '../apps/web/lib/partner-command-form';
import type { PartnerCredential } from '../apps/web/lib/partner-model';

const now = Date.parse('2026-09-15T00:00:00Z');
function form(extra: Record<string, string> = {}) { const result = new FormData(); for (const [key, value] of Object.entries({ partnerCode: 'new-partner', tenantId: 'new-sandbox', reason: 'Explicit operator onboarding request', displayName: 'New Partner', environment: 'SANDBOX', countryCodes: 'CI', ipAllowlist: '203.0.113.8/32', ...extra })) result.set(key, value); return result; }
const credential: PartnerCredential = { partnerCode: 'beta', tenantId: 'beta-production', credentialId: 'fixture', credentialKey: 'pk_fixture', status: 'ACTIVE', scopes: ['customers:read'], expiresAt: '2027-01-01T00:00:00.000Z', lastUsedAt: null };
describe('explicit global partner administration form targets', () => {
  it('uses the new partner and environment rather than an existing administration target', () => {
    const command = partnerCommandFromForm({ action: 'create_partner' }, form(), ['customers:read'], 'existing-partner', now);
    expect(command.partnerCode).toBe('new-partner'); expect(command.tenantId).toBe('new-sandbox');
  });
  it('adds an environment to the route partner using the entered environment', () => {
    const command = partnerCommandFromForm({ action: 'create_environment' }, form({ tenantId: 'second-environment' }), ['customers:read'], 'beta', now);
    expect(command.partnerCode).toBe('beta'); expect(command.tenantId).toBe('second-environment');
  });
  it('requires the operator to select an environment before issuing a credential', () => {
    expect(() => partnerCommandFromForm({ action: 'issue_credential' }, form({ tenantId: '' }), ['customers:read'], 'beta', now)).toThrow('environment');
  });
  it('targets the existing credential pair for revocation, ignoring unrelated form fields', () => {
    const command = partnerCommandFromForm({ action: 'revoke_credential', credential }, form(), [], 'beta', now);
    expect(command.partnerCode).toBe('beta'); expect(command.tenantId).toBe('beta-production'); expect(command.credentialKey).toBe('pk_fixture'); expect(command.scopes).toBeUndefined();
  });
  it('rejects a credential from a different partner', () => expect(() => partnerCommandFromForm({ action: 'revoke_credential', credential }, form(), [], 'alpha', now)).toThrow('belong'));
  it('preserves the old expiry on rotation instead of silently removing it', () => {
    const command = partnerCommandFromForm({ action: 'rotate_credential', credential }, form(), credential.scopes, 'beta', now);
    expect(command.expiresAt).toBe(credential.expiresAt);
  });
  it('validates expiry before any request or idempotency key is created', () => {
    for (const expiresAt of ['invalid-date', '2020-01-01T00:00:00Z']) expect(() => partnerCommandFromForm({ action: 'issue_credential' }, form({ expiresAt }), ['customers:read'], 'beta', now)).toThrow('future date');
  });
  it('retains explicit scopes and normalizes duplicate onboarding list values', () => {
    const command = partnerCommandFromForm({ action: 'create_partner' }, form({ countryCodes: 'CI, ci', ipAllowlist: '203.0.113.8/32\n203.0.113.8/32' }), ['customers:read', 'customers:read'], undefined, now);
    expect(command.countryCodes).toEqual(['CI']); expect(command.ipAllowlist).toEqual(['203.0.113.8/32']); expect(command.scopes).toEqual(['customers:read']);
  });
});
