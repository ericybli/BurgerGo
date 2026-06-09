import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { listByTrip, type Task } from '@/src/db/repos/tasks';
import { addTaskAction } from '@/app/_actions/tasks';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

const createSchema = z.object({ title: z.string() });

/** Trip tasks (the To-do tab's Tasks section), in creation order. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  const trip = getTrip(db, tripId);
  if (!trip) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const tasks: Task[] = listByTrip(db, tripId);
  return NextResponse.json({ tasks });
}

/** Create a task. POST { title }. */
export async function POST(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await ctx.params;
  return restWrite(req, async (body) => {
    if (!getTrip(db, tripId)) throw new Error('Trip not found');
    const { title } = createSchema.parse(body);
    return { task: await addTaskAction(tripId, title) };
  });
}
