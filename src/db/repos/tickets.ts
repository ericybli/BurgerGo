import { asc, eq, inArray } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { tickets, ticketFiles, type Ticket, type TicketFile } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';

type Db = TestDb['db'];

export type { Ticket, TicketFile };

/** One ticket by id, or undefined. */
export function getTicket(db: Db, id: string): Ticket | undefined {
  return db.select().from(tickets).where(eq(tickets.id, id)).get();
}

/**
 * All of a trip's tickets sorted by (date, time) ascending with NULLs LAST —
 * dated/timed reservations first in chronological order, undated at the end.
 */
export function listTicketsForTrip(db: Db, tripId: string): Ticket[] {
  const rows = db.select().from(tickets).where(eq(tickets.tripId, tripId)).all();
  return rows.sort((a, b) => {
    const ka = `${a.date ?? '9999-99-99'}T${a.time ?? '99:99'}`;
    const kb = `${b.date ?? '9999-99-99'}T${b.time ?? '99:99'}`;
    return ka < kb ? -1 : ka > kb ? 1 : a.createdAt < b.createdAt ? -1 : 1;
  });
}

export interface AddTicketInput {
  tripId: string;
  title: string;
  date?: string | null;
  time?: string | null;
  location?: string | null;
  note?: string | null;
}

export function addTicket(db: Db, input: AddTicketInput): Ticket {
  const ts = new Date(now());
  const row: Ticket = {
    id: newId(),
    tripId: input.tripId,
    title: input.title,
    date: input.date ?? null,
    time: input.time ?? null,
    location: input.location ?? null,
    note: input.note ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(tickets).values(row).run();
  return row;
}

/** Editable subset (never id/tripId/timestamps). */
export type TicketPatch = Partial<Pick<Ticket, 'title' | 'date' | 'time' | 'location' | 'note'>>;

export function updateTicket(db: Db, id: string, patch: TicketPatch): Ticket | undefined {
  db.update(tickets)
    .set({ ...patch, updatedAt: new Date(now()) })
    .where(eq(tickets.id, id))
    .run();
  return getTicket(db, id);
}

/** Delete a ticket row (files cascade in the DB; disk cleanup is the action's job). */
export function deleteTicket(db: Db, id: string): void {
  db.delete(tickets).where(eq(tickets.id, id)).run();
}

// --- attachments -----------------------------------------------------------

export function getTicketFile(db: Db, id: string): TicketFile | undefined {
  return db.select().from(ticketFiles).where(eq(ticketFiles.id, id)).get();
}

/** A ticket's attachments, oldest first (upload order). */
export function listFilesForTicket(db: Db, ticketId: string): TicketFile[] {
  return db
    .select()
    .from(ticketFiles)
    .where(eq(ticketFiles.ticketId, ticketId))
    .orderBy(asc(ticketFiles.createdAt), asc(ticketFiles.id))
    .all();
}

/** Batched attachments for many tickets (no N+1 on the list endpoint). */
export function listFilesForTickets(db: Db, ticketIds: string[]): TicketFile[] {
  if (ticketIds.length === 0) return [];
  return db
    .select()
    .from(ticketFiles)
    .where(inArray(ticketFiles.ticketId, ticketIds))
    .orderBy(asc(ticketFiles.createdAt), asc(ticketFiles.id))
    .all();
}

export interface AddTicketFileInput {
  id?: string;
  ticketId: string;
  tripId: string;
  name: string;
  path: string;
  mime: string;
  size: number;
}

export function addTicketFile(db: Db, input: AddTicketFileInput): TicketFile {
  const row: TicketFile = {
    id: input.id ?? newId(),
    ticketId: input.ticketId,
    tripId: input.tripId,
    name: input.name,
    path: input.path,
    mime: input.mime,
    size: input.size,
    createdAt: new Date(now()),
  };
  db.insert(ticketFiles).values(row).run();
  return row;
}

export function deleteTicketFile(db: Db, id: string): void {
  db.delete(ticketFiles).where(eq(ticketFiles.id, id)).run();
}
