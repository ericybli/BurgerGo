import { updateItemAction, deleteItemAction, type UpdateItemActionPatch } from '@/app/_actions/packing';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

/** Patch a packing item. PATCH { name?, quantity?, packed? }. */
export async function PATCH(req: Request, ctx: { params: Promise<{ tripId: string; itemId: string }> }) {
  const { tripId, itemId } = await ctx.params;
  return restWrite(req, async (body) => ({
    item: await updateItemAction(itemId, body as UpdateItemActionPatch),
  }), { tripId });
}

/** Delete a packing item. */
export async function DELETE(req: Request, ctx: { params: Promise<{ tripId: string; itemId: string }> }) {
  const { tripId, itemId } = await ctx.params;
  return restWrite(req, async () => {
    await deleteItemAction(itemId);
  }, { tripId });
}
