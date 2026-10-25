/**
 * Gemini vision-based analysis for brand impersonation and credential harvesting
 */

import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';

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

/**
 * Analyze content with Gemini
 */
export async function analyzeWithGemini(
  html: string,
  screenshotBase64?: string
): Promise<GeminiAnalysis> {
  // Check if API key is available
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  
  if (!apiKey) {
    console.warn('[Gemini] No API key found, returning mock analysis');
    return {
      score: 0,
      reasons: ['Gemini analysis skipped (no API key)']
    };
  }

  try {
    // Use Gemini 2.0 Flash for fast multimodal analysis
    const model = google('gemini-2.0-flash-001');

    // Prepare content parts
    const parts: any[] = [
      { type: 'text', text: ANALYSIS_PROMPT },
      { type: 'text', text: `\n\nHTML Content:\n${html.substring(0, 4000)}` } // Limit HTML length
    ];

    // Add screenshot if available
    if (screenshotBase64) {
      parts.push({
        type: 'image',
        image: screenshotBase64
      });
    }

    // Generate structured analysis
    const result = await generateObject({
      model,
      schema: {
        type: 'object' as const,
        properties: {
          score: {
            type: 'number' as const,
            description: 'Phishing likelihood score from 0 to 1'
          },
          impersonatedBrand: {
            type: 'string' as const,
            description: 'The brand being impersonated, if any',
            nullable: true
          },
          reasons: {
            type: 'array' as const,
            items: { type: 'string' as const },
            description: 'Specific indicators that led to the assessment'
          }
        },
        required: ['score', 'reasons']
      } as any, // Type assertion for AI SDK compatibility
      messages: [
        {
          role: 'user',
          content: parts
        }
      ],
      temperature: 0.3,
    });

    const analysis = result.object as { score: number; impersonatedBrand?: string; reasons: string[] };

    return {
      score: Math.max(0, Math.min(1, analysis.score)),
      impersonatedBrand: analysis.impersonatedBrand || undefined,
      reasons: analysis.reasons
    };

  } catch (error) {
    console.error('[Gemini] Analysis failed:', error);
    return {
      score: 0,
      reasons: [`Gemini analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
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
