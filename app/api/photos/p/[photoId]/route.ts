import { deletePhotoAction } from '@/app/_actions/photos';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

/**
 * Delete a personal photo (the native client's equivalent of the web app's
 * `deletePhotoAction` Server Action). Removes the on-disk derivatives + the row.
 * 404 when the photo id is unknown. `DELETE /api/photos/p/{photoId}`.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ photoId: string }> }) {
  const { photoId } = await ctx.params;
  return restWrite(req, async () => {
    await deletePhotoAction(photoId);
  });
}
