/**
 * Compare live candidate pages against the protected site using HTML brand signals,
 * SimHash near-duplicate distance, and hostname edit distance.
 */

import { readPublicPage } from '@/lib/account/public-page';
import { computeSimHash, hammingDistance, areSimilar } from '@/lib/fingerprint';
import { extractApexDomain } from './permute';
import type { ResolvedCandidate } from './resolve';

export const MAX_COMPARED_CANDIDATES = 8;

export interface ProtectedPageInfo {
  url: string;
  domain: string;
  brand: string;
  title?: string;
  html?: string;
  simHash?: string;
}

export interface ComparedCandidate {
  host: string;
  url: string;
  live: boolean;
  httpStatus?: number;
  title?: string;
  html: string;
  brandText?: string;
  logoMatches: string[];
  simHashDistance?: number;
  similar: boolean;
  editDistance: number;
  heuristicScore: number;
  heuristicReasons: string[];
  source: 'permute' | 'ct' | 'both';
}

export function extractPageTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return undefined;
  const text = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 200) : undefined;
}

function extractMetaContent(html: string, attrName: string, attrValue: string): string | undefined {
  const metaRegex = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  const targetAttr = attrName.toLowerCase();
  const targetVal = attrValue.toLowerCase();
  while ((match = metaRegex.exec(html)) !== null) {
    const tag = match[0];
    const attrMatch = tag.match(new RegExp(`\\b${targetAttr}=["']([^"']+)["']`, 'i'));
    if (!attrMatch || attrMatch[1].trim().toLowerCase() !== targetVal) continue;
    const contentMatch = tag.match(/\bcontent=["']([^"']+)["']/i);
    if (contentMatch?.[1]) {
      return contentMatch[1].replace(/\s+/g, ' ').trim();
    }
  }
  return undefined;
}

export function extractBrandSignals(html: string, brand: string): {
  title?: string;
  brandText: string;
  logoMatches: string[];
  bodyContainsBrand: boolean;
} {
  const title = extractPageTitle(html);
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const firstH1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
  const ogSiteName = extractMetaContent(html, 'property', 'og:site_name') || '';
  const appTitle = extractMetaContent(html, 'name', 'apple-mobile-web-app-title') || '';

  const brandText = [firstH1, ogSiteName, appTitle].filter(Boolean).join(' | ');

  const brandLower = brand.trim().toLowerCase();
  const brandSlug = brandLower.replace(/[^a-z0-9]/g, '');

  const logoMatches: string[] = [];
  const imgRegex = /<img\b[^>]*>/gi;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const tag = imgMatch[0];
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    const srcMatch = tag.match(/\bsrc=["']([^"']*)["']/i);
    const alt = altMatch?.[1] ?? '';
    const src = srcMatch?.[1] ?? '';
    const combined = `${alt} ${src}`.toLowerCase();
    if (
      (brandLower.length >= 2 && combined.includes(brandLower)) ||
      (brandSlug.length >= 2 && combined.includes(brandSlug))
    ) {
      logoMatches.push((alt || src).slice(0, 120));
    }
  }

  const visibleBody = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();

  const bodyContainsBrand =
    (brandLower.length >= 2 && visibleBody.includes(brandLower)) ||
    (brandSlug.length >= 3 && visibleBody.includes(brandSlug));

  return {
    title,
    brandText,
    logoMatches,
    bodyContainsBrand,
  };
}

/**
 * Standard Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  if (s === t) return 0;
  if (s.length === 0) return t.length;
  if (t.length === 0) return s.length;

  const prev = new Array<number>(t.length + 1);
  const curr = new Array<number>(t.length + 1);
  for (let j = 0; j <= t.length; j++) prev[j] = j;

  for (let i = 1; i <= s.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= t.length; j++) prev[j] = curr[j];
  }
  return prev[t.length];
}

function primaryLabel(host: string): string {
  const clean = host.toLowerCase().replace(/^www\./, '');
  if (clean.endsWith('.vercel.app')) {
    return clean.slice(0, -'.vercel.app'.length).split('.')[0];
  }
  return clean.split('.')[0] || clean;
}

/**
 * Heuristic score in [0, 1] combining:
 * - title contains brand (+0.30)
 * - visible brand-text (h1 / og:site_name / apple-mobile-web-app-title) or body contains brand (+0.20)
 * - logo/img alt|src mentions brand (+0.15)
 * - SimHash near-duplicate similarity (+0.20 when distance <= 6, +0.10 when <= 12)
 * - hostname edit-distance to protected apex <= 2 or contains brand slug (+0.15)
 */
export function compareCandidate(
  protectedPage: ProtectedPageInfo,
  candidate: {
    host: string;
    url: string;
    live: boolean;
    httpStatus?: number;
    title?: string;
    html: string;
    source?: 'permute' | 'ct' | 'both';
  }
): ComparedCandidate {
  const brand = protectedPage.brand.trim();
  const brandLower = brand.toLowerCase();
  const brandSlug = brandLower.replace(/[^a-z0-9]/g, '');

  const signals = extractBrandSignals(candidate.html, brand);
  const resolvedTitle = signals.title || candidate.title;

  let simHashDistance: number | undefined;
  let similar = false;
  if (protectedPage.html && protectedPage.html.trim().length > 0 && candidate.html.trim().length > 0) {
    const protectedHash = protectedPage.simHash ?? computeSimHash(protectedPage.html);
    const candidateHash = computeSimHash(candidate.html);
    simHashDistance = hammingDistance(protectedHash, candidateHash);
    similar = areSimilar(protectedHash, candidateHash, 6);
  }

  const apex = extractApexDomain(protectedPage.domain);
  const apexLabel = primaryLabel(apex);
  const candLabel = primaryLabel(candidate.host);
  const labelDist = levenshteinDistance(candLabel, apexLabel);
  const fullDist = levenshteinDistance(candidate.host, apex);
  const editDistance = Math.min(labelDist, fullDist);

  let score = 0;
  const reasons: string[] = [];

  const titleLower = (resolvedTitle || '').toLowerCase();
  if (
    (brandLower.length >= 2 && titleLower.includes(brandLower)) ||
    (brandSlug.length >= 3 && titleLower.replace(/[^a-z0-9]/g, '').includes(brandSlug))
  ) {
    score += 0.3;
    reasons.push(`Page title mentions "${brand}"`);
  }

  const brandTextLower = signals.brandText.toLowerCase();
  if (
    (brandLower.length >= 2 && brandTextLower.includes(brandLower)) ||
    signals.bodyContainsBrand
  ) {
    score += 0.2;
    reasons.push(`Visible page text references "${brand}"`);
  }

  if (signals.logoMatches.length > 0) {
    score += 0.15;
    reasons.push(`Image alt/src references "${brand}"`);
  }

  if (similar && simHashDistance !== undefined) {
    score += 0.2;
    reasons.push(`Near-duplicate page content (SimHash distance ${simHashDistance})`);
  } else if (simHashDistance !== undefined && simHashDistance <= 12) {
    score += 0.1;
    reasons.push(`Similar page layout (SimHash distance ${simHashDistance})`);
  }

  const hostContainsBrand =
    (brandSlug.length >= 3 && candidate.host.replace(/[^a-z0-9]/g, '').includes(brandSlug)) ||
    (apexLabel.length >= 3 && candLabel.includes(apexLabel));
  if (editDistance <= 2 || hostContainsBrand) {
    score += 0.15;
    reasons.push(`Lookalike hostname (${candidate.host} vs ${apex})`);
  }

  const heuristicScore = Math.min(1, Math.round(score * 100) / 100);

  return {
    host: candidate.host,
    url: candidate.url,
    live: candidate.live,
    httpStatus: candidate.httpStatus,
    title: resolvedTitle,
    html: candidate.html,
    brandText: signals.brandText || undefined,
    logoMatches: signals.logoMatches,
    simHashDistance,
    similar,
    editDistance,
    heuristicScore,
    heuristicReasons: reasons.length > 0 ? reasons.slice(0, 4) : ['No strong brand signals in HTML'],
    source: candidate.source ?? 'permute',
  };
}

function preRankLiveCandidate(
  c: ResolvedCandidate,
  protectedPage: ProtectedPageInfo
): number {
  let score = 0;
  const brandLower = protectedPage.brand.toLowerCase();
  const brandSlug = brandLower.replace(/[^a-z0-9]/g, '');
  const titleLower = (c.title || '').toLowerCase();
  if (brandLower && titleLower.includes(brandLower)) score += 0.5;
  else if (brandSlug && titleLower.replace(/[^a-z0-9]/g, '').includes(brandSlug)) score += 0.4;
  const apexLabel = primaryLabel(protectedPage.domain);
  const candLabel = primaryLabel(c.host);
  const dist = levenshteinDistance(candLabel, apexLabel);
  if (dist <= 1) score += 0.3;
  else if (dist <= 2) score += 0.2;
  if (brandSlug && c.host.replace(/[^a-z0-9]/g, '').includes(brandSlug)) score += 0.2;
  return score;
}

export async function compareLiveCandidates(
  protectedPage: ProtectedPageInfo,
  liveCandidates: Array<ResolvedCandidate & { source?: 'permute' | 'ct' | 'both' }>,
  opts: {
    maxCandidates?: number;
    deadline?: number;
    timeoutMs?: number;
  } = {}
): Promise<{ compared: ComparedCandidate[]; truncated: boolean }> {
  const maxCandidates = opts.maxCandidates ?? MAX_COMPARED_CANDIDATES;
  const timeoutMs = opts.timeoutMs ?? 5000;
  let truncated = false;

  const ranked = [...liveCandidates]
    .filter(c => c.live)
    .sort((a, b) => preRankLiveCandidate(b, protectedPage) - preRankLiveCandidate(a, protectedPage))
    .slice(0, maxCandidates);

  const protectedWithHash: ProtectedPageInfo = {
    ...protectedPage,
    simHash:
      protectedPage.simHash ??
      (protectedPage.html && protectedPage.html.trim().length > 0
        ? computeSimHash(protectedPage.html)
        : undefined),
  };

  const compared: ComparedCandidate[] = [];

  for (const item of ranked) {
    if (opts.deadline !== undefined && Date.now() >= opts.deadline) {
      truncated = true;
      break;
    }
    const targetUrl = item.finalUrl || `https://${item.host}/`;
    const remaining =
      opts.deadline !== undefined ? Math.max(50, opts.deadline - Date.now()) : timeoutMs;
    let html = '';
    try {
      html = await readPublicPage(targetUrl, {
        timeoutMs: Math.min(timeoutMs, remaining),
        maxBytes: 200_000,
      });
    } catch {
      html = item.title ? `<html><head><title>${item.title}</title></head><body></body></html>` : '';
    }

    compared.push(
      compareCandidate(protectedWithHash, {
        host: item.host,
        url: targetUrl,
        live: item.live,
        httpStatus: item.httpStatus,
        title: item.title,
        html,
        source: item.source,
      })
    );
  }

  compared.sort((a, b) => b.heuristicScore - a.heuristicScore);
  return { compared: compared.slice(0, maxCandidates), truncated };
}
