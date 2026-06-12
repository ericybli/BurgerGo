import { z } from 'zod';
import { db } from '@/src/db/client';
import { listByTrip } from '@/src/db/repos/savedLists';
import { renameSavedListAction, deleteSavedListAction } from '@/app/_actions/savedLists';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

const renameSchema = z.object({ name: z.string() });

/** The rename/delete actions don't themselves check existence, so 404 unknown ids here. */
function assertListInTrip(tripId: string, listId: string): void {
  if (!listByTrip(db, tripId).some((l) => l.id === listId)) {
    throw new Error('List not found');
  }
}

/** Rename a saved-place list. PATCH { name }. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ tripId: string; listId: string }> },
) {
  const { tripId, listId } = await ctx.params;
  return restWrite(req, async (body) => {
    assertListInTrip(tripId, listId);
    const { name } = renameSchema.parse(body);
    await renameSavedListAction(tripId, listId, name);
  }, { tripId });
}

/** Delete a saved-place list. Member places become loose (never deleted). */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ tripId: string; listId: string }> },
) {
  const { tripId, listId } = await ctx.params;
  return restWrite(req, async () => {
    assertListInTrip(tripId, listId);
    await deleteSavedListAction(tripId, listId);
  }, { tripId });
}
