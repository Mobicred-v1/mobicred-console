import { decryptToken, encryptToken, sessionHash } from './session-crypto';
const key = 'ab'.repeat(32);
describe('server session encryption', () => {
  it('round-trips without storing the raw token', () => { const sealed = encryptToken('private-access-token', key); expect(sealed).not.toContain('private-access-token'); expect(decryptToken(sealed, key)).toBe('private-access-token'); });
  it('uses a fresh nonce', () => expect(encryptToken('token', key)).not.toBe(encryptToken('token', key)));
  it('rejects a wrong key', () => expect(() => decryptToken(encryptToken('token', key), 'cd'.repeat(32))).toThrow());
  it('rejects tampering', () => { const sealed = Buffer.from(encryptToken('token', key), 'base64url'); sealed[20] ^= 1; expect(() => decryptToken(sealed.toString('base64url'), key)).toThrow(); });
  it('fails closed without a strong key', () => expect(() => encryptToken('token', 'short')).toThrow());
  it('stores a hash of a valid opaque identifier', () => { expect(sessionHash('a'.repeat(43))).toHaveLength(64); expect(() => sessionHash('../session')).toThrow(); });
});
