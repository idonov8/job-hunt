import { requireAuth } from '@/lib/auth';
import { deleteJob, getJob, pickWritable, updateJob, ValidationError } from '@/lib/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ slug: string }> };

const notFound = (slug: string) =>
  Response.json({ error: 'not_found', message: `no job with slug "${slug}"` }, { status: 404 });

export async function GET(request: Request, { params }: Context) {
  const denied = await requireAuth(request);
  if (denied) return denied;

  const { slug } = await params;
  const job = await getJob(slug);
  return job ? Response.json({ job }) : notFound(slug);
}

export async function PATCH(request: Request, { params }: Context) {
  const denied = await requireAuth(request);
  if (denied) return denied;

  const { slug } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'body must be valid JSON' }, { status: 400 });
  }

  try {
    const job = await updateJob(slug, pickWritable(body));
    return job ? Response.json({ job }) : notFound(slug);
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ error: 'invalid', message: error.message }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const denied = await requireAuth(request);
  if (denied) return denied;

  const { slug } = await params;
  return (await deleteJob(slug)) ? Response.json({ deleted: slug }) : notFound(slug);
}
