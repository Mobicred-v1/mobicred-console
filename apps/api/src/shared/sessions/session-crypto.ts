import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const context = Buffer.from('mobicred-console-session:v1');
export function sessionHash(id: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(id)) throw new Error('Invalid session identifier');
  return createHash('sha256').update(id).digest('hex');
}
function encryptionKey(secret: string | undefined): Buffer {
  if (!secret || !/^[a-fA-F0-9]{64}$/.test(secret)) throw new Error('Session encryption is not configured');
  return Buffer.from(secret, 'hex');
}
export function encryptToken(token: string, secret: string | undefined): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), nonce);
  cipher.setAAD(context);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString('base64url');
}
export function decryptToken(value: string, secret: string | undefined): string {
  if (value.length > 24000) throw new Error('Invalid encrypted session');
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length < 29) throw new Error('Invalid encrypted session');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), bytes.subarray(0, 12));
  decipher.setAAD(context);
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
}
