import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser, beginOAuth } from '@/lib/account/auth';
import { vercelReady } from '@/lib/account/vercel';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = await requireUser(req, res); if (!user) return;
  if (!vercelReady()) return res.status(503).json({ error: 'Vercel connection is not configured yet. You can add a website URL instead.' });
  const { state } = await beginOAuth(res, 'vercel', user.id);
  res.json({ url: `https://vercel.com/integrations/${encodeURIComponent(process.env.VERCEL_INTEGRATION_SLUG!)}/new?state=${state}` });
}
