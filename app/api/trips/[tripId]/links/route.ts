import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { addLinkAction, type AddLinkActionInput } from '@/app/_actions/savedLinks';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

/** Create a reading-list link. POST { url, title?, note?, thumbnail?, placeId? }. */
export async function POST(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await ctx.params;
  return restWrite(req, async (body) => {
    if (!getTrip(db, tripId)) throw new Error('Trip not found');
    const input = { ...(body as object), tripId } as AddLinkActionInput;
    return { link: await addLinkAction(input) };
  });
}
