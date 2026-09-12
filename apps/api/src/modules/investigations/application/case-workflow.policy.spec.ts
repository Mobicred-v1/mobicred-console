import { assertTransition, commandDigest, idempotencyKey } from './case-workflow.policy';
describe('case command policy', () => {
  it('allows explicit resolution and reopening', () => { expect(() => assertTransition('open', 'resolved')).not.toThrow(); expect(() => assertTransition('resolved', 'open')).not.toThrow(); });
  it('does not silently reactivate resolved work as waiting', () => expect(() => assertTransition('resolved', 'waiting')).toThrow());
  it('rejects a no-op status transition', () => expect(() => assertTransition('open', 'open')).toThrow());
  it('hashes equivalent bodies independently of property order', () => expect(commandDigest('case.create', null, { a: 1, b: 2 })).toBe(commandDigest('case.create', null, { b: 2, a: 1 })));
  it('binds a key to action, target and content', () => expect(commandDigest('case.create', null, {})).not.toBe(commandDigest('case.resolve', 'target', {})));
  it('requires a well-formed idempotency identifier', () => { expect(() => idempotencyKey(undefined)).toThrow(); expect(() => idempotencyKey('../invalid')).toThrow(); });
});
