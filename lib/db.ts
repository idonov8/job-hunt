import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
}

/**
 * Tagged-template SQL client. Interpolated values are always sent as bound
 * parameters, so `sql`select * from jobs where slug = ${slug}`` is safe.
 */
export const sql = neon(process.env.DATABASE_URL);
