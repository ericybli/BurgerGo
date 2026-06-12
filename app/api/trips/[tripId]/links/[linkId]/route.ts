import { updateLinkAction, deleteLinkAction, type UpdateLinkActionPatch } from '@/app/_actions/savedLinks';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, ctx: { params: Promise<{ tripId: string; linkId: string }> }) {
  const { tripId, linkId } = await ctx.params;
  return restWrite(req, async (body) => ({
    link: await updateLinkAction(linkId, body as UpdateLinkActionPatch),
  }), { tripId });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ tripId: string; linkId: string }> }) {
  const { tripId, linkId } = await ctx.params;
  return restWrite(req, async () => {
    await deleteLinkAction(linkId);
  }, { tripId });
}
