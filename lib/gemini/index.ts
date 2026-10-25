/**
 * Gemini vision-based analysis for brand impersonation and credential harvesting
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject, jsonSchema } from 'ai';

export interface GeminiAnalysis {
  score: number; // 0-1
  impersonatedBrand?: string;
  reasons: string[];
}

const ANALYSIS_PROMPT = `You are a Trust & Safety analyst specialized in detecting phishing pages and brand impersonation.

Analyze the provided webpage content and screenshot (if available) to determine if it's attempting to:
1. Impersonate a legitimate brand or service
2. Harvest credentials (usernames, passwords, payment info)
3. Conduct phishing or scam activities

Return a JSON object with:
- score: A number from 0 to 1 indicating phishing likelihood (0 = legitimate, 1 = definitely phishing)
- impersonatedBrand: The brand being impersonated (if any), or null
- reasons: Array of specific indicators that led to your assessment

Consider:
- Visual similarity to known brands
- Presence of login forms or payment inputs
- Urgency language (account suspended, verify now, etc.)
- Mismatch between branding and domain
- Poor quality or inconsistent design
- Requests for sensitive information

Be precise and objective. A legitimate banking site scores 0. A perfect PayPal clone on "paypa1.com" scores 0.9+.`;

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

const analysisSchema = jsonSchema<{ score: number; impersonatedBrand?: string | null; reasons: string[] }>({
  type: 'object',
  properties: {
    score: { type: 'number', description: 'Phishing likelihood score from 0 to 1' },
    impersonatedBrand: { type: 'string', description: 'The brand being impersonated, or empty string if none' },
    reasons: { type: 'array', items: { type: 'string' }, description: 'Specific indicators that led to the assessment' },
  },
  required: ['score', 'reasons'],
});

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

    const result = await generateObject({
      model,
      schema: analysisSchema,
      messages: [{ role: 'user', content: parts }],
      providerOptions: {
        google: {
          thinkingConfig: { thinkingLevel },
        },
      },
    });

    const analysis = result.object;
    const u: any = result.usage ?? {};
    return {
      score: Math.max(0, Math.min(1, Number(analysis.score) || 0)),
      impersonatedBrand: analysis.impersonatedBrand || undefined,
      reasons: analysis.reasons ?? [],
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
 * Two-tier scan.
 * Tier 1 (every deploy): fast Flash model.
 * Tier 2: Argon with heavy thinking, only if the fast score is borderline/high
 * (>= GEMINI_ESCALATION_THRESHOLD, default 0.4), the rules flagged it, or tier 1 failed.
 */
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
  const threshold = getEscalationThreshold();
  let escalationReason: string | undefined;
  if (fast.fallback && !fast.reasons[0]?.includes('no API key')) escalationReason = 'fast tier failed';
  else if (!fast.fallback && fast.score >= threshold) escalationReason = `fast score ${fast.score.toFixed(2)} >= ${threshold}`;
  else if (rulesScore >= 0.3) escalationReason = `rules score ${rulesScore.toFixed(2)} >= 0.30`;

  if (!escalationReason) {
    return { final: fast, fast, escalated: false, totalLatencyMs: Date.now() - started };
  }
  const deep = await analyzeWithGemini(html, screenshotBase64, url, {
    model: getDeepModelId(),
    thinkingLevel: getDeepThinkingLevel(),
  });
  return {
    final: deep.fallback && !fast.fallback ? fast : deep,
    fast,
    deep,
    escalated: true,
    escalationReason,
    totalLatencyMs: Date.now() - started,
  };
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
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TrustSafetyBot/1.0 (Vercel Integration)'
      },
      signal: AbortSignal.timeout(10000) // 10s timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    console.error(`[Fetch] Failed to fetch ${url}:`, error);
    throw error;
  }
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
