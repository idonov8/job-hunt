import { SESSION_COOKIE } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const response = Response.json({ ok: true });
  response.headers.append('Set-Cookie', `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  return response;
}
