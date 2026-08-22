import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitStatements } from './sql-split.mjs';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set. Try: node --env-file=.env.local scripts/migrate.mjs');
  process.exit(1);
}

const sql = neon(connectionString);
const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
const statements = splitStatements(schema);

for (const [index, statement] of statements.entries()) {
  const label = statement.split('\n')[0].slice(0, 70);
  try {
    await sql.query(statement);
    console.log(`  ok  [${index + 1}/${statements.length}] ${label}`);
  } catch (error) {
    console.error(`fail  [${index + 1}/${statements.length}] ${label}\n      ${error.message}`);
    process.exit(1);
  }
}

console.log(`\nSchema applied (${statements.length} statements).`);
