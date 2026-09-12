import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../app.module';

const integration = process.env.CONSOLE_DATABASE_TESTS === 'true' ? describe : describe.skip;
integration('case workflows against Postgres', () => {
  let app: INestApplication;
  let database: DataSource;
  let fetchMock: jest.SpyInstance;
  const token = (tenant = 'tenant-a', role = 'OPS') => `fixture-${tenant}-${role}`;
  const headers = (tenant = 'tenant-a', role = 'OPS') => ({ Authorization: `Bearer ${token(tenant, role)}`, 'X-Mobicred-Tenant-Id': tenant });
  const input = (title = 'Synthetic payment investigation') => ({ title, kind: 'payment', severity: 'high', reason: 'Synthetic provider and posting mismatch' });

  beforeAll(async () => {
    fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = new URLSearchParams(String(init?.body));
      const accessToken = body.get('token') ?? '';
      const tenant = accessToken.includes('tenant-b') ? 'tenant-b' : 'tenant-a';
      const role = accessToken.endsWith('AUDIT_READER') ? 'AUDIT_READER' : 'OPS';
      return new Response(JSON.stringify({ active: accessToken.startsWith('fixture-'), iss: process.env.CONSOLE_OIDC_ISSUER, aud: process.env.CONSOLE_OIDC_AUDIENCE, sub: `staff-${role}`, exp: Math.floor(Date.now() / 1000) + 600, tenant_ids: [tenant], realm_access: { roles: [role] } }), { status: 200 });
    });
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    database = app.get(DataSource);
  }, 30000);
  afterAll(async () => { await app?.close(); fetchMock?.mockRestore(); });

  it('rejects unverified bearer strings', async () => {
    await request(app.getHttpServer()).get('/api/v1/console-cases').set({ Authorization: 'Bearer not-a-staff-token', 'X-Mobicred-Tenant-Id': 'tenant-a' }).expect(401);
  });

  it('creates one case and one audit record for concurrent identical requests', async () => {
    const key = randomUUID();
    const send = () => request(app.getHttpServer()).post('/api/v1/console-cases').set(headers()).set('Idempotency-Key', key).send(input());
    const results = await Promise.all([send(), send()]);
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    expect(results[0].body.id).toBe(results[1].body.id);
    const audits = await database.query('SELECT id FROM console_audit_records WHERE target_id = $1', [results[0].body.id]);
    expect(audits).toHaveLength(1);
    await request(app.getHttpServer()).post('/api/v1/console-cases').set(headers()).set('Idempotency-Key', key).send(input('A different request body')).expect(409);
  });

  it('applies versioned notes and status changes without touching another tenant', async () => {
    const created = await request(app.getHttpServer()).post('/api/v1/console-cases').set(headers()).set('Idempotency-Key', randomUUID()).send(input()).expect(201);
    const id = created.body.id;
    await request(app.getHttpServer()).get(`/api/v1/console-cases/${id}`).set(headers('tenant-b')).expect(404);
    await request(app.getHttpServer()).post(`/api/v1/console-cases/${id}/commands`).set(headers('tenant-b')).set('Idempotency-Key', randomUUID()).send({ action: 'set_status', status: 'resolved', expectedVersion: 1, reason: 'Synthetic foreign tenant action' }).expect(404);
    await request(app.getHttpServer()).post(`/api/v1/console-cases/${id}/commands`).set(headers()).set('Idempotency-Key', randomUUID()).send({ action: 'add_note', note: 'Synthetic evidence checked.', expectedVersion: 1, reason: 'Document the investigation findings' }).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/console-cases/${id}/commands`).set(headers()).set('Idempotency-Key', randomUUID()).send({ action: 'set_status', status: 'resolved', expectedVersion: 1, reason: 'Resolve after evidence was checked' }).expect(409);
    const resolved = await request(app.getHttpServer()).post(`/api/v1/console-cases/${id}/commands`).set(headers()).set('Idempotency-Key', randomUUID()).send({ action: 'set_status', status: 'resolved', expectedVersion: 2, reason: 'Resolve after evidence was checked' }).expect(201);
    expect(resolved.body.version).toBe(3);
    const detail = await request(app.getHttpServer()).get(`/api/v1/console-cases/${id}`).set(headers()).expect(200);
    expect(detail.body.notes).toHaveLength(2);
    expect(detail.body.case.status).toBe('resolved');
  });

  it('keeps audit-reader identities read-only and enforces tenant predicates before counting', async () => {
    await request(app.getHttpServer()).post('/api/v1/console-cases').set(headers('tenant-a', 'AUDIT_READER')).set('Idempotency-Key', randomUUID()).send(input()).expect(403);
    const result = await request(app.getHttpServer()).get('/api/v1/console-cases').set(headers('tenant-b')).expect(200);
    expect(result.body.meta.total).toBe(0);
    expect(result.body.items).toEqual([]);
  });

  it('rolls back case creation when the audit insert fails', async () => {
    await database.query("ALTER TABLE console_audit_records ADD CONSTRAINT fixture_audit_insert_fails CHECK (reason <> 'Force synthetic audit failure')");
    try {
      await request(app.getHttpServer()).post('/api/v1/console-cases').set(headers()).set('Idempotency-Key', randomUUID()).send({ ...input('Must roll back this synthetic case'), reason: 'Force synthetic audit failure' }).expect(500);
      const rows = await database.query('SELECT id FROM investigation_cases WHERE title = $1', ['Must roll back this synthetic case']);
      expect(rows).toHaveLength(0);
    } finally { await database.query('ALTER TABLE console_audit_records DROP CONSTRAINT fixture_audit_insert_fails'); }
  });

  it('prevents updating the audit trail through ordinary SQL', async () => {
    await expect(database.query("UPDATE console_audit_records SET reason = 'tamper' WHERE tenant_id = 'tenant-a'")).rejects.toThrow('append-only');
  });

  it('stores encrypted server sessions, resolves them, and revokes them on logout', async () => {
    const created = await request(app.getHttpServer()).post('/api/v1/console-session').set(headers()).expect(201);
    expect(created.body.sessionId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const rows = await database.query('SELECT id_hash, token_ciphertext FROM console_sessions');
    expect(JSON.stringify(rows)).not.toContain(created.body.sessionId);
    expect(JSON.stringify(rows)).not.toContain(token());
    await request(app.getHttpServer()).get('/api/v1/console-session').set('X-Console-Session', created.body.sessionId).expect(200);
    await request(app.getHttpServer()).delete('/api/v1/console-session').set('X-Console-Session', created.body.sessionId).expect(204);
    await request(app.getHttpServer()).get('/api/v1/console-session').set('X-Console-Session', created.body.sessionId).expect(401);
  });
});
