import { requireAuth } from '@/lib/auth';
import { slugify } from '@/lib/slug';
import { getJob, insertJob, listJobs, pickWritable, ValidationError } from '@/lib/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function flag(params: URLSearchParams, name: string): boolean {
  const value = params.get(name);
  return value === '' || value === '1' || value === 'true';
}

export async function GET(request: Request) {
  const denied = await requireAuth(request);
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const jobs = await listJobs({
    status: params.has('status') ? params.get('status') : undefined,
    city: params.get('city'),
    employment: params.get('employment'),
    top_fit: flag(params, 'top_fit'),
    impact: flag(params, 'impact'),
    fresh: flag(params, 'fresh'),
    remote: flag(params, 'remote'),
    q: params.get('q'),
  });

  return Response.json({ count: jobs.length, jobs });
}

export async function POST(request: Request) {
  const denied = await requireAuth(request);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'body must be valid JSON' }, { status: 400 });
  }

  try {
    if (!body.company || !body.role) {
      return Response.json({ error: '"company" and "role" are required' }, { status: 400 });
    }
    const values = pickWritable(body);
    const slug = String(body.slug ?? '') || slugify(String(body.company), String(body.role));

    if (await getJob(slug)) {
      return Response.json(
        { error: 'conflict', message: `a job with slug "${slug}" already exists — PATCH it instead`, slug },
        { status: 409 },
      );
    }

    const job = await insertJob(slug, values);
    return Response.json({ job }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ error: 'invalid', message: error.message }, { status: 400 });
    }
    throw error;
  }
}
