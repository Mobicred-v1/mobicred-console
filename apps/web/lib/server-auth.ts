import 'server-only';
import { cookies } from 'next/headers';
import { trustedUrl, validSessionId, readLimitedText } from './auth-policy';
import type { ConsoleSession } from './console-model';

export function authConfig() {
  const localDevelopment = process.env.CONSOLE_ENV === 'development';
  const origin = trustedUrl(process.env.CONSOLE_PUBLIC_ORIGIN, localDevelopment, true).origin;
  const issuer = trustedUrl(process.env.CONSOLE_OIDC_ISSUER, localDevelopment).toString().replace(/\/$/, '');
  const clientId = process.env.CONSOLE_OIDC_CLIENT_ID;
  const clientSecret = process.env.CONSOLE_OIDC_CLIENT_SECRET;
  const flowKey = process.env.CONSOLE_LOGIN_COOKIE_KEY;
  if (!clientId || !clientSecret || !flowKey || !/^[a-fA-F0-9]{64}$/.test(flowKey)) throw new Error('Authentication is not configured');
  return { origin, issuer, clientId, clientSecret, flowKey, secure: origin.startsWith('https:'), callback: `${origin}/auth/callback` };
}
export function authConfigured(): boolean { try { authConfig(); return true; } catch { return false; } }
export function sessionCookieName(): string { return process.env.CONSOLE_PUBLIC_ORIGIN?.startsWith('https:') ? '__Host-mobicred_session' : 'mobicred_session'; }
export function flowCookieName(): string { return process.env.CONSOLE_PUBLIC_ORIGIN?.startsWith('https:') ? '__Host-mobicred_login' : 'mobicred_login'; }
export class ApiFailure extends Error { constructor(public readonly status: number) { super('Console source request failed'); } }

export async function consoleRequest(path: string, options: { method?: 'GET' | 'POST' | 'DELETE'; sessionId?: string; bearer?: string; tenant?: string } = {}): Promise<unknown> {
  const base = trustedUrl(process.env.CONSOLE_API_URL, process.env.CONSOLE_ENV === 'development', true).origin;
  if (!path.startsWith('/api/v1/') || path.includes('..')) throw new Error('Invalid console operation');
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.sessionId) headers['x-console-session'] = options.sessionId;
  if (options.bearer) headers.authorization = `Bearer ${options.bearer}`;
  if (options.tenant) headers['x-mobicred-tenant-id'] = options.tenant;
  const response = await fetch(`${base}${path}`, { method: options.method ?? 'GET', headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new ApiFailure(response.status);
  if (response.status === 204) return null;
  return JSON.parse(await readLimitedText(response, 1_000_000));
}

export async function currentSession(): Promise<{ id: string; session: ConsoleSession } | null> {
  const id = (await cookies()).get(sessionCookieName())?.value;
  if (!id || !validSessionId(id)) return null;
  const value = await consoleRequest('/api/v1/console-session', { sessionId: id });
  if (!value || typeof value !== 'object') throw new Error('Invalid session response');
  const row = value as Record<string, unknown>;
  if (typeof row.tenant !== 'string' || !Array.isArray(row.roles) || !row.roles.every((role) => typeof role === 'string')) throw new Error('Invalid session scope');
  return { id, session: { name: typeof row.name === 'string' ? row.name.slice(0, 120) : 'Staff operator', tenant: row.tenant, roles: row.roles as string[] } };
}
