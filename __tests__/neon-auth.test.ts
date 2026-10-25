import { jest } from '@jest/globals';
import { getUser, endSession, appOrigin } from '@/lib/account/auth';
import authHandler from '@/pages/api/auth/[...path]';
import type { NextApiRequest } from 'next';
const env = { ...process.env };
beforeEach(() => {
  process.env.NEON_AUTH_BASE_URL = 'https://neon.example.com/neondb/auth';
  process.env.NEON_AUTH_COOKIE_SECRET = 'test-secret-'.repeat(4);
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
});
afterEach(() => { process.env = { ...env }; jest.restoreAllMocks(); });
function context(cookie = '__Secure-neon-auth.session_token=opaque-test-token') {
  const req = { method: 'GET', url: '/api/auth/get-session', headers: { cookie }, query: { path: ['get-session'] } } as unknown as NextApiRequest;
  const headers: Record<string, any> = {};
  const res: any = { statusCode: 200, setHeader(k: string, v: any) { headers[k] = v; }, getHeader(k: string) { return headers[k]; }, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; }, send(body: any) { this.body = body; return this; }, end() { return this; } };
  return { req, res, headers };
}
function profile(verified = true) {
  return { session: { id: 'session-one', userId: 'neon-user', expiresAt: new Date(Date.now() + 60000).toISOString() }, user: { id: 'neon-user', email: 'user@example.com', emailVerified: verified, name: 'Alex', createdAt: '2026-01-01T00:00:00.000Z' } };
}
it('uses a server-verified Neon user and bypasses cached cookies for private data', async () => {
  const upstream = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(profile())));
  const { req, res } = context();
  expect(await getUser(req, res)).toMatchObject({ id: 'neon-user', email: 'user@example.com', name: 'Alex' });
  expect(String(upstream.mock.calls[0][0])).toContain('disableCookieCache=true');
  expect(new Headers(upstream.mock.calls[0][1]?.headers).get('cookie')).toContain('opaque-test-token');
});
it('rejects expired sessions and unverified users', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('null')).mockResolvedValueOnce(new Response(JSON.stringify(profile(false))));
  expect(await getUser(context().req)).toBeNull();
  expect(await getUser(context().req)).toBeNull();
});
it('fails closed when the auth service is unavailable', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ message: 'Unavailable' }), { status: 503 }));
  await expect(getUser(context().req)).rejects.toThrow('Could not verify');
});
it('sign-out revokes the upstream session and forwards cleared cookies', async () => {
  const upstream = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"success":true}', { headers: { 'set-cookie': '__Secure-neon-auth.session_token=; Path=/; Max-Age=0; Secure; HttpOnly' } }));
  const { req, res, headers } = context(); await endSession(req, res);
  expect(String(upstream.mock.calls[0][0])).toContain('/sign-out');
  expect(headers['Set-Cookie'].some((s: string) => s.includes('session_token=') && s.includes('Max-Age=0'))).toBe(true);
});
it('blocks cross-origin sign-in before contacting Neon', async () => {
  const upstream = jest.spyOn(globalThis, 'fetch'); const { req, res } = context();
  req.method = 'POST'; req.headers.origin = 'https://attacker.example';
  await authHandler(req, res); expect(res.statusCode).toBe(403); expect(upstream).not.toHaveBeenCalled();
});
it('uses the Vercel preview origin without redirecting to production', () => {
  process.env.VERCEL_ENV = 'preview'; process.env.VERCEL_URL = 'argon-preview.vercel.app';
  expect(appOrigin()).toBe('https://argon-preview.vercel.app');
});
