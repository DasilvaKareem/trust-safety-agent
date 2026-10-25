import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAuthProxyRequest } from '@neondatabase/auth/server';
import { neonAuthConfig, neonAuthReady } from '@/lib/auth/config';
import { appOrigin, sameOrigin } from '@/lib/account/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET', 'POST'].includes(req.method || '')) return res.status(405).end();
  if (!neonAuthReady()) return res.status(503).json({ error: 'Sign-in is not configured yet.' });
  if (req.method === 'POST' && !sameOrigin(req)) return res.status(403).json({ error: 'Please sign in from Argon Guard.' });
  const path = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path || '';
  const headers = new Headers();
  for (const name of ['cookie', 'origin', 'referer', 'content-type', 'user-agent']) {
    const value = req.headers[name];
    if (typeof value === 'string') headers.set(name, value);
  }
  headers.set('x-neon-auth-proxy', 'nextjs');
  const request = new Request(new URL(req.url!, appOrigin()), {
    method: req.method, headers,
    ...(req.method === 'POST' ? { body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}) } : {}),
  });
  try {
    const response = await handleAuthProxyRequest({ ...neonAuthConfig(), request, path });
    for (const name of ['content-type', 'location']) {
      const value = response.headers.get(name); if (value) res.setHeader(name, value);
    }
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader('Set-Cookie', cookies);
    return res.status(response.status).send(await response.text());
  } catch {
    return res.status(502).json({ error: 'Sign-in is temporarily unavailable. Please try again.' });
  }
}
