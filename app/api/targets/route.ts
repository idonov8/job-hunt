import { collectionHandlers, TARGETS } from '@/lib/collections';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { GET, POST } = collectionHandlers(TARGETS);
