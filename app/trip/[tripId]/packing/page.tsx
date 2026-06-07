import { ToDoClient } from '@/components/todo/ToDoClient';

// Static app shell: no server DB read, no cookies() — so the SW caches the page
// document and it loads offline. ToDoClient hosts the Packing list + Tasks
// sub-views, each client-fetching its own data. (spec §7.3)
export const dynamic = 'force-static';

export default async function ToDoPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <ToDoClient tripId={tripId} />;
}
