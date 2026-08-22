import { createSessionValue, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let password = '';
  try {
    const body = await request.json();
    password = String(body?.password ?? '');
  } catch {
    return Response.json({ error: 'body must be valid JSON' }, { status: 400 });
  }

  const expected = process.env.APP_PASSWORD;
  if (!expected || password !== expected) {
    return Response.json({ error: 'wrong password' }, { status: 401 });
  }

  const response = Response.json({ ok: true });
  const options = sessionCookieOptions();
  response.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=${await createSessionValue()}; Path=${options.path}; Max-Age=${options.maxAge}; HttpOnly; SameSite=Lax${options.secure ? '; Secure' : ''}`,
  );
  return response;
}
