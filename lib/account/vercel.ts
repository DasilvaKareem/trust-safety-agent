import type { Installation } from '@/lib/storage';
import { decryptToken } from './auth';
export function vercelReady() {
  return Boolean(process.env.VERCEL_CLIENT_ID && process.env.VERCEL_CLIENT_SECRET && process.env.VERCEL_INTEGRATION_SLUG && process.env.AUTH_SECRET);
}
export async function vercelApi(installation: Installation, path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://api.vercel.com${path}`);
  if (installation.teamId) url.searchParams.set('teamId', installation.teamId);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${decryptToken(installation.accessToken)}` }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Vercel could not return this project. Check the integration permissions or reconnect.');
  return response.json();
}
