import type { NextApiRequest, NextApiResponse } from 'next';
import { createHash } from 'node:crypto';
import { appOrigin, authReady, beginOAuth } from '@/lib/account/auth';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!authReady()) return res.redirect('/onboarding?error=auth_setup');
  const { state, verifier } = await beginOAuth(res, 'google');
  const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: `${appOrigin()}/api/auth/callback`, response_type: 'code', scope: 'openid email profile', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', prompt: 'select_account' });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
