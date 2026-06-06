import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const trips = sqliteTable('trips', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  startDate: text('start_date').notNull(), // YYYY-MM-DD
  endDate: text('end_date').notNull(), // YYYY-MM-DD, must be >= startDate (app-validated)
  coverPhoto: text('cover_photo'), // nullable photos path reference
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const places = sqliteTable(
  'places',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    dayDate: text('day_date'), // NULL = Saved/wishlist bucket (locked day_id)
    googlePlaceId: text('google_place_id'), // NULL for map-drop pins
    name: text('name').notNull(),
    address: text('address'),
    lat: real('lat'),
    lng: real('lng'),
    category: text('category', {
      enum: ['sightseeing', 'lodging', 'transport', 'activity', 'other'],
    }).notNull(),
    scheduledTime: text('scheduled_time'), // HH:MM
    durationMin: integer('duration_min'),
    cost: integer('cost'), // minor units, single currency
    notes: text('notes'),
    orderIndex: integer('order_index').notNull(), // 0-based; pin label = orderIndex + 1
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    byTripDay: index('idx_places_trip_day').on(t.tripId, t.dayDate, t.orderIndex),
    byGoogle: index('idx_places_google').on(t.googlePlaceId),
  }),
);

export const travelLegs = sqliteTable(
  'travel_legs',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    fromPlaceId: text('from_place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    toPlaceId: text('to_place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    mode: text('mode', { enum: ['walk', 'drive', 'transit'] }).notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    distanceMeters: integer('distance_meters').notNull(),
    computedAt: integer('computed_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    uniqLeg: uniqueIndex('uniq_leg').on(t.fromPlaceId, t.toPlaceId, t.mode),
  }),
);

export const placeDetailsCache = sqliteTable('place_details_cache', {
  googlePlaceId: text('google_place_id').primaryKey(),
  name: text('name'),
  address: text('address'),
  lat: real('lat'),
  lng: real('lng'),
  categoryGuess: text('category_guess'),
  photoRef: text('photo_ref'),
  photoLocalPath: text('photo_local_path'),
  rawJson: text('raw_json'),
  fetchedAt: integer('fetched_at', { mode: 'timestamp' }).notNull(),
});

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(), // always 1
  language: text('language', { enum: ['en', 'zh'] }).notNull(),
  currency: text('currency').notNull(), // ISO 4217, single global currency
});

// Relations (groundwork; only trips/places/travelLegs participate in 1A).
export const tripsRelations = relations(trips, ({ many }) => ({
  places: many(places),
  travelLegs: many(travelLegs),
}));

export const placesRelations = relations(places, ({ one, many }) => ({
  trip: one(trips, { fields: [places.tripId], references: [trips.id] }),
  legsFrom: many(travelLegs, { relationName: 'legFrom' }),
  legsTo: many(travelLegs, { relationName: 'legTo' }),
}));

export const travelLegsRelations = relations(travelLegs, ({ one }) => ({
  trip: one(trips, { fields: [travelLegs.tripId], references: [trips.id] }),
  fromPlace: one(places, {
    fields: [travelLegs.fromPlaceId],
    references: [places.id],
    relationName: 'legFrom',
  }),
  toPlace: one(places, {
    fields: [travelLegs.toPlaceId],
    references: [places.id],
    relationName: 'legTo',
  }),
}));

// Inferred row types (used by repos in later tasks).
export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
export type Place = typeof places.$inferSelect;
export type TravelLeg = typeof travelLegs.$inferSelect;
export type PlaceDetailsCacheRow = typeof placeDetailsCache.$inferSelect;
export type NewPlaceDetailsCacheRow = typeof placeDetailsCache.$inferInsert;
export type Settings = typeof settings.$inferSelect;
