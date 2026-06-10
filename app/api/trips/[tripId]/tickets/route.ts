import { NextResponse } from 'next/server';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import {
  listTicketsForTrip,
  listFilesForTickets,
  type Ticket,
  type TicketFile,
} from '@/src/db/repos/tickets';
import { addTicketAction, type AddTicketActionInput } from '@/app/_actions/tickets';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

/** TicketDTO: a ticket row + its attachments (upload order). */
export type TicketDTO = Ticket & { files: TicketFile[] };

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  if (!getTrip(db, tripId)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const rows = listTicketsForTrip(db, tripId);
  const fileMap = new Map<string, TicketFile[]>();
  for (const f of listFilesForTickets(db, rows.map((t) => t.id))) {
    const arr = fileMap.get(f.ticketId) ?? [];
    arr.push(f);
    fileMap.set(f.ticketId, arr);
  }
  const tickets: TicketDTO[] = rows.map((t) => ({ ...t, files: fileMap.get(t.id) ?? [] }));
  return NextResponse.json({ tickets });
}

/** Create a ticket. POST { title, date?, time?, location?, note? }. */
export async function POST(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await ctx.params;
  return restWrite(req, async (raw) => {
    const input = { ...(raw as object), tripId } as AddTicketActionInput;
    return { ticket: await addTicketAction(input) };
  });
}
