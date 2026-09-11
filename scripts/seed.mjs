import { loadEnvLocal } from './load-env.mjs';
import { createSql } from './database.mjs';
import { JOBS, TARGETS, OUTREACH, PLAY, SCAN } from '../db/seed-data.mjs';

loadEnvLocal();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set. Add it to .env.local.');
  process.exit(1);
}

const sql = createSql();
console.log(`-> ${new URL(connectionString).host}`);

// Kept in step with lib/slug.ts — the two runtimes can't share a module.
function slugify(company, role) {
  return `${company} ${role}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// Seeding never clobbers a status or note the user has already set.
for (const job of JOBS) {
  await sql`
    insert into jobs (slug, company, role, url, city, employment, remote, top_fit, impact, fresh, tags, fit_note, source, first_seen, last_seen)
    values (
      ${slugify(job.c, job.r)}, ${job.c}, ${job.r}, ${job.u ?? null}, ${job.city ?? null},
      ${job.type ?? null}, ${!!job.remote}, ${!!job.top}, ${!!job.impact}, ${!!job.fresh},
      ${job.tags ?? []}::text[], ${job.n ?? ''}, ${SCAN.sources}, ${SCAN.scanned_on}::date, ${SCAN.scanned_on}::date
    )
    on conflict (slug) do update set
      company = excluded.company, role = excluded.role, url = excluded.url,
      city = excluded.city, employment = excluded.employment, remote = excluded.remote,
      top_fit = excluded.top_fit, impact = excluded.impact, fresh = excluded.fresh,
      tags = excluded.tags, fit_note = excluded.fit_note, last_seen = excluded.last_seen
  `;
}

for (const [groupIndex, group] of TARGETS.entries()) {
  for (const [itemIndex, [name, description]] of group.l.entries()) {
    await sql`
      insert into targets (group_name, name, description, position)
      values (${group.h}, ${name}, ${description}, ${groupIndex * 100 + itemIndex})
      on conflict (group_name, name) do update set
        description = excluded.description, position = excluded.position
    `;
  }
}

for (const [index, template] of OUTREACH.entries()) {
  await sql`
    insert into outreach (title, body, position)
    values (${template.t}, ${template.b}, ${index})
    on conflict (title) do update set body = excluded.body, position = excluded.position
  `;
}

for (const [index, section] of PLAY.entries()) {
  await sql`
    insert into playbook (heading, bullets, position)
    values (${section.h}, ${section.b}::text[], ${index})
    on conflict (heading) do update set bullets = excluded.bullets, position = excluded.position
  `;
}

const [existingScan] = await sql`select id from scans where scanned_on = ${SCAN.scanned_on}::date`;
if (!existingScan) {
  await sql`
    insert into scans (scanned_on, sources, jobs_added, summary)
    values (${SCAN.scanned_on}::date, ${SCAN.sources}, ${SCAN.jobs_added}, ${SCAN.summary})
  `;
}

console.log(
  `Seeded ${JOBS.length} jobs, ${TARGETS.reduce((n, g) => n + g.l.length, 0)} targets, ` +
    `${OUTREACH.length} outreach templates, ${PLAY.length} playbook sections.`,
);
