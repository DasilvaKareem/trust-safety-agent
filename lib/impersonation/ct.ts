/**
 * Optional Certificate Transparency (crt.sh) probe.
 * Soft-fails on any error, non-200 response, or timeout.
 */

import { isIP } from 'node:net';
import { extractApexDomain } from './permute';

export const MAX_CT_HOSTS = 20;

const PRIVATE_TLDS = new Set([
  'local',
  'localhost',
  'internal',
  'lan',
  'corp',
  'home',
  'invalid',
  'test',
  'example',
]);

function isCandidatePublicHost(host: string, apex: string): boolean {
  if (!host || host === apex || host.includes('*') || !host.includes('.')) return false;
  if (host.length > 253 || isIP(host) !== 0) return false;
  const labels = host.split('.');
  const tld = labels[labels.length - 1];
  if (PRIVATE_TLDS.has(tld)) return false;
  return labels.every(
    label =>
      label.length >= 1 &&
      label.length <= 63 &&
      /^[a-z0-9-]+$/.test(label) &&
      !label.startsWith('-') &&
      !label.endsWith('-')
  );
}

export interface CtProbeInput {
  domain: string;
  brand: string;
  timeoutMs?: number;
}

export interface CtProbeResult {
  hosts: string[];
  ctError?: string;
}

export async function probeCertificateTransparency(
  input: CtProbeInput
): Promise<CtProbeResult> {
  const apex = extractApexDomain(input.domain);
  const timeoutMs = Math.max(100, input.timeoutMs ?? 5000);
  const brandSlug = (input.brand || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const apexLabel = apex.endsWith('.vercel.app')
    ? apex.slice(0, -'.vercel.app'.length).split('.')[0]
    : apex.split('.')[0];

  const queries = [`%.${apex}`];
  if (brandSlug && brandSlug.length >= 3 && brandSlug !== apex) {
    queries.push(brandSlug);
  }

  const hosts: string[] = [];
  const seen = new Set<string>([apex]);
  const errors: string[] = [];

  await Promise.all(
    queries.map(async q => {
      const url = `https://crt.sh/?q=${encodeURIComponent(q)}&output=json`;
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            'User-Agent': 'TrustSafetyBot/1.0',
            Accept: 'application/json',
          },
        });
        if (!res.ok) {
          errors.push(`crt.sh HTTP ${res.status}`);
          return;
        }
        const data: unknown = await res.json();
        if (!Array.isArray(data)) {
          errors.push('crt.sh returned non-array JSON');
          return;
        }
        for (const row of data) {
          if (!row || typeof row !== 'object') continue;
          const record = row as Record<string, unknown>;
          const rawNames: string[] = [];
          if (typeof record.name_value === 'string') {
            rawNames.push(...record.name_value.split(/[\s,]+/));
          }
          if (typeof record.common_name === 'string') {
            rawNames.push(...record.common_name.split(/[\s,]+/));
          }
          for (const raw of rawNames) {
            const candidate = raw.trim().toLowerCase().replace(/\.+$/, '');
            if (!candidate || candidate.startsWith('*.') || candidate.includes('*')) continue;
            if (!isCandidatePublicHost(candidate, apex)) continue;

            const matchesBrand =
              (brandSlug.length >= 2 && candidate.includes(brandSlug)) ||
              (apexLabel.length >= 2 && candidate.includes(apexLabel));
            const matchesApexSubdomainOrTld =
              candidate.endsWith(`.${apex}`) ||
              (apexLabel.length >= 2 && candidate.startsWith(`${apexLabel}.`));

            if (!matchesBrand && !matchesApexSubdomainOrTld) continue;

            if (!seen.has(candidate)) {
              seen.add(candidate);
              hosts.push(candidate);
              if (hosts.length >= MAX_CT_HOSTS) break;
            }
          }
          if (hosts.length >= MAX_CT_HOSTS) break;
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'crt.sh request failed');
      }
    })
  );

  return {
    hosts: hosts.slice(0, MAX_CT_HOSTS),
    ctError: errors.length > 0 ? errors[0] : undefined,
  };
}
