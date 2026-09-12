import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { boundedOwnerJson, ownerOrigin, readOwner } from './owner-read.transport';
const input = { origin: 'https://credit.example.test', resource: 'ingestion' as const, tenantId: 'tenant-a', token: 'verified-access-token' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
describe('allowlisted owner read transport', () => {
  it('sets the fixed read path and verified tenant, never an internal key', async () => {
    const transport = jest.fn().mockResolvedValue(json({ ok: true }));
    await readOwner(input, transport);
    const [url, options] = transport.mock.calls[0];
    expect(url.pathname).toBe('/api/v1/ingestion/admin/data-source-quality');
    expect(url.searchParams.toString()).toBe('tenant_id=tenant-a');
    expect(options).toEqual(expect.objectContaining({ method: 'GET', redirect: 'error', cache: 'no-store' }));
    expect(Object.keys(options.headers).sort()).toEqual(['accept', 'authorization']);
  });
  it.each([401, 403])('preserves owner authorization denial %s', async (status) => {
    await expect(readOwner(input, jest.fn().mockResolvedValue(json({}, status)))).rejects.toBeInstanceOf(ForbiddenException);
  });
  it.each([404, 429, 500])('does not convert an owner failure %s to empty success', async (status) => {
    await expect(readOwner(input, jest.fn().mockResolvedValue(json({}, status)))).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('fails closed on transport timeout', async () => {
    await expect(readOwner(input, jest.fn().mockRejectedValue(new Error('timeout')))).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it.each(['http://external.example', 'https://u:p@credit.example', 'https://credit.example/path', 'https://credit.example?key=secret', 'https://credit.example#fragment'])('rejects unsafe origin %s before fetch', async (origin) => {
    const transport = jest.fn(); await expect(readOwner({ ...input, origin }, transport)).rejects.toThrow(); expect(transport).not.toHaveBeenCalled();
  });
  it('permits loopback only outside production', () => {
    expect(ownerOrigin('http://127.0.0.1:4500', false).hostname).toBe('127.0.0.1');
    expect(() => ownerOrigin('http://127.0.0.1:4500', true)).toThrow();
  });
  it('requires a verified token and tenant before fetch', async () => {
    const transport = jest.fn();
    await expect(readOwner({ ...input, token: undefined }, transport)).rejects.toThrow();
    await expect(readOwner({ ...input, tenantId: '../tenant-b' }, transport)).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
  it('enforces a byte limit even without content-length', async () => {
    await expect(boundedOwnerJson(json({ text: 'é'.repeat(30) }), 40)).rejects.toThrow();
  });
  it('cancels a chunked response when its actual size exceeds the bound', async () => {
    const cancel = jest.fn();
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(50)); }, cancel });
    await expect(boundedOwnerJson(new Response(stream, { headers: { 'content-type': 'application/json' } }), 40)).rejects.toThrow();
    expect(cancel).toHaveBeenCalled();
  });
  it('rejects HTML, malformed JSON and invalid UTF-8', async () => {
    await expect(boundedOwnerJson(new Response('<html>'))).rejects.toThrow();
    await expect(boundedOwnerJson(new Response('{', { headers: { 'content-type': 'application/json' } }))).rejects.toThrow();
    await expect(boundedOwnerJson(new Response(new Uint8Array([255]), { headers: { 'content-type': 'application/json' } }))).rejects.toThrow();
  });
});
