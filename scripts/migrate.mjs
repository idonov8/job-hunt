import { loadEnvLocal } from './load-env.mjs';
import { readFile } from 'node:fs/promises';
import { createSql } from './database.mjs';
import { splitStatements } from './sql-split.mjs';

loadEnvLocal();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set. Add it to .env.local.');
  process.exit(1);
}

const sql = createSql();
console.log(`-> ${new URL(connectionString).host}`);
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
