import { describe, it, expect } from 'vitest';
import { journalEntries, savedLinks } from '@/src/db/schema';
import { getTableConfig } from 'drizzle-orm/sqlite-core';

/** Column names actually present on a Drizzle SQLite table. */
function columnNames(table: Parameters<typeof getTableConfig>[0]): string[] {
  return getTableConfig(table).columns.map((c) => c.name).sort();
}

describe('Plan 3 schema shapes', () => {
  it('journal_entries has the spec §3.1 columns', () => {
    expect(columnNames(journalEntries)).toEqual(
      [
        'id',
        'trip_id',
        'title',
        'body',
        'entry_date',
        'created_at',
        'updated_at',
      ].sort(),
    );
  });

  it('saved_links has the spec §3.2 columns', () => {
    expect(columnNames(savedLinks)).toEqual(
      [
        'id',
        'trip_id',
        'url',
        'title',
        'note',
        'thumbnail',
        'created_at',
        'updated_at',
      ].sort(),
    );
  });

  it('the table SQL names match the spec', () => {
    expect(getTableConfig(journalEntries).name).toBe('journal_entries');
    expect(getTableConfig(savedLinks).name).toBe('saved_links');
  });
});
