import { createHash, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { NextApiRequest, NextApiResponse } from 'next';
import { accountStore, durableStorageReady } from './store';
export type User = { id: string; email: string; name: string; createdAt: number };
const SESSION_COOKIE = 'ts_session';
export function appOrigin() {
  const origin = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');
  return new URL(origin).origin;
}
export function authReady() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && (process.env.AUTH_SECRET?.length || 0) >= 32 && (process.env.NODE_ENV !== 'production' || durableStorageReady()));
}
export function digest(value: string) { return createHash('sha256').update(value).digest('hex'); }
export function equal(a: unknown, b: unknown) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || a.length !== b.length) return false;
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function cookies(req: IncomingMessage) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(item => {
    const i = item.indexOf('='); return [item.slice(0, i).trim(), item.slice(i + 1).trim()];
  }));
}
export function cookie(res: NextApiResponse, name: string, value: string, maxAge: number) {
  const previous = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(Array.isArray(previous) ? previous.map(String) : previous ? [String(previous)] : []), `${name}=${value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${appOrigin().startsWith('https:') ? '; Secure' : ''}`]);
}
export async function getUser(req: IncomingMessage): Promise<User | null> {
  const token = cookies(req)[SESSION_COOKIE];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await accountStore.get<{ userId: string }>(`session:${digest(token)}`);
  return session ? accountStore.get<User>(`user:${session.userId}`) : null;
}
export async function createSession(res: NextApiResponse, userId: string) {
  const token = randomBytes(32).toString('hex');
  await accountStore.set(`session:${digest(token)}`, { userId }, 60 * 60 * 24 * 7);
  cookie(res, SESSION_COOKIE, token, 60 * 60 * 24 * 7);
}
export async function endSession(req: IncomingMessage, res: NextApiResponse) {
  const token = cookies(req)[SESSION_COOKIE];
  if (token) await accountStore.remove(`session:${digest(token)}`);
  cookie(res, SESSION_COOKIE, '', 0);
}
export function sameOrigin(req: IncomingMessage) { return req.headers.origin === appOrigin(); }
export async function requireUser(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET' && !sameOrigin(req)) { res.status(403).json({ error: 'Please submit this request from the app.' }); return null; }
  const user = await getUser(req);
  if (!user) { res.status(401).json({ error: 'Sign in to continue.' }); return null; }
  return user;
}
export async function beginOAuth(res: NextApiResponse, provider: 'google' | 'vercel', userId?: string) {
  const state = randomBytes(32).toString('hex');
  const verifier = randomBytes(32).toString('base64url');
  await accountStore.set(`oauth:${digest(state)}`, { provider, userId: userId || null, verifier }, 600);
  cookie(res, `ts_${provider}_state`, state, 600);
  return { state, verifier };
}
export async function consumeOAuth(req: NextApiRequest, res: NextApiResponse, provider: 'google' | 'vercel') {
  const state = req.query.state;
  if (!equal(state, cookies(req)[`ts_${provider}_state`])) throw new Error('The sign-in link expired. Please try again.');
  cookie(res, `ts_${provider}_state`, '', 0);
  const record = await accountStore.take<{ provider: string; userId: string | null; verifier: string }>(`oauth:${digest(state as string)}`);
  if (!record || record.provider !== provider) throw new Error('The sign-in link expired. Please try again.');
  return record;
}
function encryptionKey() {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) throw new Error('AUTH_SECRET must contain at least 32 characters');
  return createHash('sha256').update(process.env.AUTH_SECRET).digest();
}
export function encryptToken(value: string) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map(b => b.toString('base64url')).join('.');
}
export function decryptToken(value: string) {
  const [iv, tag, body] = value.split('.').map(s => Buffer.from(s, 'base64url'));
  const cipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv); cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(body), cipher.final()]).toString('utf8');
}
