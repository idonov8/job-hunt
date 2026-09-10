import { readFileSync } from 'node:fs';

/**
 * Load .env.local into process.env, overriding anything already set.
 *
 * `node --env-file` deliberately does NOT override variables that are already in
 * the environment, so a DATABASE_URL injected by the shell or a hosted dev
 * container silently wins over the one in .env.local — which means migrations
 * and seeds can land in the wrong database. These scripts always mean the file.
 */
export function loadEnvLocal(
  fileUrl = process.env.JOB_HUNTER_ENV_FILE ||
    new URL('../.env.local', import.meta.url),
) {
  let contents;
  try {
    contents = readFileSync(fileUrl, 'utf8');
  } catch {
    return false; // no .env.local — fall back to whatever is already set
  }

  for (const line of contents.split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;

    let [, key, value] = match;
    value = value.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
  return true;
}
