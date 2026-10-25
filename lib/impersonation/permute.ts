/**
 * Generate typosquat / lookalike domain candidates from a brand + protected apex domain.
 * Pure, deterministic, and capped at 40 candidates.
 */

export const MAX_PERMUTE_CANDIDATES = 40;

export const SWAP_TLDS = [
  'com',
  'net',
  'org',
  'co',
  'io',
  'app',
  'dev',
  'info',
  'biz',
  'xyz',
] as const;

export const HOMOGLYPH_MAP: Readonly<Record<string, readonly string[]>> = {
  o: ['0'],
  '0': ['o'],
  i: ['1', 'l'],
  l: ['1', 'i'],
  '1': ['i', 'l'],
  e: ['3'],
  '3': ['e'],
  a: ['4'],
  '4': ['a'],
  s: ['5'],
  '5': ['s'],
};

const MULTI_PART_SECOND_LEVELS = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac']);

/**
 * Extract the protected apex domain from a hostname or URL.
 * Preserves `<name>.vercel.app` as the protected apex for Vercel deployments.
 */
export function extractApexDomain(input: string): string {
  let host = input.trim().toLowerCase();
  if (host.includes('://')) {
    try {
      host = new URL(host).hostname.toLowerCase();
    } catch {
      host = host.replace(/^[a-z]+:\/\//, '').split('/')[0];
    }
  } else {
    host = host.split('/')[0].split('?')[0].split('#')[0];
  }
  host = host.replace(/\.+$/, '').replace(/^www\./, '');
  if (host.endsWith('.vercel.app')) {
    const parts = host.split('.');
    if (parts.length >= 3) {
      return `${parts[parts.length - 3]}.vercel.app`;
    }
    return host;
  }
  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const secondLast = parts[parts.length - 2];
  const last = parts[parts.length - 1];
  if (last.length === 2 && MULTI_PART_SECOND_LEVELS.has(secondLast) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

function isValidHostname(host: string): boolean {
  if (!host || host.length > 253 || !host.includes('.')) return false;
  const labels = host.split('.');
  return labels.every(
    label =>
      label.length >= 1 &&
      label.length <= 63 &&
      /^[a-z0-9-]+$/.test(label) &&
      !label.startsWith('-') &&
      !label.endsWith('-')
  );
}

export interface PermuteInput {
  brand: string;
  domain: string;
}

export function permuteDomains(input: PermuteInput): string[] {
  const apex = extractApexDomain(input.domain);
  if (!apex || !apex.includes('.')) return [];

  const isVercel = apex.endsWith('.vercel.app');
  const label = isVercel ? apex.slice(0, -'.vercel.app'.length).split('.')[0] : apex.split('.')[0];
  const tld = isVercel ? 'vercel.app' : apex.split('.').slice(1).join('.');
  if (!label || !tld) return [];

  const brandSlug = (input.brand || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const labelSlug = label.toLowerCase().replace(/[^a-z0-9]/g, '');

  const excluded = new Set<string>([
    apex,
    input.domain.trim().toLowerCase().replace(/\.+$/, '').replace(/^www\./, ''),
  ]);

  const makeChecker = () => {
    const seen = new Set<string>(excluded);
    return (candidate: string, target: string[]) => {
      const normalized = candidate.toLowerCase().trim();
      if (!seen.has(normalized) && isValidHostname(normalized)) {
        seen.add(normalized);
        target.push(normalized);
      }
    };
  };

  const addCandidate = makeChecker();

  // 1. Hyphen insertion (prefer near-middle splits first for multi-syllable brands like pay-pal)
  const hyphens: string[] = [];
  if (label.length >= 2) {
    const mid = Math.floor(label.length / 2);
    const indices: number[] = [];
    for (let offset = 0; offset < label.length; offset++) {
      const right = mid + offset;
      const left = mid - offset;
      if (right >= 1 && right < label.length && !indices.includes(right)) indices.push(right);
      if (left >= 1 && left < label.length && !indices.includes(left)) indices.push(left);
    }
    for (const i of indices) {
      if (label[i - 1] !== '-' && label[i] !== '-') {
        addCandidate(`${label.slice(0, i)}-${label.slice(i)}.${tld}`, hyphens);
      }
    }
  }

  // 2. TLD swaps among the fixed short list
  const tldSwaps: string[] = [];
  for (const swapTld of SWAP_TLDS) {
    if (swapTld !== tld) {
      addCandidate(`${label}.${swapTld}`, tldSwaps);
    }
  }

  // 3. <name>-*.vercel.app style
  const vercelApps: string[] = [];
  const slugs = Array.from(
    new Set(
      [brandSlug, ...(isVercel ? [label, labelSlug] : [labelSlug])].filter(
        s => s && s.length >= 2
      )
    )
  );
  for (const slug of slugs) {
    addCandidate(`${slug}-login.vercel.app`, vercelApps);
    addCandidate(`${slug}-secure.vercel.app`, vercelApps);
    addCandidate(`${slug}-verify.vercel.app`, vercelApps);
    addCandidate(`${slug}-support.vercel.app`, vercelApps);
    addCandidate(`secure-${slug}.vercel.app`, vercelApps);
    addCandidate(`login-${slug}.vercel.app`, vercelApps);
  }

  // 4. Adjacent transposition (swap two neighboring chars once)
  const transpositions: string[] = [];
  for (let i = 0; i < label.length - 1; i++) {
    const a = label[i];
    const b = label[i + 1];
    if (a !== b && a !== '-' && b !== '-') {
      const swapped = `${label.slice(0, i)}${b}${a}${label.slice(i + 2)}`;
      addCandidate(`${swapped}.${tld}`, transpositions);
    }
  }

  // 5. Homoglyphs / common character swaps (at most 1 substitution per candidate)
  const substitutions: string[] = [];
  for (let i = 0; i < label.length; i++) {
    const ch = label[i];
    const replacements = HOMOGLYPH_MAP[ch];
    if (!replacements) continue;
    for (const rep of replacements) {
      const sub = `${label.slice(0, i)}${rep}${label.slice(i + 1)}`;
      addCandidate(`${sub}.${tld}`, substitutions);
    }
  }

  // 6. Missing char / doubled char (one position)
  const missingAndDoubled: string[] = [];
  for (let i = 0; i < label.length; i++) {
    if (label.length > 2) {
      const omitted = `${label.slice(0, i)}${label.slice(i + 1)}`;
      if (!omitted.includes('--')) {
        addCandidate(`${omitted}.${tld}`, missingAndDoubled);
      }
    }
    if (/[a-z0-9]/.test(label[i])) {
      const doubled = `${label.slice(0, i + 1)}${label[i]}${label.slice(i + 1)}`;
      addCandidate(`${doubled}.${tld}`, missingAndDoubled);
    }
  }

  // Combine in deterministic priority order:
  // hyphen -> TLD swap -> vercel.app -> transposition -> substitution -> missing/doubled
  // Take primary slice of each bucket first so long labels never starve later generators,
  // then fill any remaining capacity in the same priority order up to 40.
  const buckets: Array<{ list: string[]; initialCap: number }> = [
    { list: hyphens, initialCap: 6 },
    { list: tldSwaps, initialCap: 10 },
    { list: vercelApps, initialCap: 8 },
    { list: transpositions, initialCap: 6 },
    { list: substitutions, initialCap: 6 },
    { list: missingAndDoubled, initialCap: 6 },
  ];

  const finalResults: string[] = [];
  const finalSeen = new Set<string>();

  for (const { list, initialCap } of buckets) {
    for (const host of list.slice(0, initialCap)) {
      if (finalResults.length >= MAX_PERMUTE_CANDIDATES) break;
      if (!finalSeen.has(host)) {
        finalSeen.add(host);
        finalResults.push(host);
      }
    }
  }

  for (const { list, initialCap } of buckets) {
    for (const host of list.slice(initialCap)) {
      if (finalResults.length >= MAX_PERMUTE_CANDIDATES) break;
      if (!finalSeen.has(host)) {
        finalSeen.add(host);
        finalResults.push(host);
      }
    }
  }

  return finalResults.slice(0, MAX_PERMUTE_CANDIDATES);
}
