import { updateEntryAction, deleteEntryAction, type UpdateEntryActionPatch } from '@/app/_actions/journal';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, ctx: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await ctx.params;
  return restWrite(req, async (body) => ({
    entry: await updateEntryAction(entryId, body as UpdateEntryActionPatch),
  }));
}

export async function DELETE(req: Request, ctx: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await ctx.params;
  return restWrite(req, async () => {
    await deleteEntryAction(entryId);
  });
}
