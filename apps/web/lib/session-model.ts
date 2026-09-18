export type PartnerContext = { partnerCode: string; tenantId: string; partnerName: string; displayName: string; environment: string };
export type StaffSession = { staffId?: string; name: string; tenant: string; roles: string[]; expiresAt?: number; contextVersion?: number; partnerContext?: PartnerContext | null };
export function sessionFrom(value: unknown): StaffSession {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid session');
  const r = value as Record<string, unknown>;
  if (typeof r.tenant !== 'string' || !Array.isArray(r.roles) || !r.roles.every((role) => typeof role === 'string') || typeof r.expiresAt !== 'number' || !Number.isFinite(r.expiresAt) || r.expiresAt <= Date.now() || !Number.isSafeInteger(r.contextVersion) || Number(r.contextVersion) < 0) throw new Error('Invalid session');
  let partner: PartnerContext | null = null;
  if (r.partnerContext !== null && r.partnerContext !== undefined) {
    const p = r.partnerContext as Record<string, unknown>;
    if (!p || typeof p !== 'object' || !['partnerCode', 'tenantId', 'partnerName', 'displayName', 'environment'].every((key) => typeof p[key] === 'string' && String(p[key]).length <= 128) || !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(String(p.partnerCode)) || !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(String(p.tenantId))) throw new Error('Invalid partner context');
    partner = { partnerCode: p.partnerCode as string, tenantId: p.tenantId as string, partnerName: p.partnerName as string, displayName: p.displayName as string, environment: p.environment as string };
  }
  if (r.tenant !== (partner?.tenantId ?? '@mobicred')) throw new Error('Invalid operational context');
  return { ...(typeof r.staffId === 'string' && r.staffId.length <= 255 ? { staffId: r.staffId } : {}), name: typeof r.name === 'string' ? r.name.slice(0, 120) : 'Staff operator', tenant: r.tenant, roles: r.roles as string[], expiresAt: r.expiresAt, contextVersion: Number(r.contextVersion), partnerContext: partner };
}
