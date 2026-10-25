/**
 * Content fingerprinting and clustering for repeat offender detection
 * Uses exact content hash + SimHash for near-duplicate detection
 */

import { createHash } from 'crypto';

/**
 * Compute exact content hash (SHA-256)
 */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Compute SimHash for near-duplicate detection
 * SimHash produces a fingerprint where similar documents have similar hashes
 */
export function computeSimHash(content: string, bitLength: number = 64): string {
  // Tokenize content into words
  const tokens = content
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ') // Remove HTML tags
    .replace(/[^\w\s]/g, ' ')  // Remove punctuation
    .split(/\s+/)
    .filter(token => token.length > 2);

  if (tokens.length === 0) {
    return '0'.repeat(bitLength / 4); // Return zero hash if no tokens
  }

  // Initialize vector for weighted hash bits
  const vector = new Array(bitLength).fill(0);

  // For each token, compute hash and add to vector
  tokens.forEach(token => {
    const hash = simpleHash(token, bitLength);
    for (let i = 0; i < bitLength; i++) {
      const bit = (hash >> BigInt(i)) & BigInt(1);
      vector[i] += bit === BigInt(1) ? 1 : -1;
    }
  });

  // Generate final SimHash from vector
  let simhash = BigInt(0);
  for (let i = 0; i < bitLength; i++) {
    if (vector[i] > 0) {
      simhash |= BigInt(1) << BigInt(i);
    }
  }

  return simhash.toString(16).padStart(bitLength / 4, '0');
}

/**
 * Simple hash function for SimHash computation
 */
function simpleHash(str: string, bitLength: number): bigint {
  let hash = BigInt(0);
  for (let i = 0; i < str.length; i++) {
    const char = BigInt(str.charCodeAt(i));
    hash = ((hash << BigInt(5)) - hash) + char;
    hash = hash & ((BigInt(1) << BigInt(bitLength)) - BigInt(1)); // Keep within bitLength
  }
  return hash;
}

/**
 * Compute Hamming distance between two SimHashes
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error('SimHashes must be same length');
  }

  const bits1 = BigInt('0x' + hash1);
  const bits2 = BigInt('0x' + hash2);
  let xor = bits1 ^ bits2;
  
  let distance = 0;
  while (xor > 0) {
    distance += Number(xor & BigInt(1));
    xor >>= BigInt(1);
  }
  
  return distance;
}

/**
 * Check if two SimHashes are similar (within threshold)
 * Typical threshold: 3-6 bits for 64-bit hashes
 */
export function areSimilar(hash1: string, hash2: string, threshold: number = 6): boolean {
  return hammingDistance(hash1, hash2) <= threshold;
}

/**
 * Generate cluster ID from SimHash
 */
export function generateClusterId(simHash: string): string {
  // Use first 16 chars of SimHash as cluster ID
  return `cluster-${simHash.substring(0, 16)}`;
}
