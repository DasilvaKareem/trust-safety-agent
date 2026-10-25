/**
 * Tests for webhook signature verification
 */

import { createHmac } from 'crypto';

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  
  return signature === expectedSignature;
}

describe('Webhook Signature Verification', () => {
  const secret = 'test-webhook-secret';

  it('should verify valid signatures', () => {
    const payload = JSON.stringify({ type: 'deployment.succeeded', id: '123' });
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    const signature = hmac.digest('hex');
    
    expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);
  });

  it('should reject invalid signatures', () => {
    const payload = JSON.stringify({ type: 'deployment.succeeded', id: '123' });
    const invalidSignature = 'invalid-signature';
    
    expect(verifyWebhookSignature(payload, invalidSignature, secret)).toBe(false);
  });

  it('should reject signatures with wrong secret', () => {
    const payload = JSON.stringify({ type: 'deployment.succeeded', id: '123' });
    const hmac = createHmac('sha256', 'wrong-secret');
    hmac.update(payload);
    const signature = hmac.digest('hex');
    
    expect(verifyWebhookSignature(payload, signature, secret)).toBe(false);
  });

  it('should reject signatures for modified payloads', () => {
    const originalPayload = JSON.stringify({ type: 'deployment.succeeded', id: '123' });
    const hmac = createHmac('sha256', secret);
    hmac.update(originalPayload);
    const signature = hmac.digest('hex');
    
    const modifiedPayload = JSON.stringify({ type: 'deployment.succeeded', id: '456' });
    expect(verifyWebhookSignature(modifiedPayload, signature, secret)).toBe(false);
  });
});
