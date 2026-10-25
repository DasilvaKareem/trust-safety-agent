/**
 * Outward-facing brand impersonation finder orchestration.
 */

import { normalizeSiteUrl, readPublicPage } from '@/lib/account/public-page';
import { computeSimHash } from '@/lib/fingerprint';
import { extractApexDomain, permuteDomains, MAX_PERMUTE_CANDIDATES } from './permute';
import { probeCertificateTransparency } from './ct';
import { resolveCandidates } from './resolve';
import {
  compareLiveCandidates,
  extractPageTitle,
  type ProtectedPageInfo,
} from './compare';
import { judgeCandidate } from './judge';

export {
  permuteDomains,
  extractApexDomain,
  probeCertificateTransparency,
  resolveCandidates,
  compareLiveCandidates,
  judgeCandidate,
};

export type ImpersonationInput = {
  url: string;                 // protected site URL
  brand?: string;              // optional override; else derived from title / hostname label
  html?: string;               // optional pre-fetched protected page HTML
  deadlineMs?: number;         // default 28000
};

export type ImpersonationHit = {
  host: string;
  url: string;
  live: boolean;
  httpStatus?: number;
  title?: string;
  simHashDistance?: number;
  heuristicScore: number;
  impersonating: boolean;
  confidence: number;
  reasons: string[];
  decidedBy: 'heuristic' | 'flash' | 'argon';
  source: 'permute' | 'ct' | 'both';
};

export type ImpersonationReport = {
  protected: { url: string; brand: string; domain: string; title?: string };
  candidatesGenerated: number;
  candidatesResolved: number;
  liveHosts: number;
  compared: number;
  hits: ImpersonationHit[];          // only impersonating===true, sorted by confidence desc
  reviewed: ImpersonationHit[];      // all compared (including clears), for the UI/debug
  ctError?: string;
  elapsedMs: number;
  truncated: boolean;                // true if deadline cut work short
};

const GENERIC_TITLE_TOKENS = new Set([
  'home',
  'welcome',
  'index',
  'login',
  'log in',
  'sign in',
  'signin',
  'dashboard',
  'official site',
  'official website',
  'untitled',
]);

export function deriveBrand(
  domain: string,
  title?: string,
  html?: string,
  override?: string
): string {
  if (override && override.trim()) {
    return override.trim();
  }

  if (html) {
    const ogMatch =
      html.match(/<meta\b[^>]*\bproperty=["']og:site_name["'][^>]*\bcontent=["']([^"']+)["']/i) ||
      html.match(/<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*\bproperty=["']og:site_name["']/i);
    if (ogMatch?.[1]?.trim()) {
      return ogMatch[1].trim();
    }
  }

  if (title) {
    const segments = title
      .split(/\s*(?:\||—|–|•|:|\s-\s)\s*/)
      .map(s => s.replace(/^welcome\s+to\s+/i, '').trim())
      .filter(Boolean);
    for (const seg of segments) {
      if (!GENERIC_TITLE_TOKENS.has(seg.toLowerCase()) && seg.length >= 2 && seg.length <= 40) {
        return seg;
      }
    }
  }

  const apex = extractApexDomain(domain);
  const label = apex.endsWith('.vercel.app')
    ? apex.slice(0, -'.vercel.app'.length).split('.')[0]
    : apex.split('.')[0];
  return label || apex;
}

const MIN_STAGE_BUDGET_MS = 50;

export async function findImpersonators(
  input: ImpersonationInput
): Promise<ImpersonationReport> {
  const started = Date.now();
  const deadlineMs = input.deadlineMs ?? 28_000;
  const deadline = started + deadlineMs;
  const remainingMs = () => deadline - Date.now();

  let truncated = deadlineMs < MIN_STAGE_BUDGET_MS;

  // 1. Normalize protected URL; fetch HTML if not provided (5s cap)
  const normalizedUrl = normalizeSiteUrl(input.url);
  const domain = extractApexDomain(normalizedUrl);

  let html = input.html;
  if (html === undefined) {
    if (remainingMs() < MIN_STAGE_BUDGET_MS) {
      truncated = true;
      html = '';
    } else {
      try {
        html = await readPublicPage(normalizedUrl, {
          timeoutMs: Math.min(5000, remainingMs()),
          maxBytes: 200_000,
        });
      } catch {
        html = '';
      }
    }
  }

  const title = html ? extractPageTitle(html) : undefined;
  const brand = deriveBrand(domain, title, html, input.brand);

  const protectedInfo: ProtectedPageInfo = {
    url: normalizedUrl,
    domain,
    brand,
    title,
    html,
    simHash: html && html.trim().length > 0 ? computeSimHash(html) : undefined,
  };

  // 2. Generate permute candidates and probe Certificate Transparency in parallel
  const permuteList = permuteDomains({ brand, domain });
  const permuteSet = new Set(permuteList);

  let ctHosts: string[] = [];
  let ctError: string | undefined;

  if (remainingMs() < MIN_STAGE_BUDGET_MS) {
    truncated = true;
  } else {
    const ctTimeout = Math.min(5000, remainingMs());
    const ctResult = await probeCertificateTransparency({
      domain,
      brand,
      timeoutMs: ctTimeout,
    });
    ctHosts = ctResult.hosts;
    ctError = ctResult.ctError;
  }

  // Deduplicate CT and permute candidates (CT hits get priority slots, capped at 40)
  const mergedCandidates: Array<{ host: string; source: 'permute' | 'ct' | 'both' }> = [];
  const mergedSeen = new Set<string>();

  for (const host of ctHosts) {
    if (mergedCandidates.length >= MAX_PERMUTE_CANDIDATES) break;
    if (!mergedSeen.has(host)) {
      mergedSeen.add(host);
      mergedCandidates.push({
        host,
        source: permuteSet.has(host) ? 'both' : 'ct',
      });
    }
  }

  for (const host of permuteList) {
    if (mergedCandidates.length >= MAX_PERMUTE_CANDIDATES) break;
    if (!mergedSeen.has(host)) {
      mergedSeen.add(host);
      mergedCandidates.push({
        host,
        source: 'permute',
      });
    }
  }

  const candidatesGenerated = mergedCandidates.length;
  const sourceByHost = new Map(mergedCandidates.map(c => [c.host, c.source]));

  if (remainingMs() < MIN_STAGE_BUDGET_MS) {
    truncated = true;
    return {
      protected: { url: normalizedUrl, brand, domain, title },
      candidatesGenerated,
      candidatesResolved: 0,
      liveHosts: 0,
      compared: 0,
      hits: [],
      reviewed: [],
      ctError,
      elapsedMs: Date.now() - started,
      truncated: true,
    };
  }

  // 3. Resolve / HTTP-probe candidates within stage budget (~12s or remaining deadline)
  const resolveBudgetMs = Math.min(12_000, Math.max(0, remainingMs()));
  const resolved = await resolveCandidates(
    mergedCandidates.map(c => c.host),
    {
      concurrency: 8,
      budgetMs: resolveBudgetMs,
      timeoutMs: Math.min(2000, resolveBudgetMs),
    }
  );

  if (resolved.length < candidatesGenerated || remainingMs() <= 0) {
    truncated = true;
  }

  const liveResolved = resolved
    .filter(r => r.live)
    .map(r => ({ ...r, source: sourceByHost.get(r.host) ?? 'permute' }));

  if (liveResolved.length === 0 || remainingMs() < MIN_STAGE_BUDGET_MS) {
    if (liveResolved.length > 0 && remainingMs() < MIN_STAGE_BUDGET_MS) {
      truncated = true;
    }
    return {
      protected: { url: normalizedUrl, brand, domain, title },
      candidatesGenerated,
      candidatesResolved: resolved.length,
      liveHosts: liveResolved.length,
      compared: 0,
      hits: [],
      reviewed: [],
      ctError,
      elapsedMs: Date.now() - started,
      truncated,
    };
  }

  // 4. Compare top live hosts (capped at 8)
  const { compared: comparedList, truncated: compareTruncated } = await compareLiveCandidates(
    protectedInfo,
    liveResolved,
    {
      maxCandidates: 8,
      deadline,
      timeoutMs: Math.min(5000, Math.max(50, remainingMs())),
    }
  );
  if (compareTruncated) {
    truncated = true;
  }

  // 5. Judge each compared candidate with Flash -> Argon escalation
  const reviewed: ImpersonationHit[] = [];

  for (const cand of comparedList) {
    if (remainingMs() < MIN_STAGE_BUDGET_MS) {
      truncated = true;
      const fallbackImpersonating = cand.heuristicScore >= 0.6;
      reviewed.push({
        host: cand.host,
        url: cand.url,
        live: cand.live,
        httpStatus: cand.httpStatus,
        title: cand.title,
        simHashDistance: cand.simHashDistance,
        heuristicScore: cand.heuristicScore,
        impersonating: fallbackImpersonating,
        confidence: cand.heuristicScore,
        reasons: cand.heuristicReasons,
        decidedBy: 'heuristic',
        source: cand.source,
      });
      continue;
    }

    const verdict = await judgeCandidate(protectedInfo, cand, {
      timeoutMs: Math.max(100, remainingMs()),
    });

    reviewed.push({
      host: cand.host,
      url: cand.url,
      live: cand.live,
      httpStatus: cand.httpStatus,
      title: cand.title,
      simHashDistance: cand.simHashDistance,
      heuristicScore: cand.heuristicScore,
      impersonating: verdict.impersonating,
      confidence: verdict.confidence,
      reasons: verdict.reasons,
      decidedBy: verdict.decidedBy,
      source: cand.source,
    });
  }

  const hits = reviewed
    .filter(r => r.impersonating)
    .sort((a, b) => b.confidence - a.confidence || b.heuristicScore - a.heuristicScore);

  return {
    protected: { url: normalizedUrl, brand, domain, title },
    candidatesGenerated,
    candidatesResolved: resolved.length,
    liveHosts: liveResolved.length,
    compared: comparedList.length,
    hits,
    reviewed,
    ctError,
    elapsedMs: Date.now() - started,
    truncated,
  };
}
