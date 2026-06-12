import { updateRestaurantAction, deleteRestaurantAction, type UpdateRestaurantActionPatch } from '@/app/_actions/restaurants';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, ctx: { params: Promise<{ tripId: string; restaurantId: string }> }) {
  const { tripId, restaurantId } = await ctx.params;
  return restWrite(req, async (body) => ({
    restaurant: await updateRestaurantAction(restaurantId, body as UpdateRestaurantActionPatch),
  }), { tripId });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ tripId: string; restaurantId: string }> }) {
  const { tripId, restaurantId } = await ctx.params;
  return restWrite(req, async () => {
    await deleteRestaurantAction(restaurantId);
  }, { tripId });
}
