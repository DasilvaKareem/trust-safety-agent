import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/account/auth';
import { getSite, runSiteScan, saveSite, verifySite } from '@/lib/account/sites';
import { accountStore } from '@/lib/account/store';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) return res.status(405).end();
  const user = await requireUser(req, res); if (!user) return;
  const site = typeof req.query.id === 'string' ? await getSite(req.query.id) : null;
  if (!site || site.ownerId !== user.id) return res.status(404).json({ error: 'Site not found.' });
  if (req.method === 'GET') return res.json({ site });
  if (req.method === 'DELETE') { await accountStore.remove(`site:${site.id}`); return res.json({ ok: true }); }
  try {
    if (req.body.action === 'scan') {
      if (!await accountStore.claim(`scan-rate:${user.id}`, 30)) return res.status(429).json({ error: 'Please wait 30 seconds between scans.' });
      return res.json({ site: await runSiteScan(site) });
    }
    if (req.body.action === 'verify') {
      if (site.kind !== 'website') throw new Error('This project is already verified through Vercel.');
      if (!await accountStore.claim(`verify-rate:${user.id}`, 5)) return res.status(429).json({ error: 'Please wait a few seconds before checking again.' });
      return res.json({ site: await verifySite(site) });
    }
    if (req.body.action === 'monitor') {
      if (typeof req.body.enabled !== 'boolean') throw new Error('Choose whether to enable monitoring.');
      if (req.body.enabled && !site.verifiedAt) throw new Error('Verify ownership before enabling monitoring.');
      if (req.body.enabled && site.kind === 'website' && !process.env.CRON_SECRET) throw new Error('Scheduled monitoring is not configured yet. You can still scan manually.');
      site.monitoring = req.body.enabled; await saveSite(site); return res.json({ site });
    }
    return res.status(400).json({ error: 'Unknown site action.' });
  } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Could not complete this request.' }); }
}
export const config = { maxDuration: 120 };
