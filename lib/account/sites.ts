import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { accountStore } from './store';
import { readPublicPage } from './public-page';
import { computeRulesScore, determineStatus } from '@/lib/rules';
import { scanTiered, effectiveScore } from '@/lib/gemini';
import { computeContentHash, computeSimHash, areSimilar, generateClusterId } from '@/lib/fingerprint';
import { vercelApi } from './vercel';
import { storage, type Deployment } from '@/lib/storage';
export type Site = {
  id: string; ownerId: string; name: string; url: string; kind: 'website' | 'vercel'; createdAt: number;
  verificationToken: string; verifiedAt: number | null; monitoring: boolean;
  installationId: string | null; projectId: string | null;
  lastScan: { id: string; at: number; status: string; score: number; reasons: string[]; modelUsed: boolean } | null;
  scanState: 'idle' | 'fetching' | 'analyzing' | 'complete' | 'error'; error: string | null;
};
export async function getSite(id: string) { return accountStore.get<Site>(`site:${id}`); }
export async function listSites(ownerId: string) {
  const sites = await Promise.all((await accountStore.members(`sites:${ownerId}`)).map(getSite));
  return sites.filter((s): s is Site => Boolean(s && s.ownerId === ownerId)).sort((a, b) => b.createdAt - a.createdAt);
}
export async function saveSite(site: Site) {
  await accountStore.set(`site:${site.id}`, site);
  await accountStore.add(`sites:${site.ownerId}`, site.id);
  await accountStore.add('all-sites', site.id);
}
export async function createSite(ownerId: string, url: string, extra?: { name: string; installationId: string; projectId: string }) {
  const existing = (await listSites(ownerId)).find(s => extra ? s.projectId === extra.projectId && s.installationId === extra.installationId : s.url === url && s.kind === 'website');
  if (existing) return existing;
  if ((await listSites(ownerId)).length >= 10) throw new Error('Your workspace can connect up to 10 sites.');
  const site: Site = { id: randomUUID(), ownerId, name: extra?.name || new URL(url).hostname, url, kind: extra ? 'vercel' : 'website', createdAt: Date.now(), verificationToken: randomBytes(24).toString('hex'), verifiedAt: extra ? Date.now() : null, monitoring: Boolean(extra), installationId: extra?.installationId || null, projectId: extra?.projectId || null, lastScan: null, scanState: 'idle', error: null };
  await saveSite(site); return site;
}
export function verificationUrl(site: Site) { return `${new URL(site.url).origin}/.well-known/trust-safety.txt`; }
export async function verifySite(site: Site) {
  const body = await readPublicPage(verificationUrl(site), { verification: true });
  if (body.trim() !== `trust-safety-verification=${site.verificationToken}`) throw new Error('The file does not match yet. Check the contents and try again.');
  site.verifiedAt = Date.now(); await saveSite(site); return site;
}
export async function runSiteScan(site: Site, scanUrl = site.url) {
  if (!await accountStore.claim(`scan-lock:${site.id}`, 180)) throw new Error('A scan is already running. Please wait a moment.');
  // Refresh before every write so a disconnect or monitoring change cannot be overwritten.
  async function update(values: Partial<Site>) {
    const current = await getSite(site.id); if (!current) throw new Error('Site disconnected.');
    Object.assign(current, values); await saveSite(current); return current;
  }
  try {
    await update({ scanState: 'fetching', error: null });
    if (site.kind === 'vercel') {
      const installation = site.installationId ? await storage.getInstallation(site.installationId) : null;
      if (!installation || installation.ownerId !== site.ownerId || installation.revokedAt) throw new Error('Reconnect Vercel before scanning this project.');
      try { await vercelApi(installation, `/v9/projects/${encodeURIComponent(site.projectId!)}`); }
      catch { await update({ verifiedAt: null, monitoring: false }); throw new Error('Vercel project access could not be confirmed. Reconnect to continue.'); }
    }
    const html = await readPublicPage(scanUrl);
    await update({ scanState: 'analyzing' });
    const rules = computeRulesScore(html, scanUrl);
    const tiers = await scanTiered(html, scanUrl, rules.score);
    const modelUsed = !tiers.final.fallback;
    const score = effectiveScore(rules.score, tiers);
    const status = determineStatus(score);
    const reasons = modelUsed ? tiers.final.reasons : rules.reasons;
    const simHash = computeSimHash(html);
    const previous = (await storage.getOwnerDeployments(site.ownerId)).find(d => d.simHash && d.clusterId && areSimilar(simHash, d.simHash));
    const clusterId = previous?.clusterId || `${createHash('sha256').update(site.ownerId).digest('hex').slice(0, 12)}-${generateClusterId(simHash)}`;
    const record: Deployment = { simHash, clusterId, contentHash: computeContentHash(html), id: `scan-${randomUUID()}`, ownerId: site.ownerId, siteId: site.id, installationId: site.installationId || 'website', projectId: site.projectId || site.id, url: scanUrl, deploymentUrl: scanUrl, createdAt: Date.now(), rulesScore: rules.score, rulesReasons: rules.reasons, ...(modelUsed ? { geminiScore: tiers.final.score, geminiReasons: reasons } : {}), status };
    await storage.saveDeployment(record);
    return await update({ scanState: 'complete', error: null, lastScan: { id: record.id, at: record.createdAt, status, score, reasons, modelUsed } });
  } catch (error) {
    await update({ scanState: 'error', error: error instanceof Error ? error.message : 'The scan could not finish. Please try again.' });
    throw error;
  } finally { await accountStore.remove(`scan-lock:${site.id}`); }
}
