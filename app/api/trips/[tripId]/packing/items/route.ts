import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { addItemAction, type AddItemActionInput } from '@/app/_actions/packing';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

/** Create a packing item. POST { categoryId, name, quantity? }. */
export async function POST(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await ctx.params;
  return restWrite(req, async (body) => {
    if (!getTrip(db, tripId)) throw new Error('Trip not found');
    const input = { ...(body as object) } as AddItemActionInput;
    return { item: await addItemAction(input) };
  }, { tripId });
}
