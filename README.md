# Job Hunter

A deliberately small Rails application for tracking and completing job applications. It uses server-rendered HTML, PostgreSQL, plain JSON endpoints, and one short vanilla JavaScript file. There is no React build, Node runtime, Hotwire, Redis, background worker, or model API key.

## Local setup

Requires Ruby 3.4, Bundler, and Docker Compose.

```bash
cp .env.example .env
# Replace the three secrets in .env. Generate SECRET_KEY_BASE with: bin/rails secret
bundle install
docker compose up -d --wait
bin/rails db:prepare
bin/rails server
```

Open <http://127.0.0.1:3000> and sign in with `APP_PASSWORD`. PostgreSQL binds only to loopback port 54329 and persists in a Docker volume. Existing PostgreSQL installations can point `DATABASE_URL` at the current database; the schema preserves all original tables and fields.

## Architecture

- `app/models/job.rb` owns job validation, filtering, ordering, and API serialization.
- `app/services/hunter_transition.rb` is the deterministic queue/session/XP state machine.
- `app/services/form_indexer.rb` performs bounded static HTML form indexing without a browser or AI.
- `app/controllers/api` contains the authenticated JSON API.
- `app/views` is server-rendered ERB; `app/assets/javascripts/application.js` only handles tabs, local filters, queue actions, and copy buttons.
- `db/schema.sql` remains the readable, repeatable source of truth; `db/structure.sql` is its Rails-loadable copy.

The app retains `/api/jobs`, `/api/targets`, `/api/outreach`, `/api/playbook`, `/api/meta`, `/api/hunter`, `/api/openapi.json`, and the Streamable HTTP-style `/mcp` JSON-RPC endpoint. API calls accept a signed browser session or `Authorization: Bearer $AGENT_TOKEN`. `/tracker` redirects to `/`.

## Workflow

Use **Openings** to search and filter roles, then add promising roles to **Application Queue**. Starting a session persists the queue. Completing an application marks its job `applied`, stores user-entered answers, and awards 100 XP only once. The state ledger lives in one locked PostgreSQL row so job status and XP are committed in the same transaction.

Open `/scan` for a copyable assistant setup prompt. MCP tools expose the current writable fields, job listing/insertion/update, form indexing, and scan recording. The assistant must verify job facts, preserve notes/history, and never fabricate a completion or form count.

## Checks

```bash
bin/rails test
bin/rails zeitwerk:check
bin/rubocop
bin/brakeman --no-pager
RAILS_ENV=production SECRET_KEY_BASE=dummy bin/rails assets:precompile
```
