import { requireAuth } from '@/lib/auth';
import { getJob } from '@/lib/jobs';
import { indexForm } from '@/lib/form-index';
import { sql } from '@/lib/db';
export const runtime = 'nodejs';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const denied = await requireAuth(request);
  if (denied) return denied;
  const { slug } = await params;
  const job = await getJob(slug);
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
  const url = job.application_url || job.url;
  if (!url)
    return Response.json(
      { error: 'Add an application URL first' },
      { status: 400 },
    );
  const index = await indexForm(url);
  await sql.query(
    'update jobs set form_index=$1::jsonb where slug=$2 and coalesce(application_url,url)=$3',
    [JSON.stringify(index), slug, url],
  );
  return Response.json({ job: await getJob(slug) });
}
