import { z } from 'zod';
import { scheduleRestaurantToDayAction, unscheduleRestaurantAction } from '@/app/_actions/restaurants';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

const schema = z.object({
  /** Day (YYYY-MM-DD) to put this restaurant on the plan, or null to unschedule. */
  dayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

/** Schedule a restaurant onto a day (creates a linked plan place), or unschedule it. */
export async function POST(req: Request, ctx: { params: Promise<{ tripId: string; restaurantId: string }> }) {
  const { tripId, restaurantId } = await ctx.params;
  return restWrite(req, async (body) => {
    const { dayDate } = schema.parse(body);
    if (dayDate === null) {
      return { restaurant: await unscheduleRestaurantAction(restaurantId) };
    }
    return scheduleRestaurantToDayAction(restaurantId, dayDate);
  }, { tripId });
}
