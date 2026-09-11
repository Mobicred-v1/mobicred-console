import { scopedCreditRows } from './credit-read.policy';
describe('scoped credit response policy', () => {
  const row = { id: 'score-1', tenantid: 'tenant-a', score: 700, decisiontrace: { secret: 'must-not-leak' } };
  it('whitelists fields and drops raw traces', () => { const [result] = scopedCreditRows({ items: [row] }, 'tenant-a'); expect(result.id).toBe('score-1'); expect(result).not.toHaveProperty('decisiontrace'); });
  it('rejects foreign-tenant rows before returning any data', () => expect(() => scopedCreditRows({ items: [row] }, 'tenant-b')).toThrow());
  it('rejects missing tenant identity', () => expect(() => scopedCreditRows({ items: [{ id: 's', score: 1 }] }, 'tenant-a')).toThrow());
  it('does not interpret malformed JSON shape as an empty result', () => expect(() => scopedCreditRows({}, 'tenant-a')).toThrow());
});
