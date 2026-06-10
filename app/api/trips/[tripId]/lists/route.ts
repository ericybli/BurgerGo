import { z } from 'zod';
import { addSavedListAction } from '@/app/_actions/savedLists';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

const createSchema = z.object({ name: z.string() });

/** Create a saved-place list (Plan's Saved bucket). POST { name } → { list }. */
export async function POST(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await ctx.params;
  return restWrite(req, async (body) => {
    const { name } = createSchema.parse(body);
    return { list: await addSavedListAction(tripId, name) };
  });
}
