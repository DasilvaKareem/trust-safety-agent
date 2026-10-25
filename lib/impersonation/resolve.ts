/**
 * DNS + HTTP liveness probe for impersonation candidates.
 * Enforces SSRF protections (public IPv4 only) and bounded concurrency/wall-clock time.
 */

import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isPublicIPv4 } from '@/lib/account/public-page';

export interface ResolvedCandidate {
  host: string;
  resolvedIp?: string;
  httpStatus?: number;
  finalUrl?: string;
  title?: string;
  live: boolean;
}

export interface ResolveOptions {
  concurrency?: number;
  budgetMs?: number;
  timeoutMs?: number;
}

const MAX_SNIPPET_BYTES = 16_384;
const MAX_REDIRECTS = 2;

function extractSnippetTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return undefined;
  const cleaned = match[1].replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, 200) : undefined;
}

async function resolvePublicIPv4(hostname: string): Promise<string | null> {
  try {
    const res: unknown = await lookup(hostname, { family: 4, all: true });
    if (Array.isArray(res)) {
      if (res.length === 0) return null;
      const addresses = res
        .map(item => (typeof item === 'string' ? item : (item as { address?: string })?.address))
        .filter((a): a is string => typeof a === 'string');
      if (addresses.length === 0 || addresses.some(ip => !isPublicIPv4(ip))) return null;
      return addresses[0];
    }
    if (typeof res === 'string') {
      return isPublicIPv4(res) ? res : null;
    }
    if (res && typeof (res as { address?: unknown }).address === 'string') {
      const ip = (res as { address: string }).address;
      return isPublicIPv4(ip) ? ip : null;
    }
    return null;
  } catch {
    return null;
  }
}

async function requestOnce(
  url: URL,
  address: string,
  timeoutMs: number
): Promise<{ status: number; location?: string; body: string }> {
  const signal = AbortSignal.timeout(Math.max(50, timeoutMs));
  return new Promise((resolve, reject) => {
    const reqFn = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = reqFn(
      url,
      {
        method: 'GET',
        signal,
        family: 4,
        headers: {
          'User-Agent': 'TrustSafetyBot/1.0',
          Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
          'Accept-Encoding': 'identity',
        },
        lookup: (_hostname, _options, callback) => callback(null, address, 4),
      },
      response => {
        const status = response.statusCode || 500;
        const rawLocation = response.headers?.location;
        const location = Array.isArray(rawLocation) ? rawLocation[0] : rawLocation;
        if (status >= 300 && status < 400) {
          response.resume();
          resolve({ status, location, body: '' });
          return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve({ status, location, body: Buffer.concat(chunks).toString('utf8') });
        };
        response.on('data', (chunk: Buffer | string) => {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
          const remaining = MAX_SNIPPET_BYTES - bytes;
          if (remaining > 0) {
            chunks.push(buf.subarray(0, remaining));
          }
          bytes += buf.length;
          if (bytes >= MAX_SNIPPET_BYTES) {
            finish();
            response.destroy();
          }
        });
        response.on('error', err => {
          if (!settled) {
            settled = true;
            reject(err);
          }
        });
        response.on('end', finish);
        response.on('close', finish);
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function probeProtocol(
  initialUrl: URL,
  initialIp: string,
  timeoutMs: number
): Promise<{ httpStatus: number; finalUrl: string; title?: string }> {
  let currentUrl = initialUrl;
  let currentIp = initialIp;
  let last3xxStatus: number | undefined;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const res = await requestOnce(currentUrl, currentIp, timeoutMs);
    if (res.status >= 300 && res.status < 400) {
      last3xxStatus = res.status;
      if (!res.location || redirects === MAX_REDIRECTS) {
        return { httpStatus: res.status, finalUrl: currentUrl.href };
      }
      let nextUrl: URL;
      try {
        nextUrl = new URL(res.location, currentUrl);
      } catch {
        return { httpStatus: res.status, finalUrl: currentUrl.href };
      }
      if (!['https:', 'http:'].includes(nextUrl.protocol) || nextUrl.username || nextUrl.password || nextUrl.port) {
        return { httpStatus: res.status, finalUrl: currentUrl.href };
      }
      const nextIp =
        nextUrl.hostname.toLowerCase() === currentUrl.hostname.toLowerCase()
          ? currentIp
          : await resolvePublicIPv4(nextUrl.hostname);
      if (!nextIp) {
        return { httpStatus: res.status, finalUrl: currentUrl.href };
      }
      currentUrl = nextUrl;
      currentIp = nextIp;
      continue;
    }

    return {
      httpStatus: res.status,
      finalUrl: currentUrl.href,
      title: extractSnippetTitle(res.body),
    };
  }

  return {
    httpStatus: last3xxStatus ?? 302,
    finalUrl: currentUrl.href,
  };
}

export async function resolveHost(
  host: string,
  opts: { timeoutMs?: number } = {}
): Promise<ResolvedCandidate> {
  const timeoutMs = opts.timeoutMs ?? 2000;
  const resolvedIp = await resolvePublicIPv4(host);
  if (!resolvedIp) {
    return { host, live: false };
  }

  for (const protocol of ['https:', 'http:'] as const) {
    try {
      const targetUrl = new URL(`${protocol}//${host}/`);
      const probe = await probeProtocol(targetUrl, resolvedIp, timeoutMs);
      const isLive = probe.httpStatus >= 200 && probe.httpStatus < 400;
      return {
        host,
        resolvedIp,
        httpStatus: probe.httpStatus,
        finalUrl: probe.finalUrl,
        title: probe.title,
        live: isLive,
      };
    } catch {
      // Fall back from https to http, or mark not live if both fail
    }
  }

  return {
    host,
    resolvedIp,
    live: false,
  };
}

export async function resolveCandidates(
  hosts: string[],
  opts: ResolveOptions = {}
): Promise<ResolvedCandidate[]> {
  const concurrency = Math.max(1, opts.concurrency ?? 8);
  const budgetMs = opts.budgetMs ?? 12_000;
  const perHostTimeoutMs = opts.timeoutMs ?? 2000;
  const deadline = Date.now() + budgetMs;

  if (hosts.length === 0 || budgetMs <= 0) return [];

  const results: Array<ResolvedCandidate | undefined> = new Array(hosts.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < hosts.length) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const idx = nextIndex++;
      if (idx >= hosts.length) break;
      const host = hosts[idx];
      const timeoutMs = Math.min(perHostTimeoutMs, Math.max(50, remaining));
      const raceTimeout = new Promise<null>(resolve => {
        const timer = setTimeout(() => resolve(null), Math.max(10, remaining));
        timer.unref?.();
      });
      const resolved = await Promise.race([resolveHost(host, { timeoutMs }), raceTimeout]);
      if (resolved === null) {
        break;
      }
      results[idx] = resolved;
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, hosts.length) }, () => worker());
  await Promise.all(workers);

  return results.filter((r): r is ResolvedCandidate => r !== undefined);
}
