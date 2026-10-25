/**
 * Review API endpoint - approve, dismiss, or block deployments
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '@/lib/storage';
import { requireUser } from '@/lib/account/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const { deploymentId, decision } = req.body;

  if (!deploymentId || !['approved', 'dismissed', 'blocked'].includes(decision)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const deployment = await storage.getDeployment(deploymentId);
    if (!deployment || deployment.ownerId !== user.id) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    // Update deployment status
    const newStatus = decision === 'approved' ? 'clean' : decision === 'blocked' ? 'flagged' : deployment.status;
    
    await storage.updateDeploymentStatus(
      deploymentId,
      newStatus,
      {
        reviewedBy: user.id,
        reviewDecision: decision,
      }
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Review] Failed:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
