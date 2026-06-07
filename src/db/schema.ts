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
    aiSummary: text('ai_summary'), // OpenAI-generated intro; editable; null until generated
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
    polyline: text('polyline'),  // nullable: NULL until Google Directions returns it
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

export const restaurants = sqliteTable(
  'restaurants',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    cuisine: text('cuisine'), // free text
    rating: integer('rating'), // 1–5; NULL = unrated
    status: text('status', { enum: ['want-to-try', 'been'] }).notNull(),
    priceLevel: integer('price_level'), // 1–4 ($–$$$$); 1 is minimum
    notes: text('notes'),
    // Location (Plan 3.x): a free-text address geocoded to coords on save so the
    // restaurant can be pinned on the Plan▸Map "Restaurants" layer. googlePlaceId
    // is captured when the address is picked from autocomplete (null otherwise).
    address: text('address'),
    lat: real('lat'),
    lng: real('lng'),
    googlePlaceId: text('google_place_id'),
    linkedPlaceId: text('linked_place_id').references(() => places.id, {
      onDelete: 'set null',
    }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    byTripStatus: index('idx_restaurants_trip').on(t.tripId, t.status),
  }),
);

export const expenses = sqliteTable(
  'expenses',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(), // minor units, actual spend
    category: text('category', {
      enum: ['food', 'lodging', 'transport', 'activities', 'shopping', 'other'],
    }).notNull(),
    spentOn: text('spent_on').notNull(), // YYYY-MM-DD
    note: text('note'),
    linkedPlaceId: text('linked_place_id').references(() => places.id, {
      onDelete: 'set null',
    }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    byTripDate: index('idx_expenses_trip_date').on(t.tripId, t.spentOn),
    byTripCat: index('idx_expenses_trip_cat').on(t.tripId, t.category),
  }),
);

// Planned budget (Plan 2 decision: planned-vs-actual). category NULL = overall
// target; non-null = per-category. Unique per (trip, category) — SQLite treats
// each NULL as distinct in a UNIQUE index, so the overall row is kept single by
// the repo's read-before-write upsert (it queries `category IS NULL`).
export const budgetTargets = sqliteTable(
  'budget_targets',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    category: text('category', {
      enum: ['food', 'lodging', 'transport', 'activities', 'shopping', 'other'],
    }), // NULL = overall target
    plannedAmount: integer('planned_amount').notNull(), // minor units
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    uniqTripCat: uniqueIndex('uniq_budget_targets_trip_cat').on(
      t.tripId,
      t.category,
    ),
  }),
);

// Personal uploaded photos (Plan 2: owner_type 'place' only; 'journal' in Plan 3).
// path = base path `<tripId>/<photoId>` (no extension); see §5.6.
export const photos = sqliteTable(
  'photos',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    ownerType: text('owner_type', { enum: ['place', 'journal'] }).notNull(),
    ownerId: text('owner_id').notNull(), // places.id (or journal_entries.id later)
    path: text('path').notNull(), // base path `<tripId>/<photoId>`
    width: integer('width'), // of the `full` derivative
    height: integer('height'),
    orderIndex: integer('order_index').notNull(), // gallery order
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    byOwner: index('idx_photos_owner').on(t.ownerType, t.ownerId, t.orderIndex),
  }),
);

// Plan 3 §3.1 — free-form trip journal entries (markdown body + photos via the
// shared `photos` table, owner_type='journal'). Listed newest-written first.
export const journalEntries = sqliteTable(
  'journal_entries',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    title: text('title').notNull(), // required (spec resolves master ambiguity to required)
    body: text('body').notNull(), // markdown source; may be ''
    entryDate: text('entry_date'), // YYYY-MM-DD, nullable display metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    byTripCreated: index('idx_journal_trip_created').on(t.tripId, t.createdAt),
  }),
);

// Plan 3 §3.2 — reading-list saved links. thumbnail is a relative path on the
// uploads volume of the downloaded OG-image derivative (null if none).
export const savedLinks = sqliteTable(
  'saved_links',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    title: text('title'), // editable; preview may prefill
    note: text('note'),
    thumbnail: text('thumbnail'), // relative derivative path; null if none
    placeId: text('place_id').references(() => places.id, { onDelete: 'cascade' }), // null = trip reading list
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    byTripCreated: index('idx_links_trip').on(t.tripId, t.createdAt),
  }),
);

// Relations (groundwork; only trips/places/travelLegs participate in 1A).
export const tripsRelations = relations(trips, ({ many }) => ({
  places: many(places),
  travelLegs: many(travelLegs),
  restaurants: many(restaurants),
  expenses: many(expenses),
  budgetTargets: many(budgetTargets),
  photos: many(photos),
  journalEntries: many(journalEntries),
  savedLinks: many(savedLinks),
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

export const restaurantsRelations = relations(restaurants, ({ one }) => ({
  trip: one(trips, { fields: [restaurants.tripId], references: [trips.id] }),
  linkedPlace: one(places, {
    fields: [restaurants.linkedPlaceId],
    references: [places.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  trip: one(trips, { fields: [expenses.tripId], references: [trips.id] }),
  linkedPlace: one(places, {
    fields: [expenses.linkedPlaceId],
    references: [places.id],
  }),
}));

export const budgetTargetsRelations = relations(budgetTargets, ({ one }) => ({
  trip: one(trips, { fields: [budgetTargets.tripId], references: [trips.id] }),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  trip: one(trips, { fields: [photos.tripId], references: [trips.id] }),
}));

export const journalEntriesRelations = relations(journalEntries, ({ one }) => ({
  trip: one(trips, { fields: [journalEntries.tripId], references: [trips.id] }),
}));

export const savedLinksRelations = relations(savedLinks, ({ one }) => ({
  trip: one(trips, { fields: [savedLinks.tripId], references: [trips.id] }),
}));

// Inferred row types (used by repos in later tasks).
export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
export type Place = typeof places.$inferSelect;
export type TravelLeg = typeof travelLegs.$inferSelect;
export type PlaceDetailsCacheRow = typeof placeDetailsCache.$inferSelect;
export type NewPlaceDetailsCacheRow = typeof placeDetailsCache.$inferInsert;
export type Settings = typeof settings.$inferSelect;
export type Restaurant = typeof restaurants.$inferSelect;
export type NewRestaurant = typeof restaurants.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type BudgetTarget = typeof budgetTargets.$inferSelect;
export type NewBudgetTarget = typeof budgetTargets.$inferInsert;
export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type NewJournalEntry = typeof journalEntries.$inferInsert;
export type SavedLink = typeof savedLinks.$inferSelect;
export type NewSavedLink = typeof savedLinks.$inferInsert;
