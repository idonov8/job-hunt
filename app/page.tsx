import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isValidSession, SESSION_COOKIE } from '@/lib/auth';
import { listJobs } from '@/lib/jobs';
import { sql } from '@/lib/db';
import Hq from './hq';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const store = await cookies();
  if (!(await isValidSession(store.get(SESSION_COOKIE)?.value))) redirect('/login');

  const [jobs, targets, outreach, playbook, scans] = await Promise.all([
    listJobs(),
    sql`select id, group_name, name, description from targets order by position asc, id asc`,
    sql`select id, title, body from outreach order by position asc, id asc`,
    sql`select id, heading, bullets from playbook order by position asc, id asc`,
    sql`select to_char(scanned_on, 'DD Mon YYYY') as scanned_on, sources from scans order by scanned_on desc limit 1`,
  ]);

  return (
    <Hq
      jobs={jobs}
      targets={targets as { id: number; group_name: string; name: string; description: string }[]}
      outreach={outreach as { id: number; title: string; body: string }[]}
      playbook={playbook as { id: number; heading: string; bullets: string[] }[]}
      lastScan={(scans[0] as { scanned_on: string; sources: string } | undefined) ?? null}
    />
  );
}
