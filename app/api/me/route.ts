import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/src/db/client';
import { user } from '@/src/db/schema';
import { getPrincipal } from '@/src/lib/authz';
import { now } from '@/src/lib/clock';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

/** The signed-in user's profile (machine principals have none → 404). */
export async function GET(req: Request) {
  const principal = await getPrincipal(req);
  if (!principal) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (principal.kind !== 'user') return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const row = db.select().from(user).where(eq(user.id, principal.userId)).get();
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({
    user: { id: row.id, name: row.name, email: row.email, image: row.image },
  });
}

/** Update display name. PATCH { name }. */
export async function PATCH(req: Request) {
  return restWrite(req, async (body, principal) => {
    if (principal.kind !== 'user') throw new Error('User not found');
    const { name } = z.object({ name: z.string().trim().min(1).max(120) }).parse(body);
    db.update(user)
      .set({ name, updatedAt: new Date(now()) })
      .where(eq(user.id, principal.userId))
      .run();
    const row = db.select().from(user).where(eq(user.id, principal.userId)).get()!;
    return { user: { id: row.id, name: row.name, email: row.email, image: row.image } };
  });
}
