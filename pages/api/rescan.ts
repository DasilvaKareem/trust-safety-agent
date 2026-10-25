/**
 * Manual re-scan (proof of concept). Re-runs the full pipeline (fetch -> rules -> Flash ->
 * [escalate] Argon -> persist) on recent deployments with the given statuses. Nothing calls
 * this on a schedule; see examples/scheduled-rescan.md for how a cron could.
 *
 *   POST /api/rescan  Authorization: Bearer $EVE_SCAN_TOKEN
 *   body: { statuses?: ("review"|"flagged"|"clean")[], limit?: number (1-10, default 5) }
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { timingSafeEqual } from 'crypto';
import { storage } from '@/lib/storage';
import { scanDeployment, type ScanSummary } from '@/lib/scan/pipeline';

const ALLOWED = ['clean', 'review', 'flagged'] as const;

function authorized(header: string | undefined, token: string): boolean {
  const got = Buffer.from(header?.replace(/^Bearer\s+/i, '') ?? '');
  const want = Buffer.from(token);
  return got.length === want.length && timingSafeEqual(got, want);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = process.env.EVE_SCAN_TOKEN;
  if (!token) return res.status(503).json({ error: 'Re-scan is not configured (EVE_SCAN_TOKEN unset)' });
  if (!authorized(req.headers.authorization, token)) return res.status(401).json({ error: 'Unauthorized' });

  const body = req.body ?? {};
  const statuses: string[] = Array.isArray(body.statuses)
    ? body.statuses.filter((s: unknown) => (ALLOWED as readonly unknown[]).includes(s))
    : ['review', 'flagged'];
  const limit = Math.max(1, Math.min(10, Number(body.limit) || 5));

  const targets = (await storage.getRecentDeployments(200))
    .filter(d => statuses.includes(d.status) && !d.id.startsWith('demo-'))
    .slice(0, limit);

  const results: ScanSummary[] = [];
  for (const d of targets) {
    results.push(await scanDeployment({ deploymentId: d.id, url: d.url, projectId: d.projectId }));
  }
  return res.status(200).json({ rescanned: results.length, statuses, results });
}

export const config = { maxDuration: 300 };
