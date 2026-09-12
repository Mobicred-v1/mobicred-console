export type VerifiedStaff = { staffId: string; tenantId: string; roles: string[]; expiresAt: number };
export class StaffTokenError extends Error {
  readonly kind: 'unauthorized' | 'forbidden' | 'unavailable';
  constructor(kind: StaffTokenError['kind']) { super('Staff authorization failed'); this.kind = kind; }
}
type Claims = Record<string, unknown>;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
export const validTenant = (value: string): boolean => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(value);

/** Introspection is authoritative. Never decode an unverified JWT to establish scope. */
export function validateStaffClaims(value: unknown, tenantId: string, issuer: string, audience: string, allowedRoles: string[], now = Date.now()): VerifiedStaff {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new StaffTokenError('unauthorized');
  const c = value as Claims;
  const audiences = typeof c.aud === 'string' ? [c.aud] : strings(c.aud);
  if (c.active !== true || c.iss !== issuer || !audiences.includes(audience) || typeof c.sub !== 'string' || !c.sub || typeof c.exp !== 'number' || !Number.isFinite(c.exp) || c.exp * 1000 <= now) throw new StaffTokenError('unauthorized');
  if (typeof c.nbf === 'number' && c.nbf * 1000 > now) throw new StaffTokenError('unauthorized');
  const realm = c.realm_access as { roles?: unknown } | undefined;
  const resources = c.resource_access as Record<string, { roles?: unknown }> | undefined;
  const roles = [...new Set([...strings(realm?.roles), ...strings(resources?.[audience]?.roles)])];
  if (!allowedRoles.length || !roles.some((role) => allowedRoles.includes(role))) throw new StaffTokenError('forbidden');
  const tenants = [...strings(c.tenant_ids), ...(typeof c.tenant_id === 'string' ? [c.tenant_id] : [])];
  if (!validTenant(tenantId) || !tenants.includes(tenantId)) throw new StaffTokenError('forbidden');
  return { staffId: c.sub, tenantId, roles, expiresAt: c.exp * 1000 };
}

export async function verifyStaffToken(token: string, tenantId: string, env: Record<string, string | undefined> = process.env, transport: typeof fetch = fetch): Promise<VerifiedStaff> {
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
    if (!response.ok) throw new StaffTokenError('unavailable');
    const text = await response.text();
    if (text.length > 65536) throw new StaffTokenError('unavailable');
    claims = JSON.parse(text);
  } catch { throw new StaffTokenError('unavailable'); }
  return validateStaffClaims(claims, tenantId, issuer, audience, roles);
}
