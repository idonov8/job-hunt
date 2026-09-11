import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { isAgentAuthorized } from '@/lib/auth';
import { scanPrompt } from '@/lib/scan-prompt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ToolResponse = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

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

function createServer(origin: string, authorization: string) {
  const server = new McpServer({ name: 'job-hunter', version: '0.1.0' });
  const api = async (
    path: string,
    method = 'GET',
    body?: unknown,
  ): Promise<ToolResponse> => {
    try {
      const response = await fetch(new URL(path, origin), {
        method,
        redirect: 'error',
        signal: AbortSignal.timeout(45000),
        headers: { authorization, 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return {
        content: [{ type: 'text', text: await response.text() }],
        isError: !response.ok,
      };
    } catch {
      return {
        content: [
          {
            type: 'text',
            text: 'Could not reach Job Hunter. Check that the app is running.',
          },
        ],
        isError: true,
      };
    }
  };

  server.registerTool(
    'get_job_fields',
    {
      description:
        'Get the current fields Job Hunter expects for every scanned opening. Call this at the start of each scan.',
    },
    async () => {
      const response = await api('/api/openapi.json');
      if (response.isError) return response;
      try {
        const document = JSON.parse(response.content[0].text) as {
          components: {
            schemas: { Job: { properties: Record<string, unknown> } };
          };
          paths: {
            '/api/jobs': {
              post: {
                requestBody: {
                  content: {
                    'application/json': { schema: { required: string[] } };
                  };
                };
              };
            };
          };
        };
        const properties = document.components.schemas.Job.properties;
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                required:
                  document.paths['/api/jobs'].post.requestBody.content[
                    'application/json'
                  ].schema.required,
                fields: Object.fromEntries(
                  Object.keys(jobFields).map((field) => [
                    field,
                    properties[field],
                  ]),
                ),
                guidance:
                  'Fill every applicable field for each verified opening. Omit unknown optional facts rather than guessing.',
              }),
            },
          ],
        };
      } catch {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Job Hunter returned an invalid field schema.',
            },
          ],
          isError: true,
        };
      }
    },
  );
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
  return server;
}

async function handle(request: Request) {
  if (!isAgentAuthorized(request))
    return Response.json(
      { error: 'unauthorized', hint: 'Send Authorization: Bearer <AGENT_TOKEN>' },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
    );

  const url = new URL(request.url);
  const requestOrigin = request.headers.get('origin');
  if (requestOrigin) {
    try {
      if (new URL(requestOrigin).origin !== url.origin)
        return Response.json({ error: 'forbidden origin' }, { status: 403 });
    } catch {
      return Response.json({ error: 'forbidden origin' }, { status: 403 });
    }
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createServer(
    url.origin,
    request.headers.get('authorization')!,
  );
  await server.connect(transport);
  return transport.handleRequest(request);
}

export { handle as GET, handle as POST, handle as DELETE };
