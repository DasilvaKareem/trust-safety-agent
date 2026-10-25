/**
 * Benchmark: rules vs Gemini Flash vs Gemini 4 Argon vs combined/tiered.
 *
 *   npm run bench                              demo set (synthetic, bench/dataset.ts)
 *   npm run bench -- --dataset phreshphish     real-world PhreshPhish sample (run scripts/prepare_phreshphish.py first)
 *   npm run bench -- --dataset phreshphish --estimate   print a cost estimate, no API calls
 *   npm run bench -- --dataset phreshphish --rules-only  rules only, no API calls
 *   BENCH_LIMIT=10 npm run bench -- ...       first 10 samples of each label
 *
 * Datasets:
 *   demo         SYNTHETIC hand-written phishing kits and benign pages. A pipeline sanity check, not accuracy.
 *   phreshphish  Balanced fixed-seed sample (seed 42, 125 phish + 125 benign) of the PhreshPhish benchmark
 *                split (CC BY 4.0, https://huggingface.co/datasets/phreshphish/phreshphish). Archived HTML only;
 *                nothing fetches a live phishing page.
 *
 * Results go to bench/results.<dataset>.json and bench/results.<dataset>.md; bench/results.md is rebuilt
 * from every per-dataset markdown file present.
 *
 * Every sample gets one rules pass, one Flash call and one Argon call. Combined and
 * tiered configs are computed from those same calls (tiered latency = Flash + Argon
 * when it escalates, Flash only when it doesn't), so every config sees identical verdicts.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
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
const HTML_CHARS_SENT = 8000; // lib/gemini sends html.substring(0, 8000)

const argv = process.argv.slice(2);
const argVal = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const DATASET = argVal('--dataset') || 'demo';
const ESTIMATE_ONLY = argv.includes('--estimate');
const RULES_ONLY = argv.includes('--rules-only');

interface DatasetInfo { name: string; synthetic: boolean; description: string; license: string; source: string; samples: Sample[] }

function loadDataset(name: string): DatasetInfo {
  if (name === 'demo') {
    return {
      name, synthetic: true, samples: SAMPLES,
      description: 'Demo set: synthetic, hand-written phishing kits and benign pages (bench/dataset.ts). Not real-world traffic; a pipeline sanity check, not production accuracy.',
      license: 'project code', source: 'bench/dataset.ts',
    };
  }
  if (name === 'phreshphish') {
    const file = 'bench/data/phreshphish-sample.jsonl';
    if (!existsSync(file)) {
      console.error(`${file} not found. Run: python3 scripts/prepare_phreshphish.py`);
      process.exit(1);
    }
    const manifest = JSON.parse(readFileSync('bench/phreshphish-manifest.json', 'utf8'));
    const samples: Sample[] = readFileSync(file, 'utf8').trim().split('\n').map(l => {
      const r = JSON.parse(l);
      return { id: r.id, label: r.label, category: r.label === 'phishing' ? `target:${r.target ?? 'unknown'}` : 'benign', url: r.url, html: r.html } as Sample;
    });
    return {
      name, synthetic: false, samples,
      description: `PhreshPhish (Dalton et al., arXiv:2507.10854) full-benchmark split, balanced fixed-seed sample: seed ${manifest.seed}, ${manifest.per_label} phish + ${manifest.per_label} benign, drawn from benchmark rows in shards ${manifest.shards.join(', ')} (pool ${manifest.pool.phish} phish / ${manifest.pool.benign} benign). Dataset revision ${manifest.revision.slice(0, 12)}. Real pages collected Sep 8 to Dec 16 2025; archived HTML, no live fetching.`,
      license: 'CC BY 4.0 (anti-phishing research only)', source: 'https://huggingface.co/datasets/phreshphish/phreshphish',
    };
  }
  console.error(`Unknown dataset "${name}". Use demo or phreshphish.`);
  process.exit(1);
}

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
  if (RULES_ONLY) {
    const none = { score: 0, latencyMs: 0, fallback: true, model: 'none' } as unknown as GeminiAnalysisDetailed;
    return { sample: s, rules: { score: r.score, latencyMs: rulesLatency, reasons: r.reasons }, flash: none, argon: none };
  }
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

/** Average precision (step-wise area under the PR curve) and precision at the first threshold with recall >= 0.9. */
function rankMetrics(scored: { score: number; pos: boolean }[]) {
  const P = scored.filter(x => x.pos).length;
  const xs = [...scored].sort((a, b) => b.score - a.score);
  let tp = 0, fp = 0, ap = 0, prevR = 0, pAt90: number | null = null;
  for (let i = 0; i < xs.length; i++) {
    if (xs[i].pos) tp++; else fp++;
    // process ties together: only emit a PR point when the next score differs
    if (i + 1 < xs.length && xs[i + 1].score === xs[i].score) continue;
    const prec = tp / (tp + fp), rec = P ? tp / P : 0;
    ap += (rec - prevR) * prec; prevR = rec;
    if (pAt90 === null && rec >= 0.9) pAt90 = prec;
  }
  return { averagePrecision: ap, precisionAtRecall90: pAt90 };
}

/** Precision a detector with this recall/FPR would get at a different phishing base rate (PhreshPhish paper, App. B.1). */
const precisionAtBaseRate = (recall: number, fpr: number, rate: number) =>
  recall * rate + fpr * (1 - rate) ? (recall * rate) / (recall * rate + fpr * (1 - rate)) : 0;

function evaluate(rows: Row[], fn: (r: Row) => ConfigEval) {
  let tp = 0, fp = 0, tn = 0, fn_ = 0, errors = 0, esc = 0;
  const lat: number[] = [];
  const scored: { score: number; pos: boolean }[] = [];
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
    scored.push({ score: e.score, pos });
    if (pred && pos) tp++; else if (pred && !pos) { fp++; misses.push(`FP ${r.sample.id}`); }
    else if (!pred && pos) { fn_++; misses.push(`FN ${r.sample.id}`); } else tn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn_ ? tp / (tp + fn_) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const falsePositiveRate = fp + tn ? fp / (fp + tn) : 0;
  return {
    tp, fp, tn, fn: fn_, precision, recall, f1,
    falsePositiveRate,
    ...rankMetrics(scored),
    projectedPrecisionAt24pct: precisionAtBaseRate(recall, falsePositiveRate, 0.24),
    projectedPrecisionAt1pct: precisionAtBaseRate(recall, falsePositiveRate, 0.01),
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
  const ds = loadDataset(DATASET);
  const limit = Number(process.env.BENCH_LIMIT || 0);
  const phish = ds.samples.filter(s => s.label === 'phishing');
  const benign = ds.samples.filter(s => s.label === 'benign');
  const set = limit ? [...phish.slice(0, limit), ...benign.slice(0, limit)] : ds.samples;

  // Cost estimate from prompt size. Overheads come from the demo-set run (avg 457 Flash / 743 Argon input tokens
  // for ~730 HTML chars); output tokens are the demo-set averages (120 Flash, 640 Argon incl. thinking).
  const chars = set.reduce((a, s) => a + Math.min(s.html.length, HTML_CHARS_SENT), 0);
  const estIn = (overhead: number) => set.length * overhead + chars / 3.5;
  const fl = PRICING['gemini-3.8-flash'], ar = PRICING['gemini-4-argon'];
  const estFlash = (estIn(250) * fl.input + set.length * 120 * fl.output) / 1e6;
  const estArgon = (estIn(540) * ar.input + set.length * 640 * ar.output) / 1e6;
  console.log(`Dataset ${ds.name}: ${set.length} samples (${set.filter(s => s.label === 'phishing').length} phishing, ${set.filter(s => s.label === 'benign').length} benign), concurrency ${CONCURRENCY}`);
  console.log(`Estimated cost: Flash $${estFlash.toFixed(2)} + Argon $${estArgon.toFixed(2)} = $${(estFlash + estArgon).toFixed(2)} (tiered reuses these calls)`);
  if (ESTIMATE_ONLY) return;
  if (!RULES_ONLY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.GEMINI_API_KEY) {
    console.error('Set GOOGLE_GENERATIVE_AI_API_KEY (or GEMINI_API_KEY) to run the benchmark.');
    process.exit(1);
  }

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

  const configs = RULES_ONLY ? { 'rules-only': CONFIGS['rules-only'] } : CONFIGS;
  const results = Object.fromEntries(Object.entries(configs).map(([k, fn]) => [k, evaluate(rows, fn)]));
  const out = {
    generatedAt: new Date().toISOString(),
    dataset: {
      name: ds.name,
      synthetic: ds.synthetic,
      note: ds.description,
      license: ds.license,
      source: ds.source,
      total: rows.length,
      phishing: rows.filter(r => r.sample.label === 'phishing').length,
      benign: rows.filter(r => r.sample.label === 'benign').length,
    },
    positiveThreshold: POSITIVE_THRESHOLD,
    escalationThreshold: getEscalationThreshold(),
    pricingUsdPer1M: PRICING,
    models: RULES_ONLY ? null : { fast: tokenStats(rows, 'flash'), deep: tokenStats(rows, 'argon') },
    wallClockSec: (Date.now() - started) / 1000,
    results,
    perSample: rows.map(r => ({
      id: r.sample.id, label: r.sample.label, category: r.sample.category, url: defang(r.sample.url),
      rules: +r.rules.score.toFixed(3),
      flash: r.flash.fallback ? null : r.flash.score, flashMs: r.flash.latencyMs,
      argon: r.argon.fallback ? null : r.argon.score, argonMs: r.argon.latencyMs,
      argonBrand: r.argon.impersonatedBrand ?? null,
    })),
  };

  mkdirSync('bench', { recursive: true });
  const suffix = RULES_ONLY ? `${ds.name}.rules` : ds.name;
  writeFileSync(`bench/results.${suffix}.json`, JSON.stringify(out, null, 2) + '\n');

  const f = (x: number) => (x * 100).toFixed(1) + '%';
  const ms = (x: number) => (x < 1 ? x.toFixed(2) : Math.round(x).toString()) + ' ms';
  const usd = (x: number | null) => (x === null ? 'unknown' : '$' + x.toFixed(5));
  const title = ds.synthetic ? `Demo set (synthetic, ${out.dataset.total} samples)` : `Real-world: ${ds.name} (${out.dataset.total} samples)`;
  const tokenRows = out.models ? [out.models.fast, out.models.deep] : [];
  const md = [
    `## ${title}`,
    '',
    `> ${ds.synthetic ? '**Synthetic.** ' : ''}${ds.description}`,
    '',
    `- Source: ${ds.source}`,
    `- License: ${ds.license}`,
    `- Sample: ${out.dataset.total} (${out.dataset.phishing} phishing, ${out.dataset.benign} benign)`,
    `- Run: ${out.generatedAt} (wall clock ${Math.round(out.wallClockSec)} s, concurrency ${CONCURRENCY})`,
    `- Positive = score >= ${POSITIVE_THRESHOLD} (status review or flagged). Tiered escalates to Argon when Flash >= ${out.escalationThreshold} or rules >= 0.3.`,
    out.models ? `- Models: fast \`${out.models.fast.model}\` (thinking ${out.models.fast.thinkingLevel}), deep \`${out.models.deep.model}\` (thinking ${out.models.deep.thinkingLevel}). The models see the URL plus the first ${HTML_CHARS_SENT} HTML characters; rules see the full HTML.` : '- Rules only (no model calls).',
    '',
    '| Config | Precision | Recall | F1 | FPR | AP | P@R=0.9 | Proj. precision @24% base rate | p50 latency | p95 latency | Cost / scan | Cost / 1k scans | Errors |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...Object.entries(results).map(([k, r]) =>
      `| ${k}${r.escalationRate !== undefined ? ` (escalated ${f(r.escalationRate)})` : ''} | ${f(r.precision)} | ${f(r.recall)} | ${r.f1.toFixed(3)} | ${f(r.falsePositiveRate)} | ${r.averagePrecision.toFixed(3)} | ${r.precisionAtRecall90 === null ? 'n/a' : r.precisionAtRecall90.toFixed(3)} | ${f(r.projectedPrecisionAt24pct)} | ${ms(r.latencyMs.p50)} | ${ms(r.latencyMs.p95)} | ${usd(r.costPerScanUsd)} | ${r.costPer1kScansUsd === null ? 'unknown' : '$' + r.costPer1kScansUsd.toFixed(2)} | ${r.modelErrors} |`),
    '',
    'AP and P@R=0.9 rank samples by score (rules and model scores are coarse, so ties are common). "Proj. precision @24%" re-weights this run\'s recall and FPR to the 24% phishing base rate of the PhreshPhish full benchmark (precision formula from the paper, App. B.1).',
    '',
    ...(tokenRows.length ? [
      '### Token usage (per call average)',
      '',
      '| Model | Thinking | Calls | Input | Output (incl. thinking) | Thinking tokens |',
      '|---|---|---|---|---|---|',
      ...tokenRows.map(m => `| ${m.model} | ${m.thinkingLevel} | ${m.calls} | ${m.avgInputTokens} | ${m.avgOutputTokens} | ${m.avgReasoningTokens} |`),
      '',
      `Pricing (USD per 1M tokens): ${Object.entries(PRICING).map(([k, p]) => `${k} $${p.input} in / $${p.output} out (${p.note})`).join('; ')}.`,
      '',
    ] : []),
    '### Misclassified',
    '',
    ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.misclassified.length ? r.misclassified.join(', ') : 'none'}`),
    '',
  ].join('\n');
  writeFileSync(`bench/results.${suffix}.md`, md);
  console.log('\n' + md);
  rebuildIndex();
}

/** bench/results.md = header + every per-dataset section (real-world first, then the demo set). */
/** Results are committed to a public repo: never write a clickable phishing URL. */
function defang(u?: string): string | undefined {
  return u?.replace(/^http/i, 'hxxp').replace(/\./g, '[.]');
}

function rebuildIndex() {
  const parts: string[] = [];
  const header = existsSync('bench/results-header.md') ? readFileSync('bench/results-header.md', 'utf8').trim() : '# Benchmark results';
  for (const name of ['phreshphish', 'demo']) {
    const file = `bench/results.${name}.md`;
    if (existsSync(file)) parts.push(readFileSync(file, 'utf8').trim());
  }
  writeFileSync('bench/results.md', [header, ...parts].join('\n\n') + '\n');
}

main().catch(e => { console.error(e); process.exit(1); });
