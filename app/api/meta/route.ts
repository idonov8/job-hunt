import { sql } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Counters for the stat row, plus when the listings were last refreshed. */
export async function GET(request: Request) {
  const denied = await requireAuth(request);
  if (denied) return denied;

  const [stats] = await sql`
    select
      count(*)::int                                        as tracked,
      count(*) filter (where fresh)::int                   as fresh,
      count(*) filter (where top_fit)::int                 as top_fit,
      count(*) filter (where impact)::int                  as impact,
      count(*) filter (where status = 'applied')::int      as applied,
      count(*) filter (where status = 'talking')::int      as talking,
      count(*) filter (where status = 'offer')::int        as offers,
      count(*) filter (where status = 'pass')::int         as passed
    from jobs
  `;

  const [scan] = await sql`
    select to_char(scanned_on, 'YYYY-MM-DD') as scanned_on, sources, jobs_added, summary
    from scans order by scanned_on desc limit 1
  `;

  return Response.json({ stats, last_scan: scan ?? null });
}

/** Record a new scan — call this after refreshing the listings. */
export async function POST(request: Request) {
  const denied = await requireAuth(request);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'body must be valid JSON' }, { status: 400 });
  }

  const [scan] = await sql`
    insert into scans (scanned_on, sources, jobs_added, summary)
    values (
      coalesce(${(body.scanned_on as string) ?? null}::date, current_date),
      ${String(body.sources ?? '')},
      ${Number(body.jobs_added ?? 0) || 0},
      ${String(body.summary ?? '')}
    )
    returning id, to_char(scanned_on, 'YYYY-MM-DD') as scanned_on, sources, jobs_added, summary
  `;

  return Response.json({ scan }, { status: 201 });
}
