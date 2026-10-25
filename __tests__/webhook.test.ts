/**
 * Webhook signature verification, Vercel format:
 *   x-vercel-signature = hex(HMAC-SHA1(secret, rawBody))
 */
import { createHmac } from 'crypto';
import { Readable } from 'stream';
import { readRawBody, signVercelPayload, verifyVercelSignature } from '@/lib/webhook/signature';
import handler from '@/pages/api/webhooks/vercel';

const secret = 'whsec_test_8f3a1c';
// Raw body exactly as Vercel would send it (note spacing/key order, which JSON.stringify would not preserve)
const rawBody = '{"id":"evt_1","type":"deployment.created",  "createdAt":1761400000000,"payload":{"deployment":{"id":"dpl_abc","url":"demo-abc.vercel.app"}}}';
const realSig = createHmac('sha1', secret).update(rawBody).digest('hex');

describe('verifyVercelSignature (HMAC-SHA1 over raw body)', () => {
  it('produces the same digest as Node crypto HMAC-SHA1', () => {
    expect(signVercelPayload(rawBody, secret)).toBe(realSig);
    expect(realSig).toMatch(/^[0-9a-f]{40}$/);
  });

  it('accepts a body signed with the real secret', () => {
    expect(verifyVercelSignature(rawBody, realSig, secret)).toBe(true);
    expect(verifyVercelSignature(Buffer.from(rawBody), realSig, secret)).toBe(true);
  });

  it('rejects a re-serialized body (why the raw body matters)', () => {
    const reserialized = JSON.stringify(JSON.parse(rawBody));
    expect(reserialized).not.toBe(rawBody);
    expect(verifyVercelSignature(reserialized, realSig, secret)).toBe(false);
  });

  it('rejects tampered bodies, wrong secrets, sha256 digests and missing headers', () => {
    expect(verifyVercelSignature(rawBody.replace('dpl_abc', 'dpl_xyz'), realSig, secret)).toBe(false);
    expect(verifyVercelSignature(rawBody, createHmac('sha1', 'wrong').update(rawBody).digest('hex'), secret)).toBe(false);
    expect(verifyVercelSignature(rawBody, createHmac('sha256', secret).update(rawBody).digest('hex'), secret)).toBe(false);
    expect(verifyVercelSignature(rawBody, undefined, secret)).toBe(false);
    expect(verifyVercelSignature(rawBody, 'not-hex', secret)).toBe(false);
    expect(verifyVercelSignature(rawBody, realSig, '')).toBe(false);
  });

  it('reads a chunked raw body byte-for-byte', async () => {
    const buf = await readRawBody(Readable.from([Buffer.from(rawBody.slice(0, 10)), Buffer.from(rawBody.slice(10))]));
    expect(buf.toString()).toBe(rawBody);
  });
});

function mockReqRes(body: string, headers: Record<string, string>) {
  const req: any = Readable.from([Buffer.from(body)]);
  req.method = 'POST';
  req.headers = headers;
  const res: any = { statusCode: 0, body: undefined };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  return { req, res };
}

describe('POST /api/webhooks/vercel', () => {
  const prev = process.env.VERCEL_INTEGRATION_WEBHOOK_SECRET;
  beforeAll(() => { process.env.VERCEL_INTEGRATION_WEBHOOK_SECRET = secret; });
  afterAll(() => { process.env.VERCEL_INTEGRATION_WEBHOOK_SECRET = prev; });

  it('disables Next body parsing so the raw body can be verified', async () => {
    const mod = await import('@/pages/api/webhooks/vercel');
    expect(mod.config.api.bodyParser).toBe(false);
  });

  it('accepts a correctly signed delivery', async () => {
    const { req, res } = mockReqRes(rawBody, { 'x-vercel-signature': realSig });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true, ignored: 'deployment.created' });
  });

  it('rejects a bad signature with 401', async () => {
    const { req, res } = mockReqRes(rawBody, { 'x-vercel-signature': createHmac('sha1', 'nope').update(rawBody).digest('hex') });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('rejects an unsigned delivery with 401', async () => {
    const { req, res } = mockReqRes(rawBody, {});
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });
});
