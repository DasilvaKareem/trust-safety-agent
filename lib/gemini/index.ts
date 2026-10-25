/**
 * Gemini multi-policy Trust & Safety analysis for phishing, scams, hate & harassment, and violent extremism
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, Output, jsonSchema } from 'ai';

export const CONTENT_CATEGORIES = [
  'phishing',
  'scam',
  'hate_harassment',
  'violent_extremism',
  'benign',
] as const;

export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

export interface GeminiAnalysis {
  score: number; // 0-1: likelihood this page is abusive under ANY policy below
  category: ContentCategory;
  impersonatedBrand?: string;
  reasons: string[];
}

export const ANALYSIS_PROMPT = `You are a Trust & Safety analyst evaluating webpages deployed by users of a cloud hosting and AI-builder platform.

Analyze the provided webpage content and screenshot (if available) under our multi-policy Trust & Safety rules to determine if the page is abusive under ANY policy below:

1. phishing:
   - Brand impersonation (visual or textual similarity to known brands on an unrelated or typosquat domain)
   - Credential, payment card, SSN, or crypto seed-phrase / private-key harvesting
   - Urgency or account-threat language ("account suspended", "verify now", "unpaid fee")
   - Mismatch between branding and domain, or off-site form submission
   - A legitimate banking site scores 0. A PayPal clone on "paypa1.com" scores 0.9+.

2. scam:
   - Fake giveaways, investment or crypto-doubling schemes, fake e-commerce stores, advance-fee fraud, or tech-support scams (even without a login form).

3. hate_harassment:
   - Content that attacks, dehumanizes, or incites hatred, exclusion, or discrimination against people based on protected attributes (religion, ethnicity, race, national origin, sexual orientation, gender identity, disability, etc.).
   - Examples: antisemitic conspiracy claims (e.g. claiming Jews secretly control or poison banks, media, or society), calling a protected group vermin, parasites, rats, subhuman, or a disease, calls for exclusion or expulsion, or targeted harassment and doxxing of individuals.

4. violent_extremism:
   - Glorification, recruitment, or support for violent extremist groups or ideologies.
   - Examples: praise or "sainthood" of mass shooters or terror attacks, extremist manifestos, calls to violence, "race war" militia recruitment, or instructions for attacks.

5. MUST NOT FLAG (score <= 0.1, category "benign"):
   - News reporting on hate crimes, terrorism, or extremism
   - History and educational material (e.g. Holocaust museum exhibits, history of the KKK)
   - Counter-speech, debunking, and anti-hate advocacy
   - Academic research on radicalisation or extremism
   - Trust & Safety policy, moderation, or community guidelines documentation
   - Fiction, art, or film/book reviews that discuss hate or extremism without endorsing it
   - Quoting hateful or extremist content in order to condemn, debunk, or explain it
   The decisive test is whether the page ENDORSES or PROMOTES hate, harassment, scams, phishing, or violence—NOT whether it merely mentions, quotes, or educates about those topics.

Return a JSON object with:
- score: A number from 0 to 1 indicating the likelihood this page is abusive under ANY policy above (0 = clearly benign, 1 = severely abusive)
- category: The single most severe applicable category ("phishing", "scam", "hate_harassment", "violent_extremism", or "benign" if nothing applies)
- impersonatedBrand: The brand being impersonated (ONLY for phishing or scam), or empty string if none
- reasons: Array of specific indicators that led to your assessment`;

export type ThinkingLevel = 'low' | 'medium' | 'high';

/** Tier 2 (deep) model: Gemini 4 Argon. Override with GEMINI_DEEP_MODEL (GEMINI_MODEL kept as an alias). */
export const DEFAULT_DEEP_MODEL = 'gemini-4-argon';
/**
 * Tier 1 (fast) model: Gemini 3.8 Flash. "Gemini 3.8 Flash Cyber" is only listed on
 * Google Cloud's Agent Platform (Vertex), not in the Gemini Developer API model list,
 * so the AI Studio key uses gemini-3.8-flash. Override with GEMINI_FAST_MODEL.
 */
export const DEFAULT_FAST_MODEL = 'gemini-3.8-flash';

export function getDeepModelId(): string {
  return process.env.GEMINI_DEEP_MODEL || process.env.GEMINI_MODEL || DEFAULT_DEEP_MODEL;
}
export function getFastModelId(): string {
  return process.env.GEMINI_FAST_MODEL || DEFAULT_FAST_MODEL;
}
/** @deprecated use getDeepModelId */
export const getGeminiModelId = getDeepModelId;

function parseLevel(v: string | undefined, fallback: ThinkingLevel): ThinkingLevel {
  return v === 'low' || v === 'medium' || v === 'high' ? v : fallback;
}

/**
 * Heavy thinking for the deep tier: thinkingLevel 'high' is the maximum reasoning
 * level the Gemini API exposes for Gemini 3+/4 models. Override with GEMINI_DEEP_THINKING_LEVEL.
 */
export function getDeepThinkingLevel(): ThinkingLevel {
  return parseLevel(process.env.GEMINI_DEEP_THINKING_LEVEL ?? process.env.GEMINI_THINKING_LEVEL, 'high');
}
/** Fast tier runs on every deploy, so it defaults to 'low'. Override with GEMINI_FAST_THINKING_LEVEL. */
export function getFastThinkingLevel(): ThinkingLevel {
  return parseLevel(process.env.GEMINI_FAST_THINKING_LEVEL, 'low');
}
export const getThinkingLevel = getDeepThinkingLevel;

/** Escalate to the deep tier when the fast score is >= this (default 0.4) */
export function getEscalationThreshold(): number {
  const n = Number(process.env.GEMINI_ESCALATION_THRESHOLD);
  return Number.isFinite(n) && n > 0 ? n : 0.4;
}

export interface GeminiUsage {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
}

export interface GeminiAnalysisDetailed extends GeminiAnalysis {
  model: string;
  thinkingLevel: string;
  latencyMs: number;
  usage?: GeminiUsage;
  /** true when the result is a fallback (no key or API error), not a model verdict */
  fallback?: boolean;
}

const analysisSchema = jsonSchema<{
  score: number;
  category: ContentCategory;
  impersonatedBrand?: string | null;
  reasons: string[];
}>({
  type: 'object',
  properties: {
    score: { type: 'number', description: 'Likelihood this page is abusive under any policy from 0 to 1' },
    category: {
      type: 'string',
      enum: [...CONTENT_CATEGORIES],
      description: 'Single most severe applicable policy category, or benign if none apply',
    },
    impersonatedBrand: { type: 'string', description: 'The brand being impersonated (only for phishing/scam), or empty string if none' },
    reasons: { type: 'array', items: { type: 'string' }, description: 'Specific indicators that led to the assessment' },
  },
  required: ['score', 'category', 'reasons'],
});

export function normalizeAnalysis(raw: {
  score?: unknown;
  category?: unknown;
  impersonatedBrand?: unknown;
  reasons?: unknown;
} | null | undefined): GeminiAnalysis {
  const numScore = Number(raw?.score);
  const score = Number.isFinite(numScore) ? Math.max(0, Math.min(1, numScore)) : 0;
  const rawCategory = typeof raw?.category === 'string' ? raw.category : '';
  const category: ContentCategory = (CONTENT_CATEGORIES as readonly string[]).includes(rawCategory)
    ? (rawCategory as ContentCategory)
    : score >= 0.3
      ? 'phishing'
      : 'benign';
  const rawBrand = typeof raw?.impersonatedBrand === 'string' ? raw.impersonatedBrand.trim() : '';
  const impersonatedBrand = rawBrand ? rawBrand : undefined;
  const reasons = Array.isArray(raw?.reasons) ? raw.reasons.map(String) : [];

  return {
    score,
    category,
    impersonatedBrand,
    reasons,
  };
}

/**
 * Analyze content with Gemini (Argon, heavy thinking)
 */
export async function analyzeWithGemini(
  html: string,
  screenshotBase64?: string,
  url?: string,
  opts: { model?: string; thinkingLevel?: ThinkingLevel } = {}
): Promise<GeminiAnalysisDetailed> {
  const modelId = opts.model ?? getDeepModelId();
  const thinkingLevel = opts.thinkingLevel ?? getDeepThinkingLevel();
  const started = Date.now();
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('[Gemini] No API key found, returning mock analysis');
    return {
      score: 0,
      category: 'benign',
      reasons: ['Gemini analysis skipped (no API key)'],
      model: modelId,
      thinkingLevel,
      latencyMs: 0,
      fallback: true,
    };
  }

  try {
    const google = createGoogleGenerativeAI({ apiKey });
    const model = google(modelId);

    const parts: any[] = [
      { type: 'text', text: ANALYSIS_PROMPT },
      { type: 'text', text: `\n\nDeployment URL: ${url ?? 'unknown'}\n\nHTML Content:\n${html.substring(0, 8000)}` },
    ];
    if (screenshotBase64) {
      parts.push({ type: 'image', image: screenshotBase64 });
    }

    const result = await generateText({
      model,
      abortSignal: AbortSignal.timeout(35_000),
      maxRetries: 0,
      output: Output.object({ schema: analysisSchema }),
      messages: [{ role: 'user', content: parts }],
      providerOptions: {
        google: {
          thinkingConfig: { thinkingLevel },
        },
      },
    });

    const normalized = normalizeAnalysis(result.output);
    const u: any = result.usage ?? {};
    return {
      ...normalized,
      model: modelId,
      thinkingLevel,
      latencyMs: Date.now() - started,
      usage: {
        inputTokens: u.inputTokens ?? 0,
        outputTokens: u.outputTokens ?? 0,
        reasoningTokens: u.reasoningTokens ?? u.outputTokenDetails?.reasoningTokens ?? 0,
      },
    };
  } catch (error) {
    console.error('[Gemini] Analysis failed:', error);
    return {
      score: 0,
      category: 'benign',
      reasons: [`Gemini analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      model: modelId,
      thinkingLevel,
      latencyMs: Date.now() - started,
      fallback: true,
    };
  }
}

export interface TieredScanResult {
  /** final verdict: deep result if escalated, otherwise fast */
  final: GeminiAnalysisDetailed;
  fast: GeminiAnalysisDetailed;
  deep?: GeminiAnalysisDetailed;
  escalated: boolean;
  escalationReason?: string;
  totalLatencyMs: number;
}

/**
 * Which tier produced the final verdict:
 * - 'argon' when escalated and deep is not fallback
 * - 'flash' when model verdict comes from fast
 * - 'rules' when no model verdict is available (fallback or no tiered scan)
 */
export function decidedBy(tiered?: TieredScanResult): 'rules' | 'flash' | 'argon' {
  if (!tiered || tiered.final.fallback) return 'rules';
  if (tiered.escalated && tiered.deep && !tiered.deep.fallback) return 'argon';
  return 'flash';
}

/**
 * Two-tier scan.
 * Tier 1 (every deploy): fast Flash model.
 * Tier 2: Argon with heavy thinking, only if the fast score is borderline/high
 * (>= GEMINI_ESCALATION_THRESHOLD, default 0.4), the rules flagged it, or tier 1 failed.
 */
/** Why a tier-1 result should escalate to the deep tier, or undefined to stop at tier 1. */
export function escalationReasonFor(fast: GeminiAnalysisDetailed, rulesScore = 0): string | undefined {
  const threshold = getEscalationThreshold();
  if (fast.fallback && !fast.reasons[0]?.includes('no API key')) return 'fast tier failed';
  if (!fast.fallback && fast.score >= threshold) return `fast score ${fast.score.toFixed(2)} >= ${threshold}`;
  if (rulesScore >= 0.3) return `rules score ${rulesScore.toFixed(2)} >= 0.30`;
  return undefined;
}

/** Combine tier results the same way scanTiered does (used by the eve durable workflow). */
export function combineTiers(
  fast: GeminiAnalysisDetailed,
  deep: GeminiAnalysisDetailed | undefined,
  escalationReason: string | undefined,
  totalLatencyMs: number
): TieredScanResult {
  if (!deep) return { final: fast, fast, escalated: false, totalLatencyMs };
  return {
    final: deep.fallback && !fast.fallback ? fast : deep,
    fast,
    deep,
    escalated: true,
    escalationReason,
    totalLatencyMs,
  };
}

export async function scanTiered(
  html: string,
  url: string,
  rulesScore = 0,
  screenshotBase64?: string
): Promise<TieredScanResult> {
  const started = Date.now();
  const fast = await analyzeWithGemini(html, screenshotBase64, url, {
    model: getFastModelId(),
    thinkingLevel: getFastThinkingLevel(),
  });
  const escalationReason = escalationReasonFor(fast, rulesScore);

  if (!escalationReason) {
    return { final: fast, fast, escalated: false, totalLatencyMs: Date.now() - started };
  }
  const deep = await analyzeWithGemini(html, screenshotBase64, url, {
    model: getDeepModelId(),
    thinkingLevel: getDeepThinkingLevel(),
  });
  return combineTiers(fast, deep, escalationReason, Date.now() - started);
}

/**
 * Final risk score for a deploy. Rules are a cheap, noisy first pass, so once the
 * deep tier has run its verdict decides (rules only decide whether to escalate).
 * Without escalation, the higher of rules and Flash wins (both are low by construction).
 * If no model verdict is available, fall back to the rules score.
 */
export function effectiveScore(rulesScore: number, tiered?: TieredScanResult): number {
  if (!tiered || tiered.final.fallback) return rulesScore;
  return tiered.escalated && tiered.deep && !tiered.deep.fallback
    ? tiered.deep.score
    : Math.max(rulesScore, tiered.final.score);
}

/**
 * Fetch HTML from a URL
 */
export async function fetchPageHTML(url: string): Promise<string> {
  const { readPublicPage } = await import('../account/public-page');
  return readPublicPage(url);
}

/**
 * Take a screenshot of a URL (placeholder - would use Playwright/screenshot service)
 * For MVP, we'll just return undefined and rely on HTML analysis
 */
export async function takeScreenshot(url: string): Promise<string | undefined> {
  // TODO: Implement screenshot capture with Playwright or screenshot service
  // For now, return undefined to keep the pipeline functional
  console.log(`[Screenshot] Skipping screenshot for ${url} (not implemented)`);
  return undefined;
}
