import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../app.module';
import { sessionHash } from '../../shared/sessions/session-crypto';

const integration = process.env.CONSOLE_DATABASE_TESTS === 'true' ? describe : describe.skip;
integration('platform staff sessions, partner context and audited cases against Postgres', () => {
  let app: INestApplication; let db: DataSource; let transport: jest.SpyInstance;
  let revoked = false; let ownerAvailable = true;
  const headers = (role = 'OPS') => ({ Authorization: `Bearer fixture-${role}` });
  const input = (title = 'Synthetic platform investigation') => ({ title, kind: 'payment', severity: 'high', reason: 'Synthetic operational investigation evidence' });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const sessionHeaders = (id: string, version = 0) => ({ 'X-Console-Session': id, 'X-Console-Context-Version': String(version) });
  const createSession = async (role = 'OPS') => (await request(app.getHttpServer()).post('/api/v1/console-session').set(headers(role)).expect(201)).body.sessionId as string;
  const select = (id: string, version: number, code: string | null) => request(app.getHttpServer()).post('/api/v1/console-partners/context').set(sessionHeaders(id, version)).send(code ? { partnerCode: code, tenantId: 'sandbox' } : { partnerCode: null });
  beforeAll(async () => {
    process.env.CONSOLE_CORE_URL = 'https://core.example.test';
    transport = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.includes('/internal/staff/partner-workspace/')) {
        if (!ownerAvailable) return json({}, 503);
        const match = target.match(/\/partner-workspace\/(alpha|beta)\/context\/sandbox$/);
        if (!match) return json({}, 404);
        // Match Core's global ResponseEnvelopeInterceptor, not only the controller DTO.
        return json({ success: true, data: { schemaVersion: 1, partnerCode: match[1], partnerName: match[1], tenantId: 'sandbox', displayName: 'Sandbox', environment: 'SANDBOX', status: 'ACTIVE', countryCodes: ['CI'] }, meta: { requestId: 'fixture', correlationId: 'fixture', timestamp: new Date().toISOString() } });
      }
      const body = new URLSearchParams(String(init?.body)); const token = body.get('token') ?? '';
      const role = token.endsWith('AUDIT_READER') ? 'AUDIT_READER' : token.endsWith('CUSTOMER') ? 'CUSTOMER' : 'OPS';
      return json({ active: !revoked && token.startsWith('fixture-'), iss: process.env.CONSOLE_OIDC_ISSUER, aud: process.env.CONSOLE_OIDC_AUDIENCE, sub: `staff-${role}`, exp: Math.floor(Date.now() / 1000) + 600, realm_access: { roles: [role] } });
    });
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); app.setGlobalPrefix('api/v1'); app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init(); db = app.get(DataSource);
  }, 30000);
  afterAll(async () => { await app?.close(); transport?.mockRestore(); });
  it('staff signs in globally without tenant claims or a requested tenant', async () => {
    const id = await createSession(); const result = await request(app.getHttpServer()).get('/api/v1/console-session').set(sessionHeaders(id)).expect(200);
    expect(result.body.partnerContext).toBeNull(); expect(result.body.tenant).toBe('@mobicred'); expect(result.body.contextVersion).toBe(0);
    await request(app.getHttpServer()).post('/api/v1/console-session').set(headers()).set('X-Mobicred-Tenant-Id', 'caller-grant').expect(403);
    await request(app.getHttpServer()).post('/api/v1/console-session').set(headers('CUSTOMER')).expect(403);
  });
  it('every protected API rejects missing, fake and revoked sessions', async () => {
    for (const path of ['console-cases', 'console-session', 'console-partners', 'console-capabilities', 'console-read/credit']) {
      await request(app.getHttpServer()).get(`/api/v1/${path}`).expect(401);
      await request(app.getHttpServer()).get(`/api/v1/${path}`).set('X-Console-Session', 'a'.repeat(43)).expect(401);
    }
    const id = await createSession(); revoked = true;
    try { await request(app.getHttpServer()).get('/api/v1/console-cases').set(sessionHeaders(id)).expect(401); } finally { revoked = false; }
  });
  it('concurrent global creates return one case and durable receipt', async () => {
    const id = await createSession(); const key = randomUUID();
    const send = () => request(app.getHttpServer()).post('/api/v1/console-cases').set(sessionHeaders(id)).set('Idempotency-Key', key).send(input());
    const results = await Promise.all([send(), send()]); expect(results.map((r) => r.status)).toEqual([201, 201]); expect(results[0].body.id).toBe(results[1].body.id);
    expect(await db.query('SELECT id FROM console_audit_records WHERE target_id = $1', [results[0].body.id])).toHaveLength(1);
    await request(app.getHttpServer()).post('/api/v1/console-cases').set(sessionHeaders(id)).set('Idempotency-Key', key).send(input('Different request')).expect(409);
  });
  it('keeps two partners using the SAME environment identifier separate while global views include both', async () => {
    const id = await createSession();
    await select(id, 0, 'alpha').expect(201);
    const alpha = await request(app.getHttpServer()).post('/api/v1/console-cases').set(sessionHeaders(id, 1)).set('Idempotency-Key', randomUUID()).send(input('Alpha partner case')).expect(201);
    await select(id, 1, 'beta').expect(201);
    const beta = await request(app.getHttpServer()).post('/api/v1/console-cases').set(sessionHeaders(id, 2)).set('Idempotency-Key', randomUUID()).send(input('Beta partner case')).expect(201);
    const listed = await request(app.getHttpServer()).get('/api/v1/console-cases').set(sessionHeaders(id, 2)).expect(200);
    expect(listed.body.items.every((r: { partnerCode: string }) => r.partnerCode === 'beta')).toBe(true);
    expect(listed.body.meta.total).toBe(1);
    await request(app.getHttpServer()).get(`/api/v1/console-cases/${alpha.body.id}`).set(sessionHeaders(id, 2)).expect(404);
    await request(app.getHttpServer()).post(`/api/v1/console-cases/${alpha.body.id}/commands`).set(sessionHeaders(id, 2)).set('Idempotency-Key', randomUUID()).send({ action: 'set_status', status: 'resolved', expectedVersion: 1, reason: 'Wrong partner operation must be denied' }).expect(404);
    await request(app.getHttpServer()).post('/api/v1/console-cases').set(sessionHeaders(id, 1)).set('Idempotency-Key', randomUUID()).send(input('Stale context')).expect(409);
    ownerAvailable = false; await select(id, 2, null).expect(201); ownerAvailable = true;
    const global = await request(app.getHttpServer()).get('/api/v1/console-cases').set(sessionHeaders(id, 3)).expect(200);
    expect(global.body.items.map((r: { id: string }) => r.id)).toEqual(expect.arrayContaining([alpha.body.id, beta.body.id]));
    expect(global.body.meta.total).toBeGreaterThanOrEqual(3);
    const audit = await request(app.getHttpServer()).get('/api/v1/console-cases/audit').set(sessionHeaders(id, 3)).expect(200);
    expect(audit.body.items.some((r: { partner_code: string }) => r.partner_code === 'alpha')).toBe(true);
  });
  it('rejects context spoofing and invalid owner pairs without changing the session', async () => {
    const id = await createSession();
    await request(app.getHttpServer()).post('/api/v1/console-partners/context').set('X-Console-Session', id).send({ partnerCode: 'alpha', tenantId: 'sandbox' }).expect(409);
    await select(id, 0, 'missing').expect(404);
    await select(id, 0, 'alpha').expect(201);
    await select(id, 0, 'beta').expect(409);
    const current = await request(app.getHttpServer()).get('/api/v1/console-session').set(sessionHeaders(id)).expect(200);
    expect(current.body.partnerContext.partnerCode).toBe('alpha');
    await request(app.getHttpServer()).get('/api/v1/console-cases?tenantId=beta').set(sessionHeaders(id)).expect(400);
  });
  it('enforces versioned notes and resolves without lost updates', async () => {
    const session = await createSession();
    const created = await request(app.getHttpServer()).post('/api/v1/console-cases').set(sessionHeaders(session)).set('Idempotency-Key', randomUUID()).send(input()).expect(201); const id = created.body.id;
    const command = (body: unknown) => request(app.getHttpServer()).post(`/api/v1/console-cases/${id}/commands`).set(sessionHeaders(session)).set('Idempotency-Key', randomUUID()).send(body);
    await command({ action: 'add_note', note: 'Synthetic evidence checked.', expectedVersion: 1, reason: 'Document the findings' }).expect(201);
    await command({ action: 'set_status', status: 'resolved', expectedVersion: 1, reason: 'Resolve after checking' }).expect(409);
    await command({ action: 'set_status', status: 'resolved', expectedVersion: 2, reason: 'Resolve after checking' }).expect(201);
    const detail = await request(app.getHttpServer()).get(`/api/v1/console-cases/${id}`).set(sessionHeaders(session)).expect(200); expect(detail.body.notes).toHaveLength(2); expect(detail.body.case.status).toBe('resolved');
  });
  it('preserves global read-only roles and transactional audit rollback', async () => {
    await request(app.getHttpServer()).post('/api/v1/console-cases').set(headers('AUDIT_READER')).set('Idempotency-Key', randomUUID()).send(input()).expect(403);
    await db.query("ALTER TABLE console_audit_records ADD CONSTRAINT fixture_fail CHECK (reason <> 'Force synthetic audit failure')");
    try {
      await request(app.getHttpServer()).post('/api/v1/console-cases').set(headers()).set('Idempotency-Key', randomUUID()).send({ ...input('Must roll back'), reason: 'Force synthetic audit failure' }).expect(500);
      expect(await db.query("SELECT id FROM investigation_cases WHERE title = 'Must roll back'")).toHaveLength(0);
    } finally { await db.query('ALTER TABLE console_audit_records DROP CONSTRAINT fixture_fail'); }
    await expect(db.query("UPDATE console_audit_records SET reason = 'tamper'")).rejects.toThrow('append-only');
  });
  it('encrypts tokens, never stores raw session IDs, and revokes server sessions on logout', async () => {
    const id = await createSession(); const rows = await db.query('SELECT id_hash, token_ciphertext FROM console_sessions WHERE id_hash = $1', [sessionHash(id)]);
    expect(JSON.stringify(rows)).not.toContain(id); expect(JSON.stringify(rows)).not.toContain('fixture-OPS');
    await request(app.getHttpServer()).delete('/api/v1/console-session').set(sessionHeaders(id)).expect(204);
    await request(app.getHttpServer()).get('/api/v1/console-session').set(sessionHeaders(id)).expect(401);
  });
});
