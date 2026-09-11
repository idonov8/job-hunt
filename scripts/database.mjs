import pg from 'pg';
import { neon } from '@neondatabase/serverless';

export function createSql() {
  let client;
  async function query(text, values = []) {
    if (!client) {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) throw new Error('DATABASE_URL is not set');
      client =
        process.env.DATABASE_DRIVER === 'pg'
          ? new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 1000 })
          : neon(connectionString);
    }
    const result = await client.query(text, values);
    return Array.isArray(result) ? result : result.rows;
  }
  return Object.assign(
    (strings, ...values) =>
      query(
        strings.reduce((s, part, i) => s + (i ? `$${i}` : '') + part, ''),
        values,
      ),
    { query },
  );
}
