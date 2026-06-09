import { updateTaskAction, deleteTaskAction, type UpdateTaskActionPatch } from '@/app/_actions/tasks';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

/** Edit a task — e.g. { done: true } to check it off, or { title, note }. */
export async function PATCH(req: Request, ctx: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await ctx.params;
  return restWrite(req, async (body) => ({
    task: await updateTaskAction(taskId, body as UpdateTaskActionPatch),
  }));
}

export async function DELETE(req: Request, ctx: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await ctx.params;
  return restWrite(req, async () => {
    await deleteTaskAction(taskId);
  });
}
