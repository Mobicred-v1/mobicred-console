import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { decryptToken, encryptToken, sessionHash } from './session-crypto';
import { PLATFORM_SCOPE, type PartnerContext, type VerifiedStaff } from '../auth/staff-token.policy';

type SessionRow = { staff_id: string; token_ciphertext: string; expires_at: Date; partner_context: PartnerContext | null; context_version: number };
@Injectable()
export class ConsoleSessions {
  constructor(private readonly database: DataSource) {}
  async create(actor: VerifiedStaff, accessToken: string) {
    const sessionId = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Math.min(actor.expiresAt, Date.now() + 8 * 60 * 60 * 1000));
    if (expiresAt.getTime() <= Date.now()) throw new ServiceUnavailableException('The staff session has expired');
    let ciphertext: string;
    try { ciphertext = encryptToken(accessToken, process.env.CONSOLE_SESSION_ENCRYPTION_KEY); }
    catch { throw new ServiceUnavailableException('Staff session storage is not configured'); }
    await this.database.query('DELETE FROM console_sessions WHERE expires_at <= now()');
    await this.database.query('INSERT INTO console_sessions (id_hash, staff_id, tenant_id, token_ciphertext, expires_at, partner_context, context_version) VALUES ($1,$2,$3,$4,$5,NULL,0)', [sessionHash(sessionId), actor.staffId, PLATFORM_SCOPE, ciphertext, expiresAt]);
    return { sessionId, expiresAt: expiresAt.toISOString() };
  }
  async resolve(id: string) {
    let hash: string;
    try { hash = sessionHash(id); } catch { return null; }
    const rows: SessionRow[] = await this.database.query('SELECT staff_id, token_ciphertext, expires_at, partner_context, context_version FROM console_sessions WHERE id_hash = $1 AND expires_at > now()', [hash]);
    if (!rows[0]) return null;
    try {
      const row = rows[0];
      if (!Number.isSafeInteger(row.context_version) || row.context_version < 0) throw new Error();
      const partner = row.partner_context;
      if (partner && (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(partner.partnerCode) || !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(partner.tenantId))) throw new Error();
      return { token: decryptToken(row.token_ciphertext, process.env.CONSOLE_SESSION_ENCRYPTION_KEY), staffId: row.staff_id, tenantId: partner?.tenantId ?? PLATFORM_SCOPE, partnerContext: partner, contextVersion: row.context_version, expiresAt: row.expires_at.getTime() };
    } catch { throw new ServiceUnavailableException('Staff session verification is unavailable'); }
  }
  async setContext(id: string, actor: VerifiedStaff, partner: PartnerContext | null) {
    const rows = await this.database.query('UPDATE console_sessions SET partner_context = $1, context_version = context_version + 1 WHERE id_hash = $2 AND staff_id = $3 AND context_version = $4 AND expires_at > now() RETURNING context_version', [partner ? JSON.stringify(partner) : null, sessionHash(id), actor.staffId, actor.contextVersion ?? 0]);
    if (!rows[0]?.length && !rows[0]?.context_version) {
      // PostgreSQL driver query runner may return [rows, affected] for UPDATE.
      if (!Array.isArray(rows) || rows.length === 0) throw new ConflictException('Workspace context changed. Reload and retry.');
    }
    const updated = Array.isArray(rows[0]) ? rows[0][0] : rows[0];
    if (!updated) throw new ConflictException('Workspace context changed. Reload and retry.');
    return { partnerContext: partner, contextVersion: updated.context_version };
  }
  async revoke(id: string): Promise<void> { await this.database.query('DELETE FROM console_sessions WHERE id_hash = $1', [sessionHash(id)]); }
}
