import { neon } from '@neondatabase/serverless';
export function databaseReady() { return Boolean(process.env.DATABASE_URL); }
export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  return neon(process.env.DATABASE_URL);
}
// Server-only storage. Every HTTP route checks user identity and ownership before access.
export const postgresRecords = {
  async get<T>(key: string): Promise<T | null> {
    const rows = await database()`SELECT value FROM argon_guard.records WHERE key = ${key} AND (expires_at IS NULL OR expires_at > now())`;
    return rows[0]?.value as T ?? null;
  },
  async set(key: string, value: unknown, seconds = 0) {
    await database()`INSERT INTO argon_guard.records (key, value, expires_at) VALUES (${key}, ${JSON.stringify(value)}::jsonb, CASE WHEN ${seconds}::int = 0 THEN NULL ELSE now() + ${seconds}::int * interval '1 second' END) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`;
  },
  async remove(key: string) { await database()`DELETE FROM argon_guard.records WHERE key = ${key}`; },
  async take<T>(key: string): Promise<T | null> {
    const rows = await database()`DELETE FROM argon_guard.records WHERE key = ${key} RETURNING value, (expires_at IS NULL OR expires_at > now()) AS valid`;
    return rows[0]?.valid ? rows[0].value as T : null;
  },
  async claim(key: string, seconds: number) {
    const rows = await database()`INSERT INTO argon_guard.records (key, value, expires_at) VALUES (${key}, 'true'::jsonb, now() + ${seconds}::int * interval '1 second') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at WHERE records.expires_at <= now() RETURNING key`;
    return rows.length === 1;
  },
  async add(key: string, id: string) { await database()`INSERT INTO argon_guard.set_members (key, member) VALUES (${key}, ${id}) ON CONFLICT DO NOTHING`; },
  async members(key: string): Promise<string[]> {
    const rows = await database()`SELECT member FROM argon_guard.set_members WHERE key = ${key}`;
    return rows.map(row => row.member);
  },
};
