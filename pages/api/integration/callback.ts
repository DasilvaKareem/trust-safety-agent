import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '@/lib/storage';
import { getUser, consumeOAuth, appOrigin, encryptToken } from '@/lib/account/auth';
import { vercelReady } from '@/lib/account/vercel';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    if (!vercelReady()) return res.redirect('/onboarding?error=vercel_setup');
    const user = await getUser(req); const flow = await consumeOAuth(req, res, 'vercel');
    if (!user || flow.userId !== user.id) throw new Error('Session expired');
    const { code, configurationId } = req.query;
    if (typeof code !== 'string' || typeof configurationId !== 'string') throw new Error('Missing authorization');
    const response = await fetch('https://api.vercel.com/v2/oauth/access_token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: process.env.VERCEL_CLIENT_ID!, client_secret: process.env.VERCEL_CLIENT_SECRET!, code, redirect_uri: `${appOrigin()}/api/integration/callback` }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Token exchange failed');
    const token = await response.json();
    if (!token.access_token || !token.user_id) throw new Error('Invalid token response');
    const id = `vercel:${configurationId}`;
    const existing = await storage.getInstallation(id);
    if (existing && existing.ownerId !== user.id) throw new Error('This integration belongs to another workspace');
    await storage.saveInstallation({ id, ownerId: user.id, teamId: token.team_id || '', userId: token.user_id, accessToken: encryptToken(token.access_token), configurationId, createdAt: existing?.createdAt || Date.now() });
    res.redirect(`/onboarding?step=connect&installation=${encodeURIComponent(id)}`);
  } catch { res.redirect('/onboarding?error=vercel_connect'); }
}
