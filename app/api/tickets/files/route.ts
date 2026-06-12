import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { getTrip } from '@/src/db/repos/trips';
import { getTicket, addTicketFile, listFilesForTicket } from '@/src/db/repos/tickets';
import { newId } from '@/src/db/ids';
import { getPrincipal, requireTripMember } from '@/src/lib/authz';

export const dynamic = 'force-dynamic';

/** Ticket attachments: booking PDFs + QR-code images. Original bytes are kept
 *  (no re-encode) so PDFs open and QR codes stay scannable. */
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_FILES_PER_TICKET = 12;

function allowedMime(mime: string): boolean {
  return mime === 'application/pdf' || mime.startsWith('image/');
}

export async function POST(req: Request): Promise<Response> {
  const principal = await getPrincipal(req);
  if (!principal) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const file = form.get('file');
  const tripId = form.get('tripId');
  const ticketId = form.get('ticketId');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'missing_file' }, { status: 400 });
  }
  if (typeof tripId !== 'string' || typeof ticketId !== 'string' || !tripId || !ticketId) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!allowedMime(file.type)) {
    return NextResponse.json({ error: 'unsupported_type' }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }

  // Owner checks: ticket must exist and belong to the named trip.
  if (!getTrip(db, tripId)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  // Caller must be a member of that trip (machine principals bypass).
  try {
    requireTripMember(principal, tripId);
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const ticket = getTicket(db, ticketId);
  if (!ticket || ticket.tripId !== tripId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (listFilesForTicket(db, ticketId).length >= MAX_FILES_PER_TICKET) {
    return NextResponse.json({ error: 'too_many' }, { status: 409 });
  }

  // Store original bytes at tickets/<ticketId>/<fileId> (id-only on disk —
  // the display filename lives in the DB row, so no path-charset concerns).
  const fileId = newId();
  const relPath = `tickets/${ticketId}/${fileId}`;
  const dir = join(env.UPLOADS_DIR, 'tickets', ticketId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(env.UPLOADS_DIR, relPath), Buffer.from(await file.arrayBuffer()));

  const row = addTicketFile(db, {
    id: fileId,
    ticketId,
    tripId,
    name: file.name || 'attachment',
    path: relPath,
    mime: file.type,
    size: file.size,
  });
  return NextResponse.json({ file: row }, { status: 201 });
}
