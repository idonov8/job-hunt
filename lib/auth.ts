/**
 * Two ways in, both checked by `requireAuth`:
 *
 *   1. Agents  — `Authorization: Bearer $AGENT_TOKEN`
 *   2. Browser — an HMAC-signed `hq_session` cookie, issued by POST /api/auth/login
 *                in exchange for $APP_PASSWORD
 */

export const SESSION_COOKIE = 'hq_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

const encoder = new TextEncoder();

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(requiredEnv('SESSION_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Buffer.from(signature).toString('base64url');
}

/** Length-independent, constant-time-ish comparison. */
function safeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < Math.max(aBytes.length, bBytes.length); i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

export async function createSessionValue(): Promise<string> {
  const issuedAt = String(Date.now());
  return `${issuedAt}.${await sign(issuedAt)}`;
}

export async function isValidSession(value: string | undefined | null): Promise<boolean> {
  if (!value) return false;
  const [issuedAt, signature] = value.split('.');
  if (!issuedAt || !signature) return false;
  if (!safeEqual(signature, await sign(issuedAt))) return false;
  const age = (Date.now() - Number(issuedAt)) / 1000;
  return Number.isFinite(age) && age >= 0 && age < SESSION_MAX_AGE;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  };
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export async function isAuthorized(request: Request): Promise<boolean> {
  if (isAgentAuthorized(request)) return true;
  const origin = request.headers.get('origin');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && origin) {
    // Next may normalize request.url to localhost; browser Host retains the public host.
    try {
      if (new URL(origin).host !== request.headers.get('host')) return false;
    } catch { return false; }
  }
  return isValidSession(readCookie(request, SESSION_COOKIE));
}

export function isAgentAuthorized(request: Request): boolean {
  const header = request.headers.get('authorization');
  const token = process.env.AGENT_TOKEN;
  return Boolean(
    token &&
      header?.startsWith('Bearer ') &&
      safeEqual(header.slice(7).trim(), token),
  );
}

/** Returns a 401 Response when the caller is not authorized, otherwise null. */
export async function requireAuth(request: Request): Promise<Response | null> {
  if (await isAuthorized(request)) return null;
  return Response.json(
    {
      error: 'unauthorized',
      hint: 'Send Authorization: Bearer <AGENT_TOKEN>, or sign in at /login. See /api/openapi.json.',
    },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
  );
}
