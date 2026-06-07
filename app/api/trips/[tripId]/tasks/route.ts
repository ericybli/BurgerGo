import { NextResponse } from 'next/server';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { listByTrip, type Task } from '@/src/db/repos/tasks';

export const dynamic = 'force-dynamic';

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
