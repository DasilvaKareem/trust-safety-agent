import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/account/auth';
import { listSites, createSite } from '@/lib/account/sites';
import { normalizeSiteUrl } from '@/lib/account/public-page';
import { accountStore } from '@/lib/account/store';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'POST'].includes(req.method || '')) return res.status(405).end();
  const user = await requireUser(req, res); if (!user) return;
  if (req.method === 'GET') return res.json({ sites: await listSites(user.id) });
  if (!await accountStore.claim(`site-create:${user.id}`, 2)) return res.status(429).json({ error: 'Please wait a moment before adding another site.' });
  try { const site = await createSite(user.id, normalizeSiteUrl(req.body.url)); return res.status(201).json({ site }); }
  catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Could not add this site.' }); }
}
