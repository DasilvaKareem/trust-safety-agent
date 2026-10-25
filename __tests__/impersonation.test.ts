/**
 * Unit tests for outward-facing brand impersonation finder
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import type { NextApiRequest, NextApiResponse } from 'next';

const mockLookup = jest.fn<any>();
const mockHttpsRequest = jest.fn<any>();
const mockHttpRequest = jest.fn<any>();
const mockGenerateText = jest.fn<any>();
const mockReadPublicPage = jest.fn<any>();

jest.unstable_mockModule('node:dns/promises', () => ({
  lookup: mockLookup,
}));

jest.unstable_mockModule('node:https', () => ({
  request: mockHttpsRequest,
}));

jest.unstable_mockModule('node:http', () => ({
  request: mockHttpRequest,
}));

jest.unstable_mockModule('ai', () => ({
  generateText: mockGenerateText,
  Output: { object: (opts: unknown) => opts },
  jsonSchema: (s: unknown) => s,
}));

const realPublicPage = await import('@/lib/account/public-page');
jest.unstable_mockModule('@/lib/account/public-page', () => ({
  ...realPublicPage,
  readPublicPage: mockReadPublicPage,
}));

const { permuteDomains } = await import('@/lib/impersonation/permute');
const { resolveCandidates } = await import('@/lib/impersonation/resolve');
const { compareCandidate } = await import('@/lib/impersonation/compare');
const { judgeCandidate } = await import('@/lib/impersonation/judge');
const { findImpersonators } = await import('@/lib/impersonation');
const { default: findHandler } = await import('@/pages/api/impersonation/find');

function makeMockHttpHandler(status: number, body: string) {
  return (_url: unknown, _opts: unknown, callback: (res: any) => void) => {
    const req = new EventEmitter() as any;
    req.end = () => {
      const res = new EventEmitter() as any;
      res.statusCode = status;
      res.headers = {};
      res.resume = () => {};
      res.destroy = () => {};
      callback(res);
      if (body) {
        res.emit('data', Buffer.from(body, 'utf8'));
      }
      res.emit('end');
    };
    return req;
  };
}

function mockApiReqRes(method = 'POST', body: unknown = {}, cookie = '', origin = 'http://localhost:3000') {
  const headers: Record<string, unknown> = {};
  const req = {
    method,
    headers: { cookie, origin, 'x-forwarded-for': '203.0.113.50' },
    body,
    query: {},
    socket: { remoteAddress: '203.0.113.50' },
  } as unknown as NextApiRequest;
  const res: any = {
    statusCode: 200,
    body: null,
    setHeader(k: string, v: unknown) {
      headers[k] = v;
    },
    getHeader(k: string) {
      return headers[k];
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    },
  };
  return { req, res: res as NextApiResponse & { statusCode: number; body: any }, headers };
}

describe('Impersonation finder', () => {
  const prevKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  let fetchSpy: jest.SpiedFunction<typeof globalThis.fetch>;

  beforeEach(() => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    mockLookup.mockReset();
    mockHttpsRequest.mockReset();
    mockHttpRequest.mockReset();
    mockGenerateText.mockReset();
    mockReadPublicPage.mockReset();
    mockReadPublicPage.mockResolvedValue('<html><head><title>Protected Brand</title></head><body>Official site</body></html>');
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  afterAll(() => {
    if (prevKey === undefined) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    else process.env.GOOGLE_GENERATIVE_AI_API_KEY = prevKey;
    if (prevAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevAppUrl;
  });

  it('1. permuteDomains produces expected classes for paypal.com / PayPal, excludes original, respects 40-cap, includes vercel.app and TLD-swap', () => {
    const candidates = permuteDomains({ brand: 'PayPal', domain: 'paypal.com' });

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThanOrEqual(40);
    expect(candidates).not.toContain('paypal.com');
    expect(new Set(candidates).size).toBe(candidates.length);

    // Hyphen insertion
    expect(candidates).toContain('pay-pal.com');
    // TLD swap
    expect(candidates.some(c => c === 'paypal.net' || c === 'paypal.org' || c === 'paypal.co')).toBe(true);
    // *.vercel.app form
    expect(candidates.some(c => c.endsWith('.vercel.app') && c.includes('paypal'))).toBe(true);
    // Adjacent transposition
    expect(candidates.some(c => ['apypal.com', 'pyapal.com', 'papyal.com', 'payapl.com', 'paypla.com'].includes(c))).toBe(true);
    // Homoglyph / char substitution
    expect(candidates.some(c => ['paypa1.com', 'p4ypal.com', 'payp4l.com', 'paypai.com'].includes(c))).toBe(true);
    // Missing or doubled char
    expect(candidates.some(c => ['aypal.com', 'ppaypal.com', 'pypal.com', 'paaypal.com'].includes(c))).toBe(true);
  });

  it('2. resolveCandidates checks DNS and HTTP: public IP 200 is live, private IP is rejected, NXDOMAIN is skipped', async () => {
    mockLookup.mockImplementation(async (host: string) => {
      if (host === 'public-live.example.net') {
        return [{ address: '93.184.216.34', family: 4 }];
      }
      if (host === 'private-ip.example.net') {
        return [{ address: '10.0.0.1', family: 4 }];
      }
      const err: any = new Error('queryA ENOTFOUND nxdomain.example.net');
      err.code = 'ENOTFOUND';
      throw err;
    });

    mockHttpsRequest.mockImplementation(
      makeMockHttpHandler(200, '<html><head><title>PayPal Login Clone</title></head><body>Sign in</body></html>')
    );

    const results = await resolveCandidates([
      'public-live.example.net',
      'private-ip.example.net',
      'nxdomain.example.net',
    ]);

    expect(results).toHaveLength(3);
    const pub = results.find(r => r.host === 'public-live.example.net');
    const priv = results.find(r => r.host === 'private-ip.example.net');
    const nx = results.find(r => r.host === 'nxdomain.example.net');

    expect(pub?.live).toBe(true);
    expect(pub?.httpStatus).toBe(200);
    expect(pub?.resolvedIp).toBe('93.184.216.34');
    expect(pub?.title).toBe('PayPal Login Clone');

    expect(priv?.live).toBe(false);
    expect(priv?.httpStatus).toBeUndefined();

    expect(nx?.live).toBe(false);
    expect(nx?.resolvedIp).toBeUndefined();

    // Only the public IP host should have triggered an HTTPS request
    expect(mockHttpsRequest).toHaveBeenCalledTimes(1);
  });

  it('3. CT soft-fail: when crt.sh returns 500 or throws, ctError is recorded and pipeline still returns', async () => {
    fetchSpy.mockResolvedValue(new Response('Internal Server Error', { status: 500 }));
    mockLookup.mockRejectedValue(new Error('ENOTFOUND'));

    const report500 = await findImpersonators({
      url: 'https://paypal.com',
      brand: 'PayPal',
      html: '<html><head><title>PayPal</title></head><body>Welcome to PayPal</body></html>',
    });

    expect(report500.ctError).toMatch(/500/);
    expect(report500.candidatesGenerated).toBeGreaterThan(0);
    expect(report500.hits).toEqual([]);

    fetchSpy.mockRejectedValue(new Error('crt.sh network timeout'));
    const reportThrow = await findImpersonators({
      url: 'https://paypal.com',
      brand: 'PayPal',
      html: '<html><head><title>PayPal</title></head><body>Welcome to PayPal</body></html>',
    });

    expect(reportThrow.ctError).toMatch(/crt\.sh network timeout/);
    expect(reportThrow.candidatesGenerated).toBeGreaterThan(0);
  });

  it('4. Judge escalation: Flash confidence 0.5 impersonating=true escalates to Argon; Flash 0.95 skips Argon', async () => {
    const protectedPage = {
      url: 'https://paypal.com/',
      domain: 'paypal.com',
      brand: 'PayPal',
      title: 'PayPal',
      html: '<html><head><title>PayPal</title></head><body>PayPal Official</body></html>',
    };
    const candidate = compareCandidate(protectedPage, {
      host: 'paypa1.com',
      url: 'https://paypa1.com/',
      live: true,
      httpStatus: 200,
      title: 'PayPal - Log In',
      html: '<html><head><title>PayPal - Log In</title></head><body><img alt="PayPal"><p>Verify your PayPal account</p></body></html>',
    });

    // Case A: Flash returns confidence 0.5, impersonating=true -> escalates to Argon
    mockGenerateText
      .mockResolvedValueOnce({
        output: {
          impersonating: true,
          confidence: 0.5,
          reasons: ['Suspicious PayPal branding on lookalike domain'],
          impersonatedBrand: 'PayPal',
        },
      })
      .mockResolvedValueOnce({
        output: {
          impersonating: true,
          confidence: 0.92,
          reasons: ['Confirmed typosquat credential harvester targeting PayPal'],
          impersonatedBrand: 'PayPal',
        },
      });

    const escalatedVerdict = await judgeCandidate(protectedPage, candidate);
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
    expect(escalatedVerdict.decidedBy).toBe('argon');
    expect(escalatedVerdict.impersonating).toBe(true);
    expect(escalatedVerdict.confidence).toBe(0.92);

    // Case B: Flash returns confidence 0.95, impersonating=true -> Argon skipped
    mockGenerateText.mockReset();
    mockGenerateText.mockResolvedValueOnce({
      output: {
        impersonating: true,
        confidence: 0.95,
        reasons: ['Clear PayPal phishing clone on paypa1.com'],
        impersonatedBrand: 'PayPal',
      },
    });

    const fastVerdict = await judgeCandidate(protectedPage, candidate);
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    expect(fastVerdict.decidedBy).toBe('flash');
    expect(fastVerdict.impersonating).toBe(true);
    expect(fastVerdict.confidence).toBe(0.95);
  });

  it('5. Endpoint auth: unauthenticated request for unrelated URL -> 401; for app own host -> allowed', async () => {
    // Unauthenticated request for unrelated URL -> 401
    const unauthOther = mockApiReqRes('POST', { url: 'https://unrelated-brand.com' });
    await findHandler(unauthOther.req, unauthOther.res);
    expect(unauthOther.res.statusCode).toBe(401);

    // Unauthenticated request for the app's own production host -> 200 allowed
    mockLookup.mockRejectedValue(new Error('ENOTFOUND'));
    const unauthOwn = mockApiReqRes('POST', {
      url: 'https://trust-safety-agent.vercel.app',
      brand: 'Argon Guard',
    });
    await findHandler(unauthOwn.req, unauthOwn.res);
    expect(unauthOwn.res.statusCode).toBe(200);
    expect(unauthOwn.res.body.protected.domain).toBe('trust-safety-agent.vercel.app');
    expect(unauthOwn.res.body.protected.brand).toBe('Argon Guard');
  });

  it('6. Deadline truncation: with a tiny deadlineMs, report.truncated === true and no throw', async () => {
    mockLookup.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve([{ address: '93.184.216.34', family: 4 }]), 100))
    );

    const report = await findImpersonators({
      url: 'https://paypal.com',
      brand: 'PayPal',
      html: '<html><head><title>PayPal</title></head><body>PayPal</body></html>',
      deadlineMs: 5,
    });

    expect(report.truncated).toBe(true);
    expect(report.protected.domain).toBe('paypal.com');
    expect(Array.isArray(report.hits)).toBe(true);
  });
});
