/**
 * Vercel Webhook Handler
 * Receives deployment events and triggers Trust & Safety scanning
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createHmac } from 'crypto';
import { storage } from '@/lib/storage';
import { computeRulesScore, determineStatus } from '@/lib/rules';
import { computeContentHash, computeSimHash, generateClusterId, areSimilar } from '@/lib/fingerprint';

/**
 * Verify webhook signature
 */
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  
  return signature === expectedSignature;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify webhook signature
    const signature = req.headers['x-vercel-signature'] as string;
    const webhookSecret = process.env.VERCEL_INTEGRATION_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      const payload = JSON.stringify(req.body);
      if (!verifyWebhookSignature(payload, signature, webhookSecret)) {
        console.warn('[Webhook] Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const event = req.body;
    console.log('[Webhook] Received event:', event.type, event.id);

    // Handle deployment.succeeded events
    if (event.type === 'deployment.succeeded') {
      await handleDeploymentSucceeded(event.payload);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Webhook] Handler failed:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function handleDeploymentSucceeded(payload: any) {
  const {
    deployment,
    project,
    team,
    user,
  } = payload;

  const deploymentId = deployment.id;
  const deploymentUrl = deployment.url;
  const fullUrl = `https://${deploymentUrl}`;

  console.log('[Webhook] Processing deployment:', deploymentId, fullUrl);

  try {
    // Fetch deployment HTML
    let html = '';
    try {
      const response = await fetch(fullUrl, {
        headers: { 'User-Agent': 'TrustSafetyBot/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      html = await response.text();
    } catch (fetchError) {
      console.warn('[Webhook] Failed to fetch deployment HTML:', fetchError);
      html = ''; // Continue with empty HTML
    }

    // Run fast rules-based scoring
    const metadata = {
      gitSource: !!deployment.meta?.githubCommitSha,
      accountAge: team?.createdAt ? Math.floor((Date.now() - team.createdAt) / (24 * 60 * 60 * 1000)) : undefined,
      projectAge: project?.createdAt ? Math.floor((Date.now() - project.createdAt) / (24 * 60 * 60 * 1000)) : undefined,
    };

    const rulesResult = computeRulesScore(html, fullUrl, metadata);
    const status = determineStatus(rulesResult.score);

    // Compute fingerprints
    const contentHash = html ? computeContentHash(html) : undefined;
    const simHash = html ? computeSimHash(html) : undefined;

    // Check for existing cluster
    let clusterId: string | undefined;
    if (simHash) {
      const existingCluster = await storage.getClusterBySimHash(simHash);
      if (existingCluster) {
        clusterId = existingCluster.id;
        // Update cluster
        existingCluster.deploymentIds.push(deploymentId);
        existingCluster.lastSeen = Date.now();
        existingCluster.count += 1;
        await storage.saveCluster(existingCluster);
        console.log('[Webhook] Added to existing cluster:', clusterId);
      } else {
        // Check for similar clusters
        const allClusters = await storage.getAllClusters();
        for (const cluster of allClusters) {
          if (areSimilar(simHash, cluster.simHash)) {
            clusterId = cluster.id;
            cluster.deploymentIds.push(deploymentId);
            cluster.lastSeen = Date.now();
            cluster.count += 1;
            await storage.saveCluster(cluster);
            console.log('[Webhook] Added to similar cluster:', clusterId);
            break;
          }
        }

        // Create new cluster if no match
        if (!clusterId) {
          clusterId = generateClusterId(simHash);
          await storage.saveCluster({
            id: clusterId,
            simHash,
            deploymentIds: [deploymentId],
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            count: 1,
          });
          console.log('[Webhook] Created new cluster:', clusterId);
        }
      }
    }

    // Find installation for this deployment
    const installations = await storage.getAllInstallations();
    const installation = installations.find(inst => 
      inst.teamId === team?.id || inst.userId === user?.id
    );

    // Save deployment record
    const deploymentRecord = {
      id: deploymentId,
      installationId: installation?.id || 'unknown',
      projectId: project?.id || 'unknown',
      url: fullUrl,
      deploymentUrl,
      createdAt: deployment.createdAt || Date.now(),
      rulesScore: rulesResult.score,
      rulesReasons: rulesResult.reasons,
      status,
      contentHash,
      simHash,
      clusterId,
    };

    await storage.saveDeployment(deploymentRecord);

    console.log('[Webhook] Deployment processed:', {
      id: deploymentId,
      rulesScore: rulesResult.score,
      status,
      clusterId
    });

    // Schedule deep scan if status warrants it
    if (status !== 'clean') {
      console.log('[Webhook] Scheduling deep scan for deployment:', deploymentId);
      // TODO: Trigger eve agent deep scan (will be implemented in agent code)
    }

  } catch (error) {
    console.error('[Webhook] Failed to process deployment:', deploymentId, error);
    throw error;
  }
}
