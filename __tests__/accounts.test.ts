import { session } from './helpers/neon';
import type { NextApiRequest, NextApiResponse } from 'next';
import { accountStore } from '@/lib/account/store';
const { getUser, endSession, beginOAuth, consumeOAuth, encryptToken, decryptToken } = await import('@/lib/account/auth');
const { createSite, saveSite } = await import('@/lib/account/sites');
import { isPublicIPv4, normalizeSiteUrl } from '@/lib/account/public-page';
const { default: sitesHandler } = await import('@/pages/api/sites/index');
const { default: siteHandler } = await import('@/pages/api/sites/[id]');
const { default: reviewHandler } = await import('@/pages/api/review');
import { storage } from '@/lib/storage';

function requestResponse(method = 'GET', cookie = '', body: unknown = {}, query: Record<string, string> = {}) {
  const req = { method, headers: { cookie, origin: 'http://localhost:3000' }, body, query } as NextApiRequest;
  const headers: Record<string, unknown> = {};
  const res: any = { statusCode: 200, body: null, setHeader: (k: string, v: unknown) => { headers[k] = v; }, getHeader: (k: string) => headers[k], status(code: number) { this.statusCode = code; return this; }, json(data: unknown) { this.body = data; return this; }, end() { return this; } };
  return { req, res: res as NextApiResponse & { statusCode: number; body: any }, headers };
}
describe('Account boundaries', () => {
  const oldOrigin = process.env.NEXT_PUBLIC_APP_URL;
  beforeAll(() => { process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'; });
  afterAll(() => { if (oldOrigin === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = oldOrigin; });
  it('requires a session to list sites', async () => {
    const { req, res } = requestResponse(); await sitesHandler(req, res); expect(res.statusCode).toBe(401);
  });
  it('only lists sites belonging to the authenticated user', async () => {
    const a = await session('list-a'); await createSite('list-a', 'https://example.com/'); await createSite('list-b', 'https://example.org/');
    const { req, res } = requestResponse('GET', a); await sitesHandler(req, res);
    expect(res.body.sites).toHaveLength(1); expect(res.body.sites[0].ownerId).toBe('list-a');
  });
  it('rejects reads, scans, edits and disconnects of another user’s site', async () => {
    const cookie = await session('outsider'); const site = await createSite('private-owner', 'https://example.com/');
    for (const method of ['GET', 'POST', 'DELETE']) {
      const { req, res } = requestResponse(method, cookie, { action: 'monitor', enabled: true }, { id: site.id });
      await siteHandler(req, res); expect(res.statusCode).toBe(404);
    }
  });
  it('requires ownership verification before monitoring and ignores forged verification fields', async () => {
    const cookie = await session('unverified'); const site = await createSite('unverified', 'https://example.com/');
    const { req, res } = requestResponse('POST', cookie, { action: 'monitor', enabled: true, verifiedAt: Date.now() }, { id: site.id });
    await siteHandler(req, res); expect(res.statusCode).toBe(400); expect(res.body.error).toMatch(/Verify ownership/);
  });
  it('rejects cross-origin state changes', async () => {
    const cookie = await session('csrf'); const { req, res } = requestResponse('POST', cookie, { url: 'https://example.com/' }); req.headers.origin = 'https://attacker.example';
    await sitesHandler(req, res); expect(res.statusCode).toBe(403);
  });
  it('revokes a session on sign-out', async () => {
    const cookie = await session('logout'); const { req, res } = requestResponse('POST', cookie);
    expect((await getUser(req))?.id).toBe('logout'); await endSession(req, res); expect(await getUser(req)).toBeNull();
  });
  it('does not allow reviewing another account’s deployment', async () => {
    await storage.saveDeployment({ id: 'private-deployment', ownerId: 'review-owner', installationId: 'x', projectId: 'x', url: 'https://example.com', deploymentUrl: 'https://example.com', createdAt: 1, rulesScore: .5, rulesReasons: [], status: 'review' });
    const cookie = await session('review-outsider'); const { req, res } = requestResponse('POST', cookie, { deploymentId: 'private-deployment', decision: 'approved' });
    await reviewHandler(req, res); expect(res.statusCode).toBe(404); expect((await storage.getDeployment('private-deployment'))?.status).toBe('review');
  });
  it('keeps deployment history scoped to its owner', async () => {
    expect(await storage.getOwnerDeployments('nobody')).toEqual([]);
    expect((await storage.getOwnerDeployments('review-owner')).every(d => d.ownerId === 'review-owner')).toBe(true);
  });
  it('only consumes an OAuth transaction once and binds it to a browser', async () => {
    const start = requestResponse(); const { state } = await beginOAuth(start.res, 'vercel');
    const cookie = (start.headers['Set-Cookie'] as string[])[0].split(';')[0];
    const wrong = requestResponse('GET', 'ts_vercel_state=wrong', {}, { state });
    await expect(consumeOAuth(wrong.req, wrong.res, 'vercel')).rejects.toThrow();
    const correct = requestResponse('GET', cookie, {}, { state });
    await expect(consumeOAuth(correct.req, correct.res, 'vercel')).resolves.toHaveProperty('provider', 'vercel');
    await expect(consumeOAuth(correct.req, correct.res, 'vercel')).rejects.toThrow();
  });
  it('expires temporary records and atomically claims work', async () => {
    expect(await accountStore.claim('claim-test', 30)).toBe(true); expect(await accountStore.claim('claim-test', 30)).toBe(false);
    await accountStore.set('expired-test', { value: 1 }, -1); expect(await accountStore.get('expired-test')).toBeNull();
  });
  it('encrypts Vercel credentials and detects tampering', () => {
    const old = process.env.AUTH_SECRET; process.env.AUTH_SECRET = 'a'.repeat(64);
    try { const cipher = encryptToken('private-vercel-token'); expect(cipher).not.toContain('private-vercel-token'); expect(decryptToken(cipher)).toBe('private-vercel-token'); const pieces = cipher.split('.'); pieces[1] = Buffer.alloc(16).toString('base64url'); expect(() => decryptToken(pieces.join('.'))).toThrow(); }
    finally { if (old === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = old; }
  });
});

describe('Public website fetch boundaries', () => {
  it.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '172.16.1.1', '192.168.1.1', '100.64.0.1', '0.0.0.0', '198.18.0.1', '224.0.0.1', '::1', '::ffff:127.0.0.1'])('blocks non-public address %s', address => expect(isPublicIPv4(address)).toBe(false));
  it('accepts public IPv4 addresses', () => expect(isPublicIPv4('93.184.216.34')).toBe(true));
  it.each(['http://localhost', 'http://127.0.0.1', 'http://2130706433', 'http://[::1]', 'file:///etc/passwd', 'https://user:pass@example.com', 'https://example.com:8080'])('rejects unsafe URL %s', url => expect(() => normalizeSiteUrl(url)).toThrow());
  it('normalizes ordinary URLs', () => expect(normalizeSiteUrl('example.com/#section')).toBe('https://example.com/'));
});
