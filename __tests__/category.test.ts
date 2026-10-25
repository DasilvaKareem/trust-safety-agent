/**
 * Tests for multi-policy ContentCategory, normalizeAnalysis, decidedBy, and tiered escalation
 */

import { jest } from '@jest/globals';

const mockGenerateText = jest.fn<any>();

jest.unstable_mockModule('ai', () => ({
  generateText: mockGenerateText,
  Output: { object: (opts: unknown) => opts },
  jsonSchema: (s: unknown) => s,
}));

const gemini = await import('../lib/gemini');
const { determineStatus } = await import('../lib/rules');

describe('Multi-policy Gemini category & tiered scan', () => {
  const prevKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  beforeEach(() => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test';
    mockGenerateText.mockReset();
  });

  afterAll(() => {
    if (prevKey === undefined) {
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    } else {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = prevKey;
    }
  });

  it('(a) hate verdict from Flash (score 0.9, hate_harassment) escalates and Argon category is final; decidedBy === argon; status flagged', async () => {
    mockGenerateText
      .mockResolvedValueOnce({
        output: {
          score: 0.9,
          category: 'hate_harassment',
          impersonatedBrand: '',
          reasons: ['Dehumanizing antisemitic conspiracy claims'],
        },
        usage: { inputTokens: 300, outputTokens: 80, reasoningTokens: 20 },
      })
      .mockResolvedValueOnce({
        output: {
          score: 0.95,
          category: 'hate_harassment',
          impersonatedBrand: '',
          reasons: ['Confirmed hate group landing page promoting expulsion'],
        },
        usage: { inputTokens: 350, outputTokens: 200, reasoningTokens: 120 },
      });

    const tiered = await gemini.scanTiered('<html><body>Hate page</body></html>', 'https://northern-covenant.vercel.app', 0.3);

    expect(mockGenerateText).toHaveBeenCalledTimes(2);
    expect(tiered.escalated).toBe(true);
    expect(tiered.final.category).toBe('hate_harassment');
    expect(tiered.final.score).toBe(0.95);
    expect(gemini.decidedBy(tiered)).toBe('argon');

    const status = determineStatus(gemini.effectiveScore(0.3, tiered));
    expect(status).toBe('flagged');

    // Verify the prompt sent to generateText contains the hate policy and counter-speech exemption
    const callArgs = mockGenerateText.mock.calls[0][0] as any;
    const promptText = callArgs.messages[0].content.map((p: any) => p.text || '').join(' ');
    expect(promptText).toContain('hate_harassment');
    expect(promptText).toContain('violent_extremism');
    expect(promptText.toLowerCase()).toContain('counter-speech');
    expect(promptText).toContain('MUST NOT FLAG');
  });

  it('(b) benign counter-speech Flash score 0.05 benign -> no escalation, decidedBy flash, status clean', async () => {
    mockGenerateText.mockResolvedValueOnce({
      output: {
        score: 0.05,
        category: 'benign',
        impersonatedBrand: '',
        reasons: ['Educational counter-speech debunking antisemitic tropes'],
      },
      usage: { inputTokens: 320, outputTokens: 60, reasoningTokens: 10 },
    });

    const tiered = await gemini.scanTiered(
      '<html><body>Understanding and debunking antisemitism</body></html>',
      'https://understanding-antisemitism.vercel.app',
      0
    );

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    expect(tiered.escalated).toBe(false);
    expect(tiered.final.category).toBe('benign');
    expect(tiered.final.score).toBe(0.05);
    expect(gemini.decidedBy(tiered)).toBe('flash');

    const status = determineStatus(gemini.effectiveScore(0, tiered));
    expect(status).toBe('clean');
  });

  it('(c) violent_extremism category passes through', async () => {
    mockGenerateText
      .mockResolvedValueOnce({
        output: {
          score: 0.85,
          category: 'violent_extremism',
          impersonatedBrand: '',
          reasons: ['Extremist militia recruitment for race war'],
        },
      })
      .mockResolvedValueOnce({
        output: {
          score: 0.98,
          category: 'violent_extremism',
          impersonatedBrand: '',
          reasons: ['Calls to armed violence and race war recruitment'],
        },
      });

    const tiered = await gemini.scanTiered('<html><body>Join our militia</body></html>', 'https://militia.example.com', 0.3);

    expect(tiered.escalated).toBe(true);
    expect(tiered.fast.category).toBe('violent_extremism');
    expect(tiered.final.category).toBe('violent_extremism');
    expect(gemini.decidedBy(tiered)).toBe('argon');
  });

  it('(d) invalid or missing category is coerced by normalizeAnalysis', () => {
    const highInvalid = gemini.normalizeAnalysis({
      score: 0.85,
      category: 'unknown_category',
      impersonatedBrand: '',
      reasons: ['Suspicious'],
    });
    expect(highInvalid.category).toBe('phishing');
    expect(highInvalid.impersonatedBrand).toBeUndefined();
    expect(highInvalid.score).toBe(0.85);

    const lowMissing = gemini.normalizeAnalysis({
      score: 0.1,
      category: undefined,
      impersonatedBrand: '   ',
      reasons: ['Clean page'],
    });
    expect(lowMissing.category).toBe('benign');
    expect(lowMissing.impersonatedBrand).toBeUndefined();

    const clamped = gemini.normalizeAnalysis({
      score: 2.5,
      category: 'scam',
      impersonatedBrand: 'PayPal',
      reasons: ['Crypto doubling scam'],
    });
    expect(clamped.score).toBe(1);
    expect(clamped.category).toBe('scam');
    expect(clamped.impersonatedBrand).toBe('PayPal');
  });

  it('(e) fallback has category benign and decidedBy rules', async () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const prevGeminiKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const tiered = await gemini.scanTiered('<html></html>', 'https://example.com', 0);
      expect(tiered.final.fallback).toBe(true);
      expect(tiered.final.category).toBe('benign');
      expect(gemini.decidedBy(tiered)).toBe('rules');
      expect(gemini.decidedBy(undefined)).toBe('rules');
    } finally {
      if (prevGeminiKey !== undefined) {
        process.env.GEMINI_API_KEY = prevGeminiKey;
      }
    }
  });
});
