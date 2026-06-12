import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { addExpenseAction, type AddExpenseActionInput } from '@/app/_actions/expenses';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

/** Create an expense. POST { amount, category, spentOn, note?, linkedPlaceId? }. */
export async function POST(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await ctx.params;
  return restWrite(req, async (body) => {
    if (!getTrip(db, tripId)) throw new Error('Trip not found');
    const input = { ...(body as object), tripId } as AddExpenseActionInput;
    return { expense: await addExpenseAction(input) };
  }, { tripId });
}
