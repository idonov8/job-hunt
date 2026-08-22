See [AGENTS.md](./AGENTS.md) for how this project works and how to change the data.

Two things worth repeating here:

- To add, update or remove a job / target / template / playbook card, use the JSON
  API described in AGENTS.md. `db/seed-data.mjs` is the original import only — the
  running site never reads it, so editing it changes nothing.
- Run `npm run typecheck && npm run build` before pushing. `main` auto-deploys.
