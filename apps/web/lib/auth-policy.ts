import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export type LoginFlow = { state: string; verifier: string; tenant: string; issuedAt: number };
export const validTenant = (value: string): boolean => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(value);
export const validSessionId = (value: string): boolean => /^[A-Za-z0-9_-]{43}$/.test(value);

export function trustedUrl(value: string | undefined, localDevelopment: boolean, originOnly = false): URL {
  if (!value) throw new Error('Authentication is not configured');
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || (originOnly && url.pathname !== '/') || (url.protocol !== 'https:' && !(localDevelopment && loopback && url.protocol === 'http:'))) throw new Error('Invalid authentication URL');
  return url;
}

export function sameOrigin(origin: string | null, expected: string): boolean {
  return origin === expected;
}

function key(secret: string): Buffer {
  if (!/^[a-fA-F0-9]{64}$/.test(secret)) throw new Error('A 32-byte login-cookie key is required');
  return Buffer.from(secret, 'hex');
}

export function newLoginFlow(tenant: string): LoginFlow {
  if (!validTenant(tenant)) throw new Error('Invalid tenant');
  return { tenant, state: randomBytes(32).toString('base64url'), verifier: randomBytes(48).toString('base64url'), issuedAt: Date.now() };
}
export const pkceChallenge = (verifier: string): string => createHash('sha256').update(verifier).digest('base64url');

export function sealFlow(flow: LoginFlow, secret: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), nonce);
  cipher.setAAD(Buffer.from('mobicred-login-flow:v1'));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(flow), 'utf8'), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString('base64url');
}

export function openFlow(value: string, state: string, secret: string, now = Date.now()): LoginFlow {
  if (value.length > 2048 || !validSessionId(state)) throw new Error('Invalid login flow');
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length < 29) throw new Error('Invalid login flow');
  const decipher = createDecipheriv('aes-256-gcm', key(secret), bytes.subarray(0, 12));
  decipher.setAAD(Buffer.from('mobicred-login-flow:v1'));
  decipher.setAuthTag(bytes.subarray(12, 28));
  const flow = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8')) as LoginFlow;
  if (typeof flow.state !== 'string' || !validSessionId(flow.state) || typeof flow.issuedAt !== 'number' || flow.issuedAt > now + 1000 || now - flow.issuedAt > 300_000 || typeof flow.verifier !== 'string' || !/^[A-Za-z0-9_-]{64}$/.test(flow.verifier) || !validTenant(flow.tenant)) throw new Error('Expired or invalid login flow');
  if (!timingSafeEqual(Buffer.from(flow.state), Buffer.from(state))) throw new Error('Login state mismatch');
  return flow;
}

export async function readLimitedText(response: { body: ReadableStream<Uint8Array> | null }, limit: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > limit) { await reader.cancel(); throw new Error('Response size limit exceeded'); }
      chunks.push(result.value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { reader.releaseLock(); }
}
