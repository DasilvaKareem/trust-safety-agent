/**
 * Outward-facing brand impersonation finder API endpoint
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getUser, requireUser } from '@/lib/account/auth';
import { normalizeSiteUrl } from '@/lib/account/public-page';
import { accountStore } from '@/lib/account/store';
import { DEMO_FIXTURES } from '@/lib/demo/fixtures';
import { findImpersonators } from '@/lib/impersonation';

const DEFAULT_PRODUCTION_HOST = 'trust-safety-agent.vercel.app';

function parseHostname(raw: string | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const u = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function getAllowedUnauthenticatedHosts(): Set<string> {
  const allowed = new Set<string>([DEFAULT_PRODUCTION_HOST]);
  const prodHost = parseHostname(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (prodHost) allowed.add(prodHost);
  const appHost = parseHostname(process.env.NEXT_PUBLIC_APP_URL);
  if (appHost) allowed.add(appHost);
  for (const fixture of DEMO_FIXTURES) {
    const fh = parseHostname(fixture.url);
    if (fh) allowed.add(fh);
  }
  return allowed;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url: rawUrl, brand: rawBrand } = req.body ?? {};
  if (!rawUrl || typeof rawUrl !== 'string') {
    return res.status(400).json({ error: 'Missing required field: url' });
  }
  if (rawBrand !== undefined && (typeof rawBrand !== 'string' || rawBrand.length > 120)) {
    return res.status(400).json({ error: 'Brand override must be a string up to 120 characters.' });
  }

  const targetHost = parseHostname(rawUrl);
  const allowedDemoHosts = getAllowedUnauthenticatedHosts();
  const isUnauthDemoAllowed = Boolean(targetHost && allowedDemoHosts.has(targetHost));

  const sessionUser = await getUser(req, res);
  if (sessionUser) {
    const user = await requireUser(req, res);
    if (!user) return;
    const claimed = await accountStore.claim(`impersonation-rate:${user.id}`, 60);
    if (!claimed) {
      return res.status(429).json({ error: 'Please wait 60 seconds between impersonation checks.' });
    }
  } else if (isUnauthDemoAllowed) {
    res.setHeader('Cache-Control', 'private, no-store');
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'anon')
      .split(',')[0]
      .trim();
    const claimed = await accountStore.claim(`impersonation-rate:ip:${ip}`, 30);
    if (!claimed) {
      return res.status(429).json({ error: 'Please wait 30 seconds between demo impersonation checks.' });
    }
  } else {
    return res.status(401).json({ error: 'Sign in to continue.' });
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeSiteUrl(rawUrl);
  } catch (err) {
    return res.status(400).json({
      error: err instanceof Error ? err.message : 'Enter a valid public website URL.',
    });
  }

  const matchingFixture = DEMO_FIXTURES.find(
    f => parseHostname(f.url) === parseHostname(normalizedUrl)
  );

  try {
    const report = await findImpersonators({
      url: normalizedUrl,
      brand: typeof rawBrand === 'string' && rawBrand.trim() ? rawBrand.trim() : undefined,
      html: matchingFixture?.html,
      deadlineMs: 28_000,
    });
    return res.status(200).json(report);
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Impersonation check failed',
    });
  }
}

export const config = { maxDuration: 60 };
