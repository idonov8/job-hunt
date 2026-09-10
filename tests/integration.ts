import assert from 'node:assert/strict';
import { createSql } from '../scripts/database.mjs';
import { loadEnvLocal } from '../scripts/load-env.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
loadEnvLocal();
const base = process.env.JOB_HUNTER_URL!;
async function api(
  path: string,
  body?: unknown,
  method = body ? 'POST' : 'GET',
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      authorization: `Bearer ${process.env.AGENT_TOKEN}`,
      'content-type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}
async function main() {
  assert.equal((await fetch(base + '/api/hunter')).status, 401);
  assert.equal(
    new URL(process.env.DATABASE_URL!).hostname,
    '127.0.0.1',
    'Only run integration tests on a local disposable database',
  );
  const first = await api('/api/hunter');
  assert.equal(
    first.body.state.selected.length,
    0,
    'Run this check against a fresh disposable database',
  );
  const slugs: string[] = [];
  try {
    for (let i = 0; i < 3; i++) {
      const r = await api('/api/jobs', {
        company: 'Integration fixture',
        role: `Role ${Date.now()}-${i}`,
        company_summary: 'Test company',
        fit_note: 'Test fit',
      });
      assert.equal(r.status, 201);
      slugs.push(r.body.job.slug);
    }
    for (const slug of slugs)
      assert.equal(
        (await api('/api/hunter', { type: 'select', slug })).status,
        200,
      );
    await api('/api/hunter', { type: 'start' });
    const action = {
      type: 'complete',
      slug: slugs[0],
      answers: [
        {
          question: 'Describe a complex system',
          answer: 'A durable event processor',
        },
      ],
    };
    const concurrent = await Promise.all([
      api('/api/hunter', action),
      api('/api/hunter', action),
    ]);
    assert.ok(concurrent.every((r) => r.status === 200));
    const saved = (await api('/api/hunter')).body.state;
    assert.equal(
      saved.completed.filter((c: { slug: string }) => c.slug === slugs[0])
        .length,
      1,
    );
    assert.equal(
      saved.answers.filter((a: { slug: string }) => a.slug === slugs[0]).length,
      1,
    );
    assert.equal(
      (await api('/api/jobs/' + slugs[0])).body.job.status,
      'applied',
    );
    await api('/api/hunter', { type: 'skip', slug: slugs[1] });
    await api('/api/hunter', { type: 'skip', slug: slugs[2] });
    assert.equal((await api('/api/hunter')).body.state.session.ended, true);
    const login = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: process.env.APP_PASSWORD }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await fetch(base+'/api/hunter',{method:'POST',headers:{cookie,origin:'https://untrusted.example','content-type':'application/json'},body:JSON.stringify({type:'end'})})).status,401);
    assert.equal((await fetch(base+'/api/hunter',{method:'POST',headers:{cookie,origin:base,'content-type':'application/json'},body:JSON.stringify({type:'end'})})).status,200);
    assert.equal((await fetch(base, { headers: { cookie } })).status, 200);
    const client = new Client({ name: 'job-hunter-check', version: '1.0' });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: ['--import', 'tsx', 'scripts/mcp.ts'],
        cwd: process.cwd(),
      }),
    );
    try {
      assert.ok(
        (await client.listTools()).tools.some((t) => t.name === 'add_job'),
      );
      const result = await client.callTool({
        name: 'list_jobs',
        arguments: { q: 'Integration fixture' },
      });
      assert.ok(!result.isError);
      assert.ok(
        (
          await client.getPrompt({
            name: 'job_scan',
            arguments: { preferences: 'Berlin product engineering' },
          })
        ).messages.length,
      );
    } finally {
      await client.close();
    }
    console.log(
      'PASS: authenticated API, job CRUD, concurrent completion, XP, answers, skips, page rendering and MCP handshake/tools/prompt',
    );
  } finally {
    await api('/api/hunter', { type: 'end' });
    for (const slug of slugs)
      await api('/api/jobs/' + slug, undefined, 'DELETE');
    const current = (await api('/api/hunter')).body.state;
    current.selected = current.selected.filter(
      (s: string) => !slugs.includes(s),
    );
    current.completed = current.completed.filter(
      (c: { slug: string }) => !slugs.includes(c.slug),
    );
    current.answers = current.answers.filter(
      (a: { slug: string }) => !slugs.includes(a.slug),
    );
    if (
      current.session &&
      [
        ...current.session.queue,
        ...current.session.done,
        ...current.session.skipped,
      ].every((s: string) => slugs.includes(s))
    )
      current.session = null;
    await createSql().query(
      'update hunter_state set data=$1::jsonb, version=version+1 where id=1',
      [JSON.stringify(current)],
    );
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
