import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import {
  trips,
  places,
  travelLegs,
  placeDetailsCache,
  settings,
} from '@/src/db/schema';

describe('schema: trips', () => {
  it('exposes the spec §5.2 columns', () => {
    const cols = getTableColumns(trips);
    expect(Object.keys(cols).sort()).toEqual(
      ['coverPhoto', 'createdAt', 'endDate', 'id', 'name', 'startDate', 'updatedAt'].sort(),
    );
    expect(cols.id.primary).toBe(true);
    expect(cols.name.notNull).toBe(true);
    expect(cols.startDate.notNull).toBe(true);
    expect(cols.endDate.notNull).toBe(true);
    expect(cols.coverPhoto.notNull).toBe(false);
  });
});

describe('schema: places', () => {
  it('exposes the spec §5.2 columns incl. nullable dayDate/googlePlaceId', () => {
    const cols = getTableColumns(places);
    expect(cols.dayDate.notNull).toBe(false);
    expect(cols.googlePlaceId.notNull).toBe(false);
    expect(cols.orderIndex.notNull).toBe(true);
    expect(cols.category.notNull).toBe(true);
  });
  it('category enum matches the spec', () => {
    expect(places.category.enumValues).toEqual([
      'sightseeing',
      'lodging',
      'transport',
      'activity',
      'other',
    ]);
  });
});

describe('schema: travelLegs', () => {
  it('mode enum is walk|drive|transit and metrics are notNull', () => {
    expect(travelLegs.mode.enumValues).toEqual(['walk', 'drive', 'transit']);
    const cols = getTableColumns(travelLegs);
    expect(cols.durationSeconds.notNull).toBe(true);
    expect(cols.distanceMeters.notNull).toBe(true);
  });
});

describe('schema: placeDetailsCache', () => {
  it('is keyed by googlePlaceId', () => {
    const cols = getTableColumns(placeDetailsCache);
    expect(cols.googlePlaceId.primary).toBe(true);
    expect(cols.fetchedAt.notNull).toBe(true);
  });
});

describe('schema: settings', () => {
  it('has integer PK and en|zh language enum', () => {
    const cols = getTableColumns(settings);
    expect(cols.id.primary).toBe(true);
    expect(cols.id.columnType).toBe('SQLiteInteger');
    expect(settings.language.enumValues).toEqual(['en', 'zh']);
    expect(cols.currency.notNull).toBe(true);
  });
});
