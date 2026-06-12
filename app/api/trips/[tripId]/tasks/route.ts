import { z } from 'zod';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { listByTrip, type Task } from '@/src/db/repos/tasks';
import { addTaskAction } from '@/app/_actions/tasks';
import { restWrite } from '@/src/lib/restWrite';
import { restRead } from '@/src/lib/restRead';

export const dynamic = 'force-dynamic';

const createSchema = z.object({ title: z.string() });

/** Trip tasks (the To-do tab's Tasks section), in creation order. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  return restRead(req, tripId, () => {
    const trip = getTrip(db, tripId);
    if (!trip) throw new Error('Trip not found');
    const tasks: Task[] = listByTrip(db, tripId);
    return { tasks };
  });
}

/** Create a task. POST { title }. */
export async function POST(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await ctx.params;
  return restWrite(req, async (body) => {
    if (!getTrip(db, tripId)) throw new Error('Trip not found');
    const { title } = createSchema.parse(body);
    return { task: await addTaskAction(tripId, title) };
  }, { tripId });
}
