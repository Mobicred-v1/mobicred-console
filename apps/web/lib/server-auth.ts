import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { ApiFailure, publicErrorCode } from './api-failure';
export { ApiFailure } from './api-failure';
import { cookies } from 'next/headers';
import { trustedUrl, validSessionId, readLimitedText } from './auth-policy';
import { consoleApiOrigin } from './api-origin';
import { sessionFrom } from './session-model';
import type { ConsoleSession } from './console-model';

export function authConfig() {
  const local = process.env.CONSOLE_ENV === 'development';
  const origin = trustedUrl(process.env.CONSOLE_PUBLIC_ORIGIN, local, true).origin;
  const issuer = trustedUrl(process.env.CONSOLE_OIDC_ISSUER, local).toString().replace(/\/$/, '');
  const clientId = process.env.CONSOLE_OIDC_CLIENT_ID; const clientSecret = process.env.CONSOLE_OIDC_CLIENT_SECRET; const flowKey = process.env.CONSOLE_LOGIN_COOKIE_KEY;
  if (!clientId || !clientSecret || !flowKey || !/^[a-fA-F0-9]{64}$/.test(flowKey)) throw new Error('Authentication is not configured');
  return { origin, issuer, clientId, clientSecret, flowKey, secure: origin.startsWith('https:'), callback: `${origin}/auth/callback` };
}
export function authConfigured(): boolean { try { authConfig(); return true; } catch { return false; } }
export function sessionCookieName() { return process.env.CONSOLE_PUBLIC_ORIGIN?.startsWith('https:') ? '__Host-mobicred_session' : 'mobicred_session'; }
export function flowCookieName() { return process.env.CONSOLE_PUBLIC_ORIGIN?.startsWith('https:') ? '__Host-mobicred_login' : 'mobicred_login'; }
export async function consoleRequest(path: string, options: { method?: 'GET' | 'POST' | 'DELETE'; sessionId?: string; bearer?: string; tenant?: string; body?: unknown; idempotencyKey?: string; contextVersion?: string | number } = {}): Promise<unknown> {
  const base = consoleApiOrigin();
  if (!path.startsWith('/api/v1/') || path.includes('..') || /[\r\n\\]/.test(path)) throw new Error('Invalid console operation');
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.sessionId) headers['x-console-session'] = options.sessionId;
  if (options.bearer) headers.authorization = `Bearer ${options.bearer}`;
  if (options.tenant) throw new Error('A tenant is not part of staff authentication');
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;
  if (options.contextVersion !== undefined) headers['x-console-context-version'] = String(options.contextVersion);
  const response = await fetch(`${base}${path}`, { method: options.method ?? 'GET', headers, body: options.body !== undefined ? JSON.stringify(options.body) : undefined, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000) });
  if (!response.ok) {
    let code;
    try { code = publicErrorCode(JSON.parse(await readLimitedText(response, 16384))); } catch { /* Preserve status without exposing raw upstream text. */ }
    throw new ApiFailure(response.status, code);
  }
  if (response.status === 204) return null;
  return JSON.parse(await readLimitedText(response, 1000000));
}
export const currentSession = cache(async (): Promise<{ id: string; session: ConsoleSession } | null> => {
  const id = (await cookies()).get(sessionCookieName())?.value;
  if (!id || !validSessionId(id)) return null;
  return { id, session: sessionFrom(await consoleRequest('/api/v1/console-session', { sessionId: id })) };
});

/** Called outside data-loader catch blocks: authorization is not a data-source error. */
export async function requirePageSession() {
  let current;
  try { current = await currentSession(); }
  catch (error) {
    if (error instanceof ApiFailure && [401, 403].includes(error.status)) redirect('/auth/login');
    throw error;
  }
  if (!current) redirect('/auth/login');
  return current;
}
