import { kv } from '@vercel/kv';
import { databaseReady, postgresRecords } from '@/lib/database';

// Shared across route modules in local development. Production uses Neon, with Redis retained for existing installations.
const memory = (globalThis as any).__accountStore ??= new Map<string, { value: unknown; expires: number }>();
export function durableStorageReady() { return databaseReady() || Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN); }
let warnedMissingAccountStorage = false;
function useRedis() {
  if (durableStorageReady()) return true;
  if (process.env.NODE_ENV === 'production' && !warnedMissingAccountStorage) {
    warnedMissingAccountStorage = true;
    console.warn('[accountStore] No Neon/KV configured; using in-memory fallback (hackathon). Connect Neon for durable auth/account storage.');
  }
  return false;
}
export const accountStore = {
  async get<T>(key: string): Promise<T | null> {
    if (databaseReady()) return postgresRecords.get<T>(`app:${key}`);
    if (useRedis()) return kv.get<T>(`app:${key}`);
    const item = memory.get(key);
    if (!item || item.expires < Date.now()) { memory.delete(key); return null; }
    return structuredClone(item.value) as T;
  },
  async set(key: string, value: unknown, seconds = 0) {
    if (databaseReady()) return postgresRecords.set(`app:${key}`, value, seconds);
    if (useRedis()) { await kv.set(`app:${key}`, value, seconds ? { ex: seconds } : {}); return; }
    memory.set(key, { value: structuredClone(value), expires: seconds ? Date.now() + seconds * 1000 : Infinity });
  },
  async remove(key: string) {
    if (databaseReady()) return postgresRecords.remove(`app:${key}`);
    if (useRedis()) { await kv.del(`app:${key}`); return; }
    memory.delete(key);
  },
  async take<T>(key: string): Promise<T | null> {
    if (databaseReady()) return postgresRecords.take<T>(`app:${key}`);
    if (useRedis()) return kv.getdel<T>(`app:${key}`);
    const item = memory.get(key); memory.delete(key);
    return item && item.expires >= Date.now() ? structuredClone(item.value) as T : null;
  },
  async claim(key: string, seconds: number) {
    if (databaseReady()) return postgresRecords.claim(`app:${key}`, seconds);
    if (useRedis()) return (await kv.set(`app:${key}`, true, { nx: true, ex: seconds })) === 'OK';
    const item = memory.get(key);
    if (item && item.expires > Date.now()) return false;
    memory.set(key, { value: true, expires: Date.now() + seconds * 1000 }); return true;
  },
  async add(key: string, id: string) {
    if (databaseReady()) return postgresRecords.add(`app:${key}`, id);
    if (useRedis()) { await kv.sadd(`app:${key}`, id); return; }
    const values = new Set<string>((memory.get(key)?.value as string[]) || []);
    values.add(id); memory.set(key, { value: [...values], expires: Infinity });
  },
  async members(key: string): Promise<string[]> {
    if (databaseReady()) return postgresRecords.members(`app:${key}`);
    if (useRedis()) return kv.smembers(`app:${key}`);
    return (await this.get<string[]>(key)) || [];
  },
};
