export const PLATFORM_SCOPE = '@mobicred';
export type PartnerContext = { partnerCode: string; tenantId: string; partnerName: string; displayName: string; environment: string };
/** tenantId is a legacy data-partition field, NOT a staff identity claim. */
export type VerifiedStaff = { staffId: string; tenantId: string; roles: string[]; expiresAt: number; partnerContext?: PartnerContext; contextVersion?: number; sessionHash?: string };
export class StaffTokenError extends Error {
  constructor(readonly kind: 'unauthorized' | 'forbidden' | 'unavailable') { super('Staff authorization failed'); }
}
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
export const validTenant = (value: string): boolean => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(value);

/** Authentication is platform-wide. Partner context is resolved separately by Core. */
export function validateStaffClaims(value: unknown, _legacyContext: string | undefined, issuer: string, audience: string, allowedRoles: string[], now = Date.now()): VerifiedStaff {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new StaffTokenError('unauthorized');
  const c = value as Record<string, unknown>;
  const audiences = typeof c.aud === 'string' ? [c.aud] : strings(c.aud);
  if (c.active !== true || c.iss !== issuer || !audiences.includes(audience) || typeof c.sub !== 'string' || !c.sub || c.sub.length > 255 || typeof c.exp !== 'number' || !Number.isFinite(c.exp) || c.exp * 1000 <= now) throw new StaffTokenError('unauthorized');
  if (typeof c.nbf === 'number' && c.nbf * 1000 > now) throw new StaffTokenError('unauthorized');
  const realm = c.realm_access as { roles?: unknown } | undefined;
  const resources = c.resource_access as Record<string, { roles?: unknown }> | undefined;
  const roles = [...new Set([...strings(realm?.roles), ...strings(resources?.[audience]?.roles)])];
  if (!allowedRoles.length || !roles.some((role) => allowedRoles.includes(role))) throw new StaffTokenError('forbidden');
  return { staffId: c.sub, tenantId: PLATFORM_SCOPE, roles, expiresAt: c.exp * 1000, contextVersion: 0 };
}

export async function verifyStaffToken(token: string, _legacyContext?: string, env: Record<string, string | undefined> = process.env, transport: typeof fetch = fetch): Promise<VerifiedStaff> {
  const issuer = env.CONSOLE_OIDC_ISSUER?.replace(/\/$/, '');
  const clientId = env.CONSOLE_OIDC_CLIENT_ID;
  const clientSecret = env.CONSOLE_OIDC_CLIENT_SECRET;
  const audience = env.CONSOLE_OIDC_AUDIENCE;
  const roles = (env.CONSOLE_STAFF_ROLES ?? '').split(',').map((r) => r.trim()).filter(Boolean);
  if (!issuer || !clientId || !clientSecret || !audience || !roles.length) throw new StaffTokenError('unavailable');
  let url: URL;
  try { url = new URL(issuer); } catch { throw new StaffTokenError('unavailable'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(env.NODE_ENV !== 'production' && local && url.protocol === 'http:'))) throw new StaffTokenError('unavailable');
  if (!token || token.length > 16384 || /\s/.test(token)) throw new StaffTokenError('unauthorized');
  let claims: unknown;
  try {
    const response = await transport(`${issuer}/protocol/openid-connect/token/introspect`, {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(4000),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, token, token_type_hint: 'access_token' }),
    });
    if (!response.ok || !response.body) throw new Error();
    const reader = response.body.getReader();
    let size = 0;
    const parts: Uint8Array[] = [];
    try {
      for (;;) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > 65536) { await reader.cancel(); throw new Error(); } parts.push(chunk.value); }
    } finally { reader.releaseLock(); }
    claims = JSON.parse(Buffer.concat(parts).toString('utf8'));
  } catch { throw new StaffTokenError('unavailable'); }
  return validateStaffClaims(claims, undefined, issuer, audience, roles);
}
