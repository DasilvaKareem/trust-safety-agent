/**
 * Demo scan API endpoint
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { storage, type Deployment } from '@/lib/storage';
import { computeRulesScore, determineStatus } from '@/lib/rules';
import { computeContentHash, computeSimHash } from '@/lib/fingerprint';
import { scanTiered, effectiveScore, decidedBy, fetchPageHTML } from '@/lib/gemini';
import { getDemoFixture } from '@/lib/demo/fixtures';
import { randomBytes } from 'crypto';
import { requireUser } from '@/lib/account/auth';
import { normalizeSiteUrl } from '@/lib/account/public-page';
import { accountStore } from '@/lib/account/store';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const started = Date.now();
  const { html: providedHtml, url: providedUrl, fetchHtml, sample } = req.body ?? {};

  // Built-in fixture samples are fixed, server-side content (no user HTML, no outbound fetch),
  // so they can be scanned without signing in; everything else requires a session.
  let user: { id: string } | null = null;
  if (sample && !providedHtml && !providedUrl && !fetchHtml) {
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'anon').split(',')[0].trim();
    if (!await accountStore.claim(`sample-scan-rate:${ip}`, 10)) return res.status(429).json({ error: 'Please wait 10 seconds between sample scans.' });
  } else {
    user = await requireUser(req, res);
    if (!user) return;
    if (!await accountStore.claim(`scan-rate:${user.id}`, 30)) return res.status(429).json({ error: 'Please wait 30 seconds between scans.' });
  }

  let html = providedHtml;
  let url = providedUrl;

  if (sample) {
    const fixture = getDemoFixture(String(sample));
    if (!fixture) {
      return res.status(400).json({ error: `Unknown sample fixture: ${sample}` });
    }
    html = fixture.html;
    url = fixture.url;
  }

  if (!url || (!html && !fetchHtml)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    normalizeSiteUrl(url);
    if (providedHtml !== undefined && (typeof providedHtml !== 'string' || providedHtml.length > 200_000)) return res.status(400).json({ error: 'HTML must be text under 200 KB.' });
    // Get HTML content
    if (fetchHtml && !sample) {
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

    // Determine status, category, and deciding tier
    const status = determineStatus(effectiveScore(rulesResult.score, tiered));
    const tierDecidedBy = decidedBy(tiered);
    const category = (!geminiAnalysis.fallback ? geminiAnalysis.category : rulesResult.categoryHint) ?? geminiAnalysis.category;

    // Compute fingerprints
    const contentHash = computeContentHash(html);
    const simHash = computeSimHash(html);

    // Save as demo deployment
    const deploymentId = `demo-${randomBytes(8).toString('hex')}`;
    const deployment: Deployment = {
      id: deploymentId,
      ownerId: user?.id ?? 'demo-sample',
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
      category,
      status,
      contentHash,
      simHash,
    };

    await storage.saveDeployment(deployment);
    const totalLatencyMs = Date.now() - started;

    res.status(200).json({
      deployment,
      category,
      decidedBy: tierDecidedBy,
      totalLatencyMs,
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
