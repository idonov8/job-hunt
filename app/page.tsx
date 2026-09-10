import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isValidSession, SESSION_COOKIE } from '@/lib/auth';
import { listJobs } from '@/lib/jobs';
import { getHunter } from '@/lib/hunter';
import Hunter from './hunter';
export const dynamic = 'force-dynamic';
export default async function Page() {
  if (!(await isValidSession((await cookies()).get(SESSION_COOKIE)?.value)))
    redirect('/login');
  const [jobs, state] = await Promise.all([listJobs(), getHunter()]);
  return <Hunter initialJobs={jobs} initialState={state} />;
}
