import { sql } from './db';
import { getJob } from './jobs';
import { transition, type Action, type HunterState } from './hunter-model';
import { z } from 'zod';
export const actionSchema = z.object({
  type: z.enum(['select', 'remove', 'start', 'skip', 'complete', 'end']),
  slug: z.string().min(1).max(100).optional(),
  answers: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(1000),
        answer: z.string().trim().min(1).max(20000),
      }),
    )
    .max(100)
    .optional(),
});
export async function getHunter(): Promise<HunterState> {
  const [row] = await sql.query('select data from hunter_state where id = 1');
  return row.data;
}
export async function act(raw: Action): Promise<HunterState> {
  const action = actionSchema.parse(raw);
  for (let attempt = 0; attempt < 5; attempt++) {
    const [row] = await sql.query(
      'select data, version from hunter_state where id = 1',
    );
    const job = action.slug ? await getJob(action.slug) : null;
    if (action.slug && !job) throw new Error('Job no longer exists');
    if (
      action.type === 'select' &&
      (job?.status ||
        row.data.completed.some(
          (c: { slug: string }) => c.slug === action.slug,
        ))
    )
      throw new Error('Only unstarted jobs can be selected');
    if (action.type === 'start') {
      const jobs = await sql.query(
        "select slug, form_index from jobs where status = ''",
      );
      row.data.selected = row.data.selected.filter((s: string) =>
        jobs.some((j: { slug: string }) => j.slug === s),
      );
      row.data.selected.sort(
        (a: string, b: string) =>
          (jobs.find((j: { slug: string }) => j.slug === a)?.form_index
            ?.minutes ?? Infinity) -
          (jobs.find((j: { slug: string }) => j.slug === b)?.form_index
            ?.minutes ?? Infinity),
      );
    }
    const alreadyCompleted = row.data.completed.some(
      (c: { slug: string }) => c.slug === action.slug,
    );
    if (action.type === 'complete' && !alreadyCompleted && job?.status)
      throw new Error(
        'This job is already tracked as applied or closed; end this session and refresh',
      );
    const state = transition(row.data, action);
    if (action.type === 'complete' && !alreadyCompleted)
      for (const answer of action.answers ?? [])
        state.answers.push({
          ...answer,
          company: job!.company,
          slug: job!.slug,
          saved_at: new Date().toISOString(),
        });
    // Compare-and-swap serializes concurrent tabs; the job status and XP ledger commit together.
    const rows = await sql.query(
      `with saved as (
      update hunter_state set data=$1::jsonb, version=version+1 where id=1 and version=$2 returning data
    ), applied as (
      update jobs set status=case when status='' then 'applied' else status end where slug=$3 and $4::boolean and exists(select 1 from saved) returning slug
    ) select data from saved`,
      [
        JSON.stringify(state),
        row.version,
        action.slug ?? '',
        action.type === 'complete' && !alreadyCompleted,
      ],
    );
    if (rows.length) return rows[0].data;
  }
  throw new Error('Another tab changed the session. Please try again.');
}
