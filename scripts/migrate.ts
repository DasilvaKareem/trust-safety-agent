import nextEnv from '@next/env';
import { neon } from '@neondatabase/serverless';
import { readFile } from 'node:fs/promises';
nextEnv.loadEnvConfig(process.cwd());
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  if (process.env.VERCEL) throw new Error('Connect Neon to this Vercel project before building.');
  console.log('No DATABASE_URL: skipping migrations for local build.');
} else {
  const sql = neon(url);
  const migration = await readFile(new URL('../migrations/001_argon_guard.sql', import.meta.url), 'utf8');
  const statements = migration.split(';').map(s => s.trim()).filter(Boolean);
  await sql.transaction(statements.map(statement => sql.query(statement)));
  console.log('Argon Guard database schema is ready.');
}
