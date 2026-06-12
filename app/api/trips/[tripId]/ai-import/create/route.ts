import { z } from 'zod';
import { createImportItemsAction, type ImportCreateItem } from '@/app/_actions/aiImport';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

/** Per-item validation lives in the action (its zod schema → 400 via restWrite). */
const createSchema = z.object({ items: z.array(z.unknown()) });

/**
 * AI import step 2: create the confirmed items — restaurants → Eats
 * (want-to-try), places → Plan's Saved bucket.
 * POST { items } → { restaurants, places } counts.
 */
export async function POST(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await ctx.params;
  return restWrite(req, async (body) => {
    const { items } = createSchema.parse(body);
    return await createImportItemsAction({ tripId, items: items as ImportCreateItem[] });
  }, { tripId });
}
