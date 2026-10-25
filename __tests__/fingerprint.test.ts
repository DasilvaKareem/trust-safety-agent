/**
 * Tests for fingerprinting and SimHash
 */

import {
  computeContentHash,
  computeSimHash,
  hammingDistance,
  areSimilar,
  generateClusterId
} from '../lib/fingerprint';

describe('Fingerprinting', () => {
  describe('computeContentHash', () => {
    it('should produce consistent SHA-256 hashes', () => {
      const content = 'Hello, world!';
      const hash1 = computeContentHash(content);
      const hash2 = computeContentHash(content);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex length
    });

    it('should produce different hashes for different content', () => {
      const hash1 = computeContentHash('Content A');
      const hash2 = computeContentHash('Content B');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('computeSimHash', () => {
    it('should produce consistent SimHashes', () => {
      const content = 'The quick brown fox jumps over the lazy dog';
      const hash1 = computeSimHash(content);
      const hash2 = computeSimHash(content);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(16); // 64 bits = 16 hex chars
    });

    it('should produce similar hashes for similar content', () => {
      const content1 = 'The quick brown fox jumps over the lazy dog';
      const content2 = 'The quick brown fox jumps over a lazy dog';
      
      const hash1 = computeSimHash(content1);
      const hash2 = computeSimHash(content2);
      
      const distance = hammingDistance(hash1, hash2);
      expect(distance).toBeLessThan(10); // Should be fairly similar
    });

    it('should produce different hashes for very different content', () => {
      const content1 = 'The quick brown fox jumps over the lazy dog';
      const content2 = 'Completely different text about banking services';
      
      const hash1 = computeSimHash(content1);
      const hash2 = computeSimHash(content2);
      
      const distance = hammingDistance(hash1, hash2);
      expect(distance).toBeGreaterThan(8); // Should be fairly different
    });

    it('should handle HTML content by stripping tags', () => {
      const html1 = '<html><body><h1>PayPal</h1><p>Login</p></body></html>';
      const html2 = '<div><h2>PayPal</h2><span>Login</span></div>';
      
      const hash1 = computeSimHash(html1);
      const hash2 = computeSimHash(html2);
      
      const distance = hammingDistance(hash1, hash2);
      expect(distance).toBeLessThan(10); // Same words, different HTML
    });

    it('should return zero hash for empty content', () => {
      const hash = computeSimHash('');
      expect(hash).toBe('0000000000000000');
    });
  });

  describe('hammingDistance', () => {
    it('should return 0 for identical hashes', () => {
      const hash = 'a1b2c3d4e5f67890';
      expect(hammingDistance(hash, hash)).toBe(0);
    });

    it('should compute correct Hamming distance', () => {
      // 0000 vs 0001 = 1 bit different
      expect(hammingDistance('0000000000000000', '0000000000000001')).toBe(1);
      
      // 0000 vs 000f = 4 bits different (f = 1111 in binary)
      expect(hammingDistance('0000000000000000', '000000000000000f')).toBe(4);
    });

    it('should throw for hashes of different lengths', () => {
      expect(() => hammingDistance('abc', 'abcd')).toThrow();
    });
  });

  describe('areSimilar', () => {
    it('should return true for hashes within threshold', () => {
      const hash1 = computeSimHash('PayPal login form password');
      const hash2 = computeSimHash('PayPal login form passwd');
      
      expect(areSimilar(hash1, hash2, 6)).toBe(true);
    });

    it('should return false for hashes outside threshold', () => {
      const hash1 = computeSimHash('PayPal login');
      const hash2 = computeSimHash('Amazon shopping cart');
      
      expect(areSimilar(hash1, hash2, 6)).toBe(false);
    });
  });

  describe('generateClusterId', () => {
    it('should generate consistent cluster IDs', () => {
      const simHash = 'a1b2c3d4e5f67890';
      const id1 = generateClusterId(simHash);
      const id2 = generateClusterId(simHash);
      
      expect(id1).toBe(id2);
      expect(id1).toContain('cluster-');
    });

    it('should include part of the SimHash', () => {
      const simHash = 'a1b2c3d4e5f67890';
      const clusterId = generateClusterId(simHash);
      
      expect(clusterId).toContain('a1b2c3d4e5f67890'.substring(0, 16));
    });
  });
});
