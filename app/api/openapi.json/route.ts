export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public on purpose — it carries no data, and an agent needs to be able to
 * discover the API shape before it has been handed a token.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  const job = {
    type: 'object',
    properties: {
      slug: { type: 'string', description: 'Stable handle, derived from company + role. Use it as the id.' },
      company: { type: 'string' },
      role: { type: 'string' },
      url: { type: 'string', nullable: true, description: 'Link to the posting' },
      city: { type: 'string', nullable: true, enum: ['Berlin', 'Israel', 'Remote'] },
      employment: { type: 'string', nullable: true, enum: ['Full-time', 'Part-time', 'Freelance', 'Contract'] },
      remote: { type: 'boolean' },
      top_fit: { type: 'boolean', description: 'Flagged as an unusually strong match' },
      impact: { type: 'boolean', description: 'Mission-driven / climate / health' },
      fresh: { type: 'boolean', description: 'Surfaced by the most recent scan' },
      tags: { type: 'array', items: { type: 'string' } },
      fit_note: { type: 'string', description: 'The curated "why this one" note shown on the card' },
      status: { type: 'string', enum: ['', 'applied', 'talking', 'offer', 'pass'] },
      my_notes: { type: 'string', description: "Ido's own running notes" },
      source: { type: 'string', nullable: true },
      first_seen: { type: 'string', format: 'date' },
      last_seen: { type: 'string', format: 'date' },
      updated_at: { type: 'string', format: 'date-time', readOnly: true },
    },
  };

  const authed = [{ bearerAuth: [] }];
  const idParam = (name: string, description: string) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' },
    description,
  });

  const collection = (key: string, item: string, itemSchema: object, required: string[]) => ({
    get: {
      summary: `List ${key}`,
      security: authed,
      responses: { '200': { description: 'OK' }, '401': { description: 'Unauthorized' } },
    },
    post: {
      summary: `Create a ${item}`,
      security: authed,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { ...itemSchema, required } } },
      },
      responses: { '201': { description: 'Created' }, '400': { description: 'Invalid body' } },
    },
  });

  const itemPath = (item: string, itemSchema: object) => ({
    parameters: [idParam('id', `Numeric id of the ${item}`)],
    patch: {
      summary: `Update a ${item} (partial)`,
      security: authed,
      requestBody: { required: true, content: { 'application/json': { schema: itemSchema } } },
      responses: { '200': { description: 'OK' }, '404': { description: 'Not found' } },
    },
    delete: {
      summary: `Delete a ${item}`,
      security: authed,
      responses: { '200': { description: 'Deleted' }, '404': { description: 'Not found' } },
    },
  });

  const targetSchema = {
    type: 'object',
    properties: {
      group_name: { type: 'string', description: 'Heading the target is filed under' },
      name: { type: 'string' },
      description: { type: 'string' },
      position: { type: 'integer' },
    },
  };

  const outreachSchema = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      body: { type: 'string', description: 'Plain-text template, [Name] style placeholders' },
      position: { type: 'integer' },
    },
  };

  const playbookSchema = {
    type: 'object',
    properties: {
      heading: { type: 'string' },
      bullets: { type: 'array', items: { type: 'string' } },
      position: { type: 'integer' },
    },
  };

  return Response.json({
    openapi: '3.1.0',
    info: {
      title: 'Job Hunt HQ API',
      version: '1.0.0',
      description:
        "Ido's job-hunt tracker. Every endpoint needs `Authorization: Bearer <AGENT_TOKEN>` " +
        '(this document is the only public route). Jobs are addressed by `slug`; targets, ' +
        'outreach templates and playbook sections by numeric `id`.',
    },
    servers: [{ url: origin }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
      schemas: { Job: job },
    },
    paths: {
      '/api/jobs': {
        get: {
          summary: 'List jobs',
          description: 'All filters combine with AND. Omit them all to get everything.',
          security: authed,
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['', 'applied', 'talking', 'offer', 'pass'] } },
            { name: 'city', in: 'query', schema: { type: 'string' } },
            { name: 'employment', in: 'query', schema: { type: 'string' } },
            { name: 'top_fit', in: 'query', schema: { type: 'boolean' } },
            { name: 'impact', in: 'query', schema: { type: 'boolean' } },
            { name: 'fresh', in: 'query', schema: { type: 'boolean' } },
            { name: 'remote', in: 'query', schema: { type: 'boolean' } },
            { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Case-insensitive search across company, role, notes and tags' },
          ],
          responses: { '200': { description: 'OK' }, '401': { description: 'Unauthorized' } },
        },
        post: {
          summary: 'Add a job',
          description: 'Slug is derived from company + role unless you pass one explicitly.',
          security: authed,
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { ...job, required: ['company', 'role'] } } },
          },
          responses: {
            '201': { description: 'Created' },
            '400': { description: 'Invalid body' },
            '409': { description: 'Slug already exists — PATCH instead' },
          },
        },
      },
      '/api/jobs/{slug}': {
        parameters: [idParam('slug', 'Job slug')],
        get: { summary: 'Get one job', security: authed, responses: { '200': { description: 'OK' }, '404': { description: 'Not found' } } },
        patch: {
          summary: 'Update a job (partial)',
          description: 'Send only the fields you want to change, e.g. {"status":"applied"}.',
          security: authed,
          requestBody: { required: true, content: { 'application/json': { schema: job } } },
          responses: { '200': { description: 'OK' }, '404': { description: 'Not found' } },
        },
        delete: { summary: 'Delete a job', security: authed, responses: { '200': { description: 'Deleted' }, '404': { description: 'Not found' } } },
      },
      '/api/targets': collection('targets', 'target', targetSchema, ['group_name', 'name']),
      '/api/targets/{id}': itemPath('target', targetSchema),
      '/api/outreach': collection('outreach templates', 'template', outreachSchema, ['title', 'body']),
      '/api/outreach/{id}': itemPath('template', outreachSchema),
      '/api/playbook': collection('playbook sections', 'section', playbookSchema, ['heading']),
      '/api/playbook/{id}': itemPath('section', playbookSchema),
      '/api/meta': {
        get: { summary: 'Counters and the last recorded scan', security: authed, responses: { '200': { description: 'OK' } } },
        post: {
          summary: 'Record a scan',
          description: 'Call after refreshing listings so the footer shows the new date.',
          security: authed,
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    scanned_on: { type: 'string', format: 'date', description: 'Defaults to today' },
                    sources: { type: 'string' },
                    jobs_added: { type: 'integer' },
                    summary: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Created' } },
        },
      },
    },
  });
}
