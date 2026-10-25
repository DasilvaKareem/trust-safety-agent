import handler from '../pages/api/rescan';

function call(method: string, headers: Record<string, string> = {}, body: any = {}) {
  const out: { status?: number; json?: any } = {};
  const res: any = {
    status(code: number) { out.status = code; return res; },
    json(payload: any) { out.json = payload; return res; },
  };
  return Promise.resolve(handler({ method, headers, body } as any, res)).then(() => out);
}

describe('POST /api/rescan (manual, no schedule)', () => {
  const saved = process.env.EVE_SCAN_TOKEN;
  afterEach(() => { process.env.EVE_SCAN_TOKEN = saved; });

  it('rejects non-POST', async () => {
    expect((await call('GET')).status).toBe(405);
  });
  it('is disabled when EVE_SCAN_TOKEN is unset', async () => {
    delete process.env.EVE_SCAN_TOKEN;
    expect((await call('POST')).status).toBe(503);
  });
  it('requires the bearer token', async () => {
    process.env.EVE_SCAN_TOKEN = 'secret-token';
    expect((await call('POST', { authorization: 'Bearer wrong' })).status).toBe(401);
  });
  it('re-scans nothing when storage has no matching deployments', async () => {
    process.env.EVE_SCAN_TOKEN = 'secret-token';
    const r = await call('POST', { authorization: 'Bearer secret-token' }, { statuses: ['flagged'] });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ rescanned: 0, statuses: ['flagged'] });
  });
});
