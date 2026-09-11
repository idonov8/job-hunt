import { requireAuth } from '@/lib/auth';
import { act, getHunter } from '@/lib/hunter';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const denied = await requireAuth(request);
  if (denied) return denied;
  return Response.json({ state: await getHunter() });
}
export async function POST(request: Request) {
  const denied = await requireAuth(request);
  if (denied) return denied;
  try {
    return Response.json({ state: await act(await request.json()) });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not save session',
      },
      { status: 400 },
    );
  }
}
