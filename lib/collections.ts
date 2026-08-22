import { sql } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * Targets, outreach templates and playbook sections are all the same shape of
 * resource: a flat table with an integer id, a handful of writable columns and a
 * fixed sort. This builds the GET/POST and GET/PATCH/DELETE handlers for one.
 */

type Coerce = (value: unknown) => unknown;

export type Collection = {
  table: 'targets' | 'outreach' | 'playbook';
  key: string;      // JSON key for the list response
  item: string;     // JSON key for a single row
  columns: string[];
  writable: Record<string, Coerce>;
  required: string[];
  orderBy: string;
};

export const asText: Coerce = (value) => String(value ?? '');
export const asInt: Coerce = (value) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
export const asTextArray: Coerce = (value) => (Array.isArray(value) ? value.map(String) : []);

export const TARGETS: Collection = {
  table: 'targets',
  key: 'targets',
  item: 'target',
  columns: ['id', 'group_name', 'name', 'description', 'position', 'updated_at'],
  writable: { group_name: asText, name: asText, description: asText, position: asInt },
  required: ['group_name', 'name'],
  orderBy: 'position asc, id asc',
};

export const OUTREACH: Collection = {
  table: 'outreach',
  key: 'outreach',
  item: 'template',
  columns: ['id', 'title', 'body', 'position', 'updated_at'],
  writable: { title: asText, body: asText, position: asInt },
  required: ['title', 'body'],
  orderBy: 'position asc, id asc',
};

export const PLAYBOOK: Collection = {
  table: 'playbook',
  key: 'playbook',
  item: 'section',
  columns: ['id', 'heading', 'bullets', 'position', 'updated_at'],
  writable: { heading: asText, bullets: asTextArray, position: asInt },
  required: ['heading'],
  orderBy: 'position asc, id asc',
};

function pick(collection: Collection, body: Record<string, unknown>) {
  const values: Record<string, unknown> = {};
  for (const [field, coerce] of Object.entries(collection.writable)) {
    if (field in body) values[field] = coerce(body[field]);
  }
  return values;
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function collectionHandlers(collection: Collection) {
  const select = collection.columns.join(', ');

  return {
    async GET(request: Request) {
      const denied = await requireAuth(request);
      if (denied) return denied;

      const rows = await sql.query(
        `select ${select} from ${collection.table} order by ${collection.orderBy}`,
      );
      return Response.json({ count: rows.length, [collection.key]: rows });
    },

    async POST(request: Request) {
      const denied = await requireAuth(request);
      if (denied) return denied;

      const body = await readBody(request);
      if (!body) return Response.json({ error: 'body must be valid JSON' }, { status: 400 });

      const missing = collection.required.filter((field) => !body[field]);
      if (missing.length) {
        return Response.json(
          { error: 'invalid', message: `missing required field(s): ${missing.join(', ')}` },
          { status: 400 },
        );
      }

      const values = pick(collection, body);
      const fields = Object.keys(values);
      const rows = await sql.query(
        `insert into ${collection.table} (${fields.join(', ')})
         values (${fields.map((_, i) => `$${i + 1}`).join(', ')})
         returning ${select}`,
        fields.map((field) => values[field]),
      );
      return Response.json({ [collection.item]: rows[0] }, { status: 201 });
    },
  };
}

export function itemHandlers(collection: Collection) {
  const select = collection.columns.join(', ');
  const missing = (id: string) =>
    Response.json({ error: 'not_found', message: `no ${collection.table} row with id ${id}` }, { status: 404 });

  return {
    async PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
      const denied = await requireAuth(request);
      if (denied) return denied;

      const { id } = await params;
      const body = await readBody(request);
      if (!body) return Response.json({ error: 'body must be valid JSON' }, { status: 400 });

      const values = pick(collection, body);
      const fields = Object.keys(values);
      if (!fields.length) {
        return Response.json({ error: 'invalid', message: 'no writable fields in body' }, { status: 400 });
      }

      const rows = await sql.query(
        `update ${collection.table} set ${fields.map((f, i) => `${f} = $${i + 2}`).join(', ')}
         where id = $1 returning ${select}`,
        [id, ...fields.map((field) => values[field])],
      );
      return rows.length ? Response.json({ [collection.item]: rows[0] }) : missing(id);
    },

    async DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
      const denied = await requireAuth(request);
      if (denied) return denied;

      const { id } = await params;
      const rows = await sql.query(`delete from ${collection.table} where id = $1 returning id`, [id]);
      return rows.length ? Response.json({ deleted: Number(id) }) : missing(id);
    },
  };
}
