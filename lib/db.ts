import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let client: NeonQueryFunction<false, false> | null = null;

function connect(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    client = neon(url);
  }
  return client;
}

/**
 * Tagged-template SQL client. Interpolated values are always sent as bound
 * parameters, so sql`select * from jobs where slug = ${slug}` is safe.
 *
 * Connecting is deferred to the first query so that `next build` — which imports
 * every route module — does not need a live DATABASE_URL.
 */
export const sql = new Proxy(function () {} as unknown as NeonQueryFunction<false, false>, {
  apply: (_target, _thisArg, args: Parameters<NeonQueryFunction<false, false>>) =>
    connect()(...args),
  get: (_target, property: keyof NeonQueryFunction<false, false>) => connect()[property],
});
