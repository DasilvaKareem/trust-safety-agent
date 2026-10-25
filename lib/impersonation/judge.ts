/**
 * Two-tier Gemini judge for brand impersonation.
 * Tier 1: Gemini 3.8 Flash.
 * Tier 2: Escalate to Gemini 4 Argon when Flash confidence is in [0.35, 0.75]
 *         OR Flash says impersonating with confidence < 0.85.
 * Soft-fails to heuristic verdict on model error or missing API key.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject, jsonSchema } from 'ai';
import {
  getFastModelId,
  getFastThinkingLevel,
  getDeepModelId,
  getDeepThinkingLevel,
  type ThinkingLevel,
} from '@/lib/gemini';
import type { ComparedCandidate, ProtectedPageInfo } from './compare';

export interface JudgeVerdict {
  impersonating: boolean;
  confidence: number;
  reasons: string[];
  impersonatedBrand: string;
  decidedBy: 'heuristic' | 'flash' | 'argon';
}

interface RawJudgeSchema {
  impersonating: boolean;
  confidence: number;
  reasons: string[];
  impersonatedBrand: string;
}

const judgeSchema = jsonSchema<RawJudgeSchema>({
  type: 'object',
  properties: {
    impersonating: {
      type: 'boolean',
      description: 'True if the candidate page is attempting to pass itself off as the protected brand',
    },
    confidence: {
      type: 'number',
      description: 'Confidence from 0 to 1 in the impersonation assessment',
    },
    reasons: {
      type: 'array',
      items: { type: 'string' },
      description: '1 to 4 concise reasons explaining the decision',
    },
    impersonatedBrand: {
      type: 'string',
      description: 'Name of the brand being impersonated, or empty string if not impersonating',
    },
  },
  required: ['impersonating', 'confidence', 'reasons', 'impersonatedBrand'],
});

export function buildJudgePrompt(
  protectedPage: ProtectedPageInfo,
  candidate: ComparedCandidate
): string {
  return `You are a Trust & Safety brand-protection analyst.

The protected brand is "${protectedPage.brand}" at official domain "${protectedPage.domain}" (${protectedPage.url}).
Official page title: "${protectedPage.title || protectedPage.brand}".

Decide if THIS OTHER page at "${candidate.url}" (host "${candidate.host}") is trying to pass itself off as "${protectedPage.brand}" (phishing, typosquatting, credential harvesting, deceptive clone, or brand abuse).

MUST NOT FLAG (set impersonating: false):
- News coverage or journalism mentioning ${protectedPage.brand}
- Product or service reviews, comparisons, or commentary
- Fan pages or community forums that clearly disclose they are unofficial
- Official subsidiaries or legitimate regional domains of ${protectedPage.brand}
- Job boards or career listings mentioning ${protectedPage.brand}
- Wikipedia, archive.org, or encyclopedic references
- Security research writeups, anti-phishing education, or threat intelligence reports

Candidate signals:
- Host: ${candidate.host}
- URL: ${candidate.url}
- Extracted Title: ${candidate.title || '(none)'}
- Extracted Brand Text (H1 / meta): ${candidate.brandText || '(none)'}
- Matching Image Alt/Src: ${candidate.logoMatches.join(', ') || '(none)'}
- SimHash Hamming Distance to Protected Page: ${candidate.simHashDistance ?? 'N/A'}
- Heuristic Score: ${candidate.heuristicScore}

Candidate HTML excerpt:
${candidate.html.slice(0, 6000)}

Return JSON with:
- impersonating: boolean
- confidence: number in [0, 1]
- reasons: 1..4 short strings
- impersonatedBrand: "${protectedPage.brand}" if impersonating, else ""`;
}

export function shouldEscalateJudge(verdict: {
  impersonating: boolean;
  confidence: number;
}): boolean {
  if (verdict.confidence >= 0.35 && verdict.confidence <= 0.75) {
    return true;
  }
  if (verdict.impersonating && verdict.confidence < 0.85) {
    return true;
  }
  return false;
}

function normalizeVerdict(
  raw: Partial<RawJudgeSchema> | null | undefined,
  fallbackBrand: string
): Omit<JudgeVerdict, 'decidedBy'> {
  const impersonating = Boolean(raw?.impersonating);
  const rawConf = Number(raw?.confidence);
  const confidence = Number.isFinite(rawConf) ? Math.max(0, Math.min(1, rawConf)) : 0.5;
  const reasons = Array.isArray(raw?.reasons)
    ? raw.reasons.map(String).filter(Boolean).slice(0, 4)
    : [];
  if (reasons.length === 0) {
    reasons.push(impersonating ? `Detected brand impersonation of ${fallbackBrand}` : 'No brand impersonation detected');
  }
  const impersonatedBrand =
    typeof raw?.impersonatedBrand === 'string' && raw.impersonatedBrand.trim()
      ? raw.impersonatedBrand.trim()
      : impersonating
        ? fallbackBrand
        : '';
  return {
    impersonating,
    confidence,
    reasons,
    impersonatedBrand,
  };
}

function heuristicFallback(
  candidate: ComparedCandidate,
  brand: string
): JudgeVerdict {
  const impersonating = candidate.heuristicScore >= 0.6;
  return {
    impersonating,
    confidence: candidate.heuristicScore,
    reasons:
      candidate.heuristicReasons.length > 0
        ? candidate.heuristicReasons.slice(0, 4)
        : [impersonating ? `Heuristic match for ${brand}` : 'Below heuristic threshold'],
    impersonatedBrand: impersonating ? brand : '',
    decidedBy: 'heuristic',
  };
}

async function callModel(
  prompt: string,
  modelId: string,
  thinkingLevel: ThinkingLevel,
  timeoutMs: number,
  apiKey: string
): Promise<RawJudgeSchema> {
  const google = createGoogleGenerativeAI({ apiKey });
  const model = google(modelId);
  const result = await generateObject({
    model,
    abortSignal: AbortSignal.timeout(Math.max(100, timeoutMs)),
    maxRetries: 0,
    schema: judgeSchema,
    prompt,
    providerOptions: {
      google: {
        thinkingConfig: { thinkingLevel },
      },
    },
  });
  return result.object;
}

export async function judgeCandidate(
  protectedPage: ProtectedPageInfo,
  candidate: ComparedCandidate,
  opts: { timeoutMs?: number } = {}
): Promise<JudgeVerdict> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return heuristicFallback(candidate, protectedPage.brand);
  }

  const timeoutMs = opts.timeoutMs ?? 10_000;
  const prompt = buildJudgePrompt(protectedPage, candidate);

  try {
    const fastRaw = await callModel(
      prompt,
      getFastModelId(),
      getFastThinkingLevel(),
      timeoutMs,
      apiKey
    );
    const fastVerdict = normalizeVerdict(fastRaw, protectedPage.brand);

    if (!shouldEscalateJudge(fastVerdict)) {
      return {
        ...fastVerdict,
        decidedBy: 'flash',
      };
    }

    const deepRaw = await callModel(
      prompt,
      getDeepModelId(),
      getDeepThinkingLevel(),
      timeoutMs,
      apiKey
    );
    const deepVerdict = normalizeVerdict(deepRaw, protectedPage.brand);
    return {
      ...deepVerdict,
      decidedBy: 'argon',
    };
  } catch {
    return heuristicFallback(candidate, protectedPage.brand);
  }
}
