import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
const sessions = new Map<string, any>();
export async function session(id: string) {
  const token = randomUUID();
  sessions.set(token, { user: { id, name: id, email: `${id}@example.com`, emailVerified: true, createdAt: new Date(0) }, session: { id: token, userId: id } });
  return `test_neon_session=${token}`;
}
jest.unstable_mockModule('@/lib/auth/neon', () => ({
  neonAuth: (req: any) => {
    const token = (req.headers.cookie || '').match(/test_neon_session=([^;]+)/)?.[1];
    return {
      getSession: async () => ({ data: sessions.get(token) || null, error: null }),
      signOut: async () => { sessions.delete(token); return { data: {}, error: null }; },
    };
  },
}));
process.env.NEON_AUTH_BASE_URL = 'https://auth.example.com/auth';
process.env.NEON_AUTH_COOKIE_SECRET = 'test-only-secret-'.repeat(3);
