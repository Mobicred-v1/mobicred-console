import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';

export const OWNER_READ_PATHS = {
  credit: '/api/v1/score-decisions/admin/search',
  ingestion: '/api/v1/ingestion/admin/data-source-quality',
} as const;

export function ownerOrigin(value: string | undefined, production = process.env.NODE_ENV === 'production'): URL {
  if (!value) throw new Error('Owner origin required');
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
    (url.protocol !== 'https:' && !(local && !production && url.protocol === 'http:'))) {
    throw new Error('Invalid owner origin');
  }
  return url;
}

/** Bound bytes while reading, not after an unbounded response.text allocation. */
export async function boundedOwnerJson(response: Response, limit = 1_000_000): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) throw new Error('Expected JSON');
  const declared = response.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) {
    await response.body?.cancel();
    throw new Error('Response too large');
  }
  if (!response.body) throw new Error('Missing response');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let text = '';
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) throw new Error('Response too large');
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally { reader.releaseLock(); }
}

export async function readOwner(input: {
  origin: string | undefined;
  resource: keyof typeof OWNER_READ_PATHS;
  tenantId: string;
  token: string | undefined;
}, transport: typeof fetch = fetch): Promise<unknown> {
  try {
    if (!input.token || input.token.length > 16384 || /\s/.test(input.token)) throw new Error('Verified token required');
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(input.tenantId)) throw new Error('Verified tenant required');
    const url = ownerOrigin(input.origin);
    const path = OWNER_READ_PATHS[input.resource];
    if (!path) throw new Error('Unapproved resource');
    url.pathname = path;
    url.searchParams.set('tenant_id', input.tenantId);
    if (input.resource === 'credit') url.searchParams.set('limit', '100');
    const response = await transport(url, {
      method: 'GET', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(6000),
      headers: { authorization: `Bearer ${input.token}`, accept: 'application/json' },
    });
    if (response.status === 401 || response.status === 403) {
      await response.body?.cancel();
      throw new ForbiddenException('The owner denied this staff session');
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error('Owner unavailable'); }
    return await boundedOwnerJson(response);
  } catch (error) {
    if (error instanceof ForbiddenException) throw error;
    throw new ServiceUnavailableException('The scoped owner source is unavailable');
  }
}
