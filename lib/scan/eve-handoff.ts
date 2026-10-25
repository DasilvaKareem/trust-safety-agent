/**
 * Hand a deployment scan to the eve agent (agent/) so it runs as a durable workflow
 * instead of inside the 30s webhook response window. The agent is mounted by withEve()
 * at /eve/v1/* on the same Vercel project; we authenticate with a shared bearer token.
 */
import { Client } from 'eve/client';
import type { ScanJob } from './pipeline';

export function eveOrigin(): string | undefined {
  if (process.env.EVE_AGENT_ORIGIN) return process.env.EVE_AGENT_ORIGIN;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return host ? `https://${host}` : undefined;
}

export function scanMessage(job: ScanJob): string {
  return `New deployment to scan. Call deep_scan with exactly this input:\n${JSON.stringify(job)}`;
}

/** Returns the eve session id, or undefined if eve is not configured / reachable. */
export async function handOffToEve(job: ScanJob): Promise<string | undefined> {
  const token = process.env.EVE_SCAN_TOKEN;
  const host = eveOrigin();
  if (!token || !host || process.env.EVE_HANDOFF === 'off') return undefined;
  try {
    const client = new Client({ host, auth: { bearer: token }, redirect: 'error' });
    const { session } = await client.sessions.create({ message: scanMessage(job) });
    return session.state.sessionId;
  } catch (error) {
    console.warn('[Webhook] eve hand-off failed, scanning inline:', error instanceof Error ? error.message : error);
    return undefined;
  }
}
