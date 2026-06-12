import { asc, inArray } from 'drizzle-orm';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { listCategories } from '@/src/db/repos/packing';
import { restRead } from '@/src/lib/restRead';
import { packingItems, type PackingCategory, type PackingItem } from '@/src/db/schema';

export const dynamic = 'force-dynamic';

/** A packing category with its items nested (ordered). */
export interface PackingCategoryDTO extends PackingCategory {
  items: PackingItem[];
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  return restRead(req, tripId, () => {
    const trip = getTrip(db, tripId);
    if (!trip) throw new Error('Trip not found');

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

    return { categories: result };
  });
}
