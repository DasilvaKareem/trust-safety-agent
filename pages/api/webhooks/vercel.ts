/**
 * Vercel Webhook Handler
 * Verifies x-vercel-signature (HMAC-SHA1 over the raw body), then hands the deployment to the
 * eve agent's durable deep-scan workflow. Falls back to an inline scan if eve is unavailable.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getWebhookSecret, readRawBody, verifyVercelSignature } from '@/lib/webhook/signature';
import { jobFromWebhookPayload, scanDeployment } from '@/lib/scan/pipeline';
import { handOffToEve } from '@/lib/scan/eve-handoff';

const SCAN_EVENTS = new Set(['deployment.succeeded', 'deployment.ready']);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = await readRawBody(req);
  const secret = getWebhookSecret();
  if (!secret) {
    console.error('[Webhook] No webhook secret configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }
  if (!verifyVercelSignature(rawBody, req.headers['x-vercel-signature'], secret)) {
    console.warn('[Webhook] Missing or invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  console.log('[Webhook] Received event:', event.type, event.id);

  if (!SCAN_EVENTS.has(event.type)) {
    return res.status(200).json({ received: true, ignored: event.type });
  }

  const job = jobFromWebhookPayload(event.payload);
  if (!job.deploymentId || job.url === 'https://') {
    return res.status(400).json({ error: 'Missing deployment id/url' });
  }

  try {
    const sessionId = await handOffToEve(job);
    if (sessionId) {
      console.log('[Webhook] Handed to eve deep_scan workflow:', job.deploymentId, sessionId);
      return res.status(202).json({ received: true, via: 'eve', sessionId });
    }
    const summary = await scanDeployment(job);
    console.log('[Webhook] Inline scan:', summary);
    return res.status(200).json({ received: true, via: 'inline', status: summary.status });
  } catch (error) {
    console.error('[Webhook] Scan failed:', job.deploymentId, error);
    return res.status(500).json({ error: 'Scan failed' });
  }
}

// Signature is computed over the exact bytes Vercel sent, so Next must not parse the body.
export const config = { api: { bodyParser: false }, maxDuration: 120 };
