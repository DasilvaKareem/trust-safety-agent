import type { NextApiRequest, NextApiResponse } from 'next';
import { getWebhookSecret, readRawBody, verifyVercelSignature } from '@/lib/webhook/signature';
import { storage } from '@/lib/storage';
import { accountStore } from '@/lib/account/store';
import { listSites, runSiteScan, saveSite } from '@/lib/account/sites';
import { vercelApi } from '@/lib/account/vercel';
const SCAN_EVENTS = new Set(['deployment.succeeded', 'deployment.ready']);
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const rawBody = await readRawBody(req); const secret = getWebhookSecret();
  if (!secret) return res.status(500).json({ error: 'Webhook secret not configured' });
  if (!verifyVercelSignature(rawBody, req.headers['x-vercel-signature'], secret)) return res.status(401).json({ error: 'Invalid signature' });
  let event: any; try { event = JSON.parse(rawBody.toString('utf8')); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  if (!SCAN_EVENTS.has(event.type) && event.type !== 'integration-configuration.removed') return res.status(200).json({ received: true, ignored: event.type });
  try {
    const installations = await storage.getAllInstallations();
    if (event.type === 'integration-configuration.removed') {
      const configurationId = event.payload?.configuration?.id || event.payload?.configurationId;
      for (const installation of installations.filter(i => i.configurationId === configurationId && i.ownerId)) {
        installation.revokedAt = Date.now(); installation.accessToken = ''; await storage.saveInstallation(installation);
        for (const site of (await listSites(installation.ownerId!)).filter(s => s.installationId === installation.id)) { site.monitoring = false; site.verifiedAt = null; site.error = 'Vercel access was removed. Reconnect to resume monitoring.'; await saveSite(site); }
      }
      return res.json({ received: true });
    }
    const payload = event.payload || {}; const deployment = payload.deployment || {};
    const projectId = payload.project?.id || deployment.projectId;
    if (!deployment.id || !projectId) return res.status(400).json({ error: 'Missing deployment id/project' });
    let scanned = 0;
    for (const installation of installations.filter(i => i.ownerId && !i.revokedAt && (i.teamId ? i.teamId === payload.team?.id : i.userId === payload.user?.id && !payload.team?.id))) {
      const sites = (await listSites(installation.ownerId!)).filter(s => s.projectId === projectId && s.installationId === installation.id && s.monitoring && s.verifiedAt);
      if (!sites.length) continue;
      // Re-check current API permissions and deployment metadata before scanning.
      const live = await vercelApi(installation, `/v13/deployments/${encodeURIComponent(deployment.id)}`);
      if (live.projectId !== projectId || live.target !== 'production' || live.readyState !== 'READY') continue;
      for (const site of sites) {
        const key = `webhook:${site.id}:${deployment.id}`;
        if (!await accountStore.claim(key, 86400)) continue;
        try {
          site.url = `https://${live.url}`; await saveSite(site);
          await runSiteScan(site); scanned++;
        } catch (error) { await accountStore.remove(key); throw error; }
      }
    }
    return res.status(200).json({ received: true, scanned });
  } catch { return res.status(500).json({ error: 'Scan failed; delivery can be retried.' }); }
}
export const config = { api: { bodyParser: false }, maxDuration: 120 };
