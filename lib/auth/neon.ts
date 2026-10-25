import type { IncomingMessage, ServerResponse } from 'node:http';
import { createAuthServer, extractNeonAuthCookies, serializeSetCookie } from '@neondatabase/auth/server';
import { neonAuthConfig } from './config';
import { appOrigin } from '@/lib/account/auth';

// Pages Router adapter. Neon owns OAuth, session verification, refresh and cookies.
export function neonAuth(req: IncomingMessage, res?: ServerResponse) {
  return createAuthServer({
    ...neonAuthConfig(),
    context: () => ({
      getCookies: () => extractNeonAuthCookies(req.headers.cookie || ''),
      getHeader: name => {
        const value = req.headers[name.toLowerCase()];
        return Array.isArray(value) ? value[0] : value || null;
      },
      getOrigin: () => appOrigin(),
      getFramework: () => 'nextjs',
      setCookie(name, value, options) {
        if (!res) return;
        const previous = res.getHeader('Set-Cookie');
        const values = Array.isArray(previous) ? previous.map(String) : previous ? [String(previous)] : [];
        res.setHeader('Set-Cookie', [...values, serializeSetCookie({ name, value, ...options })]);
      },
    }),
  });
}
