# Job Hunt HQ

Full-stack / product engineer openings across Berlin and Israel, with per-role fit
notes, direct-target companies, outreach templates and a weekly playbook.

Originally a local HTML artifact with `localStorage`; now a Next.js app on Vercel
backed by Neon Postgres, so status and notes persist across devices and agents can
read and update the pipeline over an API.

## Stack

- **Next.js 15** (App Router) on Vercel
- **Neon Postgres** via `@neondatabase/serverless`
- No ORM — SQL lives in `db/schema.sql` and `lib/`

## Local development

```bash
npm install
cp .env.example .env.local     # fill in DATABASE_URL and the three secrets
npm run db:migrate             # apply db/schema.sql (safe to re-run)
npm run db:seed                # first-time import; never overwrites status or notes
npm run dev
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** connection string |
| `AGENT_TOKEN` | Bearer token for API access (Claude, scripts, other agents) |
| `APP_PASSWORD` | Password typed once at `/login` to open the web UI |
| `SESSION_SECRET` | Signs the browser session cookie |

## Access

The UI sits behind a password at `/login`, which sets a signed, HTTP-only cookie
good for 90 days. The API accepts either that cookie or
`Authorization: Bearer $AGENT_TOKEN`. `/api/openapi.json` is the one public route.

## API

Full reference: [AGENTS.md](./AGENTS.md), or `GET /api/openapi.json`.

```
GET    /api/jobs?fresh=1&city=Berlin&q=react
POST   /api/jobs
GET    /api/jobs/{slug}
PATCH  /api/jobs/{slug}
DELETE /api/jobs/{slug}

GET|POST           /api/targets  /api/outreach  /api/playbook
PATCH|DELETE       /api/targets/{id}  /api/outreach/{id}  /api/playbook/{id}
GET|POST           /api/meta
```

## Deployment

Push to `main`; Vercel builds and deploys. Schema changes need
`npm run db:migrate` against the production `DATABASE_URL` — it is not run
automatically.
