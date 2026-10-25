import type { NextApiRequest, NextApiResponse } from 'next';
import { endSession, sameOrigin } from '@/lib/account/auth';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!sameOrigin(req)) return res.status(403).end();
  await endSession(req, res); res.redirect(303, '/onboarding');
}
