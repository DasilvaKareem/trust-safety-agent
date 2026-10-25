/**
 * Deployment scan pipeline, split into steps so it can run either inline (webhook fallback)
 * or as a durable eve workflow (agent/tools/deep_scan.ts), where each step is a retryable
 * "use step" boundary: fetch -> rules -> Gemini 3.8 Flash -> (escalate) Gemini 4 Argon -> persist.
 */
import { storage, type Deployment } from '@/lib/storage';
import { computeRulesScore, determineStatus, type RulesResult } from '@/lib/rules';
import {
  analyzeWithGemini,
  combineTiers,
  decidedBy,
  effectiveScore,
  escalationReasonFor,
  getDeepModelId,
  getDeepThinkingLevel,
  getFastModelId,
  getFastThinkingLevel,
  type ContentCategory,
  type GeminiAnalysisDetailed,
  type TieredScanResult,
} from '@/lib/gemini';
import { computeContentHash, computeSimHash, generateClusterId, areSimilar } from '@/lib/fingerprint';

export interface ScanJob {
  deploymentId: string;
  url: string;
  projectId?: string;
  teamId?: string;
  userId?: string;
  createdAt?: number;
  gitSource?: boolean;
  accountAgeDays?: number;
  projectAgeDays?: number;
}

const MAX_HTML_BYTES = 200_000;

/** Build a ScanJob from a Vercel `deployment.succeeded` / `deployment.ready` payload. */
export function jobFromWebhookPayload(payload: any): ScanJob {
  const { deployment = {}, project, team, user } = payload || {};
  const day = 24 * 60 * 60 * 1000;
  const raw = String(deployment.url || '');
  return {
    deploymentId: String(deployment.id || ''),
    url: raw.startsWith('http') ? raw : `https://${raw}`,
    projectId: project?.id,
    teamId: team?.id,
    userId: user?.id,
    createdAt: deployment.createdAt,
    gitSource: !!deployment.meta?.githubCommitSha,
    accountAgeDays: team?.createdAt ? Math.floor((Date.now() - team.createdAt) / day) : undefined,
    projectAgeDays: project?.createdAt ? Math.floor((Date.now() - project.createdAt) / day) : undefined,
  };
}

export async function fetchDeploymentHtml(url: string): Promise<string> {
  const { readPublicPage } = await import('../account/public-page');
  return (await readPublicPage(url)).slice(0, MAX_HTML_BYTES);
}

export function runRules(html: string, job: ScanJob): RulesResult {
  return computeRulesScore(html, job.url, {
    gitSource: job.gitSource,
    accountAge: job.accountAgeDays,
    projectAge: job.projectAgeDays,
  });
}

export function runFlash(html: string, url: string): Promise<GeminiAnalysisDetailed> {
  return analyzeWithGemini(html, undefined, url, { model: getFastModelId(), thinkingLevel: getFastThinkingLevel() });
}

export function runArgon(html: string, url: string): Promise<GeminiAnalysisDetailed> {
  return analyzeWithGemini(html, undefined, url, { model: getDeepModelId(), thinkingLevel: getDeepThinkingLevel() });
}

export { escalationReasonFor, combineTiers };

async function assignCluster(deploymentId: string, simHash: string): Promise<string> {
  const exact = await storage.getClusterBySimHash(simHash);
  const similar = exact ?? (await storage.getAllClusters()).find(c => areSimilar(simHash, c.simHash));
  if (similar) {
    if (!similar.deploymentIds.includes(deploymentId)) {
      similar.deploymentIds.push(deploymentId);
      similar.count += 1;
    }
    similar.lastSeen = Date.now();
    await storage.saveCluster(similar);
    return similar.id;
  }
  const id = generateClusterId(simHash);
  await storage.saveCluster({ id, simHash, deploymentIds: [deploymentId], firstSeen: Date.now(), lastSeen: Date.now(), count: 1 });
  return id;
}

/** Fingerprint, cluster and save the verdict. Returns the stored record. */
export async function persistScan(
  job: ScanJob,
  html: string,
  rules: RulesResult,
  tiered: TieredScanResult | undefined
): Promise<Deployment> {
  const modelVerdict = tiered && !tiered.final.fallback ? tiered.final : undefined;
  const simHash = html ? computeSimHash(html) : undefined;
  const clusterId = simHash ? await assignCluster(job.deploymentId, simHash) : undefined;
  const installation = (await storage.getAllInstallations()).find(
    inst => (job.teamId && inst.teamId === job.teamId) || (job.userId && inst.userId === job.userId)
  );
  const previous = await storage.getDeployment(job.deploymentId);
  const record: Deployment = {
    ...(previous?.ownerId ? { ownerId: previous.ownerId, siteId: previous.siteId } : installation?.ownerId ? { ownerId: installation.ownerId } : {}),
    id: job.deploymentId,
    installationId: installation?.id || 'unknown',
    projectId: job.projectId || 'unknown',
    url: job.url,
    deploymentUrl: job.url.replace(/^https?:\/\//, ''),
    createdAt: job.createdAt || Date.now(),
    rulesScore: rules.score,
    rulesReasons: rules.reasons,
    geminiScore: modelVerdict?.score,
    geminiReasons: modelVerdict
      ? [`[${modelVerdict.model}${tiered?.escalated ? ', escalated' : ''}]`, ...modelVerdict.reasons]
      : undefined,
    geminiImpersonatedBrand: modelVerdict?.impersonatedBrand,
    category: modelVerdict?.category ?? rules.categoryHint,
    status: determineStatus(effectiveScore(rules.score, tiered)),
    contentHash: html ? computeContentHash(html) : undefined,
    simHash,
    clusterId,
  };
  await storage.saveDeployment(record);
  return record;
}

export interface ScanSummary {
  deploymentId: string;
  url: string;
  status: Deployment['status'];
  category?: ContentCategory;
  decidedBy: 'rules' | 'flash' | 'argon';
  rulesScore: number;
  fast?: { model: string; score: number };
  deep?: { model: string; score: number };
  escalationReason?: string;
  impersonatedBrand?: string;
  clusterId?: string;
}

export function summarize(record: Deployment, tiered?: TieredScanResult): ScanSummary {
  return {
    deploymentId: record.id,
    url: record.url,
    status: record.status,
    category: record.category,
    decidedBy: decidedBy(tiered),
    rulesScore: record.rulesScore,
    fast: tiered ? { model: tiered.fast.model, score: tiered.fast.score } : undefined,
    deep: tiered?.deep ? { model: tiered.deep.model, score: tiered.deep.score } : undefined,
    escalationReason: tiered?.escalationReason,
    impersonatedBrand: record.geminiImpersonatedBrand,
    clusterId: record.clusterId,
  };
}

/** Whole pipeline in one call (inline fallback when the eve agent is not reachable). */
export async function scanDeployment(job: ScanJob): Promise<ScanSummary> {
  const started = Date.now();
  const html = await fetchDeploymentHtml(job.url);
  const rules = runRules(html, job);
  let tiered: TieredScanResult | undefined;
  if (html) {
    const fast = await runFlash(html, job.url);
    const reason = escalationReasonFor(fast, rules.score);
    const deep = reason ? await runArgon(html, job.url) : undefined;
    tiered = combineTiers(fast, deep, reason, Date.now() - started);
  }
  const record = await persistScan(job, html, rules, tiered);
  return summarize(record, tiered);
}
