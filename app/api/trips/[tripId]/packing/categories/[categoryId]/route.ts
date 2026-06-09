import { z } from 'zod';
import { renameCategoryAction, deleteCategoryAction } from '@/app/_actions/packing';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

const renameSchema = z.object({ name: z.string() });

/** Rename a packing category. PATCH { name }. */
export async function PATCH(req: Request, ctx: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await ctx.params;
  return restWrite(req, async (body) => {
    const { name } = renameSchema.parse(body);
    return { category: await renameCategoryAction(categoryId, name) };
  });
}

/** Delete a packing category (its items cascade). */
export async function DELETE(req: Request, ctx: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await ctx.params;
  return restWrite(req, async () => {
    await deleteCategoryAction(categoryId);
  });
}
