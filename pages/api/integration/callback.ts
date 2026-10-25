/**
 * Vercel Integration OAuth Callback Handler
 * Exchanges authorization code for access token and stores installation
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '@/lib/storage';
import { randomBytes } from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, configurationId, teamId, userId } = req.query;

  if (!process.env.VERCEL_CLIENT_ID || !process.env.VERCEL_CLIENT_SECRET) {
    return res.status(503).json({
      error: 'Integration not configured',
      message: 'Set VERCEL_CLIENT_ID and VERCEL_CLIENT_SECRET from the Vercel Integration Console.',
    });
  }

  if (!code || !configurationId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://api.vercel.com/v2/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.VERCEL_CLIENT_ID!,
        client_secret: process.env.VERCEL_CLIENT_SECRET!,
        code: code as string,
        redirect_uri: `${appUrl()}/api/integration/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('[OAuth] Token exchange failed:', error);
      return res.status(500).json({ error: 'Failed to exchange code for token' });
    }

    const { access_token } = (await tokenResponse.json()) as { access_token: string };

    // Register webhook for deployment events
    let webhookId: string | undefined;
    try {
      const webhookResponse = await fetch('https://api.vercel.com/v1/integrations/webhooks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: `${appUrl()}/api/webhooks/vercel`,
          events: ['deployment.created', 'deployment.succeeded'],
        }),
      });

      if (webhookResponse.ok) {
        const webhook = (await webhookResponse.json()) as { id: string };
        webhookId = webhook.id;
        console.log('[OAuth] Webhook registered:', webhookId);
      } else {
        console.warn('[OAuth] Failed to register webhook:', await webhookResponse.text());
      }
    } catch (error) {
      console.warn('[OAuth] Webhook registration failed:', error);
    }

    // Store installation
    const installation = {
      id: randomBytes(16).toString('hex'),
      teamId: teamId as string || '',
      userId: userId as string || '',
      accessToken: access_token,
      configurationId: configurationId as string,
      webhookId,
      createdAt: Date.now(),
    };

    await storage.saveInstallation(installation);

    console.log('[OAuth] Installation saved:', installation.id);

    // Redirect to success page
    res.redirect('/integration/success');
  } catch (error) {
    console.error('[OAuth] Callback failed:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function appUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'http://localhost:3000';
}
