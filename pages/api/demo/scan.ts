/**
 * Demo scan API endpoint
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '@/lib/storage';
import { computeRulesScore, determineStatus } from '@/lib/rules';
import { computeContentHash, computeSimHash } from '@/lib/fingerprint';
import { analyzeWithGemini, fetchPageHTML } from '@/lib/gemini';
import { randomBytes } from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { html: providedHtml, url, fetchHtml } = req.body;

  if (!url || (!providedHtml && !fetchHtml)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
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
    const geminiAnalysis = await analyzeWithGemini(html);

    // Determine status
    const status = determineStatus(rulesResult.score, geminiAnalysis.score);

    // Compute fingerprints
    const contentHash = computeContentHash(html);
    const simHash = computeSimHash(html);

    // Save as demo deployment
    const deploymentId = `demo-${randomBytes(8).toString('hex')}`;
    const deployment = {
      id: deploymentId,
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
    });
  } catch (error) {
    console.error('[Demo Scan] Failed:', error);
    res.status(500).json({ 
      error: 'Scan failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
