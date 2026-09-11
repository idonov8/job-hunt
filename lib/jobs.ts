import { sql } from '@/lib/db';
import { webUrl, indexForm } from '@/lib/form-index';
import type { FormIndex } from '@/lib/hunter-model';

export const STATUSES = ['', 'applied', 'talking', 'offer', 'pass'] as const;
export type Status = (typeof STATUSES)[number];

export type Job = {
  application_url: string | null;
  company_summary: string;
  connection_note: string;
  form_index: FormIndex | null;
  slug: string;
  company: string;
  role: string;
  url: string | null;
  city: string | null;
  employment: string | null;
  remote: boolean;
  top_fit: boolean;
  impact: boolean;
  fresh: boolean;
  tags: string[];
  fit_note: string;
  status: Status;
  my_notes: string;
  source: string | null;
  first_seen: string;
  last_seen: string;
  updated_at: string;
};

const SELECT_COLUMNS = `
  slug, company, role, url, city, employment, remote, top_fit, impact, fresh,
  tags, fit_note, status, my_notes, source, application_url, company_summary, connection_note, form_index,
  to_char(first_seen, 'YYYY-MM-DD') as first_seen,
  to_char(last_seen, 'YYYY-MM-DD') as last_seen,
  updated_at
`;

/** Columns an API caller is allowed to write, and how each value is validated. */
const WRITABLE = {
  company: (v: unknown) => nonEmptyString(v, 'company'),
  role: (v: unknown) => nonEmptyString(v, 'role'),
  url: validUrl,
  application_url: validUrl,
  company_summary: (v: unknown) => String(v ?? '').slice(0,10000),
  connection_note: (v: unknown) => String(v ?? '').slice(0,10000),
  city: (v: unknown) => nullableString(v),
  employment: (v: unknown) => nullableString(v),
  remote: (v: unknown) => Boolean(v),
  top_fit: (v: unknown) => Boolean(v),
  impact: (v: unknown) => Boolean(v),
  fresh: (v: unknown) => Boolean(v),
  tags: (v: unknown) => toStringArray(v),
  fit_note: (v: unknown) => String(v ?? ''),
  status: (v: unknown) => toStatus(v),
  my_notes: (v: unknown) => String(v ?? ''),
  source: (v: unknown) => nullableString(v),
  first_seen: (v: unknown) => nullableString(v),
  last_seen: (v: unknown) => nullableString(v),
} as const;

export type WritableField = keyof typeof WRITABLE;
export const WRITABLE_FIELDS = Object.keys(WRITABLE) as WritableField[];

export class ValidationError extends Error {}

function validUrl(value: unknown) {
  try { return webUrl(value); } catch { throw new ValidationError('URL must use http(s) without credentials'); }
}

function nonEmptyString(value: unknown, field: string): string {
  const text = String(value ?? '').trim();
  if (!text) throw new ValidationError(`"${field}" is required and cannot be empty`);
  return text;
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function toStringArray(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new ValidationError('"tags" must be an array of strings');
  return value.map((tag) => String(tag));
}

function toStatus(value: unknown): Status {
  const status = String(value ?? '');
  if (!(STATUSES as readonly string[]).includes(status)) {
    throw new ValidationError(`"status" must be one of: ${STATUSES.map((s) => s || '""').join(', ')}`);
  }
  return status as Status;
}

/** Picks the writable fields present in `body` and validates each one. */
export function pickWritable(body: Record<string, unknown>): Partial<Record<WritableField, unknown>> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('Body must be an object');
  const picked: Partial<Record<WritableField, unknown>> = {};
  for (const field of WRITABLE_FIELDS) {
    if (field in body) picked[field] = WRITABLE[field](body[field]);
  }
  return picked;
}

export type JobFilters = {
  status?: string | null;
  city?: string | null;
  employment?: string | null;
  top_fit?: boolean;
  impact?: boolean;
  fresh?: boolean;
  remote?: boolean;
  q?: string | null;
};

export async function listJobs(filters: JobFilters = {}): Promise<Job[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (clause: string, value: unknown) => {
    params.push(value);
    where.push(clause.replace('?', `$${params.length}`));
  };

  if (filters.status !== undefined && filters.status !== null) add('status = ?', filters.status);
  if (filters.city) add('city = ?', filters.city);
  if (filters.employment) add('employment = ?', filters.employment);
  if (filters.top_fit) where.push('top_fit');
  if (filters.impact) where.push('impact');
  if (filters.fresh) where.push('fresh');
  if (filters.remote) where.push("(remote or city = 'Remote')");
  if (filters.q) {
    add(
      "(company || ' ' || role || ' ' || fit_note || ' ' || my_notes || ' ' || array_to_string(tags, ' ')) ilike ?",
      `%${filters.q}%`,
    );
  }

  const clause = where.length ? `where ${where.join(' and ')}` : '';
  const rows = await sql.query(
    `select ${SELECT_COLUMNS} from jobs ${clause}
     order by fresh desc, top_fit desc, company asc, role asc`,
    params,
  );
  return rows as Job[];
}

export async function getJob(slug: string): Promise<Job | null> {
  const rows = await sql.query(`select ${SELECT_COLUMNS} from jobs where slug = $1`, [slug]);
  return (rows[0] as Job) ?? null;
}

export async function insertJob(
  slug: string,
  values: Partial<Record<WritableField, unknown>>,
): Promise<Job> {
  const fields = Object.keys(values) as WritableField[];
  const columns = ['slug', ...fields];
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const rows = await sql.query(
    `insert into jobs (${columns.join(', ')}) values (${placeholders.join(', ')})
     returning ${SELECT_COLUMNS}`,
    [slug, ...fields.map((field) => values[field])],
  );
  return refreshForm(rows[0] as Job);
}

export async function updateJob(
  slug: string,
  values: Partial<Record<WritableField, unknown>>,
): Promise<Job | null> {
  const fields = Object.keys(values) as WritableField[];
  if (fields.length === 0) return getJob(slug);

  const assignments = fields.map((field, index) => `${field} = $${index + 2}`);
  const rows = await sql.query(
    `update jobs set ${assignments.join(', ')} where slug = $1 returning ${SELECT_COLUMNS}`,
    [slug, ...fields.map((field) => values[field])],
  );
  const job = (rows[0] as Job) ?? null;
  return job && ('url' in values || 'application_url' in values) ? refreshForm(job) : job;
}

async function refreshForm(job: Job): Promise<Job> {
  const url = job.application_url || job.url;
  const index = url ? await indexForm(url) : null;
  await sql.query('update jobs set form_index=$1::jsonb where slug=$2 and coalesce(application_url,url) is not distinct from $3', [JSON.stringify(index), job.slug, url]);
  return (await getJob(job.slug))!;
}

export async function deleteJob(slug: string): Promise<boolean> {
  const rows = await sql.query('delete from jobs where slug = $1 returning slug', [slug]);
  return rows.length > 0;
}
