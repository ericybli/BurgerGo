import { updateRestaurantAction, deleteRestaurantAction, type UpdateRestaurantActionPatch } from '@/app/_actions/restaurants';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, ctx: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await ctx.params;
  return restWrite(req, async (body) => ({
    restaurant: await updateRestaurantAction(restaurantId, body as UpdateRestaurantActionPatch),
  }));
}

export async function DELETE(req: Request, ctx: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await ctx.params;
  return restWrite(req, async () => {
    await deleteRestaurantAction(restaurantId);
  });
}
