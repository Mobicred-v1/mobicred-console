import { consoleCapabilities } from './console-capabilities';
const actor = { staffId: 'staff-a', tenantId: 'tenant-a', roles: ['OPS'], expiresAt: Date.now() + 60000 };
describe('effective console capabilities', () => {
  it('defaults external reads and writes to disabled', () => {
    const result = consoleCapabilities(actor, {});
    expect(result.items.find((r) => r.id === 'ingestion-read')?.granted).toBe(false);
    expect(result.items.find((r) => r.id === 'case-write')?.granted).toBe(false);
    expect(result.tenantId).toBe('tenant-a');
  });
  it('requires flag, valid origin and role together', () => {
    const env = { CONSOLE_INGESTION_READS_ENABLED: 'true', CONSOLE_CREDIT_URL: 'https://credit.example.test', CONSOLE_INGESTION_READ_ROLES: 'OPS' };
    expect(consoleCapabilities(actor, env).items.find((r) => r.id === 'ingestion-read')?.granted).toBe(true);
    expect(consoleCapabilities({ ...actor, roles: ['READ_ONLY'] }, env).items.find((r) => r.id === 'ingestion-read')?.granted).toBe(false);
    expect(consoleCapabilities(actor, { ...env, CONSOLE_CREDIT_URL: 'invalid' }).items.find((r) => r.id === 'ingestion-read')?.granted).toBe(false);
  });
  it('never serializes secrets or private origins', () => {
    const result = consoleCapabilities(actor, { CONSOLE_CREDIT_URL: 'https://private.example', CONSOLE_OIDC_CLIENT_SECRET: 'private-secret', DATABASE_URL: 'private-database' });
    expect(JSON.stringify(result)).not.toContain('private');
  });
});
