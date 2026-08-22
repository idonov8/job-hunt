import { collectionHandlers, PLAYBOOK } from '@/lib/collections';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { GET, POST } = collectionHandlers(PLAYBOOK);
