/**
 * Demo scan API endpoint
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '@/lib/storage';
import { computeRulesScore, determineStatus } from '@/lib/rules';
import { computeContentHash, computeSimHash } from '@/lib/fingerprint';
import { scanTiered, effectiveScore, fetchPageHTML } from '@/lib/gemini';
import { randomBytes } from 'crypto';
import { requireUser } from '@/lib/account/auth';
import { normalizeSiteUrl } from '@/lib/account/public-page';
import { accountStore } from '@/lib/account/store';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireUser(req, res);
  if (!user) return;
  if (!await accountStore.claim(`scan-rate:${user.id}`, 30)) return res.status(429).json({ error: 'Please wait 30 seconds between scans.' });
  const { html: providedHtml, url, fetchHtml } = req.body;

  if (!url || (!providedHtml && !fetchHtml)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    normalizeSiteUrl(url);
    if (providedHtml !== undefined && (typeof providedHtml !== 'string' || providedHtml.length > 200_000)) return res.status(400).json({ error: 'HTML must be text under 200 KB.' });
    // Get HTML content
    let html = providedHtml;
    if (fetchHtml) {
      try {
        html = await fetchPageHTML(url);
      } catch (error) {
        return res.status(400).json({ 
          error: 'Failed to fetch URL',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Run rules-based scoring
    const rulesResult = computeRulesScore(html, url);

    // Run Gemini analysis
    // Two-tier: Flash on every scan, escalate to Argon (heavy thinking) when needed
    const tiered = await scanTiered(html, url, rulesResult.score);
    const geminiAnalysis = tiered.final;

    // Determine status
    const status = determineStatus(effectiveScore(rulesResult.score, tiered));

    // Compute fingerprints
    const contentHash = computeContentHash(html);
    const simHash = computeSimHash(html);

    // Save as demo deployment
    const deploymentId = `demo-${randomBytes(8).toString('hex')}`;
    const deployment = {
      id: deploymentId,
      ownerId: user.id,
      installationId: 'demo',
      projectId: 'demo',
      url,
      deploymentUrl: url,
      createdAt: Date.now(),
      rulesScore: rulesResult.score,
      rulesReasons: rulesResult.reasons,
      geminiScore: geminiAnalysis.score,
      geminiReasons: geminiAnalysis.reasons,
      geminiImpersonatedBrand: geminiAnalysis.impersonatedBrand,
      status,
      contentHash,
      simHash,
    };

    await storage.saveDeployment(deployment);

    res.status(200).json({
      deployment,
      rulesResult,
      geminiAnalysis,
      tiers: {
        fast: tiered.fast,
        deep: tiered.deep,
        escalated: tiered.escalated,
        escalationReason: tiered.escalationReason,
        totalLatencyMs: tiered.totalLatencyMs,
      },
    });
  } catch (error) {
    console.error('[Demo Scan] Failed:', error);
    res.status(500).json({ 
      error: 'Scan failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Tiered scan can take ~15-30s when it escalates to Argon with heavy thinking
export const config = { maxDuration: 120 };
