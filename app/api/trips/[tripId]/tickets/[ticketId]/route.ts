import {
  updateTicketAction,
  deleteTicketAction,
  type UpdateTicketActionPatch,
} from '@/app/_actions/tickets';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

/** Edit a ticket — any of { title, date, time, location, note } (null clears a nullable field). */
export async function PATCH(req: Request, ctx: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await ctx.params;
  return restWrite(req, async (body) => ({
    ticket: await updateTicketAction(ticketId, body as UpdateTicketActionPatch),
  }));
}

/** Delete a ticket. Goes through the action so attachment bytes are removed from disk. */
export async function DELETE(req: Request, ctx: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await ctx.params;
  return restWrite(req, async () => {
    await deleteTicketAction(ticketId);
  });
}
