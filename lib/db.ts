import { createSql } from '../scripts/database.mjs';

// Lazy connection keeps builds independent of a running database.
export const sql = createSql();
