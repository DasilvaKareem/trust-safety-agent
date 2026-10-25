import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";
import { getSite, runSiteScan } from "../../lib/account/sites";
import {
  combineTiers,
  escalationReasonFor,
  fetchDeploymentHtml,
  persistScan,
  runArgon,
  runFlash,
  runRules,
  summarize,
  type ScanJob,
} from "../../lib/scan/pipeline";
import type { GeminiAnalysisDetailed } from "../../lib/gemini";
import type { RulesResult } from "../../lib/rules";

/**
 * Durable deep scan of one deployment. Each stage is a "use step", so a crash or timeout
 * retries only that stage and recorded results (e.g. a finished Flash call) are replayed:
 *   fetch HTML -> rules -> Gemini 3.8 Flash -> [escalate] Gemini 4 Argon (heavy thinking) -> persist
 */
export default defineWorkflowTool({
  description:
    "Durably scan one Vercel deployment for phishing: fetch, rules, Gemini 3.8 Flash, escalate to Gemini 4 Argon when risky, then store the verdict.",
  inputSchema: z.object({
    deploymentId: z.string().min(1),
    siteId: z.string().optional(),
    url: z.string().url(),
    projectId: z.string().optional(),
    teamId: z.string().optional(),
    userId: z.string().optional(),
    createdAt: z.number().optional(),
    gitSource: z.boolean().optional(),
    accountAgeDays: z.number().optional(),
    projectAgeDays: z.number().optional(),
  }),
  async execute(job) {
    "use workflow";
    if (job.siteId) return await monitoredSiteStep(job.siteId);
    const html = await fetchStep(job.url);
    const rules = await rulesStep(html, job);
    if (!html) {
      return await persistStep(job, html, rules, undefined, undefined, undefined);
    }
    const { fast, reason } = await flashStep(html, job.url, rules.score);
    const deep = reason ? await argonStep(html, job.url) : undefined;
    return await persistStep(job, html, rules, fast, deep, reason);
  },
});

async function fetchStep(url: string) {
  "use step";
  return fetchDeploymentHtml(url);
}

async function rulesStep(html: string, job: ScanJob) {
  "use step";
  return runRules(html, job);
}

async function flashStep(html: string, url: string, rulesScore: number) {
  "use step";
  // Escalation reads GEMINI_ESCALATION_THRESHOLD, so decide inside the step (workflow bodies stay deterministic).
  const fast = await runFlash(html, url);
  return { fast, reason: escalationReasonFor(fast, rulesScore) };
}

async function argonStep(html: string, url: string) {
  "use step";
  return runArgon(html, url);
}

async function persistStep(
  job: ScanJob,
  html: string,
  rules: RulesResult,
  fast: GeminiAnalysisDetailed | undefined,
  deep: GeminiAnalysisDetailed | undefined,
  reason: string | undefined,
) {
  "use step";
  const latency = (fast?.latencyMs ?? 0) + (deep?.latencyMs ?? 0);
  const tiered = fast ? combineTiers(fast, deep, reason, latency) : undefined;
  const record = await persistScan(job, html, rules, tiered);
  return summarize(record, tiered);
}

async function monitoredSiteStep(id: string) {
  "use step";
  const site = await getSite(id);
  if (!site || site.kind !== 'vercel' || !site.monitoring || !site.verifiedAt) throw new Error('Site is not enabled for deployment monitoring');
  const scanned = await runSiteScan(site);
  return { siteId: site.id, status: scanned.lastScan?.status };
}
