import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/account/auth';
import { storage } from '@/lib/storage';
import { vercelApi } from '@/lib/account/vercel';
import { createSite } from '@/lib/account/sites';
import { normalizeSiteUrl } from '@/lib/account/public-page';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'POST'].includes(req.method || '')) return res.status(405).end();
  const user = await requireUser(req, res); if (!user) return;
  const id = req.method === 'GET' ? req.query.installation : req.body.installation;
  const installation = typeof id === 'string' ? await storage.getInstallation(id) : null;
  if (!installation || installation.ownerId !== user.id || installation.revokedAt) return res.status(404).json({ error: 'Connection not found. Please reconnect Vercel.' });
  try {
    if (req.method === 'GET') {
      const data = await vercelApi(installation, '/v9/projects', { limit: '100', ...(typeof req.query.until === 'string' ? { until: req.query.until } : {}) });
      return res.json({ projects: (data.projects || []).map((p: any) => ({ id: p.id, name: p.name })), next: data.pagination?.next || null });
    }
    if (typeof req.body.projectId !== 'string') return res.status(400).json({ error: 'Choose a project.' });
    // Fetch with the user's integration token; never trust a client-provided deployment URL.
    const project = await vercelApi(installation, `/v9/projects/${encodeURIComponent(req.body.projectId)}`);
    const deployments = await vercelApi(installation, '/v6/deployments', { projectId: project.id, state: 'READY', target: 'production', limit: '1' });
    const deployment = deployments.deployments?.[0];
    if (!deployment?.url) return res.status(400).json({ error: 'This project has no ready production deployment yet. Deploy it, then try again.' });
    const site = await createSite(user.id, normalizeSiteUrl(`https://${deployment.url}`), { name: project.name, installationId: installation.id, projectId: project.id });
    res.json({ site });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Could not connect the project.' }); }
}
