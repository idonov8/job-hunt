# Job Hunter

A local-first, gamified job search workspace built on Job Hunt HQ. Curate roles with your existing AI subscription through MCP, queue the interesting ones, then work through focused application sessions.

## Run locally

Requires Node.js 22.17+ and Docker Compose. No cloud database or model API key is required.

```bash
npm ci
npm run setup
# Creates private .env.local with random credentials; never overwrites an existing file.
docker compose --env-file .env.local up -d --wait
npm run db:migrate
npm run dev
```

Open the URL printed by Next.js. Sign in with `APP_PASSWORD` from `.env.local`.
If port 3000 is occupied, set `JOB_HUNTER_URL` in `.env.local` to the actual URL before using MCP.
The database binds to loopback port 54329 and persists in a Docker volume.
Stop it with `docker compose --env-file .env.local stop`. Back up the database before removing its volume.

New installations start empty. Add a role in the UI or connect your assistant.
`npm run db:seed` is an **optional import of Ido's original personal dataset**, not generic demo data; it preserves status and notes but refreshes other seeded fields.

## The workflow

- **Openings:** the light HQ overview with counters, filters, status controls, notes, and indexed application details. Choose **Apply** to add a job to **Application Queue**.
- **Focus:** one bright application iframe in a dark workspace, with company facts, your fit, connections, and relevant prior answers. Use the external link when embedding or sign-in is blocked.
- **Complete:** submit on the employer's site, then confirm and log the application. Earn 100 XP once per role; level up every 500 XP. Job Hunter never submits to an employer on your behalf.
- **Skip:** two skips per session. Skipped and unfinished roles stay in Application Queue. You can always end a session.
- **Reuse:** record answers you actually submitted. They save with the application, question, company, and timestamp. Similarity uses lexical overlap, without embeddings or model calls. Review before reusing. Unsaved answer notes are lost on reload; the application queue and earned XP survive reloads.

There is one Job Hunter interface. `/tracker` redirects to `/`. Tabs are Openings, Application Queue, History, and Answers; direct-target, outreach, and playbook tabs are removed. Legacy collection data and API routes remain intact.

## Connect your assistant through MCP

The app exposes a **local stdio MCP server**. Use a compatible assistant that supports local MCP servers (and your existing subscription). The assistant, its web/email connectors, and any scheduling run outside Job Hunter.

Run `npm run mcp:config` to print ready-to-paste local MCP settings with the correct Node executable and absolute paths. No token is printed. Add the result to your agent's local MCP configuration. Its shape is:

```json
{
  "mcpServers": {
    "job-hunter": {
      "command": "node",
      "args": [
        "--import", "/absolute/path/job-hunt/node_modules/tsx/dist/loader.mjs",
        "/absolute/path/job-hunt/scripts/mcp.ts"
      ]
    }
  }
}
```

The script resolves `.env.local` relative to the checkout, so it also works when your assistant starts in a different directory. Ensure `node` is on its PATH or use its absolute path. `npm run mcp` starts the same server for manual use (stdio is a machine protocol, not an interactive prompt).

Tools: `list_jobs`, `add_job`, `update_job`, `index_form`, `record_scan`.
Prompt: `job_scan`, with `preferences` and optional `cadence` (`daily` / `weekly`).
Open `/scan` for a gentle connection walkthrough, copyable connection instructions, and a shorter personalized scan prompt. Run it once before scheduling it. The page links to [ChatGPT scheduled tasks](https://learn.chatgpt.com/docs/automations) and [Claude recurring tasks](https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork). Local MCP scans require the app and a compatible desktop agent to remain running; a cloud-only routine cannot launch this stdio server directly. The complete prompt source is [lib/scan-prompt.ts](lib/scan-prompt.ts).

The prompt requests verified company/role/posting/application URLs, location, employment, remote policy, tags, fit notes, company facts, real connections, and dated sources. Email status updates require a separately connected and authorized email reader. It preserves user notes/history and flags ambiguous matches. MCP has no employer submission, email sending, answer-library read, or XP-awarding tool.

## Programmatic form indexing

Forms are indexed on job insertion, application/posting URL changes, or explicit re-indexing. Stored results contain the question label, kind, required flag, options, open-question classification, estimate, source URL, timestamp, and coverage note.

- HTML application forms: text, textareas, select fields, grouped radio/checkbox controls, uploads, and open questions; hidden/disabled controls are excluded.
- Greenhouse: fetches the [public Job Board questions API](https://docs.greenhouse.io/job-board.html#retrieve-a-job), including direct and embedded Greenhouse URLs. Upload/paste alternatives count once.
- Supported ATS iframe URLs can be followed once; each request and redirect uses public-address validation and pinned DNS. Downloads and request time are bounded.
- Estimates: one minute overhead, ~15 seconds per short field, ~12–15 seconds per choice, one minute per file, and 2.5 minutes per open question. These are heuristics, not observed user timings.

**Coverage limit:** static HTML and public Greenhouse questions do not reveal all JavaScript-only, conditional, consent, demographic, login, or multi-step controls. Results are labeled **partial**, or **unknown** when no controls are found; unknown jobs sort last. Full browser rendering, CAPTCHA bypass, and automatic form filling are not included. No LLM invents question counts or estimates.

## Database migration: what you need to run

**Already running the previous Job Hunter MVP?** This UI update requires no new migration. The local database created in that setup already has the needed schema.

**Upgrading the original Job Hunt HQ / Neon database?** In a checkout configured for that database, run:

```bash
npm ci
npm run db:migrate
npm run build
```

The script reads `DATABASE_URL` from that checkout's `.env.local` **in preference to shell variables**. Confirm the file targets your existing Neon database and omit `DATABASE_DRIVER=pg` there (or set it to `neon`). The preview checkout may instead point to a separate local Docker database. Migrating the preview does not migrate Neon. To keep separate settings without changing `.env.local`, use `JOB_HUNTER_ENV_FILE=/absolute/path/neon.env npm run db:migrate`; that explicit file takes precedence. The same override works for the MCP process.

The additions are:

| Database object | Purpose |
| --- | --- |
| `jobs.application_url` (nullable text) | Direct application form URL |
| `jobs.company_summary` (text, default empty) | Company context |
| `jobs.connection_note` (text, default empty) | Your connection to the role/company |
| `jobs.form_index` (nullable JSONB) | Scraped questions, field types, and time estimates |
| `hunter_state` (one row, JSONB data + version) | Application queue, sessions, XP ledger, saved answers |

The command is safe to rerun. Existing jobs, statuses, notes, and legacy tables are retained. Existing rows get empty/null new fields; use `index_form` and your next agent scan to fill them. Historical applications still count in the overview; XP starts with applications logged through focus mode. Do **not** seed your existing database to perform this upgrade.

Apply the migration before deploying the updated app. Keep your existing `APP_PASSWORD`, `SESSION_SECRET`, and `AGENT_TOKEN`. `AGENT_TOKEN` is a single fixed bearer token stored in the environment; no per-user setup or OAuth is needed for this personal installation.

## Existing hosted installation

Keep the existing `DATABASE_URL`, `AGENT_TOKEN`, `SESSION_SECRET`, and `APP_PASSWORD`; omit `DATABASE_DRIVER` (or use `neon`) for the existing Neon HTTP driver. Local Postgres uses `DATABASE_DRIVER=pg`. Review and apply `npm run db:migrate` against the intended database before deploying the updated app. Do not run local setup over production credentials.

This MVP is **one personal account per installation**. Paid hosting, billing, multi-user isolation, remote MCP/OAuth, and background scrape workers are deferred. No hosted deployment or production migration is performed by this change. Licensing is intentionally unchanged.

## API and verification

The API accepts the existing signed session cookie or `Authorization: Bearer <AGENT_TOKEN>`. `/api/openapi.json` documents the routes. See [AGENTS.md](AGENTS.md) for existing automation guidance.

New routes:

- `GET /api/hunter`: shortlist, session, completion ledger, and saved answers.
- `POST /api/hunter`: `type` = `select`, `remove`, `start`, `skip`, `complete`, `end`; `slug` for job actions; optional `answers: [{question, answer}]` when completing.
- `POST /api/jobs/{slug}/index`: re-index the stored form URL.

Session changes use optimistic concurrency; job application status and the completion ledger commit together. Duplicate completions do not duplicate XP or answers.

```bash
npm test
npm run typecheck
npm run build
# With the app running against a fresh, disposable LOCAL database:
JOB_HUNTER_ENV_FILE=/absolute/path/test.env npm run test:integration
```

Point the test settings at an isolated local database and a separate app instance using it; do not point them at your preview data. The integration check creates temporary jobs and exercises authentication, job CRUD, concurrent completion, answer persistence, skips, server rendering, and a real MCP client handshake/tool/prompt call. It cleans up its fixtures; do not run it on your working job database.
