import { z } from 'zod';
import { db } from '@/src/db/client';
import { getPhotoList } from '@/src/db/repos/photoLists';
import { renamePhotoListAction, deletePhotoListAction } from '@/app/_actions/photoLists';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

const renameSchema = z.object({ name: z.string() });

/** The rename action doesn't itself check existence, so 404 unknown ids here. */
function assertListInTrip(tripId: string, listId: string): void {
  const list = getPhotoList(db, listId);
  if (!list || list.tripId !== tripId) throw new Error('List not found');
}

/** Rename a photography list. PATCH { name }. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ tripId: string; listId: string }> },
) {
  const { tripId, listId } = await ctx.params;
  return restWrite(req, async (body) => {
    assertListInTrip(tripId, listId);
    const { name } = renameSchema.parse(body);
    await renamePhotoListAction(tripId, listId, name);
  }, { tripId });
}

/** Delete a photography list and all its photos (rows + on-disk bytes). */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ tripId: string; listId: string }> },
) {
  const { tripId, listId } = await ctx.params;
  return restWrite(req, async () => {
    await deletePhotoListAction(tripId, listId);
  }, { tripId });
}
