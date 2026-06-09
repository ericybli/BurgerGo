import { updateExpenseAction, deleteExpenseAction, type UpdateExpenseActionPatch } from '@/app/_actions/expenses';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, ctx: { params: Promise<{ expenseId: string }> }) {
  const { expenseId } = await ctx.params;
  return restWrite(req, async (body) => ({
    expense: await updateExpenseAction(expenseId, body as UpdateExpenseActionPatch),
  }));
}

export async function DELETE(req: Request, ctx: { params: Promise<{ expenseId: string }> }) {
  const { expenseId } = await ctx.params;
  return restWrite(req, async () => {
    await deleteExpenseAction(expenseId);
  });
}
