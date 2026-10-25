/**
 * Evaluate the production two-tier pipeline (rules + Flash -> Argon) on the synthetic
 * hate & violent extremism dataset (bench/hate-extremism-dataset.ts, n=20).
 *
 *   npx tsx scripts/eval-hate.ts
 *   npx tsx scripts/eval-hate.ts --rules-only
 *
 * Writes bench/results.hate-extremism.{json,md} (or .rules.{json,md} with --rules-only).
 * Does NOT touch bench/results.md or any PhreshPhish file.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { HATE_SAMPLES, type HateSample } from '../bench/hate-extremism-dataset';
import { computeRulesScore } from '../lib/rules';
import {
  analyzeWithGemini,
  combineTiers,
  decidedBy,
  effectiveScore,
  escalationReasonFor,
  getDeepModelId,
  getDeepThinkingLevel,
  getEscalationThreshold,
  getFastModelId,
  getFastThinkingLevel,
  scanTiered,
  type ContentCategory,
  type GeminiAnalysisDetailed,
  type TieredScanResult,
} from '../lib/gemini';

// Same PRICING table as scripts/bench.ts (USD per 1M tokens)
const PRICING: Record<string, { input: number; output: number; note: string }> = {
  'gemini-4-argon': { input: 2.0, output: 10.0, note: 'AI Studio price, through Nov 30 2026' },
  'gemini-3.8-flash': { input: 0.75, output: 3.75, note: 'introductory price, through Dec 31 2026' },
};

const POSITIVE_THRESHOLD = 0.3;
const CONCURRENCY = 3;

const argv = process.argv.slice(2);
const RULES_ONLY = argv.includes('--rules-only');

function cost(a?: GeminiAnalysisDetailed): number | null {
  if (!a || a.fallback || !a.usage) return null;
  const p = PRICING[a.model];
  if (!p) return null;
  return (a.usage.inputTokens * p.input + a.usage.outputTokens * p.output) / 1e6;
}

async function scanTieredWithRetry(
  html: string,
  url: string,
  rulesScore: number
): Promise<TieredScanResult> {
  let last = await scanTiered(html, url, rulesScore);
  for (let attempt = 0; attempt < 2 && last.final.fallback; attempt++) {
    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    const started = Date.now();
    const fast = await analyzeWithGemini(html, undefined, url, {
      model: getFastModelId(),
      thinkingLevel: getFastThinkingLevel(),
    });
    const reason = escalationReasonFor(fast, rulesScore);
    const deep = reason
      ? await analyzeWithGemini(html, undefined, url, {
          model: getDeepModelId(),
          thinkingLevel: getDeepThinkingLevel(),
        })
      : undefined;
    last = combineTiers(fast, deep, reason, Date.now() - started);
  }
  return last;
}

interface SampleEvalRecord {
  id: string;
  label: 'abusive' | 'benign';
  expected: ContentCategory;
  kind: string;
  url: string;
  predictedScore: number;
  predictedPositive: boolean;
  predictedCategory: ContentCategory;
  rulesScore: number;
  rulesCategoryHint?: ContentCategory;
  flash: {
    score: number | null;
    category: ContentCategory | null;
    latencyMs: number;
    fallback: boolean;
  } | null;
  argon: {
    score: number | null;
    category: ContentCategory | null;
    latencyMs: number;
    fallback: boolean;
  } | null;
  escalated: boolean;
  escalationReason?: string;
  decidedBy: 'rules' | 'flash' | 'argon';
  totalLatencyMs: number;
  costUsd: number | null;
}

function pct(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}

async function evaluateSample(sample: HateSample): Promise<SampleEvalRecord> {
  const t0 = performance.now();
  const rules = computeRulesScore(sample.html, sample.url);
  const rulesLatencyMs = performance.now() - t0;

  if (RULES_ONLY) {
    const score = effectiveScore(rules.score, undefined);
    const predictedPositive = score >= POSITIVE_THRESHOLD;
    const predictedCategory: ContentCategory = rules.categoryHint ?? (predictedPositive ? 'phishing' : 'benign');
    const tierDecision = decidedBy(undefined);
    return {
      id: sample.id,
      label: sample.label,
      expected: sample.expected,
      kind: sample.kind,
      url: sample.url,
      predictedScore: score,
      predictedPositive,
      predictedCategory,
      rulesScore: rules.score,
      rulesCategoryHint: rules.categoryHint,
      flash: null,
      argon: null,
      escalated: false,
      decidedBy: tierDecision,
      totalLatencyMs: Math.round(rulesLatencyMs * 100) / 100,
      costUsd: 0,
    };
  }

  const tiered = await scanTieredWithRetry(sample.html, sample.url, rules.score);
  const totalLatencyMs = Math.round(rulesLatencyMs + tiered.totalLatencyMs);
  const score = effectiveScore(rules.score, tiered);
  const predictedPositive = score >= POSITIVE_THRESHOLD;
  const tierDecision = decidedBy(tiered);
  const modelVerdict = !tiered.final.fallback ? tiered.final : undefined;
  const predictedCategory: ContentCategory =
    modelVerdict?.category ?? rules.categoryHint ?? (predictedPositive ? 'phishing' : 'benign');

  const flashCost = cost(tiered.fast);
  const argonCost = tiered.deep ? cost(tiered.deep) : 0;
  const sampleCost =
    flashCost === null || (tiered.deep && argonCost === null)
      ? null
      : flashCost + (argonCost ?? 0);

  const NL = String.fromCharCode(10);
  process.stdout.write(
    `${sample.label === 'abusive' ? 'A' : 'B'} ${sample.id.padEnd(38)} rules=${rules.score.toFixed(2)} ` +
      `flash=${tiered.fast.fallback ? 'ERR ' : `${tiered.fast.score.toFixed(2)}(${tiered.fast.category})`} ` +
      `argon=${!tiered.deep ? 'skip' : tiered.deep.fallback ? 'ERR ' : `${tiered.deep.score.toFixed(2)}(${tiered.deep.category})`} ` +
      `-> ${predictedCategory} (${tierDecision})` + NL
  );

  return {
    id: sample.id,
    label: sample.label,
    expected: sample.expected,
    kind: sample.kind,
    url: sample.url,
    predictedScore: score,
    predictedPositive,
    predictedCategory,
    rulesScore: rules.score,
    rulesCategoryHint: rules.categoryHint,
    flash: {
      score: tiered.fast.fallback ? null : tiered.fast.score,
      category: tiered.fast.fallback ? null : tiered.fast.category,
      latencyMs: tiered.fast.latencyMs,
      fallback: !!tiered.fast.fallback,
    },
    argon: tiered.deep
      ? {
          score: tiered.deep.fallback ? null : tiered.deep.score,
          category: tiered.deep.fallback ? null : tiered.deep.category,
          latencyMs: tiered.deep.latencyMs,
          fallback: !!tiered.deep.fallback,
        }
      : null,
    escalated: tiered.escalated,
    escalationReason: tiered.escalationReason,
    decidedBy: tierDecision,
    totalLatencyMs,
    costUsd: sampleCost,
  };
}

async function main() {
  if (!RULES_ONLY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.GEMINI_API_KEY) {
    console.error('Set GOOGLE_GENERATIVE_AI_API_KEY (or GEMINI_API_KEY) to run eval-hate, or pass --rules-only.');
    process.exit(1);
  }

  const started = Date.now();
  const records: SampleEvalRecord[] = [];
  let idx = 0;

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (idx < HATE_SAMPLES.length) {
        const sample = HATE_SAMPLES[idx++];
        records.push(await evaluateSample(sample));
      }
    })
  );

  records.sort(
    (a, b) => HATE_SAMPLES.findIndex(s => s.id === a.id) - HATE_SAMPLES.findIndex(s => s.id === b.id)
  );

  let tp = 0,
    fp = 0,
    tn = 0,
    fn = 0,
    tpCategoryCorrect = 0,
    escalatedCount = 0;
  const latencies: number[] = [];
  let totalCostUsd = 0;
  let costKnown = true;

  for (const r of records) {
    const isPos = r.label === 'abusive';
    const predPos = r.predictedPositive;
    if (predPos && isPos) {
      tp++;
      if (r.predictedCategory === r.expected) tpCategoryCorrect++;
    } else if (predPos && !isPos) {
      fp++;
    } else if (!predPos && isPos) {
      fn++;
    } else {
      tn++;
    }
    if (r.escalated) escalatedCount++;
    latencies.push(r.totalLatencyMs);
    if (r.costUsd === null) costKnown = false;
    else totalCostUsd += r.costUsd;
  }

  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const falsePositiveRate = fp + tn ? fp / (fp + tn) : 0;
  const accuracy = records.length ? (tp + tn) / records.length : 0;
  const categoryAccuracyOnTruePositives = tp ? tpCategoryCorrect / tp : 0;
  const escalationRate = records.length ? escalatedCount / records.length : 0;
  const latencyMs = {
    p50: pct(latencies, 50),
    p95: pct(latencies, 95),
  };

  const out = {
    generatedAt: new Date().toISOString(),
    mode: RULES_ONLY ? 'rules-only' : 'tiered (rules + flash -> argon)',
    dataset: {
      name: 'hate-extremism',
      synthetic: true,
      caveat:
        'SMALL SYNTHETIC hand-written set (n=20: 10 abusive, 10 tricky benign counter-speech/educational/news). Sanity check for multi-policy hate & violent extremism detection and counter-speech exemptions, not production accuracy.',
      total: records.length,
      abusive: records.filter(r => r.label === 'abusive').length,
      benign: records.filter(r => r.label === 'benign').length,
    },
    models: RULES_ONLY
      ? null
      : {
          fast: { model: getFastModelId(), thinkingLevel: getFastThinkingLevel() },
          deep: { model: getDeepModelId(), thinkingLevel: getDeepThinkingLevel() },
          escalationThreshold: getEscalationThreshold(),
        },
    positiveThreshold: POSITIVE_THRESHOLD,
    pricingUsdPer1M: PRICING,
    wallClockSec: (Date.now() - started) / 1000,
    metrics: {
      tp,
      fp,
      tn,
      fn,
      precision,
      recall,
      falsePositiveRate,
      accuracy,
      categoryAccuracyOnTruePositives,
      escalationRate,
      latencyMs,
      totalCostUsd: costKnown ? totalCostUsd : null,
      costPerScanUsd: costKnown && records.length ? totalCostUsd / records.length : null,
    },
    perSample: records,
  };

  const NL = String.fromCharCode(10);
  const code = (s: string) => String.fromCharCode(96) + s + String.fromCharCode(96);

  mkdirSync('bench', { recursive: true });
  writeFileSync(`bench/results.hate-extremism${RULES_ONLY ? '.rules' : ''}.json`, JSON.stringify(out, null, 2) + NL);

  const f = (x: number) => (x * 100).toFixed(1) + '%';
  const usd = (x: number | null) => (x === null ? 'unknown' : '$' + x.toFixed(5));

  const md = [
    '# Hate & Violent Extremism Evaluation (Synthetic, n=20)',
    '',
    '> **Caveat:** This is a **SMALL SYNTHETIC hand-written set (n=20: 10 abusive, 10 tricky benign)**. It checks that the pipeline catches explicit hate speech, harassment/doxxing, and violent extremism while respecting the counter-speech, journalism, history, and education exemptions. It is a sanity check, not a claim of real-world production accuracy.',
    '',
    `- **Date:** ${out.generatedAt}`,
    `- **Mode:** ${out.mode}`,
    out.models
      ? `- **Models:** Tier 1 ${code(out.models.fast.model)} (thinking ${code(out.models.fast.thinkingLevel)}), Tier 2 ${code(out.models.deep.model)} (thinking ${code(out.models.deep.thinkingLevel)}, escalation threshold ${out.models.escalationThreshold})`
      : '- **Models:** Rules only (no Gemini API calls)',
    `- **Dataset:** ${code('bench/hate-extremism-dataset.ts')} (${out.dataset.total} samples: ${out.dataset.abusive} abusive, ${out.dataset.benign} benign)`,
    `- **Positive threshold:** effective score >= ${POSITIVE_THRESHOLD}`,
    '',
    '## Summary Metrics',
    '',
    '| Precision | Recall | FPR | Accuracy | Category Accuracy (on TP) | Escalation Rate | p50 Latency | p95 Latency | Total Cost | Cost / Scan |',
    '|---|---|---|---|---|---|---|---|---|---|',
    `| ${f(precision)} | ${f(recall)} | ${f(falsePositiveRate)} | ${f(accuracy)} | ${f(categoryAccuracyOnTruePositives)} | ${f(escalationRate)} | ${latencyMs.p50} ms | ${latencyMs.p95} ms | ${usd(out.metrics.totalCostUsd)} | ${usd(out.metrics.costPerScanUsd)} |`,
    '',
    '## Per-Sample Results',
    '',
    '| ID | Label | Expected | Predicted | Rules | Flash | Argon | Decided By | Latency |',
    '|---|---|---|---|---|---|---|---|---|',
    ...records.map(r => {
      const fl = r.flash ? (r.flash.fallback ? 'ERR' : `${r.flash.score?.toFixed(2)} (${r.flash.category})`) : 'n/a';
      const ar = r.argon ? (r.argon.fallback ? 'ERR' : `${r.argon.score?.toFixed(2)} (${r.argon.category})`) : 'skip';
      return `| ${code(r.id)} | ${r.label} | ${code(r.expected)} | ${code(r.predictedCategory)} (${r.predictedScore.toFixed(2)}) | ${r.rulesScore.toFixed(2)} | ${fl} | ${ar} | ${r.decidedBy} | ${r.totalLatencyMs} ms |`;
    }),
    '',
  ].join(NL);

  writeFileSync(`bench/results.hate-extremism${RULES_ONLY ? '.rules' : ''}.md`, md);
  console.log(NL + md);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
