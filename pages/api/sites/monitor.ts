import type { NextApiRequest, NextApiResponse } from 'next';
import { equal } from '@/lib/account/auth';
import { accountStore } from '@/lib/account/store';
import { getSite, runSiteScan, saveSite, verifySite } from '@/lib/account/sites';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!process.env.CRON_SECRET || !equal(req.headers.authorization, `Bearer ${process.env.CRON_SECRET}`)) return res.status(401).end();
  if (!await accountStore.claim('monitor-lock', 290)) return res.status(202).json({ running: true });
  try {
    const sites = (await Promise.all((await accountStore.members('all-sites')).map(getSite)))
      .filter(s => s && s.kind === 'website' && s.monitoring && s.verifiedAt && (!s.lastScan || s.lastScan.at < Date.now() - 23 * 60 * 60 * 1000))
      .sort((a, b) => (a!.lastScan?.at || 0) - (b!.lastScan?.at || 0));
    // Bounded batches fit the request deadline. Triggered on demand (no cron deployed); each verified site is due daily.
    const results = await Promise.allSettled(sites.slice(0, 5).map(async site => {
      try { await verifySite(site!); }
      catch { site!.monitoring = false; site!.verifiedAt = null; site!.error = 'Ownership could not be re-verified. Monitoring paused; check your verification file.'; await saveSite(site!); return; }
      await runSiteScan(site!);
    }));
    res.json({ processed: results.length, failed: results.filter(r => r.status === 'rejected').length, remaining: Math.max(0, sites.length - results.length) });
  } finally { await accountStore.remove('monitor-lock'); }
}
export const config = { maxDuration: 300 };
