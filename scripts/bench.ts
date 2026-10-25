/**
 * Benchmark: rules vs Gemini Flash vs Gemini 4 Argon vs combined/tiered.
 *
 *   npm run bench            (needs GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY)
 *   BENCH_LIMIT=10 npm run bench   (quick run on the first 10 samples of each label)
 *
 * The dataset (bench/dataset.ts) is SYNTHETIC: hand-written phishing kits and benign
 * pages created for this benchmark, not real-world traffic. Treat the numbers as a
 * sanity check of the pipeline, not as production accuracy.
 *
 * Every sample gets one rules pass, one Flash call and one Argon call. Combined and
 * tiered configs are computed from those same calls (tiered latency = Flash + Argon
 * when it escalates, Flash only when it doesn't), so every config sees identical verdicts.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { SAMPLES, type Sample } from '../bench/dataset';
import { computeRulesScore } from '../lib/rules';
import {
  analyzeWithGemini,
  getFastModelId,
  getDeepModelId,
  getFastThinkingLevel,
  getDeepThinkingLevel,
  getEscalationThreshold,
  type GeminiAnalysisDetailed,
} from '../lib/gemini';

// USD per 1M tokens (Gemini Developer API paid tier; output includes thinking tokens)
const PRICING: Record<string, { input: number; output: number; note: string }> = {
  'gemini-4-argon': { input: 2.0, output: 10.0, note: 'AI Studio price, through Nov 30 2026' },
  'gemini-3.8-flash': { input: 0.75, output: 3.75, note: 'introductory price, through Dec 31 2026' },
};

const POSITIVE_THRESHOLD = 0.3; // score >= 0.3 means status "review" or "flagged" (lib/rules determineStatus)
const CONCURRENCY = Number(process.env.BENCH_CONCURRENCY || 4);

interface Row {
  sample: Sample;
  rules: { score: number; latencyMs: number; reasons: string[] };
  flash: GeminiAnalysisDetailed;
  argon: GeminiAnalysisDetailed;
}

function cost(a: GeminiAnalysisDetailed): number | null {
  const p = PRICING[a.model];
  if (!p || !a.usage) return null;
  return (a.usage.inputTokens * p.input + a.usage.outputTokens * p.output) / 1e6;
}

async function withRetry(fn: () => Promise<GeminiAnalysisDetailed>): Promise<GeminiAnalysisDetailed> {
  let last!: GeminiAnalysisDetailed;
  for (let i = 0; i < 3; i++) {
    last = await fn();
    if (!last.fallback) return last;
    await new Promise(r => setTimeout(r, 2000 * (i + 1)));
  }
  return last;
}

async function runSample(s: Sample): Promise<Row> {
  const t0 = performance.now();
  const r = computeRulesScore(s.html, s.url);
  const rulesLatency = performance.now() - t0;
  const [flash, argon] = await Promise.all([
    withRetry(() => analyzeWithGemini(s.html, undefined, s.url, { model: getFastModelId(), thinkingLevel: getFastThinkingLevel() })),
    withRetry(() => analyzeWithGemini(s.html, undefined, s.url, { model: getDeepModelId(), thinkingLevel: getDeepThinkingLevel() })),
  ]);
  process.stdout.write(`${s.label === 'phishing' ? 'P' : 'B'} ${s.id.padEnd(28)} rules=${r.score.toFixed(2)} flash=${flash.fallback ? 'ERR ' : flash.score.toFixed(2)} argon=${argon.fallback ? 'ERR ' : argon.score.toFixed(2)}\n`);
  return { sample: s, rules: { score: r.score, latencyMs: rulesLatency, reasons: r.reasons }, flash, argon };
}

function pct(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}

interface ConfigEval { score: number; latencyMs: number; costUsd: number | null; escalated?: boolean; error?: boolean }

const CONFIGS: Record<string, (r: Row) => ConfigEval> = {
  'rules-only': r => ({ score: r.rules.score, latencyMs: r.rules.latencyMs, costUsd: 0 }),
  'flash-only': r => ({ score: r.flash.score, latencyMs: r.flash.latencyMs, costUsd: cost(r.flash), error: r.flash.fallback }),
  'argon-only': r => ({ score: r.argon.score, latencyMs: r.argon.latencyMs, costUsd: cost(r.argon), error: r.argon.fallback }),
  'rules+argon': r => ({
    score: Math.max(r.rules.score, r.argon.score),
    latencyMs: r.rules.latencyMs + r.argon.latencyMs,
    costUsd: cost(r.argon),
    error: r.argon.fallback,
  }),
  'tiered (rules+flash -> argon)': r => {
    const esc = r.flash.fallback || r.flash.score >= getEscalationThreshold() || r.rules.score >= 0.3;
    const model = esc ? r.argon : r.flash;
    const fc = cost(r.flash), ac = cost(r.argon);
    return {
      // same rule as lib/gemini effectiveScore: Argon decides once escalated
      score: model.fallback ? r.rules.score : esc ? model.score : Math.max(r.rules.score, model.score),
      latencyMs: r.rules.latencyMs + r.flash.latencyMs + (esc ? r.argon.latencyMs : 0),
      costUsd: fc === null || (esc && ac === null) ? null : fc + (esc ? ac! : 0),
      escalated: esc,
      error: model.fallback,
    };
  },
};

function evaluate(rows: Row[], fn: (r: Row) => ConfigEval) {
  let tp = 0, fp = 0, tn = 0, fn_ = 0, errors = 0, esc = 0;
  const lat: number[] = [];
  let costSum = 0, costKnown = true;
  const misses: string[] = [];
  for (const r of rows) {
    const e = fn(r);
    if (e.error) errors++;
    if (e.escalated) esc++;
    lat.push(e.latencyMs);
    if (e.costUsd === null) costKnown = false; else costSum += e.costUsd;
    const pred = e.score >= POSITIVE_THRESHOLD;
    const pos = r.sample.label === 'phishing';
    if (pred && pos) tp++; else if (pred && !pos) { fp++; misses.push(`FP ${r.sample.id}`); }
    else if (!pred && pos) { fn_++; misses.push(`FN ${r.sample.id}`); } else tn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn_ ? tp / (tp + fn_) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return {
    tp, fp, tn, fn: fn_, precision, recall, f1,
    falsePositiveRate: fp + tn ? fp / (fp + tn) : 0,
    accuracy: (tp + tn) / rows.length,
    latencyMs: { p50: pct(lat, 50), p95: pct(lat, 95) },
    costPerScanUsd: costKnown ? costSum / rows.length : null,
    costPer1kScansUsd: costKnown ? (costSum / rows.length) * 1000 : null,
    escalationRate: fn === CONFIGS['tiered (rules+flash -> argon)'] ? esc / rows.length : undefined,
    modelErrors: errors,
    misclassified: misses,
  };
}

function tokenStats(rows: Row[], key: 'flash' | 'argon') {
  const xs = rows.map(r => r[key]).filter(a => a.usage);
  const avg = (f: (a: GeminiAnalysisDetailed) => number) => xs.reduce((s, a) => s + f(a), 0) / (xs.length || 1);
  return {
    model: rows[0]?.[key].model,
    thinkingLevel: rows[0]?.[key].thinkingLevel,
    calls: xs.length,
    avgInputTokens: Math.round(avg(a => a.usage!.inputTokens)),
    avgOutputTokens: Math.round(avg(a => a.usage!.outputTokens)),
    avgReasoningTokens: Math.round(avg(a => a.usage!.reasoningTokens)),
    totalInputTokens: xs.reduce((s, a) => s + a.usage!.inputTokens, 0),
    totalOutputTokens: xs.reduce((s, a) => s + a.usage!.outputTokens, 0),
  };
}

async function main() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.GEMINI_API_KEY) {
    console.error('Set GOOGLE_GENERATIVE_AI_API_KEY (or GEMINI_API_KEY) to run the benchmark.');
    process.exit(1);
  }
  const limit = Number(process.env.BENCH_LIMIT || 0);
  const phish = SAMPLES.filter(s => s.label === 'phishing');
  const benign = SAMPLES.filter(s => s.label === 'benign');
  const set = limit ? [...phish.slice(0, limit), ...benign.slice(0, limit)] : SAMPLES;
  console.log(`Running ${set.length} synthetic samples (${set.filter(s => s.label === 'phishing').length} phishing, ${set.filter(s => s.label === 'benign').length} benign), concurrency ${CONCURRENCY}`);

  const started = Date.now();
  const rows: Row[] = [];
  let i = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (i < set.length) {
      const s = set[i++];
      rows.push(await runSample(s));
    }
  }));
  rows.sort((a, b) => set.indexOf(a.sample) - set.indexOf(b.sample));

  const results = Object.fromEntries(Object.entries(CONFIGS).map(([k, fn]) => [k, evaluate(rows, fn)]));
  const out = {
    generatedAt: new Date().toISOString(),
    dataset: {
      synthetic: true,
      note: 'Synthetic, hand-written samples created for this benchmark (bench/dataset.ts). Not real-world traffic.',
      total: rows.length,
      phishing: rows.filter(r => r.sample.label === 'phishing').length,
      benign: rows.filter(r => r.sample.label === 'benign').length,
    },
    positiveThreshold: POSITIVE_THRESHOLD,
    escalationThreshold: getEscalationThreshold(),
    pricingUsdPer1M: PRICING,
    models: { fast: tokenStats(rows, 'flash'), deep: tokenStats(rows, 'argon') },
    wallClockSec: (Date.now() - started) / 1000,
    results,
    perSample: rows.map(r => ({
      id: r.sample.id, label: r.sample.label, category: r.sample.category, url: r.sample.url,
      rules: +r.rules.score.toFixed(3),
      flash: r.flash.fallback ? null : r.flash.score, flashMs: r.flash.latencyMs,
      argon: r.argon.fallback ? null : r.argon.score, argonMs: r.argon.latencyMs,
      argonBrand: r.argon.impersonatedBrand ?? null,
    })),
  };

  mkdirSync('bench', { recursive: true });
  writeFileSync('bench/results.json', JSON.stringify(out, null, 2) + '\n');

  const f = (x: number) => (x * 100).toFixed(1) + '%';
  const ms = (x: number) => (x < 1 ? x.toFixed(2) : Math.round(x).toString()) + ' ms';
  const usd = (x: number | null) => (x === null ? 'unknown' : '$' + x.toFixed(5));
  const md = [
    '# Benchmark results',
    '',
    `> **Synthetic dataset.** ${out.dataset.total} hand-written samples (${out.dataset.phishing} phishing kits, ${out.dataset.benign} benign pages) created for this benchmark. Not real-world traffic; use it as a pipeline sanity check, not production accuracy.`,
    '',
    `Generated ${out.generatedAt}. Positive = score >= ${POSITIVE_THRESHOLD} (status review or flagged). Tiered escalates to Argon when Flash >= ${out.escalationThreshold} or rules >= 0.3.`,
    `Models: fast \`${out.models.fast.model}\` (thinking ${out.models.fast.thinkingLevel}), deep \`${out.models.deep.model}\` (thinking ${out.models.deep.thinkingLevel}).`,
    '',
    '| Config | Precision | Recall | F1 | FPR | p50 latency | p95 latency | Cost / scan | Cost / 1k scans | Errors |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...Object.entries(results).map(([k, r]) =>
      `| ${k}${r.escalationRate !== undefined ? ` (escalated ${f(r.escalationRate)})` : ''} | ${f(r.precision)} | ${f(r.recall)} | ${r.f1.toFixed(3)} | ${f(r.falsePositiveRate)} | ${ms(r.latencyMs.p50)} | ${ms(r.latencyMs.p95)} | ${usd(r.costPerScanUsd)} | ${r.costPer1kScansUsd === null ? 'unknown' : '$' + r.costPer1kScansUsd.toFixed(2)} | ${r.modelErrors} |`),
    '',
    '## Token usage (per call average)',
    '',
    '| Model | Thinking | Calls | Input | Output (incl. thinking) | Thinking tokens |',
    '|---|---|---|---|---|---|',
    ...[out.models.fast, out.models.deep].map(m => `| ${m.model} | ${m.thinkingLevel} | ${m.calls} | ${m.avgInputTokens} | ${m.avgOutputTokens} | ${m.avgReasoningTokens} |`),
    '',
    `Pricing (USD per 1M tokens): ${Object.entries(PRICING).map(([k, p]) => `${k} $${p.input} in / $${p.output} out (${p.note})`).join('; ')}.`,
    '',
    '## Misclassified',
    '',
    ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.misclassified.length ? r.misclassified.join(', ') : 'none'}`),
    '',
  ].join('\n');
  writeFileSync('bench/results.md', md);
  console.log('\n' + md);
}

main().catch(e => { console.error(e); process.exit(1); });
