import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';

export function isPublicIPv4(address: string) {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}
export function normalizeSiteUrl(input: unknown) {
  if (typeof input !== 'string' || input.length > 2048) throw new Error('Enter a valid public website URL.');
  const url = new URL(input.includes('://') ? input : `https://${input}`);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port || !url.hostname.includes('.') || (isIP(url.hostname) && !isPublicIPv4(url.hostname))) throw new Error('Use a public HTTP or HTTPS website with a standard port.');
  url.hash = ''; return url.href;
}

/** Pin the checked IPv4 address at connection time; validate every redirect as well. */
export async function readPublicPage(
  input: string,
  options: { verification?: boolean; timeoutMs?: number; maxBytes?: number } = {}
): Promise<string> {
  let url = new URL(normalizeSiteUrl(input));
  const signal = AbortSignal.timeout(options.timeoutMs ?? 15000);
  const maxBytes = options.maxBytes ?? (options.verification ? 4096 : 2_000_000);
  for (let redirects = 0; redirects <= 4; redirects++) {
    const addresses = await lookup(url.hostname, { family: 4, all: true });
    if (!addresses.length || addresses.some(a => !isPublicIPv4(a.address))) throw new Error('This address is not a public website.');
    const address = addresses[0].address;
    const result = await new Promise<{ status: number; location?: string; body: string }>((resolve, reject) => {
      const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
        signal, family: 4, headers: { 'User-Agent': 'TrustSafetyBot/1.0', Accept: options.verification ? 'text/plain' : 'text/html', 'Accept-Encoding': 'identity' },
        lookup: (_hostname, _options, callback) => callback(null, address, 4),
      }, response => {
        const status = response.statusCode || 500;
        if (status >= 300 && status < 400) { response.resume(); resolve({ status, location: response.headers.location, body: '' }); return; }
        const chunks: Buffer[] = []; let bytes = 0;
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > maxBytes) { response.destroy(new Error('The page is too large to scan.')); return; }
          chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () => resolve({ status, body: Buffer.concat(chunks).toString('utf8') }));
      });
      request.on('error', reject); request.end();
    });
    if (result.status >= 300 && result.status < 400 && result.location) {
      if (options.verification) throw new Error('Serve the verification file directly, without a redirect.');
      url = new URL(normalizeSiteUrl(new URL(result.location, url).href)); continue;
    }
    if (result.status < 200 || result.status >= 300) throw new Error(`The site returned HTTP ${result.status}. Make sure it is publicly accessible.`);
    return result.body;
  }
  throw new Error('This site redirects too many times.');
}
