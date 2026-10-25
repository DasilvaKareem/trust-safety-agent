export function neonAuthReady() {
  return Boolean(process.env.NEON_AUTH_BASE_URL && (process.env.NEON_AUTH_COOKIE_SECRET?.length || 0) >= 32);
}
export function neonAuthConfig() {
  if (!neonAuthReady()) throw new Error('Neon Auth is not configured');
  return {
    baseUrl: process.env.NEON_AUTH_BASE_URL!,
    cookieSecret: process.env.NEON_AUTH_COOKIE_SECRET!,
    sameSite: 'lax' as const,
    sessionDataTtl: 300,
  };
}
