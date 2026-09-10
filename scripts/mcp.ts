import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadEnvLocal } from './load-env.mjs';
import { scanPrompt } from '../lib/scan-prompt';
loadEnvLocal();
const base = new URL(process.env.JOB_HUNTER_URL || 'http://127.0.0.1:3000');
if (
  !['http:', 'https:'].includes(base.protocol) ||
  (base.protocol === 'http:' &&
    !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))
)
  throw new Error('Use HTTPS for a remote Job Hunter server');
if (!process.env.AGENT_TOKEN) throw new Error('Set AGENT_TOKEN in .env.local');
const server = new McpServer({ name: 'job-hunter', version: '0.1.0' });
async function api(path: string, method = 'GET', body?: unknown) {
  try {
    const response = await fetch(new URL(path, base), {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(45000),
      headers: {
        authorization: `Bearer ${process.env.AGENT_TOKEN}`,
        'content-type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return {
      content: [{ type: 'text' as const, text: await response.text() }],
      isError: !response.ok,
    };
  } catch {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'Could not reach Job Hunter. Check that the app is running and JOB_HUNTER_URL matches its port.',
        },
      ],
      isError: true,
    };
  }
}
const jobFields = {
  company: z.string().min(1),
  role: z.string().min(1),
  url: z.string().url().optional(),
  application_url: z.string().url().optional(),
  city: z.string().optional(),
  employment: z.string().optional(),
  remote: z.boolean().optional(),
  top_fit: z.boolean().optional(),
  impact: z.boolean().optional(),
  fresh: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  fit_note: z
    .string()
    .optional()
    .describe(
      'Evidence-based fit and honest mismatches; do not invent candidate experience',
    ),
  company_summary: z
    .string()
    .optional()
    .describe('Verified company facts, with source URLs in the text'),
  connection_note: z
    .string()
    .optional()
    .describe(
      'Known connections or relevant candidate work. Say unknown when unsupported',
    ),
  source: z.string().optional(),
  first_seen: z.string().optional(),
  last_seen: z.string().optional(),
};
server.registerTool(
  'list_jobs',
  {
    description: 'Read the pipeline before adding or updating jobs.',
    inputSchema: {
      q: z.string().optional(),
      status: z.enum(['', 'applied', 'talking', 'offer', 'pass']).optional(),
    },
  },
  async (args) =>
    api(`/api/jobs?${new URLSearchParams(args as Record<string, string>)}`),
);
server.registerTool(
  'add_job',
  {
    description:
      'Add a verified job. The server indexes the application form programmatically. On duplicate, update the existing slug.',
    inputSchema: jobFields,
  },
  async (args) => api('/api/jobs', 'POST', args),
);
server.registerTool(
  'update_job',
  {
    description:
      'Partially update verified job facts or status from emails. Preserve user notes and history. Never mark an application submitted without evidence.',
    inputSchema: {
      slug: z.string(),
      changes: z
        .object(jobFields)
        .partial()
        .extend({
          status: z
            .enum(['', 'applied', 'talking', 'offer', 'pass'])
            .optional(),
        }),
    },
  },
  async ({ slug, changes }) =>
    api(`/api/jobs/${encodeURIComponent(slug)}`, 'PATCH', changes),
);
server.registerTool(
  'index_form',
  {
    description:
      'Programmatically re-index the stored application URL. Reports partial or unknown when the site hides controls. Never replace scraper results with guessed counts.',
    inputSchema: { slug: z.string() },
  },
  async ({ slug }) =>
    api(`/api/jobs/${encodeURIComponent(slug)}/index`, 'POST'),
);
server.registerTool(
  'record_scan',
  {
    description:
      'Record a completed daily or weekly scan and its verified sources.',
    inputSchema: {
      scanned_on: z.string(),
      sources: z.string(),
      jobs_added: z.number().int().nonnegative(),
      summary: z.string(),
    },
  },
  async (args) => api('/api/meta', 'POST', args),
);
server.registerPrompt(
  'job_scan',
  {
    description:
      'Daily or weekly job scouting and evidence-based email reconciliation.',
    argsSchema: {
      preferences: z.string(),
      cadence: z.enum(['daily', 'weekly']).optional(),
    },
  },
  async ({ preferences, cadence }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: scanPrompt(preferences, cadence || 'daily'),
        },
      },
    ],
  }),
);
async function main() {
  await server.connect(new StdioServerTransport());
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
