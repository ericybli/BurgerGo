import { NextResponse } from 'next/server';
import { db } from '@/src/db/client';
import { getPlace } from '@/src/db/repos/places';
import { generatePlaceSummaryAction } from '@/app/_actions/places';
import { isWriteAuthorized } from '@/src/lib/apiKey';

export const dynamic = 'force-dynamic';

/**
 * (Re)generate a place's AI About summary (OpenAI, server-side). POST with no
 * body (any body is ignored) → { place } — `place` is null when no key is
 * configured or generation failed (the existing summary is left untouched).
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ tripId: string; placeId: string }> },
) {
  if (!isWriteAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { tripId, placeId } = await ctx.params;
  const existing = getPlace(db, placeId);
  if (!existing || existing.tripId !== tripId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  try {
    const place = await generatePlaceSummaryAction(placeId);
    return NextResponse.json({ place });
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid_input', message: (err as Error)?.message ?? 'invalid' },
      { status: 400 },
    );
  }
}
