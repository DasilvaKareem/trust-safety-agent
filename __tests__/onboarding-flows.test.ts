import { jest } from '@jest/globals';
import { Readable } from 'node:stream';
import { createHmac } from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

const readPage = jest.fn<(...args: any[]) => Promise<string>>();
const scanTiered = jest.fn<(...args: any[]) => Promise<any>>();
const vercelApi = jest.fn<(...args: any[]) => Promise<any>>();
jest.unstable_mockModule('@/lib/account/public-page', () => ({ readPublicPage: readPage, normalizeSiteUrl: (url: string) => new URL(url).href }));
jest.unstable_mockModule('@/lib/gemini', () => ({ scanTiered, effectiveScore: (rules: number, tiers: any) => tiers.final.fallback ? rules : tiers.final.score }));
jest.unstable_mockModule('@/lib/account/vercel', () => ({ vercelApi, vercelReady: () => true }));
const { accountStore } = await import('@/lib/account/store');
const { createSite, getSite, saveSite, runSiteScan, verifySite } = await import('@/lib/account/sites');
const { storage } = await import('@/lib/storage');
const { createSession, beginOAuth, getUser } = await import('@/lib/account/auth');
const { default: googleCallback } = await import('@/pages/api/auth/callback');
const { default: projectsHandler } = await import('@/pages/api/integration/projects');
const { default: webhook } = await import('@/pages/api/webhooks/vercel');
const { default: monitor } = await import('@/pages/api/sites/monitor');
function mock(method = 'GET', cookie = '', body = {}, query = {}) {
  const headers: Record<string, any> = {};
  const req: any = { method, headers: { cookie, origin: 'http://localhost:3000' }, body, query };
  const res: any = { statusCode: 200, body: null, location: '', setHeader(k: string, v: any) { headers[k] = v; }, getHeader(k: string) { return headers[k]; }, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; }, end() { return this; }, redirect(location: string) { this.location = location; return this; } };
  return { req: req as NextApiRequest, res: res as NextApiResponse & { body: any; location: string }, headers };
}
async function session(id: string) {
  await accountStore.set(`user:${id}`, { id, name: id, email: `${id}@example.com`, createdAt: Date.now() });
  const { res, headers } = mock(); await createSession(res, id); return headers['Set-Cookie'][0].split(';')[0];
}
async function signedEvent(event: unknown) {
  const raw = JSON.stringify(event); const req: any = Readable.from([Buffer.from(raw)]);
  req.method = 'POST'; req.headers = { 'x-vercel-signature': createHmac('sha1', 'webhook-secret').update(raw).digest('hex') };
  const { res } = mock(); await webhook(req, res); return res;
}
const originalEnv = { ...process.env };
beforeAll(() => { process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'; process.env.GOOGLE_CLIENT_ID = 'test-client'; process.env.GOOGLE_CLIENT_SECRET = 'test-secret'; process.env.AUTH_SECRET = 'x'.repeat(64); process.env.VERCEL_INTEGRATION_WEBHOOK_SECRET = 'webhook-secret'; process.env.CRON_SECRET = 'cron-test'; });
afterAll(() => { process.env = originalEnv; });
beforeEach(() => { readPage.mockReset(); scanTiered.mockReset(); vercelApi.mockReset(); readPage.mockResolvedValue('<html><title>Example</title>Welcome to our website</html>'); scanTiered.mockResolvedValue({ final: { fallback: true }, escalated: false }); vercelApi.mockResolvedValue({ id: 'project-1', projectId: 'project-1', name: 'My project', url: 'example.com', target: 'production', readyState: 'READY' }); });

describe('First scan and monitoring lifecycle', () => {
  it('stores a rules-only scan in the correct account without pretending Gemini ran', async () => {
    const site = await createSite('scan-owner', 'https://example.com/'); const result = await runSiteScan(site);
    expect(result.lastScan?.modelUsed).toBe(false); expect(result.scanState).toBe('complete');
    expect((await storage.getOwnerDeployments('scan-owner'))[0].siteId).toBe(site.id);
    expect(await storage.getOwnerDeployments('unrelated-owner')).toEqual([]);
  });
  it('does not mark a failed fetch as a clean scan and allows a retry', async () => {
    const site = await createSite('retry-owner', 'https://example.com/'); readPage.mockRejectedValueOnce(new Error('HTTP 403'));
    await expect(runSiteScan(site)).rejects.toThrow('HTTP 403'); expect((await getSite(site.id))?.lastScan).toBeNull(); expect((await getSite(site.id))?.scanState).toBe('error');
    expect((await runSiteScan(site)).scanState).toBe('complete');
  });
  it('requires an exact per-site verification token', async () => {
    const site = await createSite('verify-owner', 'https://example.com/'); readPage.mockResolvedValueOnce('wrong-token');
    await expect(verifySite(site)).rejects.toThrow('does not match'); expect((await getSite(site.id))?.verifiedAt).toBeNull();
    readPage.mockResolvedValueOnce(`trust-safety-verification=${site.verificationToken}\n`); await verifySite(site);
    expect((await getSite(site.id))?.verifiedAt).not.toBeNull(); expect(readPage).toHaveBeenLastCalledWith('https://example.com/.well-known/trust-safety.txt', { verification: true });
  });
  it('rejects unauthorized cron calls and pauses monitoring if ownership is lost', async () => {
    const unauthorized = mock(); await monitor(unauthorized.req, unauthorized.res); expect(unauthorized.res.statusCode).toBe(401);
    const site = await createSite('cron-owner', 'https://example.com/'); site.verifiedAt = Date.now(); site.monitoring = true; await saveSite(site);
    readPage.mockResolvedValue('wrong-token'); const authorized = mock(); authorized.req.headers.authorization = 'Bearer cron-test'; await monitor(authorized.req, authorized.res);
    const updated = await getSite(site.id); expect(updated?.monitoring).toBe(false); expect(updated?.verifiedAt).toBeNull(); expect(scanTiered).not.toHaveBeenCalled();
  });
});

describe('Provider boundaries (mock provider responses)', () => {
  it('completes Google code exchange, creates a session, and prevents callback replay', async () => {
    const start = mock(); const { state } = await beginOAuth(start.res, 'google'); const cookie = start.headers['Set-Cookie'][0].split(';')[0];
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'google-test-token' }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ sub: 'test-google-user', email: 'google@example.com', email_verified: true, given_name: 'Alex' }), { status: 200 }));
    try {
      const callback = mock('GET', cookie, {}, { state, code: 'google-test-code' }); await googleCallback(callback.req, callback.res);
      expect(callback.res.location).toBe('/onboarding?step=connect'); const sessionCookie = callback.headers['Set-Cookie'].findLast((s: string) => s.startsWith('ts_session=')).split(';')[0];
      const signedIn = mock('GET', sessionCookie); expect((await getUser(signedIn.req))?.id).toBe('google:test-google-user');
      await googleCallback(callback.req, callback.res); expect(callback.res.location).toBe('/onboarding?error=sign_in'); expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally { fetchMock.mockRestore(); }
  });
  it('blocks project listing from another account and uses an authorized deployment URL', async () => {
    await storage.saveInstallation({ id: 'connection-a', ownerId: 'vercel-owner', teamId: 'team-a', userId: 'user-a', accessToken: 'mock-encrypted', configurationId: 'config-a', createdAt: Date.now() });
    const outsider = await session('vercel-outsider'); const foreign = mock('GET', outsider, {}, { installation: 'connection-a' }); await projectsHandler(foreign.req, foreign.res); expect(foreign.res.statusCode).toBe(404); expect(vercelApi).not.toHaveBeenCalled();
    const owner = await session('vercel-owner'); vercelApi.mockResolvedValueOnce({ id: 'project-1', name: 'My project' }).mockResolvedValueOnce({ deployments: [{ url: 'example.com' }] });
    const connect = mock('POST', owner, { installation: 'connection-a', projectId: 'project-1', url: 'http://127.0.0.1' }); await projectsHandler(connect.req, connect.res);
    expect(connect.res.body.site.url).toBe('https://example.com/'); expect(connect.res.body.site.ownerId).toBe('vercel-owner'); expect(connect.res.body.site.verifiedAt).not.toBeNull();
  });
  it('scans selected projects once per deployment and ignores unrelated projects', async () => {
    const site = await createSite('vercel-owner', 'https://example.com/', { name: 'My project', installationId: 'connection-a', projectId: 'project-1' });
    const event = { type: 'deployment.ready', payload: { team: { id: 'team-a' }, user: { id: 'user-a' }, project: { id: 'project-1' }, deployment: { id: 'deployment-one' } } };
    expect((await signedEvent(event)).body.scanned).toBe(1); expect((await signedEvent(event)).body.scanned).toBe(0); expect(scanTiered).toHaveBeenCalledTimes(1);
    const unrelated = { ...event, payload: { ...event.payload, project: { id: 'other-project' } } }; expect((await signedEvent(unrelated)).body.scanned).toBe(0);
    expect((await getSite(site.id))?.lastScan).not.toBeNull();
  });
  it('pauses a connected project when Vercel is uninstalled', async () => {
    const result = await signedEvent({ type: 'integration-configuration.removed', payload: { configuration: { id: 'config-a' } } }); expect(result.statusCode).toBe(200);
    const installation = await storage.getInstallation('connection-a'); expect(installation?.accessToken).toBe(''); expect(installation?.revokedAt).toBeTruthy();
    const { listSites } = await import('@/lib/account/sites'); const sites = await listSites('vercel-owner'); expect(sites.every(s => !s.monitoring && !s.verifiedAt)).toBe(true);
  });
});
