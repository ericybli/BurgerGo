import { NextResponse } from 'next/server';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { getTicketFile } from '@/src/db/repos/tickets';
import { deleteTicketFileAction } from '@/app/_actions/tickets';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

/** Serves a ticket attachment (image or PDF) inline with its original name. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await ctx.params;
  const file = getTicketFile(db, fileId);
  if (!file) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Path guard: must resolve strictly under the uploads root.
  const abs = join(env.UPLOADS_DIR, file.path);
  const root = resolve(env.UPLOADS_DIR);
  if (!resolve(abs).startsWith(root + sep)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    const info = await stat(abs);
    const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream;
    // RFC 5987 filename* carries non-ASCII names (e.g. Chinese) safely.
    const encoded = encodeURIComponent(file.name);
    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': file.mime,
        'Content-Length': String(info.size),
        'Content-Disposition': `inline; filename*=UTF-8''${encoded}`,
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
}

/** Delete one attachment (row + bytes), mirroring the web UI's per-file remove. */
export async function DELETE(req: Request, ctx: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await ctx.params;
  // Resolve the file's trip for the membership check; unknown ids skip the
  // check and 404 inside the action instead.
  const tripId = getTicketFile(db, fileId)?.tripId;
  return restWrite(req, async () => {
    await deleteTicketFileAction(fileId);
  }, tripId ? { tripId } : {});
}
