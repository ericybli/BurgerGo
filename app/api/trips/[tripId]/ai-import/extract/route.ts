import { z } from 'zod';
import { extractImportItemsAction } from '@/app/_actions/aiImport';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

const extractSchema = z.object({
  /** data:image/… URLs; the action enforces the prefix + max count. */
  images: z.array(z.string()).default([]),
  text: z.string().default(''),
});

/**
 * AI import step 1: extract restaurants/places from pasted images + text
 * (OpenAI), then resolve each against Google. Creates nothing — returns the
 * preview proposals. POST { images, text } → { items }. Online-only.
 */
export async function POST(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await ctx.params;
  return restWrite(req, async (body) => {
    const { images, text } = extractSchema.parse(body);
    return await extractImportItemsAction({ tripId, images, text });
  }, { tripId });
}
