import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  primaryKey,
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
      enum: [
        'sightseeing', 'lodging', 'hotel', 'airbnb', 'airport', 'transport',
        'activity', 'shopping', 'parking', 'entrance', 'museum', 'event', 'other',
      ],
    }).notNull(),
    scheduledTime: text('scheduled_time'), // HH:MM
    durationMin: integer('duration_min'),
    cost: integer('cost'), // minor units, single currency
    notes: text('notes'),
    aiSummary: text('ai_summary'), // OpenAI-generated intro; editable; null until generated
    // Travel mode of the leg ARRIVING at this place (from the previous stop in the
    // day). NULL = follow the day's default mode. The first stop of a day has no
    // incoming leg, so its value is unused.
    legMode: text('leg_mode', { enum: ['walk', 'drive', 'transit'] }),
    // Saved-bucket grouping: the saved_list this place belongs to, or NULL =
    // "loose" (shown ungrouped). Only meaningful for saved places (dayDate NULL).
    listId: text('list_id').references(() => savedLists.id, { onDelete: 'set null' }),
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
  aiPrompt: text('ai_prompt'), // custom AI-summary system prompt; null → built-in default
  aiModel: text('ai_model'), // custom OpenAI model id; null → built-in default
  // Plan▸Map pin clustering toggle. NULL = default (clustering ON); 0 = off, 1 = on.
  clusterPins: integer('cluster_pins', { mode: 'boolean' }),
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
    // Google place data, persisted on save/backfill when googlePlaceId is set
    // (server-managed; offline-usable): star rating, review count, and the
    // localized weekday hour lines (JSON string[]). Open-now is NOT stored —
    // it's volatile and fetched live when the detail sheet opens online.
    googleRating: real('google_rating'),
    googleRatingCount: integer('google_rating_count'),
    googleHours: text('google_hours'),
    googleDataUpdatedAt: integer('google_data_updated_at', { mode: 'timestamp' }),
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
    ownerType: text('owner_type', { enum: ['place', 'journal', 'restaurant', 'photo_list', 'trip'] }).notNull(),
    ownerId: text('owner_id').notNull(), // places.id / journal_entries.id / restaurants.id
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
    // Plan load resolves each place's attached guide links via inArray(placeId);
    // index it so that lookup isn't a full saved_links scan.
    byPlace: index('idx_links_place').on(t.placeId),
  }),
);

// Packing list — user-defined categories, each holding items with a name,
// quantity (default 1), and a packed checkbox. Categories cascade-delete their
// items; trips cascade-delete their categories.
export const packingCategories = sqliteTable(
  'packing_categories',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    orderIndex: integer('order_index').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    byTrip: index('idx_packing_cat_trip').on(t.tripId, t.orderIndex),
  }),
);

export const packingItems = sqliteTable(
  'packing_items',
  {
    id: text('id').primaryKey(),
    categoryId: text('category_id')
      .notNull()
      .references(() => packingCategories.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    quantity: integer('quantity').notNull().default(1),
    packed: integer('packed', { mode: 'boolean' }).notNull().default(false),
    orderIndex: integer('order_index').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    byCategory: index('idx_packing_item_cat').on(t.categoryId, t.orderIndex),
  }),
);

// Simple trip to-do tasks (the "To do" tab's Tasks section). No category — just
// a title, an optional note, and a done checkbox. Trips cascade-delete tasks.
export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    note: text('note'),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    orderIndex: integer('order_index').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    byTrip: index('idx_tasks_trip').on(t.tripId, t.orderIndex),
  }),
);

/**
 * Per-day default travel mode. Sparse: a row exists only for a day the user
 * explicitly set; a missing row → `DEFAULT_DAY_MODE` ('drive'). Per-leg
 * overrides live on `places.legMode` and take precedence over this default.
 */
export const dayModes = sqliteTable(
  'day_modes',
  {
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    dayDate: text('day_date').notNull(),
    mode: text('mode', { enum: ['walk', 'drive', 'transit'] }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tripId, t.dayDate] }),
  }),
);

/**
 * Per-day itinerary title ("what's today about"). Sparse like day_modes: a row
 * exists only for days the user titled; clearing the title deletes the row.
 */
export const dayTitles = sqliteTable(
  'day_titles',
  {
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    dayDate: text('day_date').notNull(),
    title: text('title').notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tripId, t.dayDate] }),
  }),
);

/**
 * A named, per-trip grouping ("list") for Saved-bucket places. A place points
 * here via `places.list_id`; deleting a list sets those places' list_id to NULL
 * (they become "loose" again — never deleted).
 */
export const savedLists = sqliteTable(
  'saved_lists',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    orderIndex: integer('order_index').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    byTrip: index('idx_saved_lists_trip').on(t.tripId, t.orderIndex),
  }),
);

/**
 * Tickets / reservations (the "Tickets" tab): bookings with an optional
 * date/time/location and free-form note. Attachments (booking PDFs, QR-code
 * screenshots) live in `ticket_files`. Cards sort by (date, time) ascending
 * with undated tickets last.
 */
export const tickets = sqliteTable(
  'tickets',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    date: text('date'), // YYYY-MM-DD, nullable
    time: text('time'), // HH:MM, nullable
    location: text('location'),
    note: text('note'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    byTrip: index('idx_tickets_trip').on(t.tripId, t.date, t.time),
  }),
);

/**
 * One uploaded ticket attachment (image or PDF), stored on the uploads volume
 * at `tickets/<ticketId>/<fileId>` (original bytes; no re-encode so PDFs and
 * QR codes stay scannable). Served by GET /api/tickets/files/[fileId].
 */
export const ticketFiles = sqliteTable(
  'ticket_files',
  {
    id: text('id').primaryKey(),
    ticketId: text('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // original filename (display + download name)
    path: text('path').notNull(), // uploads-relative
    mime: text('mime').notNull(), // image/* or application/pdf
    size: integer('size').notNull(), // bytes
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    byTicket: index('idx_ticket_files_ticket').on(t.ticketId),
  }),
);

/**
 * A named, per-trip photography list (Journal ▸ Photography). Each list holds
 * reference photos uploaded via the shared `photos` table with
 * owner_type='photo_list' and owner_id = this row's id — a place to collect
 * "how to shoot here" inspiration before the trip. Deleting a list also deletes
 * its photos (rows + on-disk derivatives) in the delete action, since the
 * generic photos.owner_id has no DB-level FK to cascade.
 */
export const photoLists = sqliteTable(
  'photo_lists',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    orderIndex: integer('order_index').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    byTrip: index('idx_photo_lists_trip').on(t.tripId, t.orderIndex),
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
  packingCategories: many(packingCategories),
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

export const packingCategoriesRelations = relations(packingCategories, ({ one, many }) => ({
  trip: one(trips, { fields: [packingCategories.tripId], references: [trips.id] }),
  items: many(packingItems),
}));

export const packingItemsRelations = relations(packingItems, ({ one }) => ({
  category: one(packingCategories, {
    fields: [packingItems.categoryId],
    references: [packingCategories.id],
  }),
}));

// --- Auth (Better Auth core tables; timestamps are ms-precision Dates, which
// is what its Drizzle adapter writes — distinct from the app's seconds mode) --

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

// --- Trip sharing -----------------------------------------------------------

/**
 * One row per (trip, invited email). `userId` is NULL while the invite is
 * pending and is filled when that email first signs in ("claim"). Every trip
 * has exactly one 'owner' row (enforced in the repo layer, seeded at boot for
 * pre-auth trips).
 */
export const tripMembers = sqliteTable(
  'trip_members',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    invitedEmail: text('invited_email').notNull(), // always lowercased
    role: text('role', { enum: ['owner', 'member'] }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    uniqTripEmail: uniqueIndex('uniq_trip_member_email').on(t.tripId, t.invitedEmail),
    byUser: index('idx_trip_members_user').on(t.userId),
  }),
);

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
export type PackingCategory = typeof packingCategories.$inferSelect;
export type NewPackingCategory = typeof packingCategories.$inferInsert;
export type PackingItem = typeof packingItems.$inferSelect;
export type NewPackingItem = typeof packingItems.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type DayMode = typeof dayModes.$inferSelect;
export type DayTitle = typeof dayTitles.$inferSelect;
export type NewDayMode = typeof dayModes.$inferInsert;
export type SavedListRow = typeof savedLists.$inferSelect;
export type NewSavedListRow = typeof savedLists.$inferInsert;
export type PhotoList = typeof photoLists.$inferSelect;
export type NewPhotoList = typeof photoLists.$inferInsert;
export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type TicketFile = typeof ticketFiles.$inferSelect;
export type NewTicketFile = typeof ticketFiles.$inferInsert;
