import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { decryptToken, encryptToken, sessionHash } from './session-crypto';
import type { VerifiedStaff } from '../auth/staff-token.policy';

type SessionRow = { staff_id: string; tenant_id: string; token_ciphertext: string; expires_at: Date };

@Injectable()
export class ConsoleSessions {
  constructor(private readonly database: DataSource) {}

  async create(actor: VerifiedStaff, accessToken: string) {
    const sessionId = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Math.min(actor.expiresAt, Date.now() + 8 * 60 * 60 * 1000));
    if (expiresAt.getTime() <= Date.now()) throw new ServiceUnavailableException('The verified token has expired');
    let ciphertext: string;
    try { ciphertext = encryptToken(accessToken, process.env.CONSOLE_SESSION_ENCRYPTION_KEY); }
    catch { throw new ServiceUnavailableException('Session storage is not configured'); }
    await this.database.query('DELETE FROM console_sessions WHERE expires_at <= now()');
    await this.database.query(
      'INSERT INTO console_sessions (id_hash, staff_id, tenant_id, token_ciphertext, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [sessionHash(sessionId), actor.staffId, actor.tenantId, ciphertext, expiresAt],
    );
    return { sessionId, expiresAt: expiresAt.toISOString() };
  }

  async resolve(sessionId: string) {
    let hash: string;
    try { hash = sessionHash(sessionId); } catch { return null; }
    const rows: SessionRow[] = await this.database.query(
      'SELECT staff_id, tenant_id, token_ciphertext, expires_at FROM console_sessions WHERE id_hash = $1 AND expires_at > now()', [hash],
    );
    if (!rows[0]) return null;
    try {
      return { token: decryptToken(rows[0].token_ciphertext, process.env.CONSOLE_SESSION_ENCRYPTION_KEY), staffId: rows[0].staff_id, tenantId: rows[0].tenant_id };
    } catch { throw new ServiceUnavailableException('Session verification is unavailable'); }
  }

  async revoke(sessionId: string): Promise<void> {
    await this.database.query('DELETE FROM console_sessions WHERE id_hash = $1', [sessionHash(sessionId)]);
  }
}
