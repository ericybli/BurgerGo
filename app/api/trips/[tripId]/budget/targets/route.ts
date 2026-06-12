import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import {
  setTargetAction,
  clearTargetAction,
  type SetTargetActionInput,
} from '@/app/_actions/budgetTargets';
import type { TargetCategory } from '@/src/db/repos/budgetTargets';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

/**
 * Set an overall or per-category planned amount.
 * PUT { category: <category|null>, plannedAmount }.
 * `category: null` (or omitted-as-null) is the overall whole-trip target.
 */
export async function PUT(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await ctx.params;
  return restWrite(req, async (body) => {
    if (!getTrip(db, tripId)) throw new Error('Trip not found');
    const input = { ...(body as object), tripId } as SetTargetActionInput;
    return { target: await setTargetAction(input) };
  }, { tripId });
}

/**
 * Clear a planned amount. DELETE ?category=<category> — omit the param (or pass
 * `null`/empty) to clear the overall whole-trip target. Returns { ok: true }.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await ctx.params;
  return restWrite(req, async () => {
    if (!getTrip(db, tripId)) throw new Error('Trip not found');
    const raw = new URL(req.url).searchParams.get('category');
    const category = (raw === null || raw === '' || raw === 'null'
      ? null
      : raw) as TargetCategory;
    await clearTargetAction(tripId, category);
  }, { tripId });
}
