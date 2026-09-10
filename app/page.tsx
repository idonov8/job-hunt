import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isValidSession, SESSION_COOKIE } from '@/lib/auth';
import { listJobs } from '@/lib/jobs';
import { getHunter } from '@/lib/hunter';
import Hunter from './hunter';
import { sql } from '@/lib/db';
export const dynamic = 'force-dynamic';
export default async function Page() {
  if (!(await isValidSession((await cookies()).get(SESSION_COOKIE)?.value)))
    redirect('/login');
  const [jobs, state, scans] = await Promise.all([
    listJobs(),
    getHunter(),
    sql`select to_char(scanned_on, 'DD Mon YYYY') as scanned_on, sources from scans order by scanned_on desc, id desc limit 1`,
  ]);
  return (
    <Hunter
      initialJobs={jobs}
      initialState={state}
      lastScan={scans[0] ?? null}
    />
  );
}
