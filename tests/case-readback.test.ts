import { describe, expect, test } from 'bun:test';
import { caseSnapshot, newestCase } from '../apps/web/lib/case-detail';
import type { ConsoleSession } from '../apps/web/lib/console-model';
const id = 'f7d2d789-76a1-4d47-86ca-23a7a3ccca98';
const session: ConsoleSession = { name: 'Staff', tenant: 'sandbox', contextVersion: 3, roles: ['OPS'], partnerContext: { partnerCode: 'alpha', tenantId: 'sandbox', partnerName: 'Alpha', displayName: 'Sandbox', environment: 'SANDBOX' } };
const response = { case: { id, title: 'Synthetic case', tenantId: 'sandbox', partnerCode: 'alpha', status: 'resolved', version: 4 }, notes: [], contextVersion: 3, canWrite: true };
describe('authoritative post-command case snapshots', () => {
  test('accepts the committed version and preserves the authoritative status', () => {
    const result = caseSnapshot(response, session, id, 4);
    expect(result.record.status).toBe('resolved'); expect(result.record.fields.Version).toBe('4');
  });
  test('rejects an old read even when a command receipt already reported success', () => expect(() => caseSnapshot(response, session, id, 5)).toThrow());
  test('rejects wrong record, partner, environment or context version', () => {
    for (const patch of [{ id: 'another-id' }, { partnerCode: 'beta' }, { tenantId: 'production' }]) expect(() => caseSnapshot({ ...response, case: { ...response.case, ...patch } }, session, id)).toThrow();
    expect(() => caseSnapshot({ ...response, contextVersion: 2 }, session, id)).toThrow();
  });
  test('does not restore mutation permission from an older response', () => {
    expect(caseSnapshot({ ...response, canWrite: false }, session, id).canWrite).toBe(false);
    expect(() => caseSnapshot({ ...response, canWrite: undefined }, session, id)).toThrow();
  });
  test('a late server render cannot replace a confirmed newer record', () => {
    const fresh = caseSnapshot(response, session, id);
    const old = { ...fresh.record, status: 'open', fields: { ...fresh.record.fields, Version: '2' } };
    expect(newestCase(old, fresh)).toBe(fresh.record);
    expect(newestCase({ ...old, id: 'different' }, fresh).id).toBe('different');
  });
});
