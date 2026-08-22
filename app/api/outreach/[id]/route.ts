import { itemHandlers, OUTREACH } from '@/lib/collections';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { PATCH, DELETE } = itemHandlers(OUTREACH);
