import type { NextApiRequest, NextApiResponse } from 'next';
import { appOrigin, authReady, consumeOAuth, createSession, endSession, type User } from '@/lib/account/auth';
import { accountStore } from '@/lib/account/store';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    if (!authReady()) return res.redirect('/onboarding?error=auth_setup');
    const flow = await consumeOAuth(req, res, 'google');
    if (typeof req.query.code !== 'string' || req.query.error) throw new Error('Authorization cancelled');
    const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: req.query.code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: `${appOrigin()}/api/auth/callback`, grant_type: 'authorization_code', code_verifier: flow.verifier }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Token exchange failed');
    const token = await response.json();
    const info = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(15000) });
    if (!info.ok) throw new Error('Could not verify account');
    const profile = await info.json();
    if (!profile.sub || !profile.email || profile.email_verified !== true) throw new Error('Verified email required');
    const id = `google:${profile.sub}`;
    const existing = await accountStore.get<User>(`user:${id}`);
    const user: User = { id, email: profile.email, name: profile.given_name || profile.name || 'there', createdAt: existing?.createdAt || Date.now() };
    await accountStore.set(`user:${id}`, user);
    await endSession(req, res); await createSession(res, id);
    res.redirect('/onboarding?step=connect');
  } catch { res.redirect('/onboarding?error=sign_in'); }
}
