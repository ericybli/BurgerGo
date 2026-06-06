import { describe, it, expect } from 'vitest';
import {
  restaurants,
  expenses,
  budgetTargets,
  photos,
} from '@/src/db/schema';
import { getTableConfig } from 'drizzle-orm/sqlite-core';

/** Column names actually present on a Drizzle SQLite table. */
function columnNames(table: Parameters<typeof getTableConfig>[0]): string[] {
  return getTableConfig(table).columns.map((c) => c.name).sort();
}

describe('Plan 2 schema shapes', () => {
  it('restaurants has the spec §5.2 columns', () => {
    expect(columnNames(restaurants)).toEqual(
      [
        'id',
        'trip_id',
        'name',
        'cuisine',
        'rating',
        'status',
        'price_level',
        'notes',
        'linked_place_id',
        'created_at',
        'updated_at',
      ].sort(),
    );
  });

  it('expenses has the spec §5.2 columns', () => {
    expect(columnNames(expenses)).toEqual(
      [
        'id',
        'trip_id',
        'amount',
        'category',
        'spent_on',
        'note',
        'linked_place_id',
        'created_at',
        'updated_at',
      ].sort(),
    );
  });

  it('budget_targets has the planned-vs-actual columns', () => {
    expect(columnNames(budgetTargets)).toEqual(
      [
        'id',
        'trip_id',
        'category',
        'planned_amount',
        'created_at',
        'updated_at',
      ].sort(),
    );
  });

  it('photos has the spec §5.6 columns', () => {
    expect(columnNames(photos)).toEqual(
      [
        'id',
        'trip_id',
        'owner_type',
        'owner_id',
        'path',
        'width',
        'height',
        'order_index',
        'created_at',
      ].sort(),
    );
  });
});
