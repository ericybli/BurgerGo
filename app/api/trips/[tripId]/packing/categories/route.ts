import { z } from 'zod';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { addCategoryAction } from '@/app/_actions/packing';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

const createSchema = z.object({ name: z.string() });

/** Create a packing category. POST { name }. */
export async function POST(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await ctx.params;
  return restWrite(req, async (body) => {
    if (!getTrip(db, tripId)) throw new Error('Trip not found');
    const { name } = createSchema.parse(body);
    return { category: await addCategoryAction(tripId, name) };
  }, { tripId });
}
