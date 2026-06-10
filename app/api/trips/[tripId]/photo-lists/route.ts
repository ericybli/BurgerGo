import { z } from 'zod';
import { addPhotoListAction } from '@/app/_actions/photoLists';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

const createSchema = z.object({ name: z.string() });

/** Create a photography list (Journal tab). POST { name } → { list }. */
export async function POST(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await ctx.params;
  return restWrite(req, async (body) => {
    const { name } = createSchema.parse(body);
    return { list: await addPhotoListAction(tripId, name) };
  });
}
