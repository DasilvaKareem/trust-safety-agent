/**
 * Vercel webhook signature verification.
 *
 * Vercel signs every webhook delivery with HMAC-SHA1 over the *raw* request body and
 * sends the lowercase hex digest in the `x-vercel-signature` header:
 *   crypto.createHmac('sha1', secret).update(rawBody).digest('hex')
 * Integration webhooks are signed with the Integration Client Secret; account-level
 * webhooks with the secret Vercel shows once when the webhook is created.
 * https://vercel.com/docs/webhooks/webhooks-api#securing-webhooks
 */
import { createHmac, timingSafeEqual } from 'crypto';

export function signVercelPayload(rawBody: string | Buffer, secret: string): string {
  return createHmac('sha1', secret).update(rawBody).digest('hex');
}

export function verifyVercelSignature(
  rawBody: string | Buffer,
  signature: string | string[] | undefined,
  secret: string
): boolean {
  if (!secret || typeof signature !== 'string' || !/^[0-9a-f]{40}$/i.test(signature)) return false;
  const expected = Buffer.from(signVercelPayload(rawBody, secret), 'hex');
  const given = Buffer.from(signature, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Secret used to verify deliveries: explicit webhook secret, else the integration client secret. */
export function getWebhookSecret(): string | undefined {
  return process.env.VERCEL_INTEGRATION_WEBHOOK_SECRET || process.env.VERCEL_CLIENT_SECRET || undefined;
}

/** Read a Node request stream into a Buffer (route must set bodyParser: false). */
export async function readRawBody(req: AsyncIterable<Buffer | string>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}
