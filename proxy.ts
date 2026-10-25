import { NextRequest, NextResponse } from 'next/server';
import { processAuthMiddleware } from '@neondatabase/auth/server';
import { neonAuthConfig, neonAuthReady } from './lib/auth/config';

export async function proxy(request: NextRequest) {
  if (!neonAuthReady()) return NextResponse.next();
  // Finalize Neon's OAuth verifier on the OAuth callback landing page.
  // Private pages and API routes independently verify the session and ownership.
  const result = await processAuthMiddleware({
    ...neonAuthConfig(), request, pathname: request.nextUrl.pathname,
    skipRoutes: ['/auth/complete'], loginUrl: '/onboarding',
  });
  const response = result.action === 'allow'
    ? NextResponse.next()
    : NextResponse.redirect(result.redirectUrl);
  for (const value of result.cookies || []) response.headers.append('Set-Cookie', value);
  if (result.action === 'allow') {
    for (const [name, value] of Object.entries(result.headers || {})) response.headers.set(name, value);
  }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/auth/complete'] };
