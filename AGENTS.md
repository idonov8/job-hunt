# Job Hunter — guide for agents

Ido's job-hunt tracker. A Ruby on Rails app with a PostgreSQL database.
Everything the site shows is a row in the database, and every row is reachable
over a plain JSON API — so you can update the tracker without touching the code.

**If you only need to change data (add a job, mark one applied, rewrite a
template, edit the playbook), use the API. Do not edit `db/seed-data.mjs` — it is
only the original import and is not read at runtime.**

## Getting in

Every endpoint except `/api/openapi.json` needs the bearer token:

```
Authorization: Bearer $AGENT_TOKEN
```

The token lives in the Vercel project's environment variables (`AGENT_TOKEN`) and
in `.env.local` for local work. Ask Ido for it if you don't have it — never commit it.

The machine-readable spec is at `/api/openapi.json` and is public, so you can read
the API shape before you have a token.

## The data

| Resource | Endpoint | Addressed by |
| --- | --- | --- |
| Job openings and freelance channels | `/api/jobs` | `slug` |
| Companies to approach directly | `/api/targets` | `id` |
| Outreach templates | `/api/outreach` | `id` |
| Playbook advice cards | `/api/playbook` | `id` |
| Counters + scan history | `/api/meta` | — |

A **job** looks like this:

```json
{
  "slug": "neural-frames-product-engineer-growth",
  "company": "Neural Frames",
  "role": "Product Engineer (Growth) — AI Music Video Platform",
  "url": "https://…",
  "city": "Berlin",              // Berlin | Israel | Remote
  "employment": "Full-time",     // Full-time | Part-time | Freelance | Contract
  "remote": false,
  "top_fit": true,               // unusually strong match — drives the "Top fit" filter
  "impact": false,               // mission-driven / climate / health
  "fresh": true,                 // surfaced by the most recent scan — drives "New this week"
  "tags": ["React", "Easy Apply"],
  "fit_note": "Why this one is worth his time — shown on the card.",
  "status": "",                  // "" | applied | talking | offer | pass
  "my_notes": "",                // Ido's own notes; leave these alone unless asked
  "source": "Berlin Startup Jobs, Startup Jobs, LinkedIn past-week",
  "first_seen": "2026-08-18",
  "last_seen": "2026-08-18"
}
```

`slug` is derived from company + role on insert. It is the stable id — use it in
URLs, and don't change it.

## Common tasks

**Read the pipeline.** Filters combine with AND; all are optional.

```bash
curl -H "Authorization: Bearer $AGENT_TOKEN" \
  "$SITE/api/jobs?fresh=1&city=Berlin"

# also: status=applied, employment=Freelance, top_fit=1, impact=1, remote=1,
#       q=<free text across company, role, notes and tags>
```

**Mark something applied.** PATCH is partial — send only what changes.

```bash
curl -X PATCH -H "Authorization: Bearer $AGENT_TOKEN" -H 'content-type: application/json' \
  -d '{"status":"applied"}' \
  "$SITE/api/jobs/annapurna-senior-full-stack-developer-python-typescript"
```

**Add a job.** `company` and `role` are the only required fields.

```bash
curl -X POST -H "Authorization: Bearer $AGENT_TOKEN" -H 'content-type: application/json' \
  -d '{
        "company": "Example GmbH",
        "role": "Product Engineer",
        "url": "https://example.com/jobs/1",
        "city": "Berlin",
        "employment": "Full-time",
        "top_fit": true,
        "fresh": true,
        "tags": ["React", "TypeScript"],
        "fit_note": "One honest paragraph on why this is worth his time."
      }' \
  "$SITE/api/jobs"
```

A duplicate slug returns `409` — PATCH the existing row instead of forcing a second one.

## Running the weekly scan

This is the recurring job. In order:

1. `POST /api/jobs` each genuinely new opening, with `fresh: true`.
2. Clear the flag on last week's batch so "New this week" means this week:
   `PATCH {"fresh": false}` on every job whose `first_seen` predates this scan.
   (Only jobs from the current scan should have `fresh: true`.)
3. Bump `last_seen` on any older listing you re-confirmed as still open.
4. `POST /api/meta` with `{"scanned_on","sources","jobs_added","summary"}` — this
   is what the page footer reads.
5. Summarize new matches, status updates, and any ambiguous results for the user.

Never delete a job that has a `status` set — Ido's history lives there. Set
`status: "pass"` instead if the role has closed.

## Writing fit notes

The `fit_note` is the reason the tracker is useful, so match the existing voice:
one paragraph, specific about *his* evidence (DagsHub, the Magnificode LiDAR
rescue, we4water, Berlin Sessions, MEET, Mamram), and honest about the mismatch
when there is one. Read a few existing notes before writing new ones. No hype,
no filler adjectives, and never invent a detail about a company you didn't verify.

## Changing the site itself

```
app/views/jobs/index.html.erb        Unified server-rendered board and focus session
app/assets/stylesheets/application.css  Complete visual layer
app/assets/javascripts/application.js   Minimal tabs, filtering, queue, and copy actions
app/controllers/api/**              The REST API
app/models/job.rb                    Job queries, writable fields, validation
app/services/hunter_transition.rb    Session transitions
app/services/form_indexer.rb         Static HTML form indexing
db/schema.sql                        Human-readable source of truth
db/structure.sql                     Rails-loadable schema copy
```

Adding a column: edit both SQL schema files, apply it to the intended database, then add the field to `Job::WRITABLE` and `/api/openapi.json`. Never run migrations against production merely to validate a code change.

Before pushing: `bin/rails test && bin/rails zeitwerk:check && bin/rubocop && bin/brakeman --no-pager`.

## Job Hunter MVP

The default `/` route is the unified light Job Hunter board with dark application sessions.
`/tracker` redirects to `/`; there is no separate HQ interface. Direct targets,
outreach, and playbook tabs were removed; legacy API data is retained.
See README for local Postgres setup and the HTTP MCP endpoint. Do not assume a
production deployment or access a production database to validate code changes.

New writable job fields: `application_url` (direct form), `company_summary`,
`connection_note`. Form indexing runs programmatically on insert and URL changes.
`form_index` is read-only; never guess or overwrite its question counts using an LLM.
Re-index with `POST /api/jobs/{slug}/index`.

`app/services/hunter_transition.rb` owns session transitions.
`Api::HunterController` commits the session/XP ledger and application status atomically.
`/api/hunter` is the authenticated personal state API. XP is a one-time completion
ledger, not a counter derived from mutable job statuses. Email updates should use
the existing job status API; never fabricate user-confirmed completions.

`/scan` and the MCP `job_scan` prompt let the user personalize the daily/weekly
scan. The assistant must verify facts and preserve notes, history, and user choices.
Run the Rails test, autoload, style, and security checks before pushing.
