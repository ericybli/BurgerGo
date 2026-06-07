import { NextResponse } from 'next/server';
import { asc, inArray } from 'drizzle-orm';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { listCategories } from '@/src/db/repos/packing';
import { packingItems, type PackingCategory, type PackingItem } from '@/src/db/schema';

export const dynamic = 'force-dynamic';

/** A packing category with its items nested (ordered). */
export interface PackingCategoryDTO extends PackingCategory {
  items: PackingItem[];
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  const trip = getTrip(db, tripId);
  if (!trip) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const categories = listCategories(db, tripId);
  const catIds = categories.map((c) => c.id);

  // Batch-load all items for the trip's categories in one query (avoids N+1).
  const itemsByCat = new Map<string, PackingItem[]>();
  if (catIds.length > 0) {
    const rows = db
      .select()
      .from(packingItems)
      .where(inArray(packingItems.categoryId, catIds))
      .orderBy(asc(packingItems.categoryId), asc(packingItems.orderIndex))
      .all();
    for (const row of rows) {
      const list = itemsByCat.get(row.categoryId) ?? [];
      list.push(row);
      itemsByCat.set(row.categoryId, list);
    }
  }

  const result: PackingCategoryDTO[] = categories.map((c) => ({
    ...c,
    items: itemsByCat.get(c.id) ?? [],
  }));

  return NextResponse.json({ categories: result });
}
