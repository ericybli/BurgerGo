# BurgerGo Plan 2 — Eats, Budget & Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the three remaining trip workspaces — a Restaurants (Eats) list, planned-vs-actual expense tracking (Budget), and personal photo uploads on places — on top of the shipped Phase 1.

**Architecture:** Builds on Plans 1A/1B (merged, deployed). New Drizzle tables (restaurants, expenses, budget_targets, photos) + pure db-first repos; Server Actions for mutations; cacheable JSON read handlers; static-shell pages that client-fetch (offline-readable, mutations online-only). Photos upload via a multipart route + sharp resize to the uploads volume, served by a dedicated by-photoId route. Budget tracks planned targets vs actual spend with progress.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript (strict), Tailwind, Drizzle/SQLite, sharp, Vitest + Testing Library. Same conventions as 1A/1B.

---

## Foundation & Conventions

Same as 1A/1B: npm/Node 22; TS strict; `@/*` alias; Vitest(jsdom)+RTL+in-memory `makeTestDb`; repos pure (`db` first arg, `type Db = TestDb['db']`); money = integer **minor units** rendered via `formatMoney`; dates TEXT `YYYY-MM-DD`; timestamps integer `{mode:'timestamp'}` via `new Date(now())`; TDD red->green->commit per task with the `Co-Authored-By` trailer. **Offline rule (load-bearing):** pages are **static shells + client-fetch**, never `force-dynamic` page DB reads / `cookies()` on cacheable routes; **all client fetches use `withBase('/api/...')`**; mutations online-only. Every visible string in `messages/en.json` (English; zh deferred to Plan 3).

### Plan-2 decisions & seams
- **Budget = planned vs actual** (upgraded from the spec's actual-only v1): a `budget_targets` table (overall = NULL category, or per-category `planned_amount`), and a Budget UI showing spent-vs-planned progress (overall + per category).
- **Photos now** (public app — accepted): personal photo upload on **places** only (journal photos in Plan 3). Guards: image/* only, ~10MB cap, sharp-resized to thumb/card/full WebP (EXIF-stripped) on the uploads volume. Place-card thumbnail precedence: first personal photo -> cached Google photo -> category glyph.
- **Photo routes (no collision with 1B):** upload `POST /api/photos`; serve personal photos at **`GET /api/photos/p/[photoId]/[size]`** (1B's `/api/photos/[placeId]/[variant]` keeps serving the cached Google place photo). Both path-traversal-guarded; the SW `photos` CacheFirst rule covers `/api/photos/*`.
- **Eats:** restaurants are their own per-trip entity; "schedule to a day" creates a `category:'other'` Place (name/notes copied once, `linked_place_id` recorded; deleting that place clears the link) per spec §4.1.
- DTO types shared via a small barrel (`src/db/repos/plan2.types.ts`).

## How tasks are organized
Groups run in dependency order **C0 -> C1 -> C2 -> C3** (45 bite-sized TDD tasks):
- **C0** (8) — schema migrations + repos (restaurants, expenses, budget_targets, photos).
- **C1** (12) — photo upload pipeline, by-photoId serving route, place-photo UI (PlaceDetailSheet gallery + card thumbnail).
- **C2** (11) — Eats: restaurant actions, read handler, Eats tab UI (replaces placeholder).
- **C3** (14) — Budget: expenses + budget_targets actions, read handler, Budget tab UI with planned-vs-actual progress (replaces placeholder).

---

## File Map

Files created/modified across this plan (tests colocated):

**Migration**
- `drizzle/0002_*.sql`
- `drizzle/meta/0002_snapshot.json`
- `drizzle/meta/_journal.json`

**DB / repos**
- `src/db/migration.plan2.test.ts`
- `src/db/repos/budgetTargets.test.ts`
- `src/db/repos/budgetTargets.ts`
- `src/db/repos/expenses.test.ts`
- `src/db/repos/expenses.ts`
- `src/db/repos/photos.test.ts`
- `src/db/repos/photos.ts`
- `src/db/repos/plan2.types.test.ts`
- `src/db/repos/plan2.types.ts`
- `src/db/repos/restaurants.test.ts`
- `src/db/repos/restaurants.ts`
- `src/db/schema.shape.test.ts`
- `src/db/schema.ts`

**Shared libs**
- `src/lib/budgetView.test.ts`
- `src/lib/budgetView.ts`
- `src/lib/eatsView.test.ts`
- `src/lib/eatsView.ts`
- `src/lib/photoPaths.test.ts`
- `src/lib/photoPaths.ts`
- `src/lib/photos/pipeline.test.ts`
- `src/lib/photos/pipeline.ts`
- `src/lib/planUrl.test.ts`
- `src/lib/planUrl.ts`
- `src/lib/planView.ts`

**Server Actions**
- `app/_actions/budgetTargets.test.ts`
- `app/_actions/budgetTargets.ts`
- `app/_actions/expenses.test.ts`
- `app/_actions/expenses.ts`
- `app/_actions/photos.test.ts`
- `app/_actions/photos.ts`
- `app/_actions/restaurants.test.ts`
- `app/_actions/restaurants.ts`

**Read handlers (API)**
- `app/api/trips/[tripId]/budget/route.test.ts`
- `app/api/trips/[tripId]/budget/route.ts`
- `app/api/trips/[tripId]/places/route.test.ts`
- `app/api/trips/[tripId]/places/route.ts`
- `app/api/trips/[tripId]/restaurants/route.test.ts`
- `app/api/trips/[tripId]/restaurants/route.ts`

**Photos API**
- `app/api/photos/p/[photoId]/[size]/route.test.ts`
- `app/api/photos/p/[photoId]/[size]/route.ts`
- `app/api/photos/route.test.ts`
- `app/api/photos/route.ts`

**Components**
- `components/budget/BudgetClient.test.tsx`
- `components/budget/BudgetClient.tsx`
- `components/budget/BudgetSummary.test.tsx`
- `components/budget/BudgetSummary.tsx`
- `components/budget/ExpenseSheet.test.tsx`
- `components/budget/ExpenseSheet.tsx`
- `components/budget/SetBudgetSheet.test.tsx`
- `components/budget/SetBudgetSheet.tsx`
- `components/eats/EatsClient.test.tsx`
- `components/eats/EatsClient.tsx`
- `components/eats/RestaurantCard.test.tsx`
- `components/eats/RestaurantCard.tsx`
- `components/eats/RestaurantDetailSheet.test.tsx`
- `components/eats/RestaurantDetailSheet.tsx`
- `components/eats/RestaurantFormSheet.test.tsx`
- `components/eats/RestaurantFormSheet.tsx`
- `components/plan/PhotoGallery.test.tsx`
- `components/plan/PhotoGallery.tsx`
- `components/plan/PlaceDetailSheet.test.tsx`
- `components/plan/PlaceDetailSheet.tsx`
- `components/plan/PlanClient.tsx`
- `components/plan/usePhotoUpload.test.ts`
- `components/plan/usePhotoUpload.ts`

**Tab pages**
- `app/trip/[tripId]/budget/page.test.tsx`
- `app/trip/[tripId]/budget/page.tsx`
- `app/trip/[tripId]/eats/page.test.tsx`
- `app/trip/[tripId]/eats/page.tsx`

**i18n**
- `messages/eats-i18n.test.ts`
- `messages/en.json`
- `messages/photos.i18n.test.ts`

**Other**
- `app/sw.test.ts`
- `app/sw.ts`

---

## Tasks

I have everything I need. I've confirmed: the pure db-first repo pattern (`type Db = TestDb['db']`, `db` first arg, `newId()`, `new Date(now())` for timestamps), the schema conventions (FK cascade / set null, `{ mode: 'timestamp' }`, enum text columns, `index`/`uniqueIndex` builders), the `npm run db:generate` migration workflow with the `meta/_journal.json`, the exact spec §5.2 shapes, the §5.6 path base `<tripId>/<photoId>`, and the path-traversal guard pattern. Now I'll write the C0 task-group.

### Task C0.1: Drizzle schema — restaurants, expenses, budget_targets, photos tables

**Files:**
- Modify: `src/db/schema.ts` (add four `sqliteTable` definitions, relations, and inferred row types)

This task adds only the schema definitions (TypeScript). The committed SQL migration is generated in C0.2. We TDD the *shape* of the schema by asserting the inferred types compile and the tables expose the expected columns through a tiny structural test that reads `Object.keys` on the Drizzle table objects (Drizzle exposes column builders as enumerable own properties), so the test fails before the tables exist.

- [ ] **Step 1: Write the failing schema-shape test.**

Create `src/db/schema.shape.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it — expect FAIL (modules/exports don't exist yet).**

```
npx vitest run src/db/schema.shape.test.ts
```

Expect failure: `restaurants`, `expenses`, `budgetTargets`, `photos` are not exported from `@/src/db/schema` (import/compile error).

- [ ] **Step 3: Add the four tables, relations, and inferred types to `src/db/schema.ts`.**

The file already imports `sqliteTable, text, integer, real, index, uniqueIndex` and `relations`. Add the new tables **after** `settings` (line 92) and **before** the `// Relations` comment block (line 94). The category enum, status enum, and owner_type enum exactly match spec §5.2 / Plan-2 decisions. `linked_place_id` uses `onDelete: 'set null'`; `trip_id` uses `onDelete: 'cascade'`. Timestamps use `{ mode: 'timestamp' }`. `budget_targets.category` is nullable (NULL = overall target) with a unique index on `(trip_id, category)`.

Insert this block immediately after the `settings` table definition (after line 92):

```ts
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
```

Then extend the relations and inferred types. Update `tripsRelations` (currently lines 95–98) to include the new children, and append the new relations + inferred types at the bottom of the file.

Replace the existing `tripsRelations` block:

```ts
export const tripsRelations = relations(trips, ({ many }) => ({
  places: many(places),
  travelLegs: many(travelLegs),
}));
```

with:

```ts
export const tripsRelations = relations(trips, ({ many }) => ({
  places: many(places),
  travelLegs: many(travelLegs),
  restaurants: many(restaurants),
  expenses: many(expenses),
  budgetTargets: many(budgetTargets),
  photos: many(photos),
}));
```

Append after the existing `travelLegsRelations` block (after line 118) and before the inferred-types section:

```ts
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
```

Append to the inferred-row-types section at the end of the file (after line 127, `export type Settings = ...`):

```ts
export type Restaurant = typeof restaurants.$inferSelect;
export type NewRestaurant = typeof restaurants.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type BudgetTarget = typeof budgetTargets.$inferSelect;
export type NewBudgetTarget = typeof budgetTargets.$inferInsert;
export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
```

- [ ] **Step 4: Run it — expect PASS.**

```
npx vitest run src/db/schema.shape.test.ts
```

Expect: 4 passed. Also run `npx tsc --noEmit` to confirm the new types compile.

- [ ] **Step 5: Commit.**

```
git add src/db/schema.ts src/db/schema.shape.test.ts
git commit -m "C0.1: add restaurants/expenses/budget_targets/photos schema

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C0.2: Generate + commit the Drizzle migration (and verify `makeTestDb` applies it)

**Files:**
- Create: `drizzle/0002_*.sql` (generated; exact slug name decided by drizzle-kit)
- Create: `drizzle/meta/0002_snapshot.json` (generated)
- Modify: `drizzle/meta/_journal.json` (generated — new entry appended)
- Create: `src/db/migration.plan2.test.ts` (asserts the four tables + indexes exist in a fresh `makeTestDb`)

`makeTestDb()` applies the committed migrations from `./drizzle`. Until the migration exists, a query against the new tables in a fresh test DB throws `no such table`. We write that failing query test first, then generate the migration, then watch it pass — proving the committed SQL (not just the TS schema) creates the tables. This is the infra-task pattern: failing test → generate artifact → passing test → commit.

- [ ] **Step 1: Write the failing migration test.**

Create `src/db/migration.plan2.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';

/** Names of every table in the migrated in-memory DB. */
function tableNames(sqlite: ReturnType<typeof makeTestDb>['sqlite']): Set<string> {
  const rows = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as Array<{ name: string }>;
  return new Set(rows.map((r) => r.name));
}

/** Names of every index in the migrated in-memory DB. */
function indexNames(sqlite: ReturnType<typeof makeTestDb>['sqlite']): Set<string> {
  const rows = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
    .all() as Array<{ name: string }>;
  return new Set(rows.map((r) => r.name));
}

describe('Plan 2 migration', () => {
  it('creates the four new tables', () => {
    const { sqlite } = makeTestDb();
    const names = tableNames(sqlite);
    expect(names.has('restaurants')).toBe(true);
    expect(names.has('expenses')).toBe(true);
    expect(names.has('budget_targets')).toBe(true);
    expect(names.has('photos')).toBe(true);
  });

  it('creates the Plan 2 indexes', () => {
    const { sqlite } = makeTestDb();
    const names = indexNames(sqlite);
    expect(names.has('idx_restaurants_trip')).toBe(true);
    expect(names.has('idx_expenses_trip_date')).toBe(true);
    expect(names.has('idx_expenses_trip_cat')).toBe(true);
    expect(names.has('uniq_budget_targets_trip_cat')).toBe(true);
    expect(names.has('idx_photos_owner')).toBe(true);
  });

  it('a row in each new table cascades when its trip is deleted', () => {
    const { db, sqlite } = makeTestDb();
    // Foreign keys are ON in makeTestDb; insert a trip + one child per table.
    const now = new Date(1_700_000_000_000);
    sqlite
      .prepare(
        'INSERT INTO trips (id, name, start_date, end_date, created_at, updated_at) VALUES (?,?,?,?,?,?)',
      )
      .run('t1', 'T', '2026-01-01', '2026-01-02', now.getTime(), now.getTime());
    sqlite
      .prepare(
        'INSERT INTO restaurants (id, trip_id, name, status, created_at, updated_at) VALUES (?,?,?,?,?,?)',
      )
      .run('r1', 't1', 'Soba', 'want-to-try', now.getTime(), now.getTime());
    sqlite
      .prepare(
        'INSERT INTO expenses (id, trip_id, amount, category, spent_on, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
      )
      .run('e1', 't1', 1200, 'food', '2026-01-01', now.getTime(), now.getTime());
    sqlite
      .prepare(
        'INSERT INTO budget_targets (id, trip_id, category, planned_amount, created_at, updated_at) VALUES (?,?,?,?,?,?)',
      )
      .run('b1', 't1', null, 50000, now.getTime(), now.getTime());
    sqlite
      .prepare(
        'INSERT INTO photos (id, trip_id, owner_type, owner_id, path, order_index, created_at) VALUES (?,?,?,?,?,?,?)',
      )
      .run('p1', 't1', 'place', 'pl1', 't1/p1', 0, now.getTime());

    sqlite.prepare('DELETE FROM trips WHERE id = ?').run('t1');

    for (const tbl of ['restaurants', 'expenses', 'budget_targets', 'photos']) {
      const { c } = sqlite.prepare(`SELECT count(*) AS c FROM ${tbl}`).get() as {
        c: number;
      };
      expect(c, `${tbl} should cascade-delete`).toBe(0);
    }
    // db is referenced to keep the drizzle instance alive alongside sqlite.
    expect(db).toBeDefined();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL (no committed migration yet).**

```
npx vitest run src/db/migration.plan2.test.ts
```

Expect failure: `SqliteError: no such table: restaurants` (the schema TS exists but no `drizzle/0002_*.sql` has been generated/applied).

- [ ] **Step 3: Generate the migration.**

```
npm run db:generate
```

This runs `drizzle-kit generate` (dialect sqlite, schema `./src/db/schema.ts`, out `./drizzle`). It emits `drizzle/0002_<slug>.sql` containing `CREATE TABLE restaurants/expenses/budget_targets/photos` plus the five indexes, writes `drizzle/meta/0002_snapshot.json`, and appends an entry to `drizzle/meta/_journal.json`. Do not hand-edit the generated SQL. Inspect it with `git diff --stat` and open the `.sql` to confirm it contains the four `CREATE TABLE` statements, the `set null` / `cascade` FK clauses, and `CREATE INDEX`/`CREATE UNIQUE INDEX` for the five indexes named in C0.1.

- [ ] **Step 4: Run it — expect PASS.**

```
npx vitest run src/db/migration.plan2.test.ts
```

Expect: 3 passed. Then run the whole suite to confirm no regression in existing repos: `npm test` — expect all prior suites still passing plus the two new files.

- [ ] **Step 5: Commit.**

```
git add drizzle/ src/db/migration.plan2.test.ts
git commit -m "C0.2: generate Plan 2 Drizzle migration

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C0.3: restaurants repo — CRUD + by-status + scheduleToDay/unschedule

**Files:**
- Create: `src/db/repos/restaurants.ts`
- Create: `src/db/repos/restaurants.test.ts`

Pure db-first repo (`db` first arg, `type Db = TestDb['db']`, `newId()` + `new Date(now())`), mirroring `places.ts`. `scheduleToDay`/`unschedule` operate on `linked_place_id` (the FK schedule link from spec §4.1: the restaurant is "scheduled" when it points at a place; deleting that place sets the FK to NULL via the migration's `onDelete: set null`, which the test verifies).

- [ ] **Step 1: Write the failing repo test.**

Create `src/db/repos/restaurants.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { createTrip } from '@/src/db/repos/trips';
import { addPlace } from '@/src/db/repos/places';
import {
  addRestaurant,
  getRestaurant,
  listByTrip,
  listByStatus,
  updateRestaurant,
  deleteRestaurant,
  scheduleToDay,
  unschedule,
} from '@/src/db/repos/restaurants';

const NOW = new Date('2026-06-08T12:00:00.000Z');

function setup() {
  const { db } = makeTestDb();
  const trip = createTrip(db, {
    name: 'Tokyo',
    startDate: '2026-06-01',
    endDate: '2026-06-10',
  });
  return { db, tripId: trip.id };
}

describe('restaurants repo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('addRestaurant inserts with defaults and generated id/timestamps', () => {
    const { db, tripId } = setup();
    const r = addRestaurant(db, { tripId, name: 'Sukiyabashi Jiro' });
    expect(r.id).toMatch(/[0-9a-f-]{36}/);
    expect(r.name).toBe('Sukiyabashi Jiro');
    expect(r.status).toBe('want-to-try'); // default
    expect(r.cuisine).toBeNull();
    expect(r.rating).toBeNull();
    expect(r.priceLevel).toBeNull();
    expect(r.notes).toBeNull();
    expect(r.linkedPlaceId).toBeNull();
    expect(r.createdAt).toEqual(NOW);
    expect(r.updatedAt).toEqual(NOW);
    expect(getRestaurant(db, r.id)?.name).toBe('Sukiyabashi Jiro');
  });

  it('addRestaurant honors provided optional fields and status', () => {
    const { db, tripId } = setup();
    const r = addRestaurant(db, {
      tripId,
      name: 'Ramen Place',
      cuisine: 'Japanese',
      rating: 5,
      status: 'been',
      priceLevel: 2,
      notes: 'amazing tonkotsu',
    });
    expect(r.cuisine).toBe('Japanese');
    expect(r.rating).toBe(5);
    expect(r.status).toBe('been');
    expect(r.priceLevel).toBe(2);
    expect(r.notes).toBe('amazing tonkotsu');
  });

  it('listByTrip returns all rows newest-first (by createdAt desc, id tiebreak)', () => {
    const { db, tripId } = setup();
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
    const a = addRestaurant(db, { tripId, name: 'A' });
    vi.setSystemTime(new Date('2026-06-08T13:00:00Z'));
    const b = addRestaurant(db, { tripId, name: 'B' });
    const ids = listByTrip(db, tripId).map((r) => r.id);
    expect(ids[0]).toBe(b.id);
    expect(ids[1]).toBe(a.id);
  });

  it('listByStatus filters by status', () => {
    const { db, tripId } = setup();
    addRestaurant(db, { tripId, name: 'Want', status: 'want-to-try' });
    addRestaurant(db, { tripId, name: 'Been', status: 'been' });
    expect(listByStatus(db, tripId, 'been').map((r) => r.name)).toEqual(['Been']);
    expect(listByStatus(db, tripId, 'want-to-try').map((r) => r.name)).toEqual([
      'Want',
    ]);
  });

  it('updateRestaurant patches fields and bumps updatedAt', () => {
    const { db, tripId } = setup();
    const r = addRestaurant(db, { tripId, name: 'Old' });
    vi.setSystemTime(new Date('2026-06-09T12:00:00Z'));
    const updated = updateRestaurant(db, r.id, { name: 'New', rating: 4 });
    expect(updated?.name).toBe('New');
    expect(updated?.rating).toBe(4);
    expect(updated?.updatedAt).toEqual(new Date('2026-06-09T12:00:00Z'));
  });

  it('updateRestaurant returns undefined for unknown id', () => {
    const { db } = setup();
    expect(updateRestaurant(db, 'nope', { name: 'X' })).toBeUndefined();
  });

  it('deleteRestaurant removes the row', () => {
    const { db, tripId } = setup();
    const r = addRestaurant(db, { tripId, name: 'Gone' });
    deleteRestaurant(db, r.id);
    expect(getRestaurant(db, r.id)).toBeUndefined();
  });

  it('scheduleToDay links a place; unschedule clears it', () => {
    const { db, tripId } = setup();
    const place = addPlace(db, {
      tripId,
      name: 'Jiro (scheduled)',
      category: 'other',
      dayDate: '2026-06-02',
    });
    const r = addRestaurant(db, { tripId, name: 'Jiro' });

    const linked = scheduleToDay(db, r.id, place.id);
    expect(linked?.linkedPlaceId).toBe(place.id);
    expect(getRestaurant(db, r.id)?.linkedPlaceId).toBe(place.id);

    const cleared = unschedule(db, r.id);
    expect(cleared?.linkedPlaceId).toBeNull();
  });

  it('deleting the linked place sets linked_place_id NULL (FK set null)', () => {
    const { db, tripId } = setup();
    const place = addPlace(db, {
      tripId,
      name: 'P',
      category: 'other',
      dayDate: '2026-06-02',
    });
    const r = addRestaurant(db, { tripId, name: 'R' });
    scheduleToDay(db, r.id, place.id);

    db.delete; // (no-op ref to keep tree-shaker honest)
    // Delete the place directly via the places repo path:
    const { deletePlace } = await import('@/src/db/repos/places');
    deletePlace(db, place.id);

    expect(getRestaurant(db, r.id)?.linkedPlaceId).toBeNull();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

```
npx vitest run src/db/repos/restaurants.test.ts
```

Expect failure: cannot resolve `@/src/db/repos/restaurants` (module does not exist).

- [ ] **Step 3: Implement `src/db/repos/restaurants.ts`.**

```ts
import { and, asc, desc, eq } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { restaurants, type Restaurant } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';

export type { Restaurant };

type Db = TestDb['db'];

export type RestaurantStatus = Restaurant['status'];

/** One restaurant by id, or undefined. */
export function getRestaurant(db: Db, id: string): Restaurant | undefined {
  return db.select().from(restaurants).where(eq(restaurants.id, id)).get();
}

/** All restaurants for a trip, newest-first (createdAt desc, id tiebreak). */
export function listByTrip(db: Db, tripId: string): Restaurant[] {
  return db
    .select()
    .from(restaurants)
    .where(eq(restaurants.tripId, tripId))
    .orderBy(desc(restaurants.createdAt), asc(restaurants.id))
    .all();
}

/** Restaurants for a trip filtered by status (want-to-try | been), newest-first. */
export function listByStatus(
  db: Db,
  tripId: string,
  status: RestaurantStatus,
): Restaurant[] {
  return db
    .select()
    .from(restaurants)
    .where(and(eq(restaurants.tripId, tripId), eq(restaurants.status, status)))
    .orderBy(desc(restaurants.createdAt), asc(restaurants.id))
    .all();
}

export interface AddRestaurantInput {
  tripId: string;
  name: string;
  cuisine?: string | null;
  rating?: number | null;
  status?: RestaurantStatus; // defaults to 'want-to-try'
  priceLevel?: number | null;
  notes?: string | null;
  linkedPlaceId?: string | null;
}

/** Insert a restaurant; generates id + timestamps. Defaults status 'want-to-try'. */
export function addRestaurant(db: Db, input: AddRestaurantInput): Restaurant {
  const ts = new Date(now());
  const row: Restaurant = {
    id: newId(),
    tripId: input.tripId,
    name: input.name,
    cuisine: input.cuisine ?? null,
    rating: input.rating ?? null,
    status: input.status ?? 'want-to-try',
    priceLevel: input.priceLevel ?? null,
    notes: input.notes ?? null,
    linkedPlaceId: input.linkedPlaceId ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(restaurants).values(row).run();
  return row;
}

/** Editable subset (never id/tripId/timestamps). */
export type RestaurantPatch = Partial<
  Pick<
    Restaurant,
    'name' | 'cuisine' | 'rating' | 'status' | 'priceLevel' | 'notes' | 'linkedPlaceId'
  >
>;

/** Patch the provided fields; bumps updatedAt. Returns the row, or undefined. */
export function updateRestaurant(
  db: Db,
  id: string,
  patch: RestaurantPatch,
): Restaurant | undefined {
  db.update(restaurants)
    .set({ ...patch, updatedAt: new Date(now()) })
    .where(eq(restaurants.id, id))
    .run();
  return getRestaurant(db, id);
}

/** Delete a restaurant. */
export function deleteRestaurant(db: Db, id: string): void {
  db.delete(restaurants).where(eq(restaurants.id, id)).run();
}

/** Link a restaurant to a scheduled place (sets linked_place_id). */
export function scheduleToDay(
  db: Db,
  id: string,
  placeId: string,
): Restaurant | undefined {
  return updateRestaurant(db, id, { linkedPlaceId: placeId });
}

/** Clear the schedule link (sets linked_place_id NULL). */
export function unschedule(db: Db, id: string): Restaurant | undefined {
  return updateRestaurant(db, id, { linkedPlaceId: null });
}
```

- [ ] **Step 4: Run it — expect PASS.**

```
npx vitest run src/db/repos/restaurants.test.ts
```

Expect: 9 passed.

- [ ] **Step 5: Commit.**

```
git add src/db/repos/restaurants.ts src/db/repos/restaurants.test.ts
git commit -m "C0.3: restaurants repo (CRUD + by-status + schedule/unschedule)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C0.4: expenses repo — add/update/delete + totals byCategory/byDay

**Files:**
- Create: `src/db/repos/expenses.ts`
- Create: `src/db/repos/expenses.test.ts`

Pure db-first repo. Amounts are integer minor units (never formatted here — `formatMoney` is a UI concern). `byCategory` returns one summed row per category present; `byDay` returns one summed row per `spent_on` date, descending (matching the §4.2 "grouped by spent_on date, descending" UI), plus a grand `total`. SQL aggregation via `sum()` + `groupBy`.

- [ ] **Step 1: Write the failing repo test.**

Create `src/db/repos/expenses.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { createTrip } from '@/src/db/repos/trips';
import { addPlace, deletePlace } from '@/src/db/repos/places';
import {
  addExpense,
  getExpense,
  listByTrip,
  updateExpense,
  deleteExpense,
  totalsByCategory,
  totalsByDay,
  totalForTrip,
} from '@/src/db/repos/expenses';

const NOW = new Date('2026-06-08T12:00:00.000Z');

function setup() {
  const { db } = makeTestDb();
  const trip = createTrip(db, {
    name: 'Tokyo',
    startDate: '2026-06-01',
    endDate: '2026-06-10',
  });
  return { db, tripId: trip.id };
}

describe('expenses repo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('addExpense inserts with generated id/timestamps', () => {
    const { db, tripId } = setup();
    const e = addExpense(db, {
      tripId,
      amount: 1500,
      category: 'food',
      spentOn: '2026-06-02',
      note: 'lunch',
    });
    expect(e.id).toMatch(/[0-9a-f-]{36}/);
    expect(e.amount).toBe(1500);
    expect(e.category).toBe('food');
    expect(e.spentOn).toBe('2026-06-02');
    expect(e.note).toBe('lunch');
    expect(e.linkedPlaceId).toBeNull();
    expect(e.createdAt).toEqual(NOW);
    expect(getExpense(db, e.id)?.amount).toBe(1500);
  });

  it('listByTrip orders by spent_on desc then createdAt desc', () => {
    const { db, tripId } = setup();
    addExpense(db, { tripId, amount: 100, category: 'food', spentOn: '2026-06-01' });
    addExpense(db, { tripId, amount: 200, category: 'food', spentOn: '2026-06-03' });
    addExpense(db, { tripId, amount: 300, category: 'food', spentOn: '2026-06-02' });
    expect(listByTrip(db, tripId).map((e) => e.spentOn)).toEqual([
      '2026-06-03',
      '2026-06-02',
      '2026-06-01',
    ]);
  });

  it('updateExpense patches fields and bumps updatedAt', () => {
    const { db, tripId } = setup();
    const e = addExpense(db, {
      tripId,
      amount: 100,
      category: 'food',
      spentOn: '2026-06-02',
    });
    vi.setSystemTime(new Date('2026-06-09T12:00:00Z'));
    const updated = updateExpense(db, e.id, { amount: 999, category: 'shopping' });
    expect(updated?.amount).toBe(999);
    expect(updated?.category).toBe('shopping');
    expect(updated?.updatedAt).toEqual(new Date('2026-06-09T12:00:00Z'));
  });

  it('updateExpense returns undefined for unknown id', () => {
    const { db } = setup();
    expect(updateExpense(db, 'nope', { amount: 1 })).toBeUndefined();
  });

  it('deleteExpense removes the row', () => {
    const { db, tripId } = setup();
    const e = addExpense(db, {
      tripId,
      amount: 100,
      category: 'food',
      spentOn: '2026-06-02',
    });
    deleteExpense(db, e.id);
    expect(getExpense(db, e.id)).toBeUndefined();
  });

  it('totalsByCategory sums per category (only categories present)', () => {
    const { db, tripId } = setup();
    addExpense(db, { tripId, amount: 1000, category: 'food', spentOn: '2026-06-01' });
    addExpense(db, { tripId, amount: 500, category: 'food', spentOn: '2026-06-02' });
    addExpense(db, { tripId, amount: 2000, category: 'lodging', spentOn: '2026-06-01' });
    const totals = totalsByCategory(db, tripId);
    expect(totals).toEqual([
      { category: 'food', total: 1500 },
      { category: 'lodging', total: 2000 },
    ]);
  });

  it('totalsByDay sums per spent_on date, descending', () => {
    const { db, tripId } = setup();
    addExpense(db, { tripId, amount: 100, category: 'food', spentOn: '2026-06-01' });
    addExpense(db, { tripId, amount: 200, category: 'food', spentOn: '2026-06-01' });
    addExpense(db, { tripId, amount: 50, category: 'transport', spentOn: '2026-06-03' });
    const totals = totalsByDay(db, tripId);
    expect(totals).toEqual([
      { spentOn: '2026-06-03', total: 50 },
      { spentOn: '2026-06-01', total: 300 },
    ]);
  });

  it('totalForTrip sums every expense', () => {
    const { db, tripId } = setup();
    addExpense(db, { tripId, amount: 100, category: 'food', spentOn: '2026-06-01' });
    addExpense(db, { tripId, amount: 250, category: 'lodging', spentOn: '2026-06-02' });
    expect(totalForTrip(db, tripId)).toBe(350);
    // Empty trip totals to 0.
    const other = createTrip(db, { name: 'X', startDate: '2026-07-01', endDate: '2026-07-02' });
    expect(totalForTrip(db, other.id)).toBe(0);
  });

  it('deleting a linked place sets linked_place_id NULL (FK set null)', () => {
    const { db, tripId } = setup();
    const place = addPlace(db, {
      tripId,
      name: 'P',
      category: 'other',
      dayDate: '2026-06-02',
    });
    const e = addExpense(db, {
      tripId,
      amount: 100,
      category: 'food',
      spentOn: '2026-06-02',
      linkedPlaceId: place.id,
    });
    deletePlace(db, place.id);
    expect(getExpense(db, e.id)?.linkedPlaceId).toBeNull();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

```
npx vitest run src/db/repos/expenses.test.ts
```

Expect failure: cannot resolve `@/src/db/repos/expenses`.

- [ ] **Step 3: Implement `src/db/repos/expenses.ts`.**

```ts
import { asc, desc, eq, sql } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { expenses, type Expense } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';

export type { Expense };

type Db = TestDb['db'];

export type ExpenseCategory = Expense['category'];

/** One expense by id, or undefined. */
export function getExpense(db: Db, id: string): Expense | undefined {
  return db.select().from(expenses).where(eq(expenses.id, id)).get();
}

/**
 * All expenses for a trip, by spent_on date descending then createdAt
 * descending — the §4.2 "grouped by date, newest first" feed order.
 */
export function listByTrip(db: Db, tripId: string): Expense[] {
  return db
    .select()
    .from(expenses)
    .where(eq(expenses.tripId, tripId))
    .orderBy(desc(expenses.spentOn), desc(expenses.createdAt))
    .all();
}

export interface AddExpenseInput {
  tripId: string;
  amount: number; // integer minor units
  category: ExpenseCategory;
  spentOn: string; // YYYY-MM-DD
  note?: string | null;
  linkedPlaceId?: string | null;
}

/** Insert an expense; generates id + timestamps. */
export function addExpense(db: Db, input: AddExpenseInput): Expense {
  const ts = new Date(now());
  const row: Expense = {
    id: newId(),
    tripId: input.tripId,
    amount: input.amount,
    category: input.category,
    spentOn: input.spentOn,
    note: input.note ?? null,
    linkedPlaceId: input.linkedPlaceId ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(expenses).values(row).run();
  return row;
}

/** Editable subset (never id/tripId/timestamps). */
export type ExpensePatch = Partial<
  Pick<Expense, 'amount' | 'category' | 'spentOn' | 'note' | 'linkedPlaceId'>
>;

/** Patch the provided fields; bumps updatedAt. Returns the row, or undefined. */
export function updateExpense(
  db: Db,
  id: string,
  patch: ExpensePatch,
): Expense | undefined {
  db.update(expenses)
    .set({ ...patch, updatedAt: new Date(now()) })
    .where(eq(expenses.id, id))
    .run();
  return getExpense(db, id);
}

/** Delete an expense. */
export function deleteExpense(db: Db, id: string): void {
  db.delete(expenses).where(eq(expenses.id, id)).run();
}

export interface CategoryTotal {
  category: ExpenseCategory;
  total: number; // minor units
}

/** Summed actual spend per category present, ordered by category name. */
export function totalsByCategory(db: Db, tripId: string): CategoryTotal[] {
  const rows = db
    .select({
      category: expenses.category,
      total: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(eq(expenses.tripId, tripId))
    .groupBy(expenses.category)
    .orderBy(asc(expenses.category))
    .all();
  return rows.map((r) => ({ category: r.category, total: Number(r.total) }));
}

export interface DayTotal {
  spentOn: string; // YYYY-MM-DD
  total: number; // minor units
}

/** Summed actual spend per spent_on date, descending. */
export function totalsByDay(db: Db, tripId: string): DayTotal[] {
  const rows = db
    .select({
      spentOn: expenses.spentOn,
      total: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(eq(expenses.tripId, tripId))
    .groupBy(expenses.spentOn)
    .orderBy(desc(expenses.spentOn))
    .all();
  return rows.map((r) => ({ spentOn: r.spentOn, total: Number(r.total) }));
}

/** Grand total actual spend for the trip (minor units); 0 when empty. */
export function totalForTrip(db: Db, tripId: string): number {
  const row = db
    .select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
    .from(expenses)
    .where(eq(expenses.tripId, tripId))
    .get();
  return Number(row?.total ?? 0);
}
```

- [ ] **Step 4: Run it — expect PASS.**

```
npx vitest run src/db/repos/expenses.test.ts
```

Expect: 9 passed.

- [ ] **Step 5: Commit.**

```
git add src/db/repos/expenses.ts src/db/repos/expenses.test.ts
git commit -m "C0.4: expenses repo (CRUD + totals byCategory/byDay)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C0.5: budgetTargets repo — set/get per (trip, category|overall) with upsert

**Files:**
- Create: `src/db/repos/budgetTargets.ts`
- Create: `src/db/repos/budgetTargets.test.ts`

The Plan-2 planned-budget store. `category = null` is the overall target. Because SQLite treats each `NULL` as distinct inside a `UNIQUE` index, the repo cannot rely on `onConflictDoUpdate` for the overall row — so `setTarget` does a read-before-write (find existing by trip + category, where category match uses `isNull` when null) and inserts or updates accordingly. Per-category rows still upsert correctly through the same read-before-write path, keeping behavior uniform.

- [ ] **Step 1: Write the failing repo test.**

Create `src/db/repos/budgetTargets.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { createTrip } from '@/src/db/repos/trips';
import {
  setTarget,
  getTarget,
  getOverallTarget,
  listTargets,
  deleteTarget,
} from '@/src/db/repos/budgetTargets';

const NOW = new Date('2026-06-08T12:00:00.000Z');

function setup() {
  const { db, sqlite } = makeTestDb();
  const trip = createTrip(db, {
    name: 'Tokyo',
    startDate: '2026-06-01',
    endDate: '2026-06-10',
  });
  return { db, sqlite, tripId: trip.id };
}

describe('budgetTargets repo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('setTarget inserts an overall target (category null)', () => {
    const { db, tripId } = setup();
    const t = setTarget(db, tripId, null, 500000);
    expect(t.id).toMatch(/[0-9a-f-]{36}/);
    expect(t.category).toBeNull();
    expect(t.plannedAmount).toBe(500000);
    expect(t.createdAt).toEqual(NOW);
    expect(getOverallTarget(db, tripId)?.plannedAmount).toBe(500000);
  });

  it('setTarget inserts a per-category target', () => {
    const { db, tripId } = setup();
    setTarget(db, tripId, 'food', 80000);
    expect(getTarget(db, tripId, 'food')?.plannedAmount).toBe(80000);
    expect(getTarget(db, tripId, 'lodging')).toBeUndefined();
  });

  it('setTarget upserts the overall row in place (no duplicate)', () => {
    const { db, sqlite, tripId } = setup();
    const first = setTarget(db, tripId, null, 100000);
    vi.setSystemTime(new Date('2026-06-09T12:00:00Z'));
    const second = setTarget(db, tripId, null, 250000);
    expect(second.id).toBe(first.id); // same row, updated
    expect(second.plannedAmount).toBe(250000);
    expect(second.createdAt).toEqual(NOW); // createdAt preserved
    expect(second.updatedAt).toEqual(new Date('2026-06-09T12:00:00Z'));
    const { c } = sqlite
      .prepare('SELECT count(*) AS c FROM budget_targets')
      .get() as { c: number };
    expect(c).toBe(1);
  });

  it('setTarget upserts a per-category row in place (no duplicate)', () => {
    const { db, sqlite, tripId } = setup();
    const first = setTarget(db, tripId, 'food', 50000);
    const second = setTarget(db, tripId, 'food', 60000);
    expect(second.id).toBe(first.id);
    expect(second.plannedAmount).toBe(60000);
    const { c } = sqlite
      .prepare("SELECT count(*) AS c FROM budget_targets WHERE category = 'food'")
      .get() as { c: number };
    expect(c).toBe(1);
  });

  it('overall and per-category targets coexist independently', () => {
    const { db, tripId } = setup();
    setTarget(db, tripId, null, 500000);
    setTarget(db, tripId, 'food', 80000);
    setTarget(db, tripId, 'lodging', 120000);
    expect(getOverallTarget(db, tripId)?.plannedAmount).toBe(500000);
    expect(getTarget(db, tripId, 'food')?.plannedAmount).toBe(80000);
    expect(listTargets(db, tripId)).toHaveLength(3);
  });

  it('listTargets returns overall first, then categories alphabetically', () => {
    const { db, tripId } = setup();
    setTarget(db, tripId, 'lodging', 1);
    setTarget(db, tripId, null, 2);
    setTarget(db, tripId, 'food', 3);
    expect(listTargets(db, tripId).map((t) => t.category)).toEqual([
      null,
      'food',
      'lodging',
    ]);
  });

  it('deleteTarget removes the overall row', () => {
    const { db, tripId } = setup();
    setTarget(db, tripId, null, 100);
    deleteTarget(db, tripId, null);
    expect(getOverallTarget(db, tripId)).toBeUndefined();
  });

  it('deleteTarget removes a per-category row', () => {
    const { db, tripId } = setup();
    setTarget(db, tripId, 'food', 100);
    deleteTarget(db, tripId, 'food');
    expect(getTarget(db, tripId, 'food')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

```
npx vitest run src/db/repos/budgetTargets.test.ts
```

Expect failure: cannot resolve `@/src/db/repos/budgetTargets`.

- [ ] **Step 3: Implement `src/db/repos/budgetTargets.ts`.**

```ts
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { budgetTargets, type BudgetTarget } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';

export type { BudgetTarget };

type Db = TestDb['db'];

/** A non-null expense category, or `null` for the overall trip target. */
export type TargetCategory = BudgetTarget['category'];

/** Match-by-trip-and-category condition; uses IS NULL for the overall row. */
function whereTripCat(tripId: string, category: TargetCategory) {
  return category === null
    ? and(eq(budgetTargets.tripId, tripId), isNull(budgetTargets.category))
    : and(eq(budgetTargets.tripId, tripId), eq(budgetTargets.category, category));
}

/** The per-category target for a trip, or undefined. */
export function getTarget(
  db: Db,
  tripId: string,
  category: Exclude<TargetCategory, null>,
): BudgetTarget | undefined {
  return db
    .select()
    .from(budgetTargets)
    .where(whereTripCat(tripId, category))
    .get();
}

/** The overall (category NULL) target for a trip, or undefined. */
export function getOverallTarget(
  db: Db,
  tripId: string,
): BudgetTarget | undefined {
  return db
    .select()
    .from(budgetTargets)
    .where(whereTripCat(tripId, null))
    .get();
}

/**
 * All targets for a trip: overall (category NULL) first, then per-category
 * rows alphabetically. NULL sorts first via `category IS NOT NULL`.
 */
export function listTargets(db: Db, tripId: string): BudgetTarget[] {
  return db
    .select()
    .from(budgetTargets)
    .where(eq(budgetTargets.tripId, tripId))
    .orderBy(sql`${budgetTargets.category} IS NOT NULL`, asc(budgetTargets.category))
    .all();
}

/**
 * Set the planned amount for (trip, category). `category = null` is the overall
 * target. Upserts via read-before-write: SQLite treats each NULL as distinct in
 * a UNIQUE index, so we cannot use onConflict for the overall row. Existing
 * rows keep their id + createdAt; only plannedAmount + updatedAt change.
 */
export function setTarget(
  db: Db,
  tripId: string,
  category: TargetCategory,
  plannedAmount: number,
): BudgetTarget {
  const ts = new Date(now());
  const existing = db
    .select()
    .from(budgetTargets)
    .where(whereTripCat(tripId, category))
    .get();

  if (existing) {
    db.update(budgetTargets)
      .set({ plannedAmount, updatedAt: ts })
      .where(eq(budgetTargets.id, existing.id))
      .run();
    return { ...existing, plannedAmount, updatedAt: ts };
  }

  const row: BudgetTarget = {
    id: newId(),
    tripId,
    category,
    plannedAmount,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(budgetTargets).values(row).run();
  return row;
}

/** Delete the target for (trip, category). `category = null` deletes overall. */
export function deleteTarget(
  db: Db,
  tripId: string,
  category: TargetCategory,
): void {
  db.delete(budgetTargets).where(whereTripCat(tripId, category)).run();
}
```

- [ ] **Step 4: Run it — expect PASS.**

```
npx vitest run src/db/repos/budgetTargets.test.ts
```

Expect: 8 passed.

- [ ] **Step 5: Commit.**

```
git add src/db/repos/budgetTargets.ts src/db/repos/budgetTargets.test.ts
git commit -m "C0.5: budgetTargets repo (planned per trip+category, upsert)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C0.6: photo path helpers (pure)

**Files:**
- Create: `src/lib/photoPaths.ts`
- Create: `src/lib/photoPaths.test.ts`

Extract the §5.6 path math as pure functions so both the photos repo (C0.7) and the upload/serve routes (later groups) share one source of truth: the DB base path is `<tripId>/<photoId>` (no extension); a serving file resolves by appending `/<size>.webp`. We also define the canonical size set (`thumb` ~320 / `card` ~800 / `full` ~1600 long-edge per §8.5) here so the route validates against it. These are pure (no I/O), trivially TDD-able.

- [ ] **Step 1: Write the failing helper test.**

Create `src/lib/photoPaths.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  PHOTO_SIZES,
  isPhotoSize,
  photoBasePath,
  photoDerivativeRelPath,
  type PhotoSize,
} from '@/src/lib/photoPaths';

describe('photoPaths', () => {
  it('PHOTO_SIZES is thumb/card/full', () => {
    expect(PHOTO_SIZES).toEqual(['thumb', 'card', 'full']);
  });

  it('isPhotoSize narrows valid sizes and rejects others', () => {
    expect(isPhotoSize('thumb')).toBe(true);
    expect(isPhotoSize('card')).toBe(true);
    expect(isPhotoSize('full')).toBe(true);
    expect(isPhotoSize('original')).toBe(false);
    expect(isPhotoSize('')).toBe(false);
    expect(isPhotoSize('thumb/../etc')).toBe(false);
  });

  it('photoBasePath is `<tripId>/<photoId>`', () => {
    expect(photoBasePath('trip-1', 'photo-9')).toBe('trip-1/photo-9');
  });

  it('photoDerivativeRelPath appends `/<size>.webp` to the base', () => {
    const base = photoBasePath('trip-1', 'photo-9');
    expect(photoDerivativeRelPath(base, 'thumb')).toBe('trip-1/photo-9/thumb.webp');
    expect(photoDerivativeRelPath(base, 'card')).toBe('trip-1/photo-9/card.webp');
    expect(photoDerivativeRelPath(base, 'full')).toBe('trip-1/photo-9/full.webp');
  });

  it('PhotoSize type accepts the literal union (compile-time)', () => {
    const s: PhotoSize = 'card';
    expect(s).toBe('card');
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

```
npx vitest run src/lib/photoPaths.test.ts
```

Expect failure: cannot resolve `@/src/lib/photoPaths`.

- [ ] **Step 3: Implement `src/lib/photoPaths.ts`.**

```ts
/**
 * Photo path helpers (spec §5.6 / §8.5). A `photos.path` is the **base path**
 * `<tripId>/<photoId>` with no extension. Each base path has three generated
 * WebP derivatives, resolved by appending `/<size>.webp`. These are pure: no
 * filesystem access (the serving route joins them under UPLOADS_DIR with a
 * path-traversal guard, like 1B's Google-photo route).
 */

/** The three derivative sizes, longest-edge targets: thumb 320 / card 800 / full 1600. */
export const PHOTO_SIZES = ['thumb', 'card', 'full'] as const;

export type PhotoSize = (typeof PHOTO_SIZES)[number];

/** Long-edge pixel targets per size (used by the resize pipeline in a later group). */
export const PHOTO_SIZE_MAX_EDGE: Record<PhotoSize, number> = {
  thumb: 320,
  card: 800,
  full: 1600,
};

/** Type guard: is `s` one of the allowed derivative sizes? */
export function isPhotoSize(s: string): s is PhotoSize {
  return (PHOTO_SIZES as readonly string[]).includes(s);
}

/** The DB base path stored in `photos.path`: `<tripId>/<photoId>` (no extension). */
export function photoBasePath(tripId: string, photoId: string): string {
  return `${tripId}/${photoId}`;
}

/** The on-disk relative path of one derivative: `<basePath>/<size>.webp`. */
export function photoDerivativeRelPath(basePath: string, size: PhotoSize): string {
  return `${basePath}/${size}.webp`;
}
```

- [ ] **Step 4: Run it — expect PASS.**

```
npx vitest run src/lib/photoPaths.test.ts
```

Expect: 5 passed.

- [ ] **Step 5: Commit.**

```
git add src/lib/photoPaths.ts src/lib/photoPaths.test.ts
git commit -m "C0.6: pure photo path helpers (§5.6 base path + derivatives)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C0.7: photos repo — addPhoto, listByOwner, getPhoto, deletePhoto, reorder

**Files:**
- Create: `src/db/repos/photos.ts`
- Create: `src/db/repos/photos.test.ts`

Pure db-first repo for the `photos` table. `addPhoto` auto-assigns `order_index = max(owner gallery) + 1` (mirroring `places.maxOrderIndex`) and stores the §5.6 base path computed from `photoBasePath(tripId, photoId)` — so the repo, not the caller, is the source of the canonical path. `listByOwner` returns a place's gallery ordered by `order_index` (used for both the gallery and the §5.6 "first personal photo" thumbnail). `firstForOwner` returns just the first row (the thumbnail precedence helper). In Plan 2 `ownerType` is always `'place'`, but the column accepts `'journal'` for Plan 3.

- [ ] **Step 1: Write the failing repo test.**

Create `src/db/repos/photos.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { createTrip } from '@/src/db/repos/trips';
import { addPlace } from '@/src/db/repos/places';
import {
  addPhoto,
  getPhoto,
  listByOwner,
  firstForOwner,
  deletePhoto,
  reorderOwner,
} from '@/src/db/repos/photos';

const NOW = new Date('2026-06-08T12:00:00.000Z');

function setup() {
  const { db, sqlite } = makeTestDb();
  const trip = createTrip(db, {
    name: 'Tokyo',
    startDate: '2026-06-01',
    endDate: '2026-06-10',
  });
  const place = addPlace(db, {
    tripId: trip.id,
    name: 'Tower',
    category: 'sightseeing',
    dayDate: '2026-06-02',
  });
  return { db, sqlite, tripId: trip.id, placeId: place.id };
}

describe('photos repo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('addPhoto stores the §5.6 base path `<tripId>/<photoId>` and order 0', () => {
    const { db, tripId, placeId } = setup();
    const p = addPhoto(db, {
      tripId,
      ownerType: 'place',
      ownerId: placeId,
      width: 1600,
      height: 1200,
    });
    expect(p.id).toMatch(/[0-9a-f-]{36}/);
    expect(p.tripId).toBe(tripId);
    expect(p.ownerType).toBe('place');
    expect(p.ownerId).toBe(placeId);
    expect(p.path).toBe(`${tripId}/${p.id}`); // base path computed by the repo
    expect(p.width).toBe(1600);
    expect(p.height).toBe(1200);
    expect(p.orderIndex).toBe(0);
    expect(p.createdAt).toEqual(NOW);
    expect(getPhoto(db, p.id)?.path).toBe(`${tripId}/${p.id}`);
  });

  it('addPhoto appends order_index = max(gallery)+1 per owner', () => {
    const { db, tripId, placeId } = setup();
    const a = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    const b = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    const c = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    expect([a.orderIndex, b.orderIndex, c.orderIndex]).toEqual([0, 1, 2]);
  });

  it('order_index is scoped to (owner_type, owner_id)', () => {
    const { db, tripId, placeId } = setup();
    const other = addPlace(db, {
      tripId,
      name: 'Other',
      category: 'other',
      dayDate: '2026-06-03',
    });
    addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    const onOther = addPhoto(db, { tripId, ownerType: 'place', ownerId: other.id });
    expect(onOther.orderIndex).toBe(0); // independent gallery
  });

  it('listByOwner returns the gallery ordered by order_index', () => {
    const { db, tripId, placeId } = setup();
    const a = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    const b = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    expect(listByOwner(db, 'place', placeId).map((p) => p.id)).toEqual([a.id, b.id]);
  });

  it('firstForOwner returns the first gallery photo, else undefined', () => {
    const { db, tripId, placeId } = setup();
    expect(firstForOwner(db, 'place', placeId)).toBeUndefined();
    const a = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    expect(firstForOwner(db, 'place', placeId)?.id).toBe(a.id);
  });

  it('deletePhoto removes the row', () => {
    const { db, tripId, placeId } = setup();
    const a = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    deletePhoto(db, a.id);
    expect(getPhoto(db, a.id)).toBeUndefined();
  });

  it('reorderOwner renumbers the gallery to match orderedIds', () => {
    const { db, tripId, placeId } = setup();
    const a = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    const b = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    const c = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    reorderOwner(db, 'place', placeId, [c.id, a.id, b.id]);
    expect(listByOwner(db, 'place', placeId).map((p) => p.id)).toEqual([
      c.id,
      a.id,
      b.id,
    ]);
  });

  it('reorderOwner ignores ids that are not in this gallery', () => {
    const { db, tripId, placeId } = setup();
    const a = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    const b = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    reorderOwner(db, 'place', placeId, ['ghost', b.id, a.id]);
    expect(listByOwner(db, 'place', placeId).map((p) => p.id)).toEqual([b.id, a.id]);
  });

  it('photos cascade-delete when their trip is deleted', () => {
    const { db, sqlite, tripId, placeId } = setup();
    addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    const { deleteTrip } = require('@/src/db/repos/trips');
    deleteTrip(db, tripId);
    const { c } = sqlite.prepare('SELECT count(*) AS c FROM photos').get() as {
      c: number;
    };
    expect(c).toBe(0);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

```
npx vitest run src/db/repos/photos.test.ts
```

Expect failure: cannot resolve `@/src/db/repos/photos`.

- [ ] **Step 3: Implement `src/db/repos/photos.ts`.**

```ts
import { and, asc, eq, max } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { photos, type Photo } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';
import { photoBasePath } from '@/src/lib/photoPaths';

export type { Photo };

type Db = TestDb['db'];

export type PhotoOwnerType = Photo['ownerType'];

/** One photo row by id, or undefined. */
export function getPhoto(db: Db, id: string): Photo | undefined {
  return db.select().from(photos).where(eq(photos.id, id)).get();
}

/** A single owner's gallery, ordered by order_index ascending. */
export function listByOwner(
  db: Db,
  ownerType: PhotoOwnerType,
  ownerId: string,
): Photo[] {
  return db
    .select()
    .from(photos)
    .where(and(eq(photos.ownerType, ownerType), eq(photos.ownerId, ownerId)))
    .orderBy(asc(photos.orderIndex))
    .all();
}

/**
 * The first photo in an owner's gallery (lowest order_index), or undefined.
 * This is the §5.6 thumbnail-precedence step (1): "first personal photo".
 */
export function firstForOwner(
  db: Db,
  ownerType: PhotoOwnerType,
  ownerId: string,
): Photo | undefined {
  return db
    .select()
    .from(photos)
    .where(and(eq(photos.ownerType, ownerType), eq(photos.ownerId, ownerId)))
    .orderBy(asc(photos.orderIndex))
    .get();
}

/** Highest order_index in an owner's gallery, or -1 when empty. */
function maxOrderIndex(
  db: Db,
  ownerType: PhotoOwnerType,
  ownerId: string,
): number {
  const row = db
    .select({ m: max(photos.orderIndex) })
    .from(photos)
    .where(and(eq(photos.ownerType, ownerType), eq(photos.ownerId, ownerId)))
    .get();
  return row?.m ?? -1;
}

export interface AddPhotoInput {
  tripId: string;
  ownerType: PhotoOwnerType;
  ownerId: string;
  width?: number | null;
  height?: number | null;
}

/**
 * Insert a photo row, generating its id and the §5.6 base path
 * `<tripId>/<photoId>`. order_index = max(owner gallery) + 1. The caller
 * (upload route, later group) writes the derivative files to this base path.
 */
export function addPhoto(db: Db, input: AddPhotoInput): Photo {
  const id = newId();
  const row: Photo = {
    id,
    tripId: input.tripId,
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    path: photoBasePath(input.tripId, id),
    width: input.width ?? null,
    height: input.height ?? null,
    orderIndex: maxOrderIndex(db, input.ownerType, input.ownerId) + 1,
    createdAt: new Date(now()),
  };
  db.insert(photos).values(row).run();
  return row;
}

/** Delete a photo row. (File cleanup on the uploads volume is the route's job.) */
export function deletePhoto(db: Db, id: string): void {
  db.delete(photos).where(eq(photos.id, id)).run();
}

/**
 * Renumber an owner's gallery to match `orderedIds`. Ids not in this gallery
 * are ignored; matched ids become order_index 0..n-1. Transactional so a
 * concurrent reader never sees a partially-reordered gallery (mirrors
 * places.reorderDay).
 */
export function reorderOwner(
  db: Db,
  ownerType: PhotoOwnerType,
  ownerId: string,
  orderedIds: string[],
): void {
  db.transaction((tx) => {
    const txDb = tx as unknown as Db;
    const inGallery = new Set(
      listByOwner(txDb, ownerType, ownerId).map((p) => p.id),
    );
    let i = 0;
    for (const id of orderedIds) {
      if (!inGallery.has(id)) continue;
      txDb.update(photos).set({ orderIndex: i }).where(eq(photos.id, id)).run();
      i += 1;
    }
  });
}
```

- [ ] **Step 4: Run it — expect PASS.**

```
npx vitest run src/db/repos/photos.test.ts
```

Expect: 9 passed.

- [ ] **Step 5: Commit.**

```
git add src/db/repos/photos.ts src/db/repos/photos.test.ts
git commit -m "C0.7: photos repo (add/listByOwner/first/delete/reorder, §5.6 path)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C0.8: full-suite green gate + DTO type barrel

**Files:**
- Create: `src/db/repos/plan2.types.ts` (DTO-friendly re-export barrel for the four new repos)
- Create: `src/db/repos/plan2.types.test.ts`

A tiny barrel that re-exports the row types and the discriminated-union helpers later groups (API DTO routes, server actions, UI) import without reaching into each repo file. Verified by a compile-asserting test plus a final full-suite run that gates the whole group.

- [ ] **Step 1: Write the failing barrel test.**

Create `src/db/repos/plan2.types.test.ts`:

```ts
import { describe, it, expectTypeOf, expect } from 'vitest';
import type {
  Restaurant,
  Expense,
  BudgetTarget,
  Photo,
  ExpenseCategory,
  RestaurantStatus,
  PhotoOwnerType,
  TargetCategory,
} from '@/src/db/repos/plan2.types';

describe('plan2 DTO type barrel', () => {
  it('re-exports the four row types with expected key shapes', () => {
    expectTypeOf<Restaurant>().toHaveProperty('linkedPlaceId');
    expectTypeOf<Expense>().toHaveProperty('spentOn');
    expectTypeOf<BudgetTarget>().toHaveProperty('plannedAmount');
    expectTypeOf<Photo>().toHaveProperty('orderIndex');
  });

  it('re-exports the enum/union helper types', () => {
    expectTypeOf<RestaurantStatus>().toEqualTypeOf<'want-to-try' | 'been'>();
    expectTypeOf<PhotoOwnerType>().toEqualTypeOf<'place' | 'journal'>();
    expectTypeOf<ExpenseCategory>().toEqualTypeOf<
      'food' | 'lodging' | 'transport' | 'activities' | 'shopping' | 'other'
    >();
    // overall target = null category
    expectTypeOf<TargetCategory>().toEqualTypeOf<ExpenseCategory | null>();
  });

  it('placeholder runtime assertion so the file runs as a test', () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

```
npx vitest run src/db/repos/plan2.types.test.ts
```

Expect failure: cannot resolve `@/src/db/repos/plan2.types`.

- [ ] **Step 3: Implement `src/db/repos/plan2.types.ts`.**

```ts
/**
 * DTO-friendly type barrel for the Plan 2 data layer. API read-handlers,
 * server actions, and UI import the row + enum/union types from here without
 * depending on each repo's implementation file. (Mirrors the per-repo
 * `export type { ... }` re-exports already used in places/legs.)
 */
export type {
  Restaurant,
  Expense,
  BudgetTarget,
  Photo,
  NewRestaurant,
  NewExpense,
  NewBudgetTarget,
  NewPhoto,
} from '@/src/db/schema';

export type { RestaurantStatus } from '@/src/db/repos/restaurants';
export type { ExpenseCategory, CategoryTotal, DayTotal } from '@/src/db/repos/expenses';
export type { TargetCategory } from '@/src/db/repos/budgetTargets';
export type { PhotoOwnerType } from '@/src/db/repos/photos';
```

- [ ] **Step 4: Run it — expect PASS, then run the whole suite as the group gate.**

```
npx vitest run src/db/repos/plan2.types.test.ts
npm test
```

Expect: the barrel file passes, and the full suite reports all prior 1A/1B suites plus the new C0 files passing (approximately "N passed", no failures). Also run `npx tsc --noEmit` to confirm strict-mode types across the new files.

- [ ] **Step 5: Commit.**

```
git add src/db/repos/plan2.types.ts src/db/repos/plan2.types.test.ts
git commit -m "C0.8: Plan 2 DTO type barrel + full-suite green gate

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

**Group C0 outputs (consumed by later groups):**
- Tables + committed migration: `restaurants`, `expenses`, `budget_targets`, `photos` (FK cascade to trips; `linked_place_id` set-null; indexes per spec §5.2).
- Repos (all pure, `db` first arg, `type Db = TestDb['db']`):
  - `restaurants.ts`: `getRestaurant`, `listByTrip`, `listByStatus`, `addRestaurant`, `updateRestaurant`, `deleteRestaurant`, `scheduleToDay`, `unschedule`.
  - `expenses.ts`: `getExpense`, `listByTrip`, `addExpense`, `updateExpense`, `deleteExpense`, `totalsByCategory`, `totalsByDay`, `totalForTrip`.
  - `budgetTargets.ts`: `getTarget`, `getOverallTarget`, `listTargets`, `setTarget` (upsert), `deleteTarget`.
  - `photos.ts`: `getPhoto`, `listByOwner`, `firstForOwner`, `addPhoto` (computes §5.6 base path + appends order_index), `deletePhoto`, `reorderOwner`.
- Pure helpers: `src/lib/photoPaths.ts` (`PHOTO_SIZES`, `PHOTO_SIZE_MAX_EDGE`, `isPhotoSize`, `photoBasePath`, `photoDerivativeRelPath`) — shared by the upload + serve routes in later groups.
- DTO barrel: `src/db/repos/plan2.types.ts`.

---

I have everything I need. I'll write the C1 task group. Key facts confirmed: `thumbForPlace`/`cardPhotoUrl` precedence in `src/lib/planUrl.ts` (currently glyph vs cached-Google); `PlaceDTO` in `src/lib/planView.ts` has `photoPath`; SW `photos` matcher regex `^${base}/api/photos/[^/]+/[^/]+$` (2 segments — a 3-segment personal-serving path would NOT match, so I must address that); the 1B route serves by `[placeId]/[variant]` (2 segments); env `UPLOADS_DIR` default `./uploads`; repos pure with `type Db = TestDb['db']`; clock mocked via `vi.mock('@/src/lib/clock')`; `newId()` = `crypto.randomUUID()`; route test pattern mocks `@/src/db/client`, `@/src/env`, `node:fs`.

I'll choose the serving path `GET /api/photos/p/[photoId]/[size]` (3 segments) and update the SW matcher to also match it — and a C1 task confirms/extends the SW matcher.

Here is the plan.

---

### Task C1.1: `photos` table + `photos` repo (pure, db-first)

**Files:**
- Modify `src/db/schema.ts` (add `photos` table + inferred types).
- Create `src/db/repos/photos.ts`.
- Create `src/db/repos/photos.test.ts`.
- Create migration `drizzle/0002_*.sql` (generated via `npm run db:generate`).

The §5.6 `photos` row: `id`, `tripId` (FK cascade), `ownerType` enum `place|journal` (only `place` used in Plan 2), `ownerId`, `path` (base `'<tripId>/<photoId>'`), `width?`, `height?`, `orderIndex`, `createdAt`. The repo mirrors the existing `places.ts` pure pattern (`type Db = TestDb['db']`, `newId()`, `new Date(now())`).

- [ ] **Step 1: Failing repo test.** Create `src/db/repos/photos.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places } from '@/src/db/schema';
import {
  addPhoto,
  listPhotosForOwner,
  firstPhotoForOwner,
  getPhoto,
  deletePhoto,
} from '@/src/db/repos/photos';

vi.mock('@/src/lib/clock', () => ({ now: () => 1_700_000_000_000 }));

const TS = new Date(1_700_000_000_000);
type Db = ReturnType<typeof makeTestDb>['db'];

function seed(db: Db) {
  db.insert(trips).values({
    id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(places).values({
    id: 'place-1', tripId: 'trip-1', dayDate: null, googlePlaceId: null,
    name: 'Castle', address: null, lat: null, lng: null, category: 'sightseeing',
    scheduledTime: null, durationMin: null, cost: null, notes: null,
    orderIndex: 0, createdAt: TS, updatedAt: TS,
  }).run();
}

describe('photos repo', () => {
  let db: Db;
  beforeEach(() => { db = makeTestDb().db; seed(db); });

  it('addPhoto inserts a row, generates id, sets path base and appends orderIndex', () => {
    const a = addPhoto(db, { tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1', width: 800, height: 600 });
    const b = addPhoto(db, { tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1' });
    expect(a.id).toBeTruthy();
    expect(a.tripId).toBe('trip-1');
    expect(a.ownerType).toBe('place');
    expect(a.ownerId).toBe('place-1');
    expect(a.path).toBe(`trip-1/${a.id}`);
    expect(a.width).toBe(800);
    expect(a.height).toBe(600);
    expect(a.orderIndex).toBe(0);
    expect(b.orderIndex).toBe(1);
    expect(a.createdAt).toEqual(TS);
  });

  it('listPhotosForOwner returns owner photos ordered by orderIndex', () => {
    addPhoto(db, { tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1' });
    addPhoto(db, { tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1' });
    const list = listPhotosForOwner(db, 'place', 'place-1');
    expect(list.map((p) => p.orderIndex)).toEqual([0, 1]);
  });

  it('listPhotosForOwner does not bleed across owners', () => {
    addPhoto(db, { tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1' });
    expect(listPhotosForOwner(db, 'place', 'other')).toHaveLength(0);
  });

  it('firstPhotoForOwner returns the lowest-orderIndex photo, or undefined', () => {
    expect(firstPhotoForOwner(db, 'place', 'place-1')).toBeUndefined();
    const a = addPhoto(db, { tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1' });
    addPhoto(db, { tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1' });
    expect(firstPhotoForOwner(db, 'place', 'place-1')?.id).toBe(a.id);
  });

  it('getPhoto returns a row by id, or undefined', () => {
    const a = addPhoto(db, { tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1' });
    expect(getPhoto(db, a.id)?.id).toBe(a.id);
    expect(getPhoto(db, 'nope')).toBeUndefined();
  });

  it('deletePhoto removes the row', () => {
    const a = addPhoto(db, { tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1' });
    deletePhoto(db, a.id);
    expect(getPhoto(db, a.id)).toBeUndefined();
  });

  it('cascades when the trip is deleted', () => {
    const a = addPhoto(db, { tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1' });
    db.delete(trips).where(eqTrip()).run();
    expect(getPhoto(db, a.id)).toBeUndefined();
    function eqTrip() { return (require('drizzle-orm').eq)(trips.id, 'trip-1'); }
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run src/db/repos/photos.test.ts` → fails (no `photos` export in schema, no `src/db/repos/photos.ts`).

- [ ] **Step 3: Add the schema table.** In `src/db/schema.ts`, after the `placeDetailsCache` table (and before `settings`), add:

```ts
export const photos = sqliteTable(
  'photos',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    ownerType: text('owner_type', { enum: ['place', 'journal'] }).notNull(),
    ownerId: text('owner_id').notNull(),
    path: text('path').notNull(), // base '<tripId>/<photoId>'; files at <path>/<size>.webp
    width: integer('width'),
    height: integer('height'),
    orderIndex: integer('order_index').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    byOwner: index('idx_photos_owner').on(t.ownerType, t.ownerId, t.orderIndex),
  }),
);
```

Then at the bottom, beside the other inferred types, add:

```ts
export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
```

- [ ] **Step 4: Create the repo.** Create `src/db/repos/photos.ts`:

```ts
import { and, asc, eq, max } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { photos, type Photo } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';

export type { Photo };

type Db = TestDb['db'];

export type PhotoOwnerType = Photo['ownerType'];

/** All photos for an owner (place/journal), ordered by orderIndex (0-based). */
export function listPhotosForOwner(
  db: Db,
  ownerType: PhotoOwnerType,
  ownerId: string,
): Photo[] {
  return db
    .select()
    .from(photos)
    .where(and(eq(photos.ownerType, ownerType), eq(photos.ownerId, ownerId)))
    .orderBy(asc(photos.orderIndex))
    .all();
}

/** The lowest-orderIndex photo for an owner, or undefined. */
export function firstPhotoForOwner(
  db: Db,
  ownerType: PhotoOwnerType,
  ownerId: string,
): Photo | undefined {
  return db
    .select()
    .from(photos)
    .where(and(eq(photos.ownerType, ownerType), eq(photos.ownerId, ownerId)))
    .orderBy(asc(photos.orderIndex))
    .get();
}

/** One photo by id, or undefined. */
export function getPhoto(db: Db, id: string): Photo | undefined {
  return db.select().from(photos).where(eq(photos.id, id)).get();
}

/** Highest orderIndex for an owner, or -1 if none. */
function maxOrderIndex(db: Db, ownerType: PhotoOwnerType, ownerId: string): number {
  const row = db
    .select({ m: max(photos.orderIndex) })
    .from(photos)
    .where(and(eq(photos.ownerType, ownerType), eq(photos.ownerId, ownerId)))
    .get();
  return row?.m ?? -1;
}

export interface AddPhotoInput {
  tripId: string;
  ownerType: PhotoOwnerType;
  ownerId: string;
  width?: number | null;
  height?: number | null;
}

/**
 * Insert a photo row. Generates id + createdAt, derives the path base
 * '<tripId>/<photoId>' (files live at '<path>/<size>.webp'), and appends at
 * orderIndex = max(owner) + 1.
 */
export function addPhoto(db: Db, input: AddPhotoInput): Photo {
  const id = newId();
  const row: Photo = {
    id,
    tripId: input.tripId,
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    path: `${input.tripId}/${id}`,
    width: input.width ?? null,
    height: input.height ?? null,
    orderIndex: maxOrderIndex(db, input.ownerType, input.ownerId) + 1,
    createdAt: new Date(now()),
  };
  db.insert(photos).values(row).run();
  return row;
}

/** Delete a photo row by id (file cleanup is handled by the caller/route). */
export function deletePhoto(db: Db, id: string): void {
  db.delete(photos).where(eq(photos.id, id)).run();
}
```

- [ ] **Step 5: Generate the migration.** Run `npm run db:generate`. Confirm a new `drizzle/0002_*.sql` is emitted that `CREATE TABLE photos (...)` with the FK + index, and `drizzle/meta` is updated. (No hand-editing — `makeTestDb()` applies committed migrations from `./drizzle`.)

- [ ] **Step 6: Run — expect PASS.** `npx vitest run src/db/repos/photos.test.ts` → "Expected: 7 passed".

- [ ] **Step 7: Commit.** `git add -A && git commit -m "feat(db): photos table + pure photos repo (Plan 2 personal photos)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C1.2: pure photo-pipeline helper (validate + sharp-resize derivatives)

**Files:**
- Create `src/lib/photos/pipeline.ts`.
- Create `src/lib/photos/pipeline.test.ts`.

A pure, testable module owning the guards (image/* + ~10MB cap), the size derivatives (`thumb` 320 / `card` 800 / `full` 1600 max long-edge, WebP, EXIF-stripped via `.rotate()` then re-encode), and the on-disk layout `<UPLOADS_DIR>/<tripId>/<photoId>/<size>.webp`. Mirrors the `scripts/gen-icons.ts` sharp approach. The route (C1.3) is a thin wrapper around this.

- [ ] **Step 1: Failing test.** Create `src/lib/photos/pipeline.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  SIZES,
  MAX_UPLOAD_BYTES,
  validateUpload,
  processPhoto,
} from '@/src/lib/photos/pipeline';

let uploadsDir: string;

beforeAll(() => {
  uploadsDir = mkdtempSync(join(tmpdir(), 'burgergo-photos-'));
});
afterAll(() => {
  rmSync(uploadsDir, { recursive: true, force: true });
});

// A real 2000x1000 JPEG so resize math is exercised end-to-end.
async function sampleJpeg(): Promise<Buffer> {
  return sharp({
    create: { width: 2000, height: 1000, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .jpeg()
    .toBuffer();
}

describe('validateUpload', () => {
  it('accepts an image/* content type within the size cap', () => {
    expect(validateUpload({ contentType: 'image/jpeg', byteLength: 1000 })).toEqual({ ok: true });
  });

  it('rejects a non-image content type', () => {
    const r = validateUpload({ contentType: 'application/pdf', byteLength: 1000 });
    expect(r).toEqual({ ok: false, reason: 'not_image' });
  });

  it('rejects an empty/missing content type', () => {
    expect(validateUpload({ contentType: '', byteLength: 1000 })).toEqual({ ok: false, reason: 'not_image' });
  });

  it('rejects a file over the byte cap', () => {
    const r = validateUpload({ contentType: 'image/png', byteLength: MAX_UPLOAD_BYTES + 1 });
    expect(r).toEqual({ ok: false, reason: 'too_large' });
  });
});

describe('processPhoto', () => {
  it('writes thumb/card/full WebP derivatives under <uploadsDir>/<tripId>/<photoId>/', async () => {
    const buf = await sampleJpeg();
    const out = await processPhoto({
      buffer: buf,
      uploadsDir,
      tripId: 'trip-1',
      photoId: 'photo-1',
    });

    for (const size of Object.keys(SIZES)) {
      const file = join(uploadsDir, 'trip-1', 'photo-1', `${size}.webp`);
      expect(existsSync(file)).toBe(true);
      const meta = await sharp(file).metadata();
      expect(meta.format).toBe('webp');
    }
    // out reports the dimensions of the largest ('full') derivative.
    expect(out.width).toBe(1600);
    expect(out.height).toBe(800);
  });

  it('caps each derivative long-edge at its target and never enlarges', async () => {
    const buf = await sampleJpeg();
    await processPhoto({ buffer: buf, uploadsDir, tripId: 'trip-1', photoId: 'photo-2' });

    const thumb = await sharp(join(uploadsDir, 'trip-1', 'photo-2', 'thumb.webp')).metadata();
    expect(thumb.width).toBe(320);
    const card = await sharp(join(uploadsDir, 'trip-1', 'photo-2', 'card.webp')).metadata();
    expect(card.width).toBe(800);
  });

  it('strips EXIF (no orientation/exif metadata survives the re-encode)', async () => {
    const withExif = await sharp({
      create: { width: 1200, height: 600, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    await processPhoto({ buffer: withExif, uploadsDir, tripId: 'trip-1', photoId: 'photo-3' });
    const meta = await sharp(join(uploadsDir, 'trip-1', 'photo-3', 'full.webp')).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
  });

  it('rejects a buffer sharp cannot decode (defends against spoofed content type)', async () => {
    await expect(
      processPhoto({ buffer: Buffer.from('not really an image'), uploadsDir, tripId: 'trip-1', photoId: 'bad' }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run src/lib/photos/pipeline.test.ts` → fails (module missing).

- [ ] **Step 3: Implement the helper.** Create `src/lib/photos/pipeline.ts`:

```ts
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

/** Long-edge caps per derivative (spec §8.5). thumb 320 / card 800 / full 1600. */
export const SIZES = {
  thumb: 320,
  card: 800,
  full: 1600,
} as const;

export type PhotoSize = keyof typeof SIZES;

/** Per-place upload size cap (~10MB), per Plan-2 public-app guards. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type ValidateResult =
  | { ok: true }
  | { ok: false; reason: 'not_image' | 'too_large' };

/** Guard an upload by declared content type + byte length (no decoding). */
export function validateUpload(input: {
  contentType: string | null | undefined;
  byteLength: number;
}): ValidateResult {
  const ct = input.contentType ?? '';
  if (!ct.startsWith('image/')) return { ok: false, reason: 'not_image' };
  if (input.byteLength > MAX_UPLOAD_BYTES) return { ok: false, reason: 'too_large' };
  return { ok: true };
}

export interface ProcessPhotoInput {
  buffer: Buffer;
  uploadsDir: string;
  tripId: string;
  photoId: string;
}

export interface ProcessPhotoResult {
  /** Path base relative to uploadsDir: '<tripId>/<photoId>'. */
  path: string;
  /** Dimensions of the largest ('full') derivative. */
  width: number;
  height: number;
}

/**
 * Decode `buffer`, then write thumb/card/full WebP derivatives (EXIF-stripped,
 * orientation baked in via `.rotate()`, never enlarged) to
 * `<uploadsDir>/<tripId>/<photoId>/<size>.webp`. Throws if the buffer is not a
 * decodable image (defence against a spoofed content type).
 */
export async function processPhoto(input: ProcessPhotoInput): Promise<ProcessPhotoResult> {
  const { buffer, uploadsDir, tripId, photoId } = input;
  const dir = join(uploadsDir, tripId, photoId);
  await mkdir(dir, { recursive: true });

  // `.rotate()` (no args) bakes EXIF orientation then drops it; re-encoding to
  // WebP without `.withMetadata()` strips all remaining EXIF.
  const base = () => sharp(buffer).rotate();

  let full: { width: number; height: number } | null = null;
  for (const size of Object.keys(SIZES) as PhotoSize[]) {
    const cap = SIZES[size];
    const info = await base()
      .resize(cap, cap, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(join(dir, `${size}.webp`));
    if (size === 'full') full = { width: info.width, height: info.height };
  }

  if (!full) throw new Error('processPhoto: missing full derivative');
  return { path: `${tripId}/${photoId}`, width: full.width, height: full.height };
}
```

- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/lib/photos/pipeline.test.ts` → "Expected: 8 passed".

- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(photos): pure validate + sharp-resize pipeline (thumb/card/full WebP, EXIF-stripped)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C1.3: `POST /api/photos` multipart upload route

**Files:**
- Create `app/api/photos/route.ts`.
- Create `app/api/photos/route.test.ts`.

Accepts `multipart/form-data` with `image` (File), `tripId`, `ownerType` (`place`), `ownerId`. Validates via `validateUpload`, runs `processPhoto`, inserts a `photos` row via `addPhoto`, and returns the photo DTO. Mirrors the read-handler DTO pattern and the route-test mocking style (mock `@/src/db/client`, `@/src/env`, and `@/src/lib/photos/pipeline`'s `processPhoto` so no real disk write in tests).

- [ ] **Step 1: Failing test.** Create `app/api/photos/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));
vi.mock('@/src/env', () => ({ env: { UPLOADS_DIR: '/uploads' } }));
vi.mock('@/src/lib/clock', () => ({ now: () => 1_700_000_000_000 }));

// Mock the disk-writing step; assert the pipeline is invoked with the right args.
const processPhoto = vi.fn(async (a: { tripId: string; photoId: string }) => ({
  path: `${a.tripId}/${a.photoId}`, width: 1600, height: 800,
}));
vi.mock('@/src/lib/photos/pipeline', async (orig) => {
  const actual = await orig<typeof import('@/src/lib/photos/pipeline')>();
  return { ...actual, processPhoto: (...args: unknown[]) => processPhoto(...(args as [{ tripId: string; photoId: string }])) };
});

import { POST } from '@/app/api/photos/route';
import { listPhotosForOwner } from '@/src/db/repos/photos';

const TS = new Date(1_700_000_000_000);

function seed(db: ReturnType<typeof makeTestDb>['db']) {
  db.insert(trips).values({
    id: 'trip-1', name: 'T', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(places).values({
    id: 'place-1', tripId: 'trip-1', dayDate: null, googlePlaceId: null,
    name: 'Castle', address: null, lat: null, lng: null, category: 'sightseeing',
    scheduledTime: null, durationMin: null, cost: null, notes: null,
    orderIndex: 0, createdAt: TS, updatedAt: TS,
  }).run();
}

function uploadReq(fields: { image?: Blob; tripId?: string; ownerType?: string; ownerId?: string }) {
  const fd = new FormData();
  if (fields.image) fd.set('image', fields.image, 'photo.jpg');
  if (fields.tripId !== undefined) fd.set('tripId', fields.tripId);
  if (fields.ownerType !== undefined) fd.set('ownerType', fields.ownerType);
  if (fields.ownerId !== undefined) fd.set('ownerId', fields.ownerId);
  return new Request('http://x/api/photos', { method: 'POST', body: fd });
}

function imageBlob(bytes = 1000) {
  return new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });
}

describe('POST /api/photos', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
    processPhoto.mockClear();
  });

  it('uploads an image, runs the pipeline, inserts a row, and returns the DTO', async () => {
    const res = await POST(uploadReq({ image: imageBlob(), tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1' }));
    expect(res.status).toBe(201);
    const body = await res.json() as { photo: { id: string; tripId: string; ownerId: string; path: string; width: number; height: number } };
    expect(body.photo.tripId).toBe('trip-1');
    expect(body.photo.ownerId).toBe('place-1');
    expect(body.photo.path).toBe(`trip-1/${body.photo.id}`);
    expect(body.photo.width).toBe(1600);
    expect(body.photo.height).toBe(800);

    expect(processPhoto).toHaveBeenCalledWith(expect.objectContaining({
      uploadsDir: '/uploads', tripId: 'trip-1', photoId: body.photo.id,
    }));
    expect(listPhotosForOwner(testHandle.db, 'place', 'place-1')).toHaveLength(1);
  });

  it('rejects a non-image file with 415', async () => {
    const pdf = new Blob([new Uint8Array(100)], { type: 'application/pdf' });
    const res = await POST(uploadReq({ image: pdf, tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1' }));
    expect(res.status).toBe(415);
    expect(processPhoto).not.toHaveBeenCalled();
    expect(listPhotosForOwner(testHandle.db, 'place', 'place-1')).toHaveLength(0);
  });

  it('rejects an oversized file with 413', async () => {
    const big = new Blob([new Uint8Array(11 * 1024 * 1024)], { type: 'image/jpeg' });
    const res = await POST(uploadReq({ image: big, tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1' }));
    expect(res.status).toBe(413);
    expect(processPhoto).not.toHaveBeenCalled();
  });

  it('returns 400 when the image field is missing', async () => {
    const res = await POST(uploadReq({ tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid ownerType', async () => {
    const res = await POST(uploadReq({ image: imageBlob(), tripId: 'trip-1', ownerType: 'bogus', ownerId: 'place-1' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when the trip does not exist', async () => {
    const res = await POST(uploadReq({ image: imageBlob(), tripId: 'ghost', ownerType: 'place', ownerId: 'place-1' }));
    expect(res.status).toBe(404);
  });

  it('returns 404 when the place owner does not exist or belongs to another trip', async () => {
    const res = await POST(uploadReq({ image: imageBlob(), tripId: 'trip-1', ownerType: 'place', ownerId: 'nope' }));
    expect(res.status).toBe(404);
  });

  it('enforces the per-place max photo count', async () => {
    for (let i = 0; i < 12; i++) {
      const r = await POST(uploadReq({ image: imageBlob(), tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1' }));
      expect(r.status).toBe(201);
    }
    const over = await POST(uploadReq({ image: imageBlob(), tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1' }));
    expect(over.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run app/api/photos/route.test.ts` → fails (no `POST` export).

- [ ] **Step 3: Implement the route.** Create `app/api/photos/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { newId } from '@/src/db/ids';
import { getTrip } from '@/src/db/repos/trips';
import { getPlace } from '@/src/db/repos/places';
import {
  addPhoto,
  listPhotosForOwner,
  type Photo,
} from '@/src/db/repos/photos';
import {
  validateUpload,
  processPhoto,
} from '@/src/lib/photos/pipeline';

export const dynamic = 'force-dynamic';

/** Per-place max personal photos (Plan-2 public-app guard). */
const MAX_PER_OWNER = 12;

/** Photo DTO returned to the client (full row + relative-path base). */
export type PhotoDTO = Photo;

export async function POST(req: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const image = form.get('image');
  const tripId = form.get('tripId');
  const ownerType = form.get('ownerType');
  const ownerId = form.get('ownerId');

  // Field presence + types.
  if (!(image instanceof Blob) || image.size === 0) {
    return NextResponse.json({ error: 'missing_image' }, { status: 400 });
  }
  if (typeof tripId !== 'string' || typeof ownerId !== 'string' || tripId === '' || ownerId === '') {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  // Only 'place' is accepted in Plan 2.
  if (ownerType !== 'place') {
    return NextResponse.json({ error: 'bad_owner_type' }, { status: 400 });
  }

  // Image guards (content type + size cap) before any decode/disk work.
  const guard = validateUpload({ contentType: image.type, byteLength: image.size });
  if (!guard.ok) {
    const status = guard.reason === 'too_large' ? 413 : 415;
    return NextResponse.json({ error: guard.reason }, { status });
  }

  // Owner must exist and belong to the named trip.
  const trip = getTrip(db, tripId);
  if (!trip) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const place = getPlace(db, ownerId);
  if (!place || place.tripId !== tripId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Per-owner count cap.
  if (listPhotosForOwner(db, 'place', ownerId).length >= MAX_PER_OWNER) {
    return NextResponse.json({ error: 'too_many' }, { status: 409 });
  }

  // Pre-generate the id so the on-disk path base matches the row.
  const photoId = newId();
  let result;
  try {
    const arrayBuf = await image.arrayBuffer();
    result = await processPhoto({
      buffer: Buffer.from(arrayBuf),
      uploadsDir: env.UPLOADS_DIR,
      tripId,
      photoId,
    });
  } catch {
    // sharp could not decode → spoofed content type / corrupt image.
    return NextResponse.json({ error: 'invalid_image' }, { status: 415 });
  }

  // Insert with the same id used for the disk path.
  const ts = addPhoto(db, {
    tripId,
    ownerType: 'place',
    ownerId,
    width: result.width,
    height: result.height,
  });
  // addPhoto generated its own id; re-key the row to the pre-generated photoId
  // so path/disk/id all agree. Simpler: just trust addPhoto's id — see below.
  void ts;

  // NOTE: addPhoto generates an id internally; to keep id↔disk consistency we
  // instead persist a row with the pre-generated photoId via a direct path. The
  // implementation re-derives below to avoid the mismatch.
  return NextResponse.json({ photo: ts }, { status: 201 });
}
```

> Implementation note for the reader: the two-id mismatch above is intentional to flag. Fix it before running by making `addPhoto` accept an optional `id`. Apply this minimal change in `src/db/repos/photos.ts`:
> - In `AddPhotoInput` add `id?: string;`
> - In `addPhoto`, replace `const id = newId();` with `const id = input.id ?? newId();`
>
> Then in the route, replace the `addPhoto(...)` block with:
> ```ts
> const photo = addPhoto(db, {
>   id: photoId,
>   tripId,
>   ownerType: 'place',
>   ownerId,
>   width: result.width,
>   height: result.height,
> });
> return NextResponse.json({ photo }, { status: 201 });
> ```
> and delete the `ts`/`void ts`/NOTE lines. (The `addPhoto` `id` test from C1.1 still passes; add one extra assertion `addPhoto(db, { id: 'fixed', ... }).id === 'fixed'` to `photos.test.ts` and re-run C1.1's suite.)

- [ ] **Step 4: Run — expect PASS.** `npx vitest run app/api/photos/route.test.ts src/db/repos/photos.test.ts` → both suites green (route: 8 passed).

- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(api): POST /api/photos multipart upload (guards + sharp pipeline + photos row)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C1.4: personal-photo serving route `GET /api/photos/p/[photoId]/[size]`

**Files:**
- Create `app/api/photos/p/[photoId]/[size]/route.ts`.
- Create `app/api/photos/p/[photoId]/[size]/route.test.ts`.

A distinct path from the 1B `GET /api/photos/[placeId]/[variant]` route (no collision: the `p/` segment disambiguates, and Next prefers the static `p` segment over the dynamic `[placeId]`). Serves `<UPLOADS_DIR>/<photo.path>/<size>.webp` with the same path-traversal guard and immutable cache headers as the 1B route. Mirrors the 1B route-test mocking (`node:fs`, `@/src/db/client`, `@/src/env`).

- [ ] **Step 1: Failing test.** Create `app/api/photos/p/[photoId]/[size]/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places, photos } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));

const PHOTO_BYTES = Buffer.from('FAKE_WEBP_DATA');
vi.mock('node:fs', () => {
  const read = (path: string) => {
    if (path.includes('photo-1') && path.endsWith('card.webp')) return PHOTO_BYTES;
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    throw err;
  };
  return { default: { readFileSync: vi.fn(read) }, readFileSync: vi.fn(read) };
});
vi.mock('@/src/env', () => ({ env: { UPLOADS_DIR: '/uploads' } }));

import { GET } from '@/app/api/photos/p/[photoId]/[size]/route';

const TS = new Date('2026-06-08T12:00:00.000Z');

function seed(db: ReturnType<typeof makeTestDb>['db']) {
  db.insert(trips).values({
    id: 'trip-1', name: 'T', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(places).values({
    id: 'place-1', tripId: 'trip-1', dayDate: null, googlePlaceId: null,
    name: 'Castle', address: null, lat: null, lng: null, category: 'sightseeing',
    scheduledTime: null, durationMin: null, cost: null, notes: null,
    orderIndex: 0, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(photos).values({
    id: 'photo-1', tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1',
    path: 'trip-1/photo-1', width: 1600, height: 800, orderIndex: 0, createdAt: TS,
  }).run();
}

function ctx(photoId: string, size: string) {
  return { params: Promise.resolve({ photoId, size }) };
}

describe('GET /api/photos/p/[photoId]/[size]', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
  });

  it('streams the requested size webp for a known photo', async () => {
    const res = await GET(new Request('http://x/api/photos/p/photo-1/card'), ctx('photo-1', 'card'));
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer())).toEqual(PHOTO_BYTES);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(res.headers.get('cache-control')).toContain('immutable');
  });

  it('returns 404 for an unknown photo id', async () => {
    const res = await GET(new Request('http://x/api/photos/p/nope/card'), ctx('nope', 'card'));
    expect(res.status).toBe(404);
  });

  it('returns 404 for an invalid size', async () => {
    const res = await GET(new Request('http://x/api/photos/p/photo-1/huge'), ctx('photo-1', 'huge'));
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('not_found');
  });

  it('returns 404 when the file is missing on disk', async () => {
    // 'thumb' is valid but the fs mock only returns bytes for card.webp.
    const res = await GET(new Request('http://x/api/photos/p/photo-1/thumb'), ctx('photo-1', 'thumb'));
    expect(res.status).toBe(404);
  });

  it('returns 404 (no read outside UPLOADS_DIR) when the stored path traverses out', async () => {
    testHandle.db.insert(photos).values({
      id: 'trav', tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1',
      path: '../../etc', width: null, height: null, orderIndex: 1, createdAt: TS,
    }).run();
    const res = await GET(new Request('http://x/api/photos/p/trav/card'), ctx('trav', 'card'));
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('not_found');
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run "app/api/photos/p/[photoId]/[size]/route.test.ts"` → fails (no route).

- [ ] **Step 3: Implement the route.** Create `app/api/photos/p/[photoId]/[size]/route.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { NextResponse } from 'next/server';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { getPhoto } from '@/src/db/repos/photos';

export const dynamic = 'force-dynamic';

/** Valid size segments (mirror the pipeline derivatives). */
const ALLOWED_SIZES = new Set(['thumb', 'card', 'full']);

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ photoId: string; size: string }> },
): Promise<Response> {
  const { photoId, size } = await ctx.params;

  if (!ALLOWED_SIZES.has(size)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const photo = getPhoto(db, photoId);
  if (!photo) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Resolve <UPLOADS_DIR>/<path>/<size>.webp and constrain to UPLOADS_DIR.
  const filePath = join(env.UPLOADS_DIR, photo.path, `${size}.webp`);
  const resolved = resolve(filePath);
  const root = resolve(env.UPLOADS_DIR);
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    const bytes = readFileSync(filePath);
    return new Response(bytes, {
      status: 200,
      headers: {
        'content-type': 'image/webp',
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
}
```

- [ ] **Step 4: Run — expect PASS.** `npx vitest run "app/api/photos/p/[photoId]/[size]/route.test.ts"` → "Expected: 5 passed".

- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(api): GET /api/photos/p/[photoId]/[size] serve personal photos (traversal-guarded)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C1.5: SW `photos` CacheFirst matches the personal-serving path

**Files:**
- Modify `app/sw.ts` (extend the `photos` matcher).
- Modify `app/sw.test.ts` (add matching cases).

The current `photos` matcher only matches the 2-segment 1B path: `^${base}/api/photos/[^/]+/[^/]+$`. The new serving route is 3 segments (`/api/photos/p/<id>/<size>`) and would NOT match. Extend the matcher to also CacheFirst `/api/photos/p/...`, while keeping the upload `POST /api/photos` (which is single-segment, never a GET navigation) uncached.

- [ ] **Step 1: Failing test.** In `app/sw.test.ts`, locate the `describe('photos'...)` block (the existing one asserting the 1B path matches) and add these cases inside it:

```ts
  it('CacheFirst matches the personal-photo serving path /api/photos/p/<id>/<size>', () => {
    const entry = buildRuntimeCaching('').find((e) => e.name === 'photos')!;
    const url = new URL('http://x/api/photos/p/photo-1/card');
    expect(entry.matcher({ url, request: new Request(url), sameOrigin: true })).toBe(true);
  });

  it('CacheFirst matches the personal-photo path under a basePath', () => {
    const entry = buildRuntimeCaching('/burgergo').find((e) => e.name === 'photos')!;
    const url = new URL('http://x/burgergo/api/photos/p/photo-1/thumb');
    expect(entry.matcher({ url, request: new Request(url), sameOrigin: true })).toBe(true);
  });

  it('does NOT CacheFirst the single-segment upload endpoint /api/photos', () => {
    const entry = buildRuntimeCaching('').find((e) => e.name === 'photos')!;
    const url = new URL('http://x/api/photos');
    expect(entry.matcher({ url, request: new Request(url), sameOrigin: true })).toBe(false);
  });
```

(Confirm the top of `app/sw.test.ts` already imports `buildRuntimeCaching`; the existing 1B-path test there does. Reuse the existing import.)

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run app/sw.test.ts` → the 3-segment cases fail (current regex requires exactly 2 segments).

- [ ] **Step 3: Implement.** In `app/sw.ts`, in the `photos` entry's `matcher`, replace the final regexp test:

```ts
          new RegExp(`^${base}/api/photos/[^/]+/[^/]+$`).test(url.pathname)
```

with:

```ts
          // 1B cached-Google photos: /api/photos/<placeId>/<variant>
          new RegExp(`^${base}/api/photos/[^/]+/[^/]+$`).test(url.pathname) ||
          // Plan-2 personal photos: /api/photos/p/<photoId>/<size>
          new RegExp(`^${base}/api/photos/p/[^/]+/[^/]+$`).test(url.pathname)
```

- [ ] **Step 4: Run — expect PASS.** `npx vitest run app/sw.test.ts` → all photos matcher cases green.

- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(sw): CacheFirst the personal-photo serving path /api/photos/p/*" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C1.6: deletePhotoAction Server Action

**Files:**
- Create `app/_actions/photos.ts`.
- Create `app/_actions/photos.test.ts`.

A `deletePhotoAction(photoId)` Server Action (online-only, mirrors `deletePlaceAction`): looks up the photo, removes its on-disk dir, deletes the row, and `revalidatePath('/trip/<tripId>/plan')`. (Upload uses the route, not an action, because it carries binary multipart; delete is a plain action.) Test mocks `@/src/db/client`, `node:fs/promises` (`rm`), `next/cache`, `@/src/env`.

- [ ] **Step 1: Failing test.** Create `app/_actions/photos.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places, photos } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({ get db() { return testHandle.db; }, sqlite: {} }));
vi.mock('@/src/env', () => ({ env: { UPLOADS_DIR: '/uploads' } }));
vi.mock('@/src/lib/clock', () => ({ now: () => 1_700_000_000_000 }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

const rm = vi.fn(async () => undefined);
vi.mock('node:fs/promises', () => ({ rm: (...a: unknown[]) => rm(...a) }));

import { deletePhotoAction } from '@/app/_actions/photos';
import { getPhoto } from '@/src/db/repos/photos';

const TS = new Date(1_700_000_000_000);

function seed(db: ReturnType<typeof makeTestDb>['db']) {
  db.insert(trips).values({
    id: 'trip-1', name: 'T', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(places).values({
    id: 'place-1', tripId: 'trip-1', dayDate: null, googlePlaceId: null,
    name: 'Castle', address: null, lat: null, lng: null, category: 'sightseeing',
    scheduledTime: null, durationMin: null, cost: null, notes: null,
    orderIndex: 0, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(photos).values({
    id: 'photo-1', tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1',
    path: 'trip-1/photo-1', width: 1600, height: 800, orderIndex: 0, createdAt: TS,
  }).run();
}

describe('deletePhotoAction', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
    revalidatePath.mockClear();
    rm.mockClear();
  });

  it('deletes the row, removes the dir, and revalidates the plan', async () => {
    await deletePhotoAction('photo-1');
    expect(getPhoto(testHandle.db, 'photo-1')).toBeUndefined();
    expect(rm).toHaveBeenCalledWith('/uploads/trip-1/photo-1', { recursive: true, force: true });
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/plan');
  });

  it('throws for an unknown photo id', async () => {
    await expect(deletePhotoAction('nope')).rejects.toThrow();
    expect(rm).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run app/_actions/photos.test.ts` → fails (no action).

- [ ] **Step 3: Implement.** Create `app/_actions/photos.ts`:

```ts
'use server';

import { z } from 'zod';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { getPhoto, deletePhoto } from '@/src/db/repos/photos';

const photoId = z.string().min(1);

/**
 * Delete a personal photo: remove its on-disk derivatives dir, delete the row,
 * and revalidate the owning trip's Plan tab. Online-only (a Server Action).
 */
export async function deletePhotoAction(id: string): Promise<void> {
  const parsed = photoId.parse(id);
  const existing = getPhoto(db, parsed);
  if (!existing) throw new Error('Photo not found');

  // Best-effort disk cleanup (force:true → no throw if already gone).
  await rm(join(env.UPLOADS_DIR, existing.path), { recursive: true, force: true });

  deletePhoto(db, parsed);
  revalidatePath(`/trip/${existing.tripId}/plan`);
}
```

- [ ] **Step 4: Run — expect PASS.** `npx vitest run app/_actions/photos.test.ts` → "Expected: 2 passed".

- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(actions): deletePhotoAction (remove derivatives + row + revalidate)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C1.7: photo client helpers + DTO wiring (`personalPhotoUrl`, precedence)

**Files:**
- Modify `src/lib/planView.ts` (extend `PlaceDTO` with `photos`).
- Modify `src/lib/planUrl.ts` (add `personalPhotoUrl`, update `thumbForPlace` precedence).
- Modify `src/lib/planUrl.test.ts` (precedence cases).
- Modify `app/api/trips/[tripId]/places/route.ts` (attach `photos` to each `PlaceDTO`).
- Modify `app/api/trips/[tripId]/places/route.test.ts` (assert `photos` field).

`PlaceDTO` gains `photos: { id: string; width: number | null; height: number | null }[]` (ordered). The card thumbnail precedence becomes: first personal photo (`personalPhotoUrl(photoId,'card')`) → cached Google photo (`cardPhotoUrl`) → glyph. `personalPhotoUrl` uses `withBase('/api/photos/p/<id>/<size>')`.

- [ ] **Step 1: Failing helper test.** In `src/lib/planUrl.test.ts`, add:

```ts
import { personalPhotoUrl } from '@/src/lib/planUrl';

describe('personalPhotoUrl', () => {
  it('builds the base-prefixed personal-photo serving URL for a size', () => {
    expect(personalPhotoUrl('photo-1', 'card')).toBe('/api/photos/p/photo-1/card');
    expect(personalPhotoUrl('photo-1', 'full')).toBe('/api/photos/p/photo-1/full');
  });
});

describe('thumbForPlace precedence (Plan 2)', () => {
  const base = { id: 'p1', category: 'other' as const, photoPath: null, photos: [] as { id: string; width: number | null; height: number | null }[] };

  it('prefers the first personal photo over a cached Google photo', () => {
    const t = thumbForPlace({ ...base, photoPath: 'gpid/card.webp', photos: [{ id: 'ph1', width: null, height: null }] });
    expect(t).toEqual({ kind: 'photo', src: '/api/photos/p/ph1/card' });
  });

  it('falls back to the cached Google photo when there are no personal photos', () => {
    const t = thumbForPlace({ ...base, photoPath: 'gpid/card.webp', photos: [] });
    expect(t).toEqual({ kind: 'photo', src: '/api/photos/p1/card' });
  });

  it('falls back to the category glyph when neither exists', () => {
    const t = thumbForPlace({ ...base });
    expect(t).toEqual({ kind: 'glyph', glyph: '📍' });
  });
});
```

(Note: tests assume `BASE_PATH=''` in the test env, matching the existing `cardPhotoUrl` tests.)

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run src/lib/planUrl.test.ts` → fails (`personalPhotoUrl` missing; `thumbForPlace` ignores `photos`).

- [ ] **Step 3: Extend the DTO.** In `src/lib/planView.ts`, add to the `PlaceDTO` interface (after `photoPath`):

```ts
  /** Personal photos for this place, ordered (Plan 2). First wins for the card thumb. */
  photos: { id: string; width: number | null; height: number | null }[];
```

- [ ] **Step 4: Implement the helpers.** In `src/lib/planUrl.ts`, add a `personalPhotoUrl` helper and update `thumbForPlace`:

```ts
/** URL for a personal photo derivative (Plan-2 serving handler). */
export function personalPhotoUrl(photoId: string, size: 'thumb' | 'card' | 'full'): string {
  return withBase(`/api/photos/p/${photoId}/${size}`);
}
```

Replace the existing `thumbForPlace` with the Plan-2 precedence:

```ts
/**
 * Canonical Place-card thumbnail (spec §5.6/§5.8). Precedence: first personal
 * photo → cached Google photo → category glyph.
 */
export function thumbForPlace(
  place: Pick<PlaceDTO, 'id' | 'category' | 'photoPath' | 'photos'>,
): Thumb {
  const first = place.photos[0];
  if (first) return { kind: 'photo', src: personalPhotoUrl(first.id, 'card') };
  if (place.photoPath) return { kind: 'photo', src: cardPhotoUrl(place.id) };
  return { kind: 'glyph', glyph: categoryGlyph(place.category) };
}
```

- [ ] **Step 5: Run helper test — expect PASS.** `npx vitest run src/lib/planUrl.test.ts` → green.

- [ ] **Step 6: Failing route test.** In `app/api/trips/[tripId]/places/route.test.ts`, add a case (seed a `photos` row for an existing place, then assert it surfaces on the DTO ordered):

```ts
  it('attaches ordered personal photos to each PlaceDTO', async () => {
    // (Assumes the suite's seed inserts a place with a known id; adjust id to match.)
    testHandle.db.insert(photos).values([
      { id: 'ph-b', tripId: 'trip-1', ownerType: 'place', ownerId: SEEDED_PLACE_ID, path: 'trip-1/ph-b', width: 800, height: 600, orderIndex: 1, createdAt: TS },
      { id: 'ph-a', tripId: 'trip-1', ownerType: 'place', ownerId: SEEDED_PLACE_ID, path: 'trip-1/ph-a', width: 800, height: 600, orderIndex: 0, createdAt: TS },
    ]).run();
    const res = await GET(new Request('http://x/api/trips/trip-1/places'), ctx('trip-1'));
    const body = await res.json() as { places: Array<{ id: string; photos: { id: string }[] }> };
    const target = body.places.find((p) => p.id === SEEDED_PLACE_ID)!;
    expect(target.photos.map((p) => p.id)).toEqual(['ph-a', 'ph-b']);
  });

  it('returns an empty photos array for a place with no personal photos', async () => {
    const res = await GET(new Request('http://x/api/trips/trip-1/places'), ctx('trip-1'));
    const body = await res.json() as { places: Array<{ photos: unknown[] }> };
    expect(Array.isArray(body.places[0]!.photos)).toBe(true);
  });
```

> Reader: add `photos` to the schema import at the top of this test, define `SEEDED_PLACE_ID`/`TS`/`ctx` to match the existing seed in this file (read it first), and import `photos` from `@/src/db/schema`.

- [ ] **Step 7: Run — expect FAIL.** `npx vitest run "app/api/trips/[tripId]/places/route.test.ts"` → new cases fail (`photos` not on DTO).

- [ ] **Step 8: Implement route wiring.** In `app/api/trips/[tripId]/places/route.ts`:

Add to imports:

```ts
import { photos as photosTable, type Photo } from '@/src/db/schema';
```

Add to the `PlaceDTO` interface:

```ts
  photos: { id: string; width: number | null; height: number | null }[];
```

Before building `placesResult`, batch-load personal photos for all places in one query (no N+1), ordered by `ownerId, orderIndex`:

```ts
  // Batch-load personal photos for all places (owner_type = 'place').
  const placeIds = rawPlaces.map((p) => p.id);
  const photoMapByOwner = new Map<string, { id: string; width: number | null; height: number | null }[]>();
  if (placeIds.length > 0) {
    const photoRows: Photo[] = db
      .select()
      .from(photosTable)
      .where(
        and(
          eq(photosTable.ownerType, 'place'),
          inArray(photosTable.ownerId, placeIds),
        ),
      )
      .orderBy(asc(photosTable.ownerId), asc(photosTable.orderIndex))
      .all();
    for (const row of photoRows) {
      const list = photoMapByOwner.get(row.ownerId) ?? [];
      list.push({ id: row.id, width: row.width, height: row.height });
      photoMapByOwner.set(row.ownerId, list);
    }
  }
```

(Add `and, asc` to the existing `drizzle-orm` import; `eq, inArray` are already imported.)

Update the `placesResult` map to include `photos`:

```ts
  const placesResult: PlaceDTO[] = rawPlaces.map((p) => ({
    ...p,
    photoPath: (p.googlePlaceId ? (photoMap.get(p.googlePlaceId) ?? null) : null),
    photos: photoMapByOwner.get(p.id) ?? [],
  }));
```

- [ ] **Step 9: Run — expect PASS.** `npx vitest run "app/api/trips/[tripId]/places/route.test.ts" src/lib/planUrl.test.ts` → all green.

- [ ] **Step 10: Commit.** `git add -A && git commit -m "feat(plan): personal-photo precedence on place-card thumb + photos in PlaceDTO" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C1.8: en.json strings for the photo UI

**Files:**
- Modify `messages/en.json` (add photo strings under the existing `plan` block).

Every visible string lives in `messages/en.json` (English; zh deferred). Add the photo UI strings to the `plan` namespace (used by `PlaceDetailSheet`).

- [ ] **Step 1: Failing test.** Create `messages/photos.i18n.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import en from '@/messages/en.json';

describe('en.json photo strings', () => {
  it('has all photo UI keys under plan', () => {
    for (const key of [
      'photosLabel', 'addPhoto', 'addPhotoOffline', 'uploadingPhoto',
      'photoUploadFailed', 'deletePhoto', 'photoTooLarge', 'photoNotImage',
      'closePhoto', 'photoOf',
    ]) {
      expect(en.plan, `plan.${key}`).toHaveProperty(key);
      expect(typeof (en.plan as Record<string, unknown>)[key]).toBe('string');
    }
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run messages/photos.i18n.test.ts` → fails (keys missing).

- [ ] **Step 3: Add the strings.** In `messages/en.json`, inside the `"plan"` object, add (e.g. after `"routeError"`, fixing the preceding comma):

```json
    "routeError": "Something went wrong loading this plan.",
    "photosLabel": "Photos",
    "addPhoto": "Add photo",
    "addPhotoOffline": "Connect to add photos",
    "uploadingPhoto": "Uploading…",
    "photoUploadFailed": "Couldn't upload — please try again.",
    "deletePhoto": "Delete photo",
    "photoTooLarge": "That image is too large (max 10MB).",
    "photoNotImage": "Please choose an image file.",
    "closePhoto": "Close photo",
    "photoOf": "Photo of {name}"
```

- [ ] **Step 4: Run — expect PASS.** `npx vitest run messages/photos.i18n.test.ts` → "Expected: 1 passed".

- [ ] **Step 5: Commit.** `git add -A && git commit -m "i18n(en): photo UI strings under plan namespace" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C1.9: `PhotoGallery` component (thumbnails + full-screen tap-through + delete)

**Files:**
- Create `components/plan/PhotoGallery.tsx`.
- Create `components/plan/PhotoGallery.test.tsx`.

A presentational gallery: renders each photo as a `thumb` `<img>` (served by `personalPhotoUrl(id,'thumb')`), tapping opens a full-screen overlay (`full` size) with prev/next tap-through and a close control, and a delete control per photo (calls `onDelete(id)`; disabled offline). Pure-ish RTL component — actions are passed in as props (the sheet wires `deletePhotoAction`), matching the existing prop-injection style. Uses `next-intl`.

- [ ] **Step 1: Failing test.** Create `components/plan/PhotoGallery.test.tsx`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import { PhotoGallery } from './PhotoGallery';

type P = { id: string; width: number | null; height: number | null };

function renderGallery(props: Partial<React.ComponentProps<typeof PhotoGallery>> = {}) {
  const onDelete = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PhotoGallery
        photos={[{ id: 'ph1', width: 800, height: 600 }, { id: 'ph2', width: 800, height: 600 }] as P[]}
        placeName="Castle"
        disabled={false}
        onDelete={onDelete}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onDelete };
}

describe('PhotoGallery', () => {
  it('renders a thumbnail per photo using the personal-photo thumb URL', () => {
    renderGallery();
    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toHaveAttribute('src', '/api/photos/p/ph1/thumb');
    expect(imgs[1]).toHaveAttribute('src', '/api/photos/p/ph2/thumb');
  });

  it('renders nothing when there are no photos', () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <PhotoGallery photos={[]} placeName="Castle" disabled={false} onDelete={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('opens a full-screen viewer (full size) when a thumbnail is tapped, and closes it', async () => {
    renderGallery();
    await userEvent.click(screen.getAllByRole('button', { name: /Castle/ })[0]!);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    const full = screen.getByAltText(en.plan.photoOf.replace('{name}', 'Castle'));
    expect(full).toHaveAttribute('src', '/api/photos/p/ph1/full');
    await userEvent.click(screen.getByRole('button', { name: en.plan.closePhoto }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onDelete with the photo id when its delete control is used', async () => {
    const { onDelete } = renderGallery();
    await userEvent.click(screen.getAllByRole('button', { name: en.plan.deletePhoto })[0]!);
    expect(onDelete).toHaveBeenCalledWith('ph1');
  });

  it('disables delete controls when offline', () => {
    renderGallery({ disabled: true });
    for (const btn of screen.getAllByRole('button', { name: en.plan.deletePhoto })) {
      expect(btn).toBeDisabled();
    }
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run components/plan/PhotoGallery.test.tsx` → fails (no component).

- [ ] **Step 3: Implement.** Create `components/plan/PhotoGallery.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { personalPhotoUrl } from '@/src/lib/planUrl';

export type GalleryPhoto = { id: string; width: number | null; height: number | null };

type PhotoGalleryProps = {
  photos: GalleryPhoto[];
  placeName: string;
  /** Offline → delete disabled (mutations are online-only). */
  disabled: boolean;
  onDelete: (photoId: string) => void;
};

export function PhotoGallery({ photos, placeName, disabled, onDelete }: PhotoGalleryProps) {
  const t = useTranslations('plan');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  const open = viewerIndex != null ? photos[viewerIndex] : null;

  function close() { setViewerIndex(null); }
  function prev() { setViewerIndex((i) => (i == null ? i : (i - 1 + photos.length) % photos.length)); }
  function next() { setViewerIndex((i) => (i == null ? i : (i + 1) % photos.length)); }

  return (
    <div className="mt-3">
      <p className="text-label font-medium text-ink">{t('photosLabel')}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <li key={p.id} className="relative">
            <button
              type="button"
              onClick={() => setViewerIndex(i)}
              aria-label={t('photoOf', { name: placeName })}
              className="block h-20 w-20 overflow-hidden rounded-control bg-paper shadow-inset"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={personalPhotoUrl(p.id, 'thumb')}
                alt={placeName}
                width={80}
                height={80}
                className="h-20 w-20 object-cover"
              />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onDelete(p.id)}
              aria-label={t('deletePhoto')}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-chip bg-card text-caption font-bold text-danger shadow-card disabled:opacity-40"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('photoOf', { name: placeName })}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[rgb(0_0_0_/_0.85)] p-4"
          onClick={close}
          onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={personalPhotoUrl(open.id, 'full')}
            alt={t('photoOf', { name: placeName })}
            className="max-h-[80vh] max-w-full rounded-card object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="mt-4 flex gap-3" onClick={(e) => e.stopPropagation()}>
            {photos.length > 1 ? (
              <>
                <button type="button" onClick={prev} className="rounded-control bg-card px-4 py-2 text-label font-medium text-ink shadow-card">‹</button>
                <button type="button" onClick={next} className="rounded-control bg-card px-4 py-2 text-label font-medium text-ink shadow-card">›</button>
              </>
            ) : null}
            <button
              type="button"
              onClick={close}
              aria-label={t('closePhoto')}
              className="rounded-control bg-coral px-4 py-2 text-label font-medium text-white shadow-card"
            >
              {t('closePhoto')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS.** `npx vitest run components/plan/PhotoGallery.test.tsx` → "Expected: 5 passed".

- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(plan): PhotoGallery (thumbnails + full-screen tap-through + delete)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C1.10: `usePhotoUpload` hook (online-only multipart POST to `/api/photos`)

**Files:**
- Create `components/plan/usePhotoUpload.ts`.
- Create `components/plan/usePhotoUpload.test.ts`.

A small hook owning the upload lifecycle: takes a `File`, posts multipart `FormData` to `withBase('/api/photos')`, exposes `{ upload, uploading, error }`. Online-only (the caller disables the control offline; the hook surfaces server errors). All fetches use `withBase`. Tested by mocking `global.fetch`.

- [ ] **Step 1: Failing test.** Create `components/plan/usePhotoUpload.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePhotoUpload } from './usePhotoUpload';

const file = new File([new Uint8Array(10)], 'p.jpg', { type: 'image/jpeg' });

beforeEach(() => { vi.restoreAllMocks(); });

describe('usePhotoUpload', () => {
  it('POSTs multipart FormData to withBase(/api/photos) and returns the photo on success', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ photo: { id: 'ph1', width: 1600, height: 800 } }),
      { status: 201, headers: { 'content-type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => usePhotoUpload());
    let returned: unknown;
    await act(async () => {
      returned = await result.current.upload({ file, tripId: 't1', ownerId: 'place-1' });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/photos'); // BASE_PATH='' in tests
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    const fd = init.body as FormData;
    expect(fd.get('tripId')).toBe('t1');
    expect(fd.get('ownerType')).toBe('place');
    expect(fd.get('ownerId')).toBe('place-1');
    expect(fd.get('image')).toBeInstanceOf(File);
    expect(returned).toEqual({ id: 'ph1', width: 1600, height: 800 });
    expect(result.current.uploading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets error and returns null when the server rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'too_large' }), { status: 413 })));
    const { result } = renderHook(() => usePhotoUpload());
    let returned: unknown = 'sentinel';
    await act(async () => {
      returned = await result.current.upload({ file, tripId: 't1', ownerId: 'place-1' });
    });
    expect(returned).toBeNull();
    await waitFor(() => expect(result.current.error).toBe('too_large'));
  });

  it('sets a generic error when fetch throws (offline)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const { result } = renderHook(() => usePhotoUpload());
    let returned: unknown = 'sentinel';
    await act(async () => {
      returned = await result.current.upload({ file, tripId: 't1', ownerId: 'place-1' });
    });
    expect(returned).toBeNull();
    await waitFor(() => expect(result.current.error).toBe('network'));
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run components/plan/usePhotoUpload.test.ts` → fails (no hook).

- [ ] **Step 3: Implement.** Create `components/plan/usePhotoUpload.ts`:

```ts
'use client';

import { useCallback, useState } from 'react';
import { withBase } from '@/src/lib/basePath';

export interface UploadedPhoto {
  id: string;
  width: number | null;
  height: number | null;
}

export interface UploadArgs {
  file: File;
  tripId: string;
  ownerId: string;
}

/**
 * Multipart photo upload to POST /api/photos (online-only). Returns the created
 * photo on success, or null on failure (error code surfaced via `error`).
 */
export function usePhotoUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (args: UploadArgs): Promise<UploadedPhoto | null> => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set('image', args.file);
      fd.set('tripId', args.tripId);
      fd.set('ownerType', 'place');
      fd.set('ownerId', args.ownerId);

      const res = await fetch(withBase('/api/photos'), { method: 'POST', body: fd });
      if (!res.ok) {
        let code = 'upload_failed';
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) code = body.error;
        } catch { /* non-JSON error body */ }
        setError(code);
        return null;
      }
      const body = (await res.json()) as { photo: UploadedPhoto };
      return body.photo;
    } catch {
      setError('network');
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, uploading, error };
}
```

- [ ] **Step 4: Run — expect PASS.** `npx vitest run components/plan/usePhotoUpload.test.ts` → "Expected: 3 passed".

- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(plan): usePhotoUpload hook (online-only multipart POST to /api/photos)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C1.11: wire photo upload + gallery into `PlaceDetailSheet`

**Files:**
- Modify `components/plan/PlaceDetailSheet.tsx` (add upload control + `PhotoGallery`).
- Modify `components/plan/PlaceDetailSheet.test.tsx` (upload + gallery cases).
- Modify `components/plan/PlanClient.tsx` (refresh after upload/delete — reuse existing `load`).

`PlaceDetailSheet` already receives the `place` (now carrying `place.photos`) and `disabled` + `onSaved`. Add: a "Add photo" `<input type="file" accept="image/*" capture="environment">` control (capture/pick from phone), wired to `usePhotoUpload`; render `PhotoGallery` for `place.photos` with delete wired to `deletePhotoAction`; after a successful upload or delete, call `onSaved()` (PlanClient's `onSaved` reloads via `load()`), so the new/removed photo and the updated card thumbnail reflect immediately. Upload control disabled when `disabled` (offline).

- [ ] **Step 1: Failing test.** In `components/plan/PlaceDetailSheet.test.tsx`, extend the existing mock block and add cases. First, broaden the action mock to include photos and mock the upload hook:

```ts
// Add alongside the existing places action mock:
const deletePhotoAction = vi.fn(async () => undefined);
vi.mock('@/app/_actions/photos', () => ({
  deletePhotoAction: (...a: unknown[]) => deletePhotoAction(...a),
}));

const uploadFn = vi.fn(async () => ({ id: 'new-photo', width: 1600, height: 800 }));
const uploadState = { uploading: false, error: null as string | null };
vi.mock('@/components/plan/usePhotoUpload', () => ({
  usePhotoUpload: () => ({ upload: uploadFn, uploading: uploadState.uploading, error: uploadState.error }),
}));
```

Then add tests (within the existing `describe`):

```ts
  it('renders existing photos in a gallery', () => {
    renderSheet({ place: place({ photos: [{ id: 'ph1', width: 800, height: 600 }] }) });
    expect(screen.getByRole('img')).toHaveAttribute('src', '/api/photos/p/ph1/thumb');
  });

  it('uploads a chosen image then refreshes via onSaved', async () => {
    const { onSaved } = renderSheet();
    const input = screen.getByLabelText(en.plan.addPhoto) as HTMLInputElement;
    const file = new File([new Uint8Array(10)], 'p.jpg', { type: 'image/jpeg' });
    await userEvent.upload(input, file);
    await waitFor(() => expect(uploadFn).toHaveBeenCalled());
    expect(uploadFn).toHaveBeenCalledWith(expect.objectContaining({ tripId: 't1', ownerId: 'p1', file }));
    expect(onSaved).toHaveBeenCalled();
  });

  it('deletes a photo via deletePhotoAction then refreshes via onSaved', async () => {
    const { onSaved } = renderSheet({ place: place({ photos: [{ id: 'ph1', width: 800, height: 600 }] }) });
    await userEvent.click(screen.getByRole('button', { name: en.plan.deletePhoto }));
    await waitFor(() => expect(deletePhotoAction).toHaveBeenCalledWith('ph1'));
    expect(onSaved).toHaveBeenCalled();
  });

  it('disables the photo upload control when offline', () => {
    renderSheet({ disabled: true });
    expect(screen.getByLabelText(en.plan.addPhoto)).toBeDisabled();
  });
```

Also update the test's `place()` factory default to include `photos: []` (add `photos: [], ` to the returned object) so existing cases keep compiling.

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run components/plan/PlaceDetailSheet.test.tsx` → new cases fail (no upload control / gallery).

- [ ] **Step 3: Implement.** Edit `components/plan/PlaceDetailSheet.tsx`. Add imports:

```ts
import { PhotoGallery } from '@/components/plan/PhotoGallery';
import { usePhotoUpload } from '@/components/plan/usePhotoUpload';
import { deletePhotoAction } from '@/app/_actions/photos';
```

Inside the component, after the existing hooks, add upload/delete wiring:

```ts
  const { upload, uploading } = usePhotoUpload();
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setPhotoError(null);
    if (!file.type.startsWith('image/')) { setPhotoError(t('photoNotImage')); return; }
    const result = await upload({ file, tripId: place.tripId, ownerId: place.id });
    if (result) {
      onSaved(); // PlanClient reloads → gallery + card thumb refresh
    } else {
      setPhotoError(t('photoUploadFailed'));
    }
  }

  function handlePhotoDelete(photoId: string) {
    setPhotoError(null);
    startTransition(async () => {
      try {
        await deletePhotoAction(photoId);
        onSaved();
      } catch {
        setPhotoError(t('photoUploadFailed'));
      }
    });
  }
```

In the JSX, before the "Open in Google Maps" link (after the notes textarea), insert the gallery + upload control:

```tsx
        {photoError ? (
          <p role="alert" className="mt-3 rounded-control bg-red-50 px-3 py-2 text-caption text-red-700">
            {photoError}
          </p>
        ) : null}

        <PhotoGallery
          photos={place.photos}
          placeName={place.name}
          disabled={disabled}
          onDelete={handlePhotoDelete}
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="pd-photo">
          {disabled ? t('addPhotoOffline') : t('addPhoto')}
        </label>
        <input
          id="pd-photo"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={disabled || uploading}
          onChange={handlePhotoChange}
          className="mt-1 w-full text-body text-ink disabled:opacity-60"
        />
        {uploading ? (
          <p className="mt-1 text-caption text-ink-muted">{t('uploadingPhoto')}</p>
        ) : null}
```

> Note for the reader: the `addPhoto` label text changes to `addPhotoOffline` when disabled, but `getByLabelText(en.plan.addPhoto)` in the "disabled" test targets the enabled-state label — so keep the `<label htmlFor="pd-photo">` text as `t('addPhoto')` and instead show the offline hint separately. Adjust: render the label always as `{t('addPhoto')}` and add `{disabled ? <p className="text-caption text-ink-muted">{t('addPhotoOffline')}</p> : null}` below it. This keeps the `addPhoto` label stable for the test's `getByLabelText`.

- [ ] **Step 4: Run — expect PASS.** `npx vitest run components/plan/PlaceDetailSheet.test.tsx` → all green (including the original 6 cases).

- [ ] **Step 5: Confirm PlanClient already refreshes.** `PlanClient` passes `onSaved={() => { setDetailFor(null); void load(); }}`. Because the sheet now calls `onSaved()` after upload/delete, the sheet closes and the plan reloads — the new photo and updated card thumbnail appear on reopen. No PlanClient change is strictly required; if a smoother UX is wanted, change PlanClient's `onSaved` to reload without closing. Run the full suite to confirm nothing else broke: `npx vitest run components/plan/PlanClient.test.tsx components/plan/PlaceCard.test.tsx`.

- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat(plan): photo upload control + gallery in PlaceDetailSheet (online-only)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C1.12: group-wide verification (typecheck, lint, full suite, build)

**Files:** none (verification only).

Confirm the whole C1 group integrates: types resolve (new `PlaceDTO.photos`, new routes/repos/actions), lint passes, every test is green, and the production build (which runs `gen:icons` then `next build`, exercising the new routes) succeeds.

- [ ] **Step 1: Typecheck.** `npx tsc --noEmit` → no errors. (Watch for any remaining `thumbForPlace` callers needing `photos` — `PlaceCard.tsx` passes the full `place` which now includes `photos`, so it is covered; `PlaceInfoCard.tsx` may also call `thumbForPlace` — if so, ensure the object passed includes `photos`.)

- [ ] **Step 2: Lint.** `npm run lint` → clean (note the intentional `eslint-disable @next/next/no-img-element` lines on raw `<img>`).

- [ ] **Step 3: Full test suite.** `npm test` → all suites pass (no regressions in `places/route`, `sw`, `planUrl`, `PlaceDetailSheet`, `PlaceCard`).

- [ ] **Step 4: Production build.** `npm run build` → succeeds (compiles `app/api/photos/route.ts`, `app/api/photos/p/[photoId]/[size]/route.ts`, and `app/_actions/photos.ts`; static Plan shell still builds since pages remain static + client-fetch).

- [ ] **Step 5: Commit (only if verification produced fixes).** If steps 1–4 required edits, `git add -A && git commit -m "chore(photos): C1 group verification fixes (types/lint/build)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`. Otherwise nothing to commit.

---

Relevant absolute paths for the implementer:
- `src/db/schema.ts`, `src/db/repos/photos.ts`, `src/lib/photos/pipeline.ts`
- `app/api/photos/route.ts`, `app/api/photos/p/[photoId]/[size]/route.ts`
- `app/_actions/photos.ts`
- `src/lib/planView.ts`, `src/lib/planUrl.ts`, `app/api/trips/[tripId]/places/route.ts`
- `app/sw.ts`, `messages/en.json`
- `components/plan/PhotoGallery.tsx`, `components/plan/usePhotoUpload.ts`, `components/plan/PlaceDetailSheet.tsx`, `components/plan/PlaceCard.tsx`

---

I now have a complete picture of all the conventions: pure repos (`type Db = TestDb['db']`, `now()`, `newId()`), server actions (`'use server'`, zod parse, `revalidatePath`), force-dynamic read handlers with `vi.mock('@/src/db/client')` test pattern, static-shell pages with `force-static` + client component, client-fetch with `withBase`, sheets with role=dialog/Escape/alert pattern, RTL tests mocking actions and using `NextIntlClientProvider` with real `en.json`, and `formatMoney`.

I have everything needed to write the C2 task group. Here is the deliverable.

---

### Task C2.1: `restaurants` repo — list/get/add/update/delete (pure, db-first)

**Files:**
- Create `src/db/repos/restaurants.ts`
- Test `src/db/repos/restaurants.test.ts`

This group assumes group C0 already added the `restaurants` table to `src/db/schema.ts` and a committed Drizzle migration, matching:

```ts
export const restaurants = sqliteTable(
  'restaurants',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    cuisine: text('cuisine'),
    rating: integer('rating'), // 1–5, app-validated, nullable
    status: text('status', { enum: ['want-to-try', 'been'] }).notNull(),
    priceLevel: integer('price_level'), // 1–4, app-validated, nullable
    notes: text('notes'),
    linkedPlaceId: text('linked_place_id').references(() => places.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (tb) => ({ byTrip: index('idx_restaurants_trip').on(tb.tripId, tb.createdAt) }),
);
export type Restaurant = typeof restaurants.$inferSelect;
```

If your C0 used different column names, reconcile this task to them before writing.

- [ ] **Step 1: Write the failing test.**

`src/db/repos/restaurants.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb, type TestDb } from '@/src/db/testDb';
import { trips, places } from '@/src/db/schema';
import {
  listRestaurants,
  getRestaurant,
  addRestaurant,
  updateRestaurant,
  deleteRestaurant,
} from '@/src/db/repos/restaurants';

const TS = new Date('2026-06-08T12:00:00.000Z');

function seedTrip(db: TestDb['db']) {
  db.insert(trips).values({
    id: 't1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
}

describe('restaurants repo', () => {
  let h: TestDb;
  beforeEach(() => {
    vi.restoreAllMocks();
    h = makeTestDb();
    seedTrip(h.db);
  });

  it('addRestaurant generates id + timestamps and applies defaults', () => {
    const r = addRestaurant(h.db, { tripId: 't1', name: 'Ichiran', status: 'want-to-try' });
    expect(r.id).toBeTruthy();
    expect(r.name).toBe('Ichiran');
    expect(r.status).toBe('want-to-try');
    expect(r.cuisine).toBeNull();
    expect(r.rating).toBeNull();
    expect(r.priceLevel).toBeNull();
    expect(r.notes).toBeNull();
    expect(r.linkedPlaceId).toBeNull();
    expect(r.createdAt).toBeInstanceOf(Date);
    expect(getRestaurant(h.db, r.id)?.name).toBe('Ichiran');
  });

  it('addRestaurant persists all provided fields', () => {
    const r = addRestaurant(h.db, {
      tripId: 't1', name: 'Kani Doraku', cuisine: 'Crab', rating: 4,
      status: 'been', priceLevel: 3, notes: 'Window seat',
    });
    expect(r).toMatchObject({
      name: 'Kani Doraku', cuisine: 'Crab', rating: 4, status: 'been', priceLevel: 3, notes: 'Window seat',
    });
  });

  it('listRestaurants returns a trip\'s rows newest-first (createdAt desc, id tiebreak)', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const a = addRestaurant(h.db, { tripId: 't1', name: 'A', status: 'want-to-try' });
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    const b = addRestaurant(h.db, { tripId: 't1', name: 'B', status: 'been' });
    const ids = listRestaurants(h.db, 't1').map((x) => x.id);
    expect(ids).toEqual([b.id, a.id]);
  });

  it('listRestaurants scopes to the given trip', () => {
    h.db.insert(trips).values({
      id: 't2', name: 'Kyoto', startDate: '2026-07-01', endDate: '2026-07-02',
      coverPhoto: null, createdAt: TS, updatedAt: TS,
    }).run();
    addRestaurant(h.db, { tripId: 't1', name: 'A', status: 'want-to-try' });
    addRestaurant(h.db, { tripId: 't2', name: 'B', status: 'want-to-try' });
    expect(listRestaurants(h.db, 't1').map((x) => x.name)).toEqual(['A']);
  });

  it('updateRestaurant patches provided fields and bumps updatedAt', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const r = addRestaurant(h.db, { tripId: 't1', name: 'A', status: 'want-to-try' });
    vi.spyOn(Date, 'now').mockReturnValue(5000);
    const updated = updateRestaurant(h.db, r.id, { status: 'been', rating: 5 });
    expect(updated?.status).toBe('been');
    expect(updated?.rating).toBe(5);
    expect(updated?.name).toBe('A');
    expect(updated!.updatedAt.getTime()).toBe(5000);
  });

  it('updateRestaurant returns undefined for an unknown id', () => {
    expect(updateRestaurant(h.db, 'nope', { status: 'been' })).toBeUndefined();
  });

  it('deleteRestaurant removes the row', () => {
    const r = addRestaurant(h.db, { tripId: 't1', name: 'A', status: 'want-to-try' });
    deleteRestaurant(h.db, r.id);
    expect(getRestaurant(h.db, r.id)).toBeUndefined();
  });

  it('linkedPlaceId is set NULL when the linked place is deleted (FK onDelete set null)', () => {
    h.db.insert(places).values({
      id: 'p1', tripId: 't1', dayDate: null, googlePlaceId: null, name: 'Place',
      address: null, lat: null, lng: null, category: 'other', scheduledTime: null,
      durationMin: null, cost: null, notes: null, orderIndex: 0, createdAt: TS, updatedAt: TS,
    }).run();
    const r = addRestaurant(h.db, { tripId: 't1', name: 'A', status: 'been', linkedPlaceId: 'p1' });
    h.db.delete(places).where(eqId('p1')).run();
    expect(getRestaurant(h.db, r.id)?.linkedPlaceId).toBeNull();
  });
});

// local helper to avoid importing drizzle ops at top for one test
import { eq } from 'drizzle-orm';
import { places as placesTable } from '@/src/db/schema';
function eqId(id: string) {
  return eq(placesTable.id, id);
}
```

- [ ] **Step 2: Run — expect FAIL.**
`npm test -- src/db/repos/restaurants.test.ts`
Expect: cannot resolve `@/src/db/repos/restaurants` (module not found).

- [ ] **Step 3: Minimal impl.**

`src/db/repos/restaurants.ts`:
```ts
import { and, asc, desc, eq } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { restaurants, type Restaurant } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';

export type { Restaurant };

type Db = TestDb['db'];

/** All restaurants for a trip, newest-first (createdAt desc, id tiebreak). */
export function listRestaurants(db: Db, tripId: string): Restaurant[] {
  return db
    .select()
    .from(restaurants)
    .where(eq(restaurants.tripId, tripId))
    .orderBy(desc(restaurants.createdAt), asc(restaurants.id))
    .all();
}

/** One restaurant by id, or undefined. */
export function getRestaurant(db: Db, id: string): Restaurant | undefined {
  return db.select().from(restaurants).where(eq(restaurants.id, id)).get();
}

export interface AddRestaurantInput {
  tripId: string;
  name: string;
  cuisine?: string | null;
  rating?: number | null;
  status: Restaurant['status'];
  priceLevel?: number | null;
  notes?: string | null;
  linkedPlaceId?: string | null;
}

/** Insert a restaurant; generates id + timestamps, applies nullable defaults. */
export function addRestaurant(db: Db, input: AddRestaurantInput): Restaurant {
  const ts = new Date(now());
  const row: Restaurant = {
    id: newId(),
    tripId: input.tripId,
    name: input.name,
    cuisine: input.cuisine ?? null,
    rating: input.rating ?? null,
    status: input.status,
    priceLevel: input.priceLevel ?? null,
    notes: input.notes ?? null,
    linkedPlaceId: input.linkedPlaceId ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(restaurants).values(row).run();
  return row;
}

/** Editable subset (never id/tripId/timestamps). */
export type RestaurantPatch = Partial<
  Pick<Restaurant, 'name' | 'cuisine' | 'rating' | 'status' | 'priceLevel' | 'notes' | 'linkedPlaceId'>
>;

/** Patch provided fields; bumps updatedAt. Returns the row, or undefined. */
export function updateRestaurant(db: Db, id: string, patch: RestaurantPatch): Restaurant | undefined {
  if (!getRestaurant(db, id)) return undefined;
  db.update(restaurants)
    .set({ ...patch, updatedAt: new Date(now()) })
    .where(eq(restaurants.id, id))
    .run();
  return getRestaurant(db, id);
}

/** Delete a restaurant by id. */
export function deleteRestaurant(db: Db, id: string): void {
  db.delete(restaurants).where(eq(restaurants.id, id)).run();
}

/** Clear linkedPlaceId on every restaurant pointing at `placeId` (used when un-scheduling). */
export function clearLinkedPlace(db: Db, placeId: string): void {
  db.update(restaurants)
    .set({ linkedPlaceId: null, updatedAt: new Date(now()) })
    .where(eq(restaurants.linkedPlaceId, placeId))
    .run();
}

/** First restaurant linked to a place, or undefined (used to find the scheduled-to record). */
export function getByLinkedPlace(db: Db, placeId: string): Restaurant | undefined {
  return db
    .select()
    .from(restaurants)
    .where(eq(restaurants.linkedPlaceId, placeId))
    .get();
}

/** Restaurants for a trip filtered by status. */
export function listByStatus(db: Db, tripId: string, status: Restaurant['status']): Restaurant[] {
  return db
    .select()
    .from(restaurants)
    .where(and(eq(restaurants.tripId, tripId), eq(restaurants.status, status)))
    .orderBy(desc(restaurants.createdAt), asc(restaurants.id))
    .all();
}
```

- [ ] **Step 4: Run — expect PASS.**
`npm test -- src/db/repos/restaurants.test.ts`
Expect: "Expected: 8 passed".

- [ ] **Step 5: Commit.**
```
git add src/db/repos/restaurants.ts src/db/repos/restaurants.test.ts
git commit -m "C2.1: restaurants repo (list/get/add/update/delete + link helpers)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C2.2: `scheduleToDay` / `unschedule` repo helpers (restaurant ↔ Place link)

**Files:**
- Modify `src/db/repos/restaurants.ts`
- Modify `src/db/repos/restaurants.test.ts`

Per spec §4.1, scheduling a restaurant creates a `category='other'` Place on a target day (copying name/notes once), and records `restaurants.linked_place_id`. Un-scheduling deletes that Place and clears the link. Because deleting the Place already nulls the link via FK `onDelete: 'set null'`, the repo's `unscheduleRestaurant` only needs to delete the place; we also defensively clear the link in the same transaction.

- [ ] **Step 1: Add failing tests.** Append to `src/db/repos/restaurants.test.ts`:
```ts
import { getPlace } from '@/src/db/repos/places';
import { scheduleRestaurantToDay, unscheduleRestaurant } from '@/src/db/repos/restaurants';

describe('restaurants scheduling', () => {
  let h2: TestDb;
  beforeEach(() => {
    vi.restoreAllMocks();
    h2 = makeTestDb();
    h2.db.insert(trips).values({
      id: 't1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
      coverPhoto: null, createdAt: TS, updatedAt: TS,
    }).run();
  });

  it('scheduleRestaurantToDay creates an "other" place, copies name/notes, links it', () => {
    const r = addRestaurant(h2.db, { tripId: 't1', name: 'Ichiran', status: 'want-to-try', notes: 'Tonkotsu' });
    const { restaurant, place } = scheduleRestaurantToDay(h2.db, r.id, '2026-06-06');
    expect(place.tripId).toBe('t1');
    expect(place.dayDate).toBe('2026-06-06');
    expect(place.category).toBe('other');
    expect(place.name).toBe('Ichiran');
    expect(place.notes).toBe('Tonkotsu');
    expect(restaurant.linkedPlaceId).toBe(place.id);
    expect(getPlace(h2.db, place.id)?.name).toBe('Ichiran');
  });

  it('scheduling a second time re-points the link to a new place (does NOT recopy onto the old one)', () => {
    const r = addRestaurant(h2.db, { tripId: 't1', name: 'A', status: 'want-to-try' });
    const first = scheduleRestaurantToDay(h2.db, r.id, '2026-06-06');
    const second = scheduleRestaurantToDay(h2.db, r.id, '2026-06-07');
    expect(second.place.id).not.toBe(first.place.id);
    expect(second.restaurant.linkedPlaceId).toBe(second.place.id);
    // the first place was the link target; re-scheduling removes it
    expect(getPlace(h2.db, first.place.id)).toBeUndefined();
  });

  it('scheduleRestaurantToDay throws for an unknown restaurant', () => {
    expect(() => scheduleRestaurantToDay(h2.db, 'nope', '2026-06-06')).toThrow();
  });

  it('unscheduleRestaurant deletes the linked place and clears the link', () => {
    const r = addRestaurant(h2.db, { tripId: 't1', name: 'A', status: 'been' });
    const { place } = scheduleRestaurantToDay(h2.db, r.id, '2026-06-06');
    const after = unscheduleRestaurant(h2.db, r.id);
    expect(after?.linkedPlaceId).toBeNull();
    expect(getPlace(h2.db, place.id)).toBeUndefined();
  });

  it('unscheduleRestaurant is a no-op (returns row) when nothing is linked', () => {
    const r = addRestaurant(h2.db, { tripId: 't1', name: 'A', status: 'been' });
    expect(unscheduleRestaurant(h2.db, r.id)?.linkedPlaceId).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
`npm test -- src/db/repos/restaurants.test.ts`
Expect: `scheduleRestaurantToDay`/`unscheduleRestaurant` are not exported (import error / not a function).

- [ ] **Step 3: Minimal impl.** Append to `src/db/repos/restaurants.ts`:
```ts
import { addPlace, deletePlace, getPlace, type Place } from '@/src/db/repos/places';

/**
 * Schedule a restaurant onto `dayDate`: create a new category='other' Place
 * (copying name + notes once) and point restaurants.linked_place_id at it.
 * If the restaurant was already scheduled, delete the previous place first so
 * exactly one linked place exists at a time. Returns both rows.
 */
export function scheduleRestaurantToDay(
  db: Db,
  restaurantId: string,
  dayDate: string,
): { restaurant: Restaurant; place: Place } {
  const existing = getRestaurant(db, restaurantId);
  if (!existing) throw new Error('Restaurant not found');

  // Drop any previously-linked place so we never accumulate orphans.
  if (existing.linkedPlaceId) {
    deletePlace(db, existing.linkedPlaceId); // FK set-null clears the link below anyway
  }

  const place = addPlace(db, {
    tripId: existing.tripId,
    dayDate,
    name: existing.name,
    category: 'other',
    notes: existing.notes ?? null,
  });

  db.update(restaurants)
    .set({ linkedPlaceId: place.id, updatedAt: new Date(now()) })
    .where(eq(restaurants.id, restaurantId))
    .run();

  const restaurant = getRestaurant(db, restaurantId)!;
  return { restaurant, place };
}

/**
 * Un-schedule a restaurant: delete its linked place (if any) and clear the
 * link. Returns the updated restaurant, or undefined if not found.
 */
export function unscheduleRestaurant(db: Db, restaurantId: string): Restaurant | undefined {
  const existing = getRestaurant(db, restaurantId);
  if (!existing) return undefined;
  if (existing.linkedPlaceId && getPlace(db, existing.linkedPlaceId)) {
    deletePlace(db, existing.linkedPlaceId);
  }
  db.update(restaurants)
    .set({ linkedPlaceId: null, updatedAt: new Date(now()) })
    .where(eq(restaurants.id, restaurantId))
    .run();
  return getRestaurant(db, restaurantId);
}
```

- [ ] **Step 4: Run — expect PASS.**
`npm test -- src/db/repos/restaurants.test.ts`
Expect: "Expected: 13 passed" (8 from C2.1 + 5 here).

- [ ] **Step 5: Commit.**
```
git add src/db/repos/restaurants.ts src/db/repos/restaurants.test.ts
git commit -m "C2.2: restaurant scheduleToDay/unschedule (creates linked 'other' place)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C2.3: restaurant Server Actions (`add/update/delete/scheduleToDay/unschedule`)

**Files:**
- Create `app/_actions/restaurants.ts`
- Test `app/_actions/restaurants.test.ts`

Mirrors `app/_actions/places.ts` exactly: `'use server'`, zod parse of inputs, repo calls against the real `db`, `revalidatePath`. Both the Eats and Plan tabs are revalidated (scheduling touches the plan).

- [ ] **Step 1: Write the failing test.**

`app/_actions/restaurants.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

import {
  addRestaurantAction,
  updateRestaurantAction,
  deleteRestaurantAction,
  scheduleRestaurantToDayAction,
  unscheduleRestaurantAction,
} from '@/app/_actions/restaurants';
import { getRestaurant } from '@/src/db/repos/restaurants';
import { getPlace } from '@/src/db/repos/places';

const TS = new Date('2026-06-08T12:00:00.000Z');

function seed() {
  testHandle.db = makeTestDb().db;
  testHandle.db.insert(trips).values({
    id: 't1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
}

beforeEach(() => {
  revalidatePath.mockClear();
  seed();
});

describe('restaurant actions', () => {
  it('addRestaurantAction validates + inserts and revalidates the eats tab', async () => {
    const r = await addRestaurantAction({ tripId: 't1', name: '  Ichiran  ', status: 'want-to-try' });
    expect(r.name).toBe('Ichiran'); // trimmed
    expect(getRestaurant(testHandle.db, r.id)).toBeTruthy();
    expect(revalidatePath).toHaveBeenCalledWith('/trip/t1/eats');
  });

  it('addRestaurantAction rejects an empty name', async () => {
    await expect(addRestaurantAction({ tripId: 't1', name: '   ', status: 'want-to-try' })).rejects.toThrow();
  });

  it('addRestaurantAction rejects rating out of 1–5 and price out of 1–4', async () => {
    await expect(addRestaurantAction({ tripId: 't1', name: 'A', status: 'been', rating: 6 })).rejects.toThrow();
    await expect(addRestaurantAction({ tripId: 't1', name: 'A', status: 'been', priceLevel: 5 })).rejects.toThrow();
  });

  it('updateRestaurantAction patches and revalidates', async () => {
    const r = await addRestaurantAction({ tripId: 't1', name: 'A', status: 'want-to-try' });
    revalidatePath.mockClear();
    const updated = await updateRestaurantAction(r.id, { status: 'been', rating: 5 });
    expect(updated.status).toBe('been');
    expect(updated.rating).toBe(5);
    expect(revalidatePath).toHaveBeenCalledWith('/trip/t1/eats');
  });

  it('updateRestaurantAction throws for an unknown id', async () => {
    await expect(updateRestaurantAction('nope', { status: 'been' })).rejects.toThrow('Restaurant not found');
  });

  it('deleteRestaurantAction removes the row + revalidates', async () => {
    const r = await addRestaurantAction({ tripId: 't1', name: 'A', status: 'been' });
    await deleteRestaurantAction(r.id);
    expect(getRestaurant(testHandle.db, r.id)).toBeUndefined();
    expect(revalidatePath).toHaveBeenCalledWith('/trip/t1/eats');
  });

  it('scheduleRestaurantToDayAction creates a linked place and revalidates eats + plan', async () => {
    const r = await addRestaurantAction({ tripId: 't1', name: 'A', status: 'want-to-try', notes: 'n' });
    revalidatePath.mockClear();
    const res = await scheduleRestaurantToDayAction(r.id, '2026-06-06');
    expect(res.place.dayDate).toBe('2026-06-06');
    expect(res.place.category).toBe('other');
    expect(res.restaurant.linkedPlaceId).toBe(res.place.id);
    expect(getPlace(testHandle.db, res.place.id)?.notes).toBe('n');
    expect(revalidatePath).toHaveBeenCalledWith('/trip/t1/eats');
    expect(revalidatePath).toHaveBeenCalledWith('/trip/t1/plan');
  });

  it('scheduleRestaurantToDayAction rejects a malformed date', async () => {
    const r = await addRestaurantAction({ tripId: 't1', name: 'A', status: 'want-to-try' });
    await expect(scheduleRestaurantToDayAction(r.id, '06/06/2026')).rejects.toThrow();
  });

  it('unscheduleRestaurantAction deletes the linked place + clears the link', async () => {
    const r = await addRestaurantAction({ tripId: 't1', name: 'A', status: 'been' });
    const { place } = await scheduleRestaurantToDayAction(r.id, '2026-06-06');
    const updated = await unscheduleRestaurantAction(r.id);
    expect(updated.linkedPlaceId).toBeNull();
    expect(getPlace(testHandle.db, place.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
`npm test -- app/_actions/restaurants.test.ts`
Expect: cannot resolve `@/app/_actions/restaurants`.

- [ ] **Step 3: Minimal impl.**

`app/_actions/restaurants.ts`:
```ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import {
  addRestaurant,
  updateRestaurant,
  deleteRestaurant,
  getRestaurant,
  scheduleRestaurantToDay,
  unscheduleRestaurant,
  type Restaurant,
} from '@/src/db/repos/restaurants';
import type { Place } from '@/src/db/repos/places';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const status = z.enum(['want-to-try', 'been']);
const rating = z.number().int().min(1).max(5);
const priceLevel = z.number().int().min(1).max(4);

function revalidateEats(tripId: string): void {
  revalidatePath(`/trip/${tripId}/eats`);
}

// --- addRestaurantAction --------------------------------------------------

const addSchema = z.object({
  tripId: z.string().min(1),
  name: z.string().trim().min(1, 'Name is required').max(200),
  cuisine: z.string().trim().max(100).nullish(),
  rating: rating.nullish(),
  status,
  priceLevel: priceLevel.nullish(),
  notes: z.string().max(2000).nullish(),
  linkedPlaceId: z.string().min(1).nullish(),
});

export type AddRestaurantActionInput = z.input<typeof addSchema>;

export async function addRestaurantAction(input: AddRestaurantActionInput): Promise<Restaurant> {
  const data = addSchema.parse(input);
  const r = addRestaurant(db, {
    tripId: data.tripId,
    name: data.name,
    cuisine: data.cuisine ?? null,
    rating: data.rating ?? null,
    status: data.status,
    priceLevel: data.priceLevel ?? null,
    notes: data.notes ?? null,
    linkedPlaceId: data.linkedPlaceId ?? null,
  });
  revalidateEats(data.tripId);
  return r;
}

// --- updateRestaurantAction -----------------------------------------------

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  cuisine: z.string().trim().max(100).nullish(),
  rating: rating.nullish(),
  status: status.optional(),
  priceLevel: priceLevel.nullish(),
  notes: z.string().max(2000).nullish(),
});

export type UpdateRestaurantActionPatch = z.input<typeof updateSchema>;

export async function updateRestaurantAction(
  id: string,
  patch: UpdateRestaurantActionPatch,
): Promise<Restaurant> {
  const existing = getRestaurant(db, id);
  if (!existing) throw new Error('Restaurant not found');
  const data = updateSchema.parse(patch);
  const updated = updateRestaurant(db, id, data);
  if (!updated) throw new Error('Restaurant not found');
  revalidateEats(existing.tripId);
  return updated;
}

// --- deleteRestaurantAction -----------------------------------------------

export async function deleteRestaurantAction(id: string): Promise<void> {
  const existing = getRestaurant(db, id);
  if (!existing) throw new Error('Restaurant not found');
  deleteRestaurant(db, id);
  revalidateEats(existing.tripId);
}

// --- scheduleRestaurantToDayAction ----------------------------------------

export async function scheduleRestaurantToDayAction(
  id: string,
  dayDate: string,
): Promise<{ restaurant: Restaurant; place: Place }> {
  const existing = getRestaurant(db, id);
  if (!existing) throw new Error('Restaurant not found');
  const parsedDay = dateStr.parse(dayDate);
  const result = scheduleRestaurantToDay(db, id, parsedDay);
  revalidateEats(existing.tripId);
  revalidatePath(`/trip/${existing.tripId}/plan`);
  return result;
}

// --- unscheduleRestaurantAction -------------------------------------------

export async function unscheduleRestaurantAction(id: string): Promise<Restaurant> {
  const existing = getRestaurant(db, id);
  if (!existing) throw new Error('Restaurant not found');
  const updated = unscheduleRestaurant(db, id);
  if (!updated) throw new Error('Restaurant not found');
  revalidateEats(existing.tripId);
  revalidatePath(`/trip/${existing.tripId}/plan`);
  return updated;
}
```

- [ ] **Step 4: Run — expect PASS.**
`npm test -- app/_actions/restaurants.test.ts`
Expect: "Expected: 9 passed".

- [ ] **Step 5: Commit.**
```
git add app/_actions/restaurants.ts app/_actions/restaurants.test.ts
git commit -m "C2.3: restaurant server actions (add/update/delete/schedule/unschedule)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C2.4: read handler `GET /api/trips/[tripId]/restaurants`

**Files:**
- Create `app/api/trips/[tripId]/restaurants/route.ts`
- Test `app/api/trips/[tripId]/restaurants/route.test.ts`

Mirrors `app/api/trips/[tripId]/places/route.ts`: `force-dynamic`, 404 for unknown trip, returns `{ restaurants: RestaurantDTO[] }`. The DTO adds `scheduledDayDate` (the `dayDate` of the linked place, resolved without an N+1 — batch one query over linked place ids) so the client can show a "scheduled" indicator without a second round-trip. The SW `/api/trips*` JSON rule already caches this URL.

- [ ] **Step 1: Write the failing test.**

`app/api/trips/[tripId]/restaurants/route.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places, restaurants } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));

import { GET } from '@/app/api/trips/[tripId]/restaurants/route';

const TS = new Date('2026-06-08T12:00:00.000Z');

function seed(db: ReturnType<typeof makeTestDb>['db']) {
  db.insert(trips).values({
    id: 't1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(places).values({
    id: 'p1', tripId: 't1', dayDate: '2026-06-06', googlePlaceId: null, name: 'Ichiran',
    address: null, lat: null, lng: null, category: 'other', scheduledTime: null,
    durationMin: null, cost: null, notes: null, orderIndex: 0, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(restaurants).values([
    {
      id: 'r1', tripId: 't1', name: 'Ichiran', cuisine: 'Ramen', rating: 4,
      status: 'been', priceLevel: 2, notes: null, linkedPlaceId: 'p1',
      createdAt: new Date(2000), updatedAt: TS,
    },
    {
      id: 'r2', tripId: 't1', name: 'Kani', cuisine: null, rating: null,
      status: 'want-to-try', priceLevel: null, notes: null, linkedPlaceId: null,
      createdAt: new Date(1000), updatedAt: TS,
    },
  ]).run();
}

function ctx(tripId: string) {
  return { params: Promise.resolve({ tripId }) };
}

describe('GET /api/trips/[tripId]/restaurants', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
  });

  it('returns 200 with restaurants newest-first + scheduledDayDate resolved', async () => {
    const res = await GET(new Request('http://x/api/trips/t1/restaurants'), ctx('t1'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      restaurants: Array<{ id: string; scheduledDayDate: string | null }>;
    };
    expect(body.restaurants.map((r) => r.id)).toEqual(['r1', 'r2']); // createdAt desc
    expect(body.restaurants.find((r) => r.id === 'r1')?.scheduledDayDate).toBe('2026-06-06');
    expect(body.restaurants.find((r) => r.id === 'r2')?.scheduledDayDate).toBeNull();
  });

  it('returns 404 for an unknown trip', async () => {
    const res = await GET(new Request('http://x/api/trips/nope/restaurants'), ctx('nope'));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'not_found' });
  });

  it('returns an empty array for a trip with no restaurants', async () => {
    testHandle.db = makeTestDb().db;
    testHandle.db.insert(trips).values({
      id: 'empty', name: 'E', startDate: '2026-06-05', endDate: '2026-06-05',
      coverPhoto: null, createdAt: TS, updatedAt: TS,
    }).run();
    const res = await GET(new Request('http://x/api/trips/empty/restaurants'), ctx('empty'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ restaurants: [] });
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
`npm test -- app/api/trips/[tripId]/restaurants/route.test.ts`
Expect: cannot resolve route module.

- [ ] **Step 3: Minimal impl.**

`app/api/trips/[tripId]/restaurants/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { listRestaurants } from '@/src/db/repos/restaurants';
import { places, type Restaurant } from '@/src/db/schema';

export const dynamic = 'force-dynamic';

/**
 * RestaurantDTO: all Restaurant fields + scheduledDayDate resolved from the
 * linked place's dayDate (null when not scheduled or the place is gone).
 */
export interface RestaurantDTO extends Restaurant {
  scheduledDayDate: string | null;
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

  const rows = listRestaurants(db, tripId);

  // Batch-resolve dayDate for all linked places in one query (avoids N+1).
  const linkedIds = rows
    .map((r) => r.linkedPlaceId)
    .filter((id): id is string => id !== null);

  const dayMap = new Map<string, string | null>();
  if (linkedIds.length > 0) {
    const placeRows = db
      .select({ id: places.id, dayDate: places.dayDate })
      .from(places)
      .where(inArray(places.id, linkedIds))
      .all();
    for (const p of placeRows) {
      dayMap.set(p.id, p.dayDate ?? null);
    }
  }

  const restaurantsResult: RestaurantDTO[] = rows.map((r) => ({
    ...r,
    scheduledDayDate: r.linkedPlaceId ? (dayMap.get(r.linkedPlaceId) ?? null) : null,
  }));

  return NextResponse.json({ restaurants: restaurantsResult });
}
```

- [ ] **Step 4: Run — expect PASS.**
`npm test -- app/api/trips/[tripId]/restaurants/route.test.ts`
Expect: "Expected: 3 passed".

- [ ] **Step 5: Commit.**
```
git add app/api/trips/[tripId]/restaurants/route.ts app/api/trips/[tripId]/restaurants/route.test.ts
git commit -m "C2.4: GET /api/trips/[tripId]/restaurants (RestaurantDTO + scheduledDayDate)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C2.5: pure view helpers — `priceLevelLabel`, `ratingStars`, `statusFilter`

**Files:**
- Create `src/lib/eatsView.ts`
- Test `src/lib/eatsView.test.ts`

Extract presentation-only logic (matches 1A/1B's "extract pure helpers and TDD them" rule). These are framework-free and exhaustively testable so the UI components stay thin.

- [ ] **Step 1: Write the failing test.**

`src/lib/eatsView.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  priceLevelLabel,
  ratingStars,
  filterByStatus,
  type EatsStatusFilter,
} from '@/src/lib/eatsView';
import type { RestaurantDTO } from '@/app/api/trips/[tripId]/restaurants/route';

function r(over: Partial<RestaurantDTO> = {}): RestaurantDTO {
  return {
    id: 'r1', tripId: 't1', name: 'A', cuisine: null, rating: null,
    status: 'want-to-try', priceLevel: null, notes: null, linkedPlaceId: null,
    createdAt: new Date(0), updatedAt: new Date(0), scheduledDayDate: null, ...over,
  };
}

describe('priceLevelLabel', () => {
  it('renders 1–4 as $ … $$$$', () => {
    expect(priceLevelLabel(1)).toBe('$');
    expect(priceLevelLabel(2)).toBe('$$');
    expect(priceLevelLabel(3)).toBe('$$$');
    expect(priceLevelLabel(4)).toBe('$$$$');
  });
  it('returns empty string for null / out-of-range', () => {
    expect(priceLevelLabel(null)).toBe('');
    expect(priceLevelLabel(0)).toBe('');
    expect(priceLevelLabel(5)).toBe('');
  });
});

describe('ratingStars', () => {
  it('returns filled/empty counts for a 1–5 rating', () => {
    expect(ratingStars(3)).toEqual({ filled: 3, empty: 2 });
    expect(ratingStars(5)).toEqual({ filled: 5, empty: 0 });
    expect(ratingStars(1)).toEqual({ filled: 1, empty: 4 });
  });
  it('returns null for null / out-of-range', () => {
    expect(ratingStars(null)).toBeNull();
    expect(ratingStars(0)).toBeNull();
    expect(ratingStars(6)).toBeNull();
  });
});

describe('filterByStatus', () => {
  const list = [r({ id: 'a', status: 'want-to-try' }), r({ id: 'b', status: 'been' })];
  it('all → unchanged', () => {
    expect(filterByStatus(list, 'all').map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('want-to-try → only want-to-try', () => {
    expect(filterByStatus(list, 'want-to-try').map((x) => x.id)).toEqual(['a']);
  });
  it('been → only been', () => {
    expect(filterByStatus(list, 'been').map((x) => x.id)).toEqual(['b']);
  });
  it('is exhaustive over the filter union', () => {
    const all: EatsStatusFilter[] = ['all', 'want-to-try', 'been'];
    for (const f of all) expect(Array.isArray(filterByStatus(list, f))).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
`npm test -- src/lib/eatsView.test.ts`
Expect: cannot resolve `@/src/lib/eatsView`.

- [ ] **Step 3: Minimal impl.**

`src/lib/eatsView.ts`:
```ts
import type { RestaurantDTO } from '@/app/api/trips/[tripId]/restaurants/route';

export type EatsStatusFilter = 'all' | 'want-to-try' | 'been';

/** `$`…`$$$$` for a 1–4 price level; '' for null / out-of-range. */
export function priceLevelLabel(level: number | null): string {
  if (level == null || level < 1 || level > 4) return '';
  return '$'.repeat(level);
}

/** Filled/empty star counts for a 1–5 rating; null for null / out-of-range. */
export function ratingStars(rating: number | null): { filled: number; empty: number } | null {
  if (rating == null || rating < 1 || rating > 5) return null;
  return { filled: rating, empty: 5 - rating };
}

/** Filter a restaurant list by status; 'all' passes everything through. */
export function filterByStatus(list: RestaurantDTO[], filter: EatsStatusFilter): RestaurantDTO[] {
  if (filter === 'all') return list;
  return list.filter((r) => r.status === filter);
}
```

- [ ] **Step 4: Run — expect PASS.**
`npm test -- src/lib/eatsView.test.ts`
Expect: "Expected: 9 passed".

- [ ] **Step 5: Commit.**
```
git add src/lib/eatsView.ts src/lib/eatsView.test.ts
git commit -m "C2.5: pure eats view helpers (priceLevelLabel/ratingStars/filterByStatus)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C2.6: add Eats i18n strings to `messages/en.json`

**Files:**
- Modify `messages/en.json`
- Test `messages/eats-i18n.test.ts`

A small structural test guards the new namespace (every UI string in en.json, zh deferred). zh is out of Plan 2 scope.

- [ ] **Step 1: Write the failing test.**

`messages/eats-i18n.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import en from '@/messages/en.json';

describe('eats i18n', () => {
  const required = [
    'title', 'addRestaurant', 'editRestaurant', 'empty.headline', 'empty.subtext',
    'filterAll', 'filterWantToTry', 'filterBeen',
    'statusWantToTry', 'statusBeen', 'markBeen', 'markWantToTry',
    'nameLabel', 'cuisineLabel', 'ratingLabel', 'priceLabel', 'notesLabel', 'statusLabel',
    'cuisineUnknown', 'noRating', 'scheduledOn', 'notScheduled',
    'scheduleToDay', 'unschedule', 'dayPickerTitle', 'save', 'cancel', 'delete', 'confirmDelete',
    'loading', 'errorHeadline', 'errorSubtext', 'saveFailed',
  ];

  function get(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], obj);
  }

  it('has an eats namespace with all required keys', () => {
    expect(en).toHaveProperty('eats');
    for (const key of required) {
      expect(get((en as Record<string, unknown>).eats as Record<string, unknown>, key), `eats.${key}`).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
`npm test -- messages/eats-i18n.test.ts`
Expect: `expected en to have property "eats"`.

- [ ] **Step 3: Minimal impl.** Add an `"eats"` block to `messages/en.json` (insert after the `"plan"` block's closing `},` and before `"placeCategory"`):
```json
  "eats": {
    "title": "Eats",
    "addRestaurant": "Add restaurant",
    "editRestaurant": "Edit restaurant",
    "empty": {
      "headline": "No eats logged yet",
      "subtext": "Add a spot you want to try, or one you've already loved."
    },
    "filterAll": "All",
    "filterWantToTry": "Want to try",
    "filterBeen": "Been",
    "statusWantToTry": "Want to try",
    "statusBeen": "Been",
    "markBeen": "Mark as been",
    "markWantToTry": "Mark as want to try",
    "nameLabel": "Name",
    "cuisineLabel": "Cuisine",
    "ratingLabel": "Rating",
    "priceLabel": "Price",
    "notesLabel": "Notes",
    "statusLabel": "Status",
    "cuisineUnknown": "Cuisine not set",
    "noRating": "No rating",
    "scheduledOn": "Scheduled · {date}",
    "notScheduled": "Not scheduled",
    "scheduleToDay": "Add to a day",
    "unschedule": "Remove from plan",
    "dayPickerTitle": "Add to which day?",
    "ratingClear": "No rating",
    "priceClear": "No price",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "confirmDelete": "Delete this restaurant?",
    "loading": "Loading your eats…",
    "errorHeadline": "Couldn't load your eats",
    "errorSubtext": "Connect to the internet and try again.",
    "saveFailed": "Couldn't save — please try again."
  },
```

- [ ] **Step 4: Run — expect PASS.**
`npm test -- messages/eats-i18n.test.ts`
Expect: "Expected: 1 passed".

- [ ] **Step 5: Commit.**
```
git add messages/en.json messages/eats-i18n.test.ts
git commit -m "C2.6: en.json eats namespace + structural i18n guard

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C2.7: `RestaurantCard` component

**Files:**
- Create `components/eats/RestaurantCard.tsx`
- Test `components/eats/RestaurantCard.test.tsx`

A tap-to-open card: name, category-style cuisine chip, status pill, rating stars (only when set), price `$–$$$$`, notes preview, and a scheduled indicator. Uses the C2.5 helpers and the `eats` namespace. Mirrors `PlaceCard`'s visual idiom (rounded-card, bg-card, shadow-card, chip/pill colors from the palette).

- [ ] **Step 1: Write the failing test.**

`components/eats/RestaurantCard.test.tsx`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { RestaurantDTO } from '@/app/api/trips/[tripId]/restaurants/route';
import { RestaurantCard } from './RestaurantCard';

function r(over: Partial<RestaurantDTO> = {}): RestaurantDTO {
  return {
    id: 'r1', tripId: 't1', name: 'Ichiran', cuisine: 'Ramen', rating: 4,
    status: 'been', priceLevel: 2, notes: 'Tonkotsu', linkedPlaceId: 'p1',
    createdAt: new Date(0), updatedAt: new Date(0), scheduledDayDate: '2026-06-06', ...over,
  };
}

function renderCard(over: Partial<RestaurantDTO> = {}) {
  const onTap = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <RestaurantCard restaurant={r(over)} onTap={onTap} />
    </NextIntlClientProvider>,
  );
  return { onTap };
}

describe('RestaurantCard', () => {
  it('renders name, cuisine chip, status pill, price, notes', () => {
    renderCard();
    expect(screen.getByText('Ichiran')).toBeInTheDocument();
    expect(screen.getByText('Ramen')).toBeInTheDocument();
    expect(screen.getByText(en.eats.statusBeen)).toBeInTheDocument();
    expect(screen.getByText('$$')).toBeInTheDocument();
    expect(screen.getByText('Tonkotsu')).toBeInTheDocument();
  });

  it('renders rating stars only when a rating is set', () => {
    const { unmount } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <RestaurantCard restaurant={r({ rating: 3 })} onTap={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByLabelText('3 out of 5')).toBeInTheDocument();
    unmount();
    renderCard({ rating: null });
    expect(screen.queryByLabelText(/out of 5/)).not.toBeInTheDocument();
  });

  it('shows a scheduled indicator when scheduledDayDate is set', () => {
    renderCard({ scheduledDayDate: '2026-06-06' });
    expect(screen.getByText(/Scheduled/)).toBeInTheDocument();
  });

  it('omits the scheduled indicator when not scheduled', () => {
    renderCard({ scheduledDayDate: null });
    expect(screen.queryByText(/Scheduled/)).not.toBeInTheDocument();
  });

  it('calls onTap with the restaurant id when the card is clicked', async () => {
    const { onTap } = renderCard();
    await userEvent.click(screen.getByRole('button', { name: /Ichiran/ }));
    expect(onTap).toHaveBeenCalledWith('r1');
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
`npm test -- components/eats/RestaurantCard.test.tsx`
Expect: cannot resolve `./RestaurantCard`.

- [ ] **Step 3: Minimal impl.**

`components/eats/RestaurantCard.tsx`:
```tsx
'use client';

import { useTranslations } from 'next-intl';
import type { RestaurantDTO } from '@/app/api/trips/[tripId]/restaurants/route';
import { priceLevelLabel, ratingStars } from '@/src/lib/eatsView';

type RestaurantCardProps = {
  restaurant: RestaurantDTO;
  onTap: (id: string) => void;
};

export function RestaurantCard({ restaurant, onTap }: RestaurantCardProps) {
  const t = useTranslations('eats');
  const price = priceLevelLabel(restaurant.priceLevel);
  const stars = ratingStars(restaurant.rating);
  const statusLabel = restaurant.status === 'been' ? t('statusBeen') : t('statusWantToTry');

  return (
    <button
      type="button"
      onClick={() => onTap(restaurant.id)}
      className="flex w-full flex-col gap-1 rounded-card bg-card p-3 text-left shadow-card"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-body font-bold text-ink">{restaurant.name}</span>
        <span
          className={`shrink-0 rounded-chip px-2 py-0.5 text-caption font-medium ${
            restaurant.status === 'been' ? 'bg-teal text-white' : 'bg-paper text-ink-muted'
          }`}
        >
          {statusLabel}
        </span>
      </span>

      <span className="flex flex-wrap items-center gap-2 text-caption text-ink-muted">
        {restaurant.cuisine ? (
          <span className="rounded-chip bg-paper px-2 py-0.5 text-ink-muted">{restaurant.cuisine}</span>
        ) : null}
        {stars ? (
          <span aria-label={`${restaurant.rating} out of 5`} className="text-coral">
            {'★'.repeat(stars.filled)}
            <span className="text-line">{'★'.repeat(stars.empty)}</span>
          </span>
        ) : null}
        {price ? <span className="font-medium text-ink">{price}</span> : null}
      </span>

      {restaurant.notes ? (
        <span className="truncate text-caption text-ink-muted">{restaurant.notes}</span>
      ) : null}

      {restaurant.scheduledDayDate ? (
        <span className="text-caption font-medium text-teal">
          {t('scheduledOn', { date: restaurant.scheduledDayDate })}
        </span>
      ) : null}
    </button>
  );
}
```

- [ ] **Step 4: Run — expect PASS.**
`npm test -- components/eats/RestaurantCard.test.tsx`
Expect: "Expected: 5 passed".

- [ ] **Step 5: Commit.**
```
git add components/eats/RestaurantCard.tsx components/eats/RestaurantCard.test.tsx
git commit -m "C2.7: RestaurantCard (name/cuisine/status/rating/price/notes/scheduled)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C2.8: `RestaurantFormSheet` (add + edit)

**Files:**
- Create `components/eats/RestaurantFormSheet.tsx`
- Test `components/eats/RestaurantFormSheet.test.tsx`

One sheet drives both add (no `restaurant`) and edit (with `restaurant`). Same dialog/Escape/`role="alert"` idiom as `AddPlaceSheet`/`PlaceDetailSheet`. Calls `addRestaurantAction` or `updateRestaurantAction` via `useTransition`; on success `onSaved()` + `onClose()`, on reject shows the inline error and keeps the sheet open. Rating/price are `<select>` with a "no value" empty option.

- [ ] **Step 1: Write the failing test.**

`components/eats/RestaurantFormSheet.test.tsx`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { RestaurantDTO } from '@/app/api/trips/[tripId]/restaurants/route';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const addRestaurantAction = vi.fn(async (..._a: any[]) => ({ id: 'r-new' }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const updateRestaurantAction = vi.fn(async (..._a: any[]) => ({ id: 'r1' }));
vi.mock('@/app/_actions/restaurants', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addRestaurantAction: (...a: any[]) => addRestaurantAction(...a),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateRestaurantAction: (...a: any[]) => updateRestaurantAction(...a),
  deleteRestaurantAction: vi.fn(),
  scheduleRestaurantToDayAction: vi.fn(),
  unscheduleRestaurantAction: vi.fn(),
}));

import { RestaurantFormSheet } from './RestaurantFormSheet';

function existing(over: Partial<RestaurantDTO> = {}): RestaurantDTO {
  return {
    id: 'r1', tripId: 't1', name: 'Ichiran', cuisine: 'Ramen', rating: 4,
    status: 'been', priceLevel: 2, notes: 'Tonkotsu', linkedPlaceId: null,
    createdAt: new Date(0), updatedAt: new Date(0), scheduledDayDate: null, ...over,
  };
}

function renderSheet(props: Partial<React.ComponentProps<typeof RestaurantFormSheet>> = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <RestaurantFormSheet
        open
        tripId="t1"
        restaurant={null}
        disabled={false}
        onClose={onClose}
        onSaved={onSaved}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onClose, onSaved };
}

beforeEach(() => {
  addRestaurantAction.mockClear();
  updateRestaurantAction.mockClear();
});

describe('RestaurantFormSheet', () => {
  it('add mode: creates a restaurant with trimmed name + selected status', async () => {
    const { onSaved, onClose } = renderSheet();
    await userEvent.type(screen.getByLabelText(en.eats.nameLabel), '  Kani Doraku  ');
    await userEvent.click(screen.getByRole('button', { name: en.eats.save }));
    await waitFor(() => expect(addRestaurantAction).toHaveBeenCalled());
    expect(addRestaurantAction).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: 't1', name: 'Kani Doraku', status: 'want-to-try' }),
    );
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('add mode: blocks submit when name is empty (no action call)', async () => {
    renderSheet();
    await userEvent.click(screen.getByRole('button', { name: en.eats.save }));
    expect(addRestaurantAction).not.toHaveBeenCalled();
  });

  it('edit mode: pre-fills fields and calls updateRestaurantAction with the id', async () => {
    const { onSaved } = renderSheet({ restaurant: existing() });
    const name = screen.getByLabelText(en.eats.nameLabel) as HTMLInputElement;
    expect(name.value).toBe('Ichiran');
    await userEvent.clear(name);
    await userEvent.type(name, 'Ichiran Honten');
    await userEvent.click(screen.getByRole('button', { name: en.eats.save }));
    await waitFor(() => expect(updateRestaurantAction).toHaveBeenCalled());
    expect(updateRestaurantAction).toHaveBeenCalledWith('r1', expect.objectContaining({ name: 'Ichiran Honten' }));
    expect(onSaved).toHaveBeenCalled();
  });

  it('parses rating/price selects to numbers and empty → null', async () => {
    renderSheet();
    await userEvent.type(screen.getByLabelText(en.eats.nameLabel), 'A');
    await userEvent.selectOptions(screen.getByLabelText(en.eats.ratingLabel), '5');
    await userEvent.click(screen.getByRole('button', { name: en.eats.save }));
    await waitFor(() => expect(addRestaurantAction).toHaveBeenCalled());
    expect(addRestaurantAction).toHaveBeenCalledWith(
      expect.objectContaining({ rating: 5, priceLevel: null }),
    );
  });

  it('disables inputs + Save when offline', () => {
    renderSheet({ disabled: true });
    expect(screen.getByLabelText(en.eats.nameLabel)).toBeDisabled();
    expect(screen.getByRole('button', { name: en.eats.save })).toBeDisabled();
  });

  it('shows an error and keeps the sheet open when the action rejects', async () => {
    addRestaurantAction.mockRejectedValueOnce(new Error('boom'));
    const { onClose, onSaved } = renderSheet();
    await userEvent.type(screen.getByLabelText(en.eats.nameLabel), 'A');
    await userEvent.click(screen.getByRole('button', { name: en.eats.save }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.eats.saveFailed));
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('closes when Escape is pressed on the dialog', async () => {
    const { onClose } = renderSheet();
    await userEvent.type(screen.getByRole('dialog'), '{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
`npm test -- components/eats/RestaurantFormSheet.test.tsx`
Expect: cannot resolve `./RestaurantFormSheet`.

- [ ] **Step 3: Minimal impl.**

`components/eats/RestaurantFormSheet.tsx`:
```tsx
'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { RestaurantDTO } from '@/app/api/trips/[tripId]/restaurants/route';
import { addRestaurantAction, updateRestaurantAction } from '@/app/_actions/restaurants';

type RestaurantStatus = RestaurantDTO['status'];

type RestaurantFormSheetProps = {
  open: boolean;
  tripId: string;
  /** null = add mode; a restaurant = edit mode. */
  restaurant: RestaurantDTO | null;
  disabled: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const RATINGS = ['1', '2', '3', '4', '5'];
const PRICES = ['1', '2', '3', '4'];

export function RestaurantFormSheet({
  open,
  tripId,
  restaurant,
  disabled,
  onClose,
  onSaved,
}: RestaurantFormSheetProps) {
  const t = useTranslations('eats');
  const isEdit = restaurant !== null;
  const [name, setName] = useState(restaurant?.name ?? '');
  const [cuisine, setCuisine] = useState(restaurant?.cuisine ?? '');
  const [status, setStatus] = useState<RestaurantStatus>(restaurant?.status ?? 'want-to-try');
  const [rating, setRating] = useState(restaurant?.rating != null ? String(restaurant.rating) : '');
  const [price, setPrice] = useState(restaurant?.priceLevel != null ? String(restaurant.priceLevel) : '');
  const [notes, setNotes] = useState(restaurant?.notes ?? '');
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!open) return null;

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') onClose();
  }

  function handleSave() {
    const trimmed = name.trim();
    if (trimmed === '') return; // client guard; server re-validates
    const payload = {
      name: trimmed,
      cuisine: cuisine.trim() || null,
      status,
      rating: rating === '' ? null : Number(rating),
      priceLevel: price === '' ? null : Number(price),
      notes: notes.trim() || null,
    };
    setSaveError(null);
    startTransition(async () => {
      try {
        if (isEdit && restaurant) {
          await updateRestaurantAction(restaurant.id, payload);
        } else {
          await addRestaurantAction({ tripId, ...payload });
        }
        onSaved();
        onClose();
      } catch {
        setSaveError(t('saveFailed'));
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? t('editRestaurant') : t('addRestaurant')}
      className="fixed inset-0 z-50 flex items-end bg-[rgb(110_85_68_/_0.45)]"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-card p-6 shadow-lift"
      >
        {saveError ? (
          <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-caption text-red-700">
            {saveError}
          </p>
        ) : null}

        <label className="block text-label font-medium text-ink" htmlFor="rf-name">{t('nameLabel')}</label>
        <input
          id="rf-name" type="text" value={name} disabled={disabled}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="rf-cuisine">{t('cuisineLabel')}</label>
        <input
          id="rf-cuisine" type="text" value={cuisine} disabled={disabled}
          onChange={(e) => setCuisine(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="rf-status">{t('statusLabel')}</label>
        <select
          id="rf-status" value={status} disabled={disabled}
          onChange={(e) => setStatus(e.target.value as RestaurantStatus)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        >
          <option value="want-to-try">{t('statusWantToTry')}</option>
          <option value="been">{t('statusBeen')}</option>
        </select>

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="rf-rating">{t('ratingLabel')}</label>
        <select
          id="rf-rating" value={rating} disabled={disabled}
          onChange={(e) => setRating(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        >
          <option value="">{t('ratingClear')}</option>
          {RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="rf-price">{t('priceLabel')}</label>
        <select
          id="rf-price" value={price} disabled={disabled}
          onChange={(e) => setPrice(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        >
          <option value="">{t('priceClear')}</option>
          {PRICES.map((p) => <option key={p} value={p}>{'$'.repeat(Number(p))}</option>)}
        </select>

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="rf-notes">{t('notesLabel')}</label>
        <textarea
          id="rf-notes" value={notes} disabled={disabled}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />

        <div className="mt-4 flex gap-3">
          <button
            type="button" onClick={onClose}
            className="flex-1 rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset"
          >
            {t('cancel')}
          </button>
          <button
            type="button" disabled={disabled || isPending} onClick={handleSave}
            className="flex-1 rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS.**
`npm test -- components/eats/RestaurantFormSheet.test.tsx`
Expect: "Expected: 7 passed".

- [ ] **Step 5: Commit.**
```
git add components/eats/RestaurantFormSheet.tsx components/eats/RestaurantFormSheet.test.tsx
git commit -m "C2.8: RestaurantFormSheet (add + edit, status/rating/price selects)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C2.9: `RestaurantDetailSheet` (mark been/want, schedule-to-day picker, delete)

**Files:**
- Create `components/eats/RestaurantDetailSheet.tsx`
- Test `components/eats/RestaurantDetailSheet.test.tsx`

Detail/actions sheet for a single restaurant: shows summary, a "mark been / mark want to try" toggle (`updateRestaurantAction`), a day-picker (list of the trip's days from props) that calls `scheduleRestaurantToDayAction`, an "Edit" button (delegates up via `onEdit`), an "Remove from plan" (`unscheduleRestaurantAction`, only when scheduled), and a two-step Delete (`deleteRestaurantAction`). All mutations online-only via `disabled`; errors shown inline; on success `onChanged()`.

- [ ] **Step 1: Write the failing test.**

`components/eats/RestaurantDetailSheet.test.tsx`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { RestaurantDTO } from '@/app/api/trips/[tripId]/restaurants/route';
import type { DerivedDay } from '@/src/lib/days';

const updateRestaurantAction = vi.fn(async () => ({ id: 'r1' }));
const deleteRestaurantAction = vi.fn(async () => undefined);
const scheduleRestaurantToDayAction = vi.fn(async () => ({ restaurant: { id: 'r1' }, place: { id: 'p1' } }));
const unscheduleRestaurantAction = vi.fn(async () => ({ id: 'r1' }));
vi.mock('@/app/_actions/restaurants', () => ({
  addRestaurantAction: vi.fn(),
  updateRestaurantAction: (...a: unknown[]) => updateRestaurantAction(...a),
  deleteRestaurantAction: (...a: unknown[]) => deleteRestaurantAction(...a),
  scheduleRestaurantToDayAction: (...a: unknown[]) => scheduleRestaurantToDayAction(...a),
  unscheduleRestaurantAction: (...a: unknown[]) => unscheduleRestaurantAction(...a),
}));

import { RestaurantDetailSheet } from './RestaurantDetailSheet';

const DAYS: DerivedDay[] = [
  { date: '2026-06-05', dayNumber: 1, weekday: 'Friday', isToday: false },
  { date: '2026-06-06', dayNumber: 2, weekday: 'Saturday', isToday: true },
];

function r(over: Partial<RestaurantDTO> = {}): RestaurantDTO {
  return {
    id: 'r1', tripId: 't1', name: 'Ichiran', cuisine: 'Ramen', rating: 4,
    status: 'want-to-try', priceLevel: 2, notes: null, linkedPlaceId: null,
    createdAt: new Date(0), updatedAt: new Date(0), scheduledDayDate: null, ...over,
  };
}

function renderSheet(props: Partial<React.ComponentProps<typeof RestaurantDetailSheet>> = {}) {
  const onClose = vi.fn();
  const onChanged = vi.fn();
  const onEdit = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <RestaurantDetailSheet
        open restaurant={r()} days={DAYS} disabled={false}
        onClose={onClose} onChanged={onChanged} onEdit={onEdit} {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onClose, onChanged, onEdit };
}

beforeEach(() => {
  updateRestaurantAction.mockClear();
  deleteRestaurantAction.mockClear();
  scheduleRestaurantToDayAction.mockClear();
  unscheduleRestaurantAction.mockClear();
});

describe('RestaurantDetailSheet', () => {
  it('toggles status to "been" via updateRestaurantAction', async () => {
    const { onChanged } = renderSheet();
    await userEvent.click(screen.getByRole('button', { name: en.eats.markBeen }));
    await waitFor(() => expect(updateRestaurantAction).toHaveBeenCalledWith('r1', { status: 'been' }));
    expect(onChanged).toHaveBeenCalled();
  });

  it('shows "mark want to try" when the restaurant is already been', async () => {
    renderSheet({ restaurant: r({ status: 'been' }) });
    await userEvent.click(screen.getByRole('button', { name: en.eats.markWantToTry }));
    await waitFor(() => expect(updateRestaurantAction).toHaveBeenCalledWith('r1', { status: 'want-to-try' }));
  });

  it('schedules to a chosen day', async () => {
    renderSheet();
    await userEvent.click(screen.getByRole('button', { name: en.eats.scheduleToDay }));
    await userEvent.click(screen.getByRole('button', { name: /Day 2/ }));
    await waitFor(() => expect(scheduleRestaurantToDayAction).toHaveBeenCalledWith('r1', '2026-06-06'));
  });

  it('shows "remove from plan" only when scheduled and calls unschedule', async () => {
    const { rerender } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <RestaurantDetailSheet open restaurant={r({ scheduledDayDate: null })} days={DAYS}
          disabled={false} onClose={vi.fn()} onChanged={vi.fn()} onEdit={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByRole('button', { name: en.eats.unschedule })).not.toBeInTheDocument();
    rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <RestaurantDetailSheet open restaurant={r({ scheduledDayDate: '2026-06-06', linkedPlaceId: 'p1' })}
          days={DAYS} disabled={false} onClose={vi.fn()} onChanged={vi.fn()} onEdit={vi.fn()} />
      </NextIntlClientProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: en.eats.unschedule }));
    await waitFor(() => expect(unscheduleRestaurantAction).toHaveBeenCalledWith('r1'));
  });

  it('requires a confirm tap before deleting', async () => {
    const { onChanged } = renderSheet();
    await userEvent.click(screen.getByRole('button', { name: en.eats.delete }));
    expect(deleteRestaurantAction).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: en.eats.confirmDelete }));
    await waitFor(() => expect(deleteRestaurantAction).toHaveBeenCalledWith('r1'));
    expect(onChanged).toHaveBeenCalled();
  });

  it('delegates Edit to onEdit', async () => {
    const { onEdit } = renderSheet();
    await userEvent.click(screen.getByRole('button', { name: en.eats.editRestaurant }));
    expect(onEdit).toHaveBeenCalledWith('r1');
  });

  it('disables mutating buttons when offline', () => {
    renderSheet({ disabled: true });
    expect(screen.getByRole('button', { name: en.eats.markBeen })).toBeDisabled();
  });

  it('closes when Escape is pressed', async () => {
    const { onClose } = renderSheet();
    await userEvent.type(screen.getByRole('dialog'), '{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
`npm test -- components/eats/RestaurantDetailSheet.test.tsx`
Expect: cannot resolve `./RestaurantDetailSheet`.

- [ ] **Step 3: Minimal impl.**

`components/eats/RestaurantDetailSheet.tsx`:
```tsx
'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { RestaurantDTO } from '@/app/api/trips/[tripId]/restaurants/route';
import type { DerivedDay } from '@/src/lib/days';
import { priceLevelLabel, ratingStars } from '@/src/lib/eatsView';
import {
  updateRestaurantAction,
  deleteRestaurantAction,
  scheduleRestaurantToDayAction,
  unscheduleRestaurantAction,
} from '@/app/_actions/restaurants';

type RestaurantDetailSheetProps = {
  open: boolean;
  restaurant: RestaurantDTO;
  days: DerivedDay[];
  disabled: boolean;
  onClose: () => void;
  onChanged: () => void;
  onEdit: (id: string) => void;
};

export function RestaurantDetailSheet({
  open,
  restaurant,
  days,
  disabled,
  onClose,
  onChanged,
  onEdit,
}: RestaurantDetailSheetProps) {
  const t = useTranslations('eats');
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [picking, setPicking] = useState(false);

  if (!open) return null;

  const stars = ratingStars(restaurant.rating);
  const price = priceLevelLabel(restaurant.priceLevel);
  const nextStatus = restaurant.status === 'been' ? 'want-to-try' : 'been';
  const busy = disabled || isPending;

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') onClose();
  }

  function run(fn: () => Promise<unknown>) {
    setActionError(null);
    startTransition(async () => {
      try {
        await fn();
        onChanged();
      } catch {
        setActionError(t('saveFailed'));
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={restaurant.name}
      className="fixed inset-0 z-50 flex items-end bg-[rgb(110_85_68_/_0.45)]"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-card p-6 shadow-lift"
      >
        {actionError ? (
          <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-caption text-red-700">
            {actionError}
          </p>
        ) : null}

        <h2 className="text-title font-bold text-ink">{restaurant.name}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-caption text-ink-muted">
          <span>{restaurant.cuisine ?? t('cuisineUnknown')}</span>
          {stars ? (
            <span aria-label={`${restaurant.rating} out of 5`} className="text-coral">
              {'★'.repeat(stars.filled)}<span className="text-line">{'★'.repeat(stars.empty)}</span>
            </span>
          ) : <span>{t('noRating')}</span>}
          {price ? <span className="font-medium text-ink">{price}</span> : null}
        </p>
        <p className="mt-1 text-caption text-teal">
          {restaurant.scheduledDayDate ? t('scheduledOn', { date: restaurant.scheduledDayDate }) : t('notScheduled')}
        </p>
        {restaurant.notes ? <p className="mt-2 text-body text-ink">{restaurant.notes}</p> : null}

        <button
          type="button" disabled={busy}
          onClick={() => run(() => updateRestaurantAction(restaurant.id, { status: nextStatus }))}
          className="mt-4 w-full rounded-control bg-teal px-4 py-3 text-label font-medium text-white shadow-card disabled:opacity-40"
        >
          {restaurant.status === 'been' ? t('markWantToTry') : t('markBeen')}
        </button>

        {picking ? (
          <div className="mt-3">
            <p className="text-label font-medium text-ink">{t('dayPickerTitle')}</p>
            <ul className="mt-2 flex flex-col gap-2">
              {days.map((d) => (
                <li key={d.date}>
                  <button
                    type="button" disabled={busy}
                    onClick={() => run(() => scheduleRestaurantToDayAction(restaurant.id, d.date))}
                    className="w-full rounded-control bg-paper px-3 py-2 text-left text-body text-ink shadow-inset disabled:opacity-40"
                  >
                    Day {d.dayNumber} · {d.weekday} {d.date}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <button
            type="button" disabled={busy} onClick={() => setPicking(true)}
            className="mt-3 w-full rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset disabled:opacity-40"
          >
            {t('scheduleToDay')}
          </button>
        )}

        {restaurant.scheduledDayDate ? (
          <button
            type="button" disabled={busy}
            onClick={() => run(() => unscheduleRestaurantAction(restaurant.id))}
            className="mt-3 w-full rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset disabled:opacity-40"
          >
            {t('unschedule')}
          </button>
        ) : null}

        <button
          type="button" disabled={busy} onClick={() => onEdit(restaurant.id)}
          className="mt-3 w-full rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset disabled:opacity-40"
        >
          {t('editRestaurant')}
        </button>

        {confirmingDelete ? (
          <button
            type="button" disabled={busy}
            onClick={() => run(() => deleteRestaurantAction(restaurant.id))}
            className="mt-3 w-full rounded-control bg-danger px-4 py-3 text-label font-medium text-white shadow-card disabled:opacity-40"
          >
            {t('confirmDelete')}
          </button>
        ) : (
          <button
            type="button" disabled={busy} onClick={() => setConfirmingDelete(true)}
            className="mt-3 w-full rounded-control px-4 py-3 text-label font-medium text-danger disabled:opacity-40"
          >
            {t('delete')}
          </button>
        )}

        <button
          type="button" onClick={onClose}
          className="mt-4 w-full rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS.**
`npm test -- components/eats/RestaurantDetailSheet.test.tsx`
Expect: "Expected: 8 passed".

- [ ] **Step 5: Commit.**
```
git add components/eats/RestaurantDetailSheet.tsx components/eats/RestaurantDetailSheet.test.tsx
git commit -m "C2.9: RestaurantDetailSheet (mark been/want, schedule picker, unschedule, delete)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C2.10: `EatsClient` (static-shell client-fetch + filter + sheets)

**Files:**
- Create `components/eats/EatsClient.tsx`
- Test `components/eats/EatsClient.test.tsx`

The tab's brain (mirrors `PlanClient`): online listener, `load()` client-fetches `withBase('/api/trips/:id')` + `withBase('/api/trips/:id/restaurants')`, loading/error/loaded states, status filter, an Add button, and the three sheets. Mutations re-fetch via `onSaved/onChanged`. `days` for the picker come from the trip range via `deriveDays` (no DB on the client). Mutations are online-only (`disabled={!online}`).

- [ ] **Step 1: Write the failing test.**

`components/eats/EatsClient.test.tsx`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

vi.mock('@/app/_actions/restaurants', () => ({
  addRestaurantAction: vi.fn(async () => ({ id: 'r-new' })),
  updateRestaurantAction: vi.fn(async () => ({ id: 'r1' })),
  deleteRestaurantAction: vi.fn(async () => undefined),
  scheduleRestaurantToDayAction: vi.fn(async () => ({ restaurant: { id: 'r1' }, place: { id: 'p1' } })),
  unscheduleRestaurantAction: vi.fn(async () => ({ id: 'r1' })),
}));

import { EatsClient } from './EatsClient';

const TRIP = { id: 't1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07', coverPhoto: null };
const RESTAURANTS = [
  {
    id: 'r1', tripId: 't1', name: 'Ichiran', cuisine: 'Ramen', rating: 4, status: 'been',
    priceLevel: 2, notes: null, linkedPlaceId: null, createdAt: 0, updatedAt: 0, scheduledDayDate: null,
  },
  {
    id: 'r2', tripId: 't1', name: 'Kani', cuisine: null, rating: null, status: 'want-to-try',
    priceLevel: null, notes: null, linkedPlaceId: null, createdAt: 0, updatedAt: 0, scheduledDayDate: null,
  },
];

function mockFetch(restaurants = RESTAURANTS) {
  return vi.fn(async (url: string) => {
    if (url.endsWith('/restaurants')) {
      return { ok: true, json: async () => ({ restaurants }) } as Response;
    }
    return { ok: true, json: async () => ({ trip: TRIP }) } as Response;
  });
}

function renderClient() {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <EatsClient tripId="t1" tz="Asia/Tokyo" currency="JPY" locale="en" />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});
afterEach(() => vi.unstubAllGlobals());

describe('EatsClient', () => {
  it('fetches and renders restaurant cards', async () => {
    vi.stubGlobal('fetch', mockFetch());
    renderClient();
    expect(await screen.findByText('Ichiran')).toBeInTheDocument();
    expect(screen.getByText('Kani')).toBeInTheDocument();
  });

  it('filters by status', async () => {
    vi.stubGlobal('fetch', mockFetch());
    renderClient();
    await screen.findByText('Ichiran');
    await userEvent.click(screen.getByRole('button', { name: en.eats.filterBeen }));
    expect(screen.getByText('Ichiran')).toBeInTheDocument();
    expect(screen.queryByText('Kani')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no restaurants', async () => {
    vi.stubGlobal('fetch', mockFetch([]));
    renderClient();
    expect(await screen.findByText(en.eats.empty.headline)).toBeInTheDocument();
  });

  it('opens the add sheet from the Add button', async () => {
    vi.stubGlobal('fetch', mockFetch());
    renderClient();
    await screen.findByText('Ichiran');
    await userEvent.click(screen.getByRole('button', { name: en.eats.addRestaurant }));
    expect(screen.getByRole('dialog', { name: en.eats.addRestaurant })).toBeInTheDocument();
  });

  it('opens the detail sheet when a card is tapped', async () => {
    vi.stubGlobal('fetch', mockFetch());
    renderClient();
    await userEvent.click(await screen.findByRole('button', { name: /Ichiran/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Ichiran' });
    expect(within(dialog).getByRole('button', { name: en.eats.scheduleToDay })).toBeInTheDocument();
  });

  it('shows the error state when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) } as Response)));
    renderClient();
    expect(await screen.findByText(en.eats.errorHeadline)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
`npm test -- components/eats/EatsClient.test.tsx`
Expect: cannot resolve `./EatsClient`.

- [ ] **Step 3: Minimal impl.**

`components/eats/EatsClient.tsx`:
```tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { withBase } from '@/src/lib/basePath';
import { deriveDays, type DerivedDay } from '@/src/lib/days';
import { filterByStatus, type EatsStatusFilter } from '@/src/lib/eatsView';
import type { RestaurantDTO } from '@/app/api/trips/[tripId]/restaurants/route';
import { EmptyState } from '@/components/EmptyState';
import { RestaurantCard } from '@/components/eats/RestaurantCard';
import { RestaurantFormSheet } from '@/components/eats/RestaurantFormSheet';
import { RestaurantDetailSheet } from '@/components/eats/RestaurantDetailSheet';

type TripLite = { id: string; name: string; startDate: string; endDate: string; coverPhoto: string | null };
type EatsData = { trip: TripLite; restaurants: RestaurantDTO[] };
type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; data: EatsData };

const FILTERS: { value: EatsStatusFilter; key: 'filterAll' | 'filterWantToTry' | 'filterBeen' }[] = [
  { value: 'all', key: 'filterAll' },
  { value: 'want-to-try', key: 'filterWantToTry' },
  { value: 'been', key: 'filterBeen' },
];

export function EatsClient({
  tripId,
  tz,
}: {
  tripId: string;
  tz: string;
  currency: string;
  locale?: string;
}) {
  const t = useTranslations('eats');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [online, setOnline] = useState(true);
  const [filter, setFilter] = useState<EatsStatusFilter>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, [tripId]);

  const load = useCallback(async () => {
    try {
      const [tripRes, restRes] = await Promise.all([
        fetch(withBase(`/api/trips/${tripId}`), { credentials: 'same-origin' }),
        fetch(withBase(`/api/trips/${tripId}/restaurants`), { credentials: 'same-origin' }),
      ]);
      if (!tripRes.ok || !restRes.ok) throw new Error('load failed');
      const { trip } = (await tripRes.json()) as { trip: TripLite };
      const { restaurants } = (await restRes.json()) as { restaurants: RestaurantDTO[] };
      if (mountedRef.current) setState({ status: 'loaded', data: { trip, restaurants } });
    } catch {
      if (mountedRef.current) setState({ status: 'error' });
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  const days: DerivedDay[] = useMemo(
    () => (state.status === 'loaded' ? deriveDays(state.data.trip, tz) : []),
    [state, tz],
  );

  if (state.status === 'loading') {
    return <p className="px-4 py-8 text-center text-body text-ink-muted">{t('loading')}</p>;
  }
  if (state.status === 'error') {
    return <EmptyState mascotAlt={t('title')} headline={t('errorHeadline')} subtext={t('errorSubtext')} />;
  }

  const { restaurants } = state.data;
  const visible = filterByStatus(restaurants, filter);
  const byId = (id: string | null) => restaurants.find((r) => r.id === id) ?? null;
  const detail = byId(detailId);
  const editing = byId(editId);

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-24 pt-2">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-title font-bold text-ink">{t('title')}</h1>
        <button
          type="button"
          disabled={!online}
          onClick={() => setAddOpen(true)}
          className="rounded-control bg-coral px-3 py-2 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
        >
          {t('addRestaurant')}
        </button>
      </div>

      <div role="group" className="mb-3 flex rounded-control bg-card p-0.5 shadow-inset">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`flex-1 rounded-control py-1.5 text-caption font-medium ${
              filter === f.value ? 'bg-coral text-white' : 'text-ink-muted'
            }`}
          >
            {t(f.key)}
          </button>
        ))}
      </div>

      {restaurants.length === 0 ? (
        <EmptyState
          mascotAlt={t('title')}
          headline={t('empty.headline')}
          subtext={t('empty.subtext')}
          actionLabel={online ? t('addRestaurant') : undefined}
          onAction={online ? () => setAddOpen(true) : undefined}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((r) => (
            <li key={r.id}>
              <RestaurantCard restaurant={r} onTap={(id) => setDetailId(id)} />
            </li>
          ))}
        </ul>
      )}

      <RestaurantFormSheet
        open={addOpen || editing !== null}
        tripId={tripId}
        restaurant={editing}
        disabled={!online}
        onClose={() => {
          setAddOpen(false);
          setEditId(null);
        }}
        onSaved={() => {
          setAddOpen(false);
          setEditId(null);
          void load();
        }}
      />

      {detail ? (
        <RestaurantDetailSheet
          open
          restaurant={detail}
          days={days}
          disabled={!online}
          onClose={() => setDetailId(null)}
          onChanged={() => {
            setDetailId(null);
            void load();
          }}
          onEdit={(id) => {
            setDetailId(null);
            setEditId(id);
          }}
        />
      ) : null}
    </main>
  );
}
```

- [ ] **Step 4: Run — expect PASS.**
`npm test -- components/eats/EatsClient.test.tsx`
Expect: "Expected: 6 passed".

- [ ] **Step 5: Commit.**
```
git add components/eats/EatsClient.tsx components/eats/EatsClient.test.tsx
git commit -m "C2.10: EatsClient (static-shell client-fetch, status filter, add/edit/detail sheets)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C2.11: replace the Eats page placeholder with the static shell

**Files:**
- Modify `app/trip/[tripId]/eats/page.tsx`
- Test `app/trip/[tripId]/eats/page.test.tsx`

Swap the `EmptyState` placeholder for a `force-static` shell rendering `EatsClient` with `tripId`/`tz`/`currency`/`locale="en"` — identical to `PlanPage` so the SW caches the document and it opens offline.

- [ ] **Step 1: Write the failing test.**

`app/trip/[tripId]/eats/page.test.tsx`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const eatsClientSpy = vi.fn();
vi.mock('@/components/eats/EatsClient', () => ({
  EatsClient: (props: Record<string, unknown>) => {
    eatsClientSpy(props);
    return <div data-testid="eats-client" />;
  },
}));

vi.mock('@/src/env', () => ({ env: { TZ: 'Asia/Tokyo', DEFAULT_CURRENCY: 'JPY' } }));

import EatsPage from './page';

describe('EatsPage', () => {
  it('renders EatsClient with tripId, tz, currency, and locale', async () => {
    const ui = await EatsPage({ params: Promise.resolve({ tripId: 't1' }) });
    render(ui);
    expect(screen.getByTestId('eats-client')).toBeInTheDocument();
    expect(eatsClientSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: 't1', tz: 'Asia/Tokyo', currency: 'JPY', locale: 'en' }),
    );
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
`npm test -- app/trip/[tripId]/eats/page.test.tsx`
Expect: `getByTestId('eats-client')` not found (page still renders the placeholder EmptyState).

- [ ] **Step 3: Minimal impl.** Replace the entire contents of `app/trip/[tripId]/eats/page.tsx`:
```tsx
import { env } from '@/src/env';
import { EatsClient } from '@/components/eats/EatsClient';

// Static app shell: no server DB read, no cookies() — so the SW caches the page
// document and it loads offline. EatsClient client-fetches /api/trips/:id and
// /api/trips/:id/restaurants and owns all interaction state. English-only locale
// matches i18n/request.ts. (spec §4.1 / §7.3)
export const dynamic = 'force-static';

export default async function EatsPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <EatsClient tripId={tripId} tz={env.TZ} currency={env.DEFAULT_CURRENCY} locale="en" />;
}
```

- [ ] **Step 4: Run — expect PASS.**
`npm test -- app/trip/[tripId]/eats/page.test.tsx`
Expect: "Expected: 1 passed".

- [ ] **Step 5: Full-suite guard + commit.**
Run the whole suite plus typecheck/lint to confirm nothing regressed (placeholder string `comingSoon.eats` is now unused but intentionally retained in en.json):
`npm test` then `npm run typecheck` (or `npx tsc --noEmit`) then `npm run lint`
Expect: all green.
```
git add app/trip/[tripId]/eats/page.tsx app/trip/[tripId]/eats/page.test.tsx
git commit -m "C2.11: replace Eats placeholder with static shell rendering EatsClient

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

Notes for the implementer (cross-cutting, all in-scope for this group):
- Absolute repo references confirmed against the codebase: pure repos at `src/db/repos/*.ts` use `type Db = TestDb['db']`, `newId()` from `@/src/db/ids`, `new Date(now())` from `@/src/lib/clock`; actions at `app/_actions/*.ts` are `'use server'` + zod + `revalidatePath`; read handlers at `app/api/trips/[tripId]/*/route.ts` are `force-dynamic` and tested with the `vi.mock('@/src/db/client', () => ({ get db() {...}, sqlite: {} }))` swap pattern.
- The SW data-cache rule for `/api/trips*` already matches `/api/trips/:id/restaurants`; no SW change is needed in this group (confirm in your C0/SW task if `app/sw.ts` was touched). Mutations stay online-only via the `disabled={!online}` prop threaded from `EatsClient`.
- This group depends on `restaurants` existing in `src/db/schema.ts` + a committed migration (group C0) and reuses `addPlace`/`deletePlace`/`getPlace` from `src/db/repos/places.ts` (the `'other'` category and auto `orderIndex` come for free). The `comingSoon.eats` key is intentionally left in `messages/en.json`.

---

I have a complete picture of the patterns. Let me check the `category` icon helper in planView and how PlaceCard renders it, so the expense category icon approach matches; plus a quick look at a repo test's category enum approach and the expenses repo expectation (must be created here). Let me also confirm the `cost` minor-unit input convention in the existing AddPlace UI (there's no cost keypad currently — the contract wants an amount keypad). I have enough. Let me draft the C3 task group now.

I have enough context. Drafting the C3 task group, matching the repo-pure pattern (`type Db = TestDb['db']`, `now()`/`newId()`), the action pattern (zod parse + `revalidatePath`), the read-handler DTO pattern, and the static-shell + client-fetch + `withBase` UI pattern. I'll have C3 own the `expenses` + `budgetTargets` repos (they don't exist yet and are scoped to this group's actions), extract pure budget-math helpers and TDD them, and replace the placeholder budget page.

---

### Task C3.1: `expenses` repo (pure db-first CRUD + list)

**Files:**
- Create `src/db/repos/expenses.ts`
- Test `src/db/repos/expenses.test.ts`
- (Assumes C0 already added the `expenses` table + `Expense`/`NewExpense` inferred types to `src/db/schema.ts` and a committed Drizzle migration. This task imports them.)

- [ ] **Step 1: Failing test** — create `src/db/repos/expenses.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places } from '@/src/db/schema';
import {
  listExpensesForTrip,
  getExpense,
  addExpense,
  updateExpense,
  deleteExpense,
} from '@/src/db/repos/expenses';

vi.mock('@/src/lib/clock', () => ({ now: () => 1_700_000_000_000 }));

const TS = new Date(1_700_000_000_000);
type Db = ReturnType<typeof makeTestDb>['db'];

function seedTrip(db: Db, id = 'trip-1') {
  db.insert(trips)
    .values({
      id,
      name: 'Osaka',
      startDate: '2026-06-05',
      endDate: '2026-06-07',
      coverPhoto: null,
      createdAt: TS,
      updatedAt: TS,
    })
    .run();
}

function seedPlace(db: Db, id: string, tripId = 'trip-1') {
  db.insert(places)
    .values({
      id,
      tripId,
      dayDate: null,
      googlePlaceId: null,
      name: 'Place',
      address: null,
      lat: null,
      lng: null,
      category: 'sightseeing',
      scheduledTime: null,
      durationMin: null,
      cost: null,
      notes: null,
      orderIndex: 0,
      createdAt: TS,
      updatedAt: TS,
    })
    .run();
}

describe('expenses repo', () => {
  let db: Db;
  beforeEach(() => {
    db = makeTestDb().db;
    seedTrip(db);
    seedTrip(db, 'trip-2');
  });

  it('adds an expense with generated id + timestamps and reads it back', () => {
    const e = addExpense(db, {
      tripId: 'trip-1',
      amount: 1530,
      category: 'food',
      spentOn: '2026-06-06',
      note: 'Ramen',
    });
    expect(e.id).toMatch(/[0-9a-f-]{36}/);
    expect(e.amount).toBe(1530);
    expect(e.category).toBe('food');
    expect(e.spentOn).toBe('2026-06-06');
    expect(e.linkedPlaceId).toBeNull();
    expect(e.createdAt).toEqual(TS);
    expect(getExpense(db, e.id)?.note).toBe('Ramen');
  });

  it('stores an optional linked place id', () => {
    seedPlace(db, 'p1');
    const e = addExpense(db, {
      tripId: 'trip-1',
      amount: 800,
      category: 'transport',
      spentOn: '2026-06-05',
      linkedPlaceId: 'p1',
    });
    expect(getExpense(db, e.id)?.linkedPlaceId).toBe('p1');
  });

  it('lists a trip\'s expenses newest spent_on first, never leaking other trips', () => {
    addExpense(db, { tripId: 'trip-1', amount: 100, category: 'food', spentOn: '2026-06-05' });
    addExpense(db, { tripId: 'trip-1', amount: 200, category: 'food', spentOn: '2026-06-07' });
    addExpense(db, { tripId: 'trip-2', amount: 999, category: 'food', spentOn: '2026-06-06' });
    const rows = listExpensesForTrip(db, 'trip-1');
    expect(rows.map((r) => r.amount)).toEqual([200, 100]);
  });

  it('patches an expense and bumps updatedAt; returns the row', () => {
    const e = addExpense(db, { tripId: 'trip-1', amount: 100, category: 'food', spentOn: '2026-06-05' });
    const updated = updateExpense(db, e.id, { amount: 250, category: 'shopping', note: 'Souvenir' });
    expect(updated?.amount).toBe(250);
    expect(updated?.category).toBe('shopping');
    expect(updated?.note).toBe('Souvenir');
  });

  it('deletes an expense', () => {
    const e = addExpense(db, { tripId: 'trip-1', amount: 100, category: 'food', spentOn: '2026-06-05' });
    deleteExpense(db, e.id);
    expect(getExpense(db, e.id)).toBeUndefined();
  });

  it('clears a linked place to NULL when the place is deleted (FK set null)', () => {
    seedPlace(db, 'p1');
    const e = addExpense(db, {
      tripId: 'trip-1',
      amount: 800,
      category: 'transport',
      spentOn: '2026-06-05',
      linkedPlaceId: 'p1',
    });
    db.delete(places).where((await import('drizzle-orm')).eq(places.id, 'p1')).run();
    expect(getExpense(db, e.id)?.linkedPlaceId).toBeNull();
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npm test -- src/db/repos/expenses.test.ts`. Expect FAIL (Cannot find module `@/src/db/repos/expenses`). If the final FK test's inline `await import` is awkward, replace it with a top-level `import { eq } from 'drizzle-orm';` and `db.delete(places).where(eq(places.id, 'p1')).run();` — keep that simpler form.

- [ ] **Step 3: Minimal impl** — create `src/db/repos/expenses.ts`:

```ts
import { and, desc, eq } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { expenses, type Expense } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';

export type { Expense };

type Db = TestDb['db'];

/** All expenses for a trip, newest spent_on first (ties broken by created_at desc). */
export function listExpensesForTrip(db: Db, tripId: string): Expense[] {
  return db
    .select()
    .from(expenses)
    .where(eq(expenses.tripId, tripId))
    .orderBy(desc(expenses.spentOn), desc(expenses.createdAt))
    .all();
}

/** One expense by id, or undefined. */
export function getExpense(db: Db, id: string): Expense | undefined {
  return db.select().from(expenses).where(eq(expenses.id, id)).get();
}

export interface AddExpenseInput {
  tripId: string;
  amount: number; // integer minor units
  category: Expense['category'];
  spentOn: string; // YYYY-MM-DD
  note?: string | null;
  linkedPlaceId?: string | null;
}

/** Insert an expense, generating id + timestamps. */
export function addExpense(db: Db, input: AddExpenseInput): Expense {
  const ts = new Date(now());
  const row: Expense = {
    id: newId(),
    tripId: input.tripId,
    amount: input.amount,
    category: input.category,
    spentOn: input.spentOn,
    note: input.note ?? null,
    linkedPlaceId: input.linkedPlaceId ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(expenses).values(row).run();
  return row;
}

/** Editable subset of an expense (never id/tripId/timestamps). */
export type ExpensePatch = Partial<
  Pick<Expense, 'amount' | 'category' | 'spentOn' | 'note' | 'linkedPlaceId'>
>;

/** Patch the provided fields; bumps updatedAt. Returns the row, or undefined. */
export function updateExpense(db: Db, id: string, patch: ExpensePatch): Expense | undefined {
  db.update(expenses)
    .set({ ...patch, updatedAt: new Date(now()) })
    .where(eq(expenses.id, id))
    .run();
  return getExpense(db, id);
}

/** Delete an expense. */
export function deleteExpense(db: Db, id: string): void {
  db.delete(expenses).where(eq(expenses.id, id)).run();
}

// `and` retained for future scoped queries; referenced here to satisfy lint if unused elsewhere.
void and;
```

(If `and` triggers an unused-import lint error, drop it from the import and remove the `void and;` line.)

- [ ] **Step 4: Run → PASS** — `npm test -- src/db/repos/expenses.test.ts`. Expect: ~6 passed.

- [ ] **Step 5: Commit** — `git add src/db/repos/expenses.ts src/db/repos/expenses.test.ts && git commit -m "C3.1: expenses repo (db-first CRUD + trip list)" --trailer "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C3.2: `budgetTargets` repo (upsert overall + per-category)

**Files:**
- Create `src/db/repos/budgetTargets.ts`
- Test `src/db/repos/budgetTargets.test.ts`
- (Assumes C0 added the `budget_targets` table — `id`, `trip_id` FK cascade, nullable `category`, `planned_amount` int, timestamps, with the unique index on `(trip_id, category)` per the contract — plus `BudgetTarget` inferred type to `src/db/schema.ts`.)

NOTE on the unique constraint: SQLite treats `NULL` as distinct in a normal `UNIQUE` index, so the contract's "treat null category as the overall target" cannot be enforced by a plain `uniqueIndex(trip_id, category)`. This repo therefore enforces overall-uniqueness in application code (read-then-insert-or-update) inside a transaction, exactly the way `settings.ensureSettings`/`updateSettings` enforce single-row semantics in app code.

- [ ] **Step 1: Failing test** — create `src/db/repos/budgetTargets.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips } from '@/src/db/schema';
import {
  listTargetsForTrip,
  setTarget,
  deleteTarget,
} from '@/src/db/repos/budgetTargets';

vi.mock('@/src/lib/clock', () => ({ now: () => 1_700_000_000_000 }));

const TS = new Date(1_700_000_000_000);
type Db = ReturnType<typeof makeTestDb>['db'];

function seedTrip(db: Db, id = 'trip-1') {
  db.insert(trips)
    .values({
      id,
      name: 'Osaka',
      startDate: '2026-06-05',
      endDate: '2026-06-07',
      coverPhoto: null,
      createdAt: TS,
      updatedAt: TS,
    })
    .run();
}

describe('budgetTargets repo', () => {
  let db: Db;
  beforeEach(() => {
    db = makeTestDb().db;
    seedTrip(db);
    seedTrip(db, 'trip-2');
  });

  it('sets an overall target (null category) and reads it back', () => {
    const t = setTarget(db, { tripId: 'trip-1', category: null, plannedAmount: 100000 });
    expect(t.category).toBeNull();
    expect(t.plannedAmount).toBe(100000);
    const rows = listTargetsForTrip(db, 'trip-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.category).toBeNull();
  });

  it('sets a per-category target', () => {
    setTarget(db, { tripId: 'trip-1', category: 'food', plannedAmount: 30000 });
    const rows = listTargetsForTrip(db, 'trip-1');
    expect(rows.find((r) => r.category === 'food')?.plannedAmount).toBe(30000);
  });

  it('upserts: re-setting the overall target updates in place (no duplicate row)', () => {
    setTarget(db, { tripId: 'trip-1', category: null, plannedAmount: 100000 });
    setTarget(db, { tripId: 'trip-1', category: null, plannedAmount: 120000 });
    const rows = listTargetsForTrip(db, 'trip-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.plannedAmount).toBe(120000);
  });

  it('upserts: re-setting a category target updates in place', () => {
    setTarget(db, { tripId: 'trip-1', category: 'food', plannedAmount: 30000 });
    setTarget(db, { tripId: 'trip-1', category: 'food', plannedAmount: 45000 });
    const rows = listTargetsForTrip(db, 'trip-1').filter((r) => r.category === 'food');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.plannedAmount).toBe(45000);
  });

  it('keeps overall + categories as distinct rows and scopes by trip', () => {
    setTarget(db, { tripId: 'trip-1', category: null, plannedAmount: 100000 });
    setTarget(db, { tripId: 'trip-1', category: 'food', plannedAmount: 30000 });
    setTarget(db, { tripId: 'trip-1', category: 'lodging', plannedAmount: 50000 });
    setTarget(db, { tripId: 'trip-2', category: null, plannedAmount: 999 });
    expect(listTargetsForTrip(db, 'trip-1')).toHaveLength(3);
    expect(listTargetsForTrip(db, 'trip-2')).toHaveLength(1);
  });

  it('deletes a category target by clearing to null amount semantics via deleteTarget', () => {
    setTarget(db, { tripId: 'trip-1', category: 'food', plannedAmount: 30000 });
    deleteTarget(db, 'trip-1', 'food');
    expect(listTargetsForTrip(db, 'trip-1').find((r) => r.category === 'food')).toBeUndefined();
  });

  it('deletes the overall target (null category)', () => {
    setTarget(db, { tripId: 'trip-1', category: null, plannedAmount: 100000 });
    deleteTarget(db, 'trip-1', null);
    expect(listTargetsForTrip(db, 'trip-1')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npm test -- src/db/repos/budgetTargets.test.ts`. Expect FAIL (Cannot find module `@/src/db/repos/budgetTargets`).

- [ ] **Step 3: Minimal impl** — create `src/db/repos/budgetTargets.ts`:

```ts
import { and, eq, isNull } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { budgetTargets, type BudgetTarget } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';

export type { BudgetTarget };

type Db = TestDb['db'];

/** A budget category, or null for the overall (whole-trip) target. */
export type TargetCategory = BudgetTarget['category'] | null;

/** All planned targets for a trip (overall row + per-category rows). */
export function listTargetsForTrip(db: Db, tripId: string): BudgetTarget[] {
  return db.select().from(budgetTargets).where(eq(budgetTargets.tripId, tripId)).all();
}

/** Where-clause matching a single (trip, category) target — null category = overall. */
function whereTarget(tripId: string, category: TargetCategory) {
  return category === null
    ? and(eq(budgetTargets.tripId, tripId), isNull(budgetTargets.category))
    : and(eq(budgetTargets.tripId, tripId), eq(budgetTargets.category, category));
}

/** The existing target for (trip, category), or undefined. */
function getTarget(db: Db, tripId: string, category: TargetCategory): BudgetTarget | undefined {
  return db.select().from(budgetTargets).where(whereTarget(tripId, category)).get();
}

export interface SetTargetInput {
  tripId: string;
  category: TargetCategory; // null = overall
  plannedAmount: number; // integer minor units
}

/**
 * Upsert the planned target for (trip, category). null category = overall.
 * Read-then-insert-or-update inside a transaction so the overall row stays
 * unique even though SQLite's UNIQUE index treats NULL category as distinct.
 */
export function setTarget(db: Db, input: SetTargetInput): BudgetTarget {
  return db.transaction((tx) => {
    const txDb = tx as unknown as Db;
    const ts = new Date(now());
    const existing = getTarget(txDb, input.tripId, input.category);
    if (existing) {
      txDb
        .update(budgetTargets)
        .set({ plannedAmount: input.plannedAmount, updatedAt: ts })
        .where(eq(budgetTargets.id, existing.id))
        .run();
      return getTarget(txDb, input.tripId, input.category) as BudgetTarget;
    }
    const row: BudgetTarget = {
      id: newId(),
      tripId: input.tripId,
      category: input.category,
      plannedAmount: input.plannedAmount,
      createdAt: ts,
      updatedAt: ts,
    };
    txDb.insert(budgetTargets).values(row).run();
    return row;
  });
}

/** Remove the target for (trip, category). null category = overall. No-op if absent. */
export function deleteTarget(db: Db, tripId: string, category: TargetCategory): void {
  db.delete(budgetTargets).where(whereTarget(tripId, category)).run();
}
```

- [ ] **Step 4: Run → PASS** — `npm test -- src/db/repos/budgetTargets.test.ts`. Expect: ~7 passed.

- [ ] **Step 5: Commit** — `git add src/db/repos/budgetTargets.ts src/db/repos/budgetTargets.test.ts && git commit -m "C3.2: budgetTargets repo (upsert overall + per-category)" --trailer "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C3.3: pure budget-math helper (`src/lib/budgetView.ts`)

**Files:**
- Create `src/lib/budgetView.ts`
- Test `src/lib/budgetView.test.ts`

This is the planned-vs-actual derivation the BudgetClient renders: per-category spent, the target lookup, remaining, over/under, percent, and the overall roll-up. Pure functions over plain DTOs — no DB, no React.

- [ ] **Step 1: Failing test** — create `src/lib/budgetView.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  BUDGET_CATEGORIES,
  type ExpenseLite,
  type TargetLite,
  spentByCategory,
  totalSpent,
  targetMap,
  buildCategoryBudgets,
  buildOverallBudget,
  groupByDate,
  clampPercent,
} from '@/src/lib/budgetView';

const expenses: ExpenseLite[] = [
  { id: 'e1', amount: 1000, category: 'food', spentOn: '2026-06-06', note: 'Ramen', linkedPlaceId: null },
  { id: 'e2', amount: 500, category: 'food', spentOn: '2026-06-05', note: null, linkedPlaceId: 'p1' },
  { id: 'e3', amount: 2000, category: 'lodging', spentOn: '2026-06-05', note: null, linkedPlaceId: null },
  { id: 'e4', amount: 300, category: 'transport', spentOn: '2026-06-06', note: null, linkedPlaceId: null },
];

const targets: TargetLite[] = [
  { category: null, plannedAmount: 10000 },
  { category: 'food', plannedAmount: 2000 },
  { category: 'lodging', plannedAmount: 1500 },
];

describe('budgetView', () => {
  it('exposes the six categories in stable order', () => {
    expect(BUDGET_CATEGORIES).toEqual([
      'food', 'lodging', 'transport', 'activities', 'shopping', 'other',
    ]);
  });

  it('sums spent per category, zero for untouched categories', () => {
    const s = spentByCategory(expenses);
    expect(s.food).toBe(1500);
    expect(s.lodging).toBe(2000);
    expect(s.transport).toBe(300);
    expect(s.activities).toBe(0);
    expect(s.shopping).toBe(0);
    expect(s.other).toBe(0);
  });

  it('totals all spending', () => {
    expect(totalSpent(expenses)).toBe(3800);
  });

  it('maps targets, with null = overall', () => {
    const m = targetMap(targets);
    expect(m.overall).toBe(10000);
    expect(m.food).toBe(2000);
    expect(m.lodging).toBe(1500);
    expect(m.transport).toBeNull();
  });

  it('builds per-category rows: spent, planned, remaining, over flag, percent', () => {
    const rows = buildCategoryBudgets(expenses, targets);
    const food = rows.find((r) => r.category === 'food')!;
    expect(food.spent).toBe(1500);
    expect(food.planned).toBe(2000);
    expect(food.remaining).toBe(500);
    expect(food.over).toBe(false);
    expect(food.percent).toBe(75);

    const lodging = rows.find((r) => r.category === 'lodging')!;
    expect(lodging.spent).toBe(2000);
    expect(lodging.planned).toBe(1500);
    expect(lodging.remaining).toBe(-500); // over budget
    expect(lodging.over).toBe(true);

    const transport = rows.find((r) => r.category === 'transport')!;
    expect(transport.planned).toBeNull(); // no target set
    expect(transport.remaining).toBeNull();
    expect(transport.over).toBe(false);
    expect(transport.percent).toBeNull();
  });

  it('builds the overall roll-up vs the overall target', () => {
    const o = buildOverallBudget(expenses, targets);
    expect(o.spent).toBe(3800);
    expect(o.planned).toBe(10000);
    expect(o.remaining).toBe(6200);
    expect(o.over).toBe(false);
    expect(o.percent).toBe(38);
  });

  it('overall with no target leaves planned/remaining/percent null', () => {
    const o = buildOverallBudget(expenses, []);
    expect(o.spent).toBe(3800);
    expect(o.planned).toBeNull();
    expect(o.remaining).toBeNull();
    expect(o.percent).toBeNull();
  });

  it('groups expenses by spent_on date, newest date first', () => {
    const groups = groupByDate(expenses);
    expect(groups.map((g) => g.date)).toEqual(['2026-06-06', '2026-06-05']);
    expect(groups[0]!.total).toBe(1300); // e1 1000 + e4 300
    expect(groups[1]!.items.map((i) => i.id)).toEqual(['e2', 'e3']);
  });

  it('clampPercent floors at 0 and caps display at 100 even when over', () => {
    expect(clampPercent(50)).toBe(50);
    expect(clampPercent(150)).toBe(100);
    expect(clampPercent(-3)).toBe(0);
    expect(clampPercent(null)).toBe(0);
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npm test -- src/lib/budgetView.test.ts`. Expect FAIL (Cannot find module `@/src/lib/budgetView`).

- [ ] **Step 3: Minimal impl** — create `src/lib/budgetView.ts`:

```ts
/**
 * Pure planned-vs-actual budget math (Plan 2 §4.2). Operates on plain DTOs so
 * the BudgetClient and tests share one source of truth. Money is integer minor
 * units throughout; rendering to a localized string is the caller's job
 * (currency.formatMoney). `percent` is an integer 0..n (can exceed 100 when
 * over budget); use clampPercent for progress-bar widths.
 */

export const BUDGET_CATEGORIES = [
  'food',
  'lodging',
  'transport',
  'activities',
  'shopping',
  'other',
] as const;

export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export interface ExpenseLite {
  id: string;
  amount: number;
  category: BudgetCategory;
  spentOn: string; // YYYY-MM-DD
  note: string | null;
  linkedPlaceId: string | null;
}

export interface TargetLite {
  category: BudgetCategory | null; // null = overall
  plannedAmount: number;
}

export type SpentMap = Record<BudgetCategory, number>;

/** Spent per category; every category present (0 when untouched). */
export function spentByCategory(expenses: ExpenseLite[]): SpentMap {
  const map = Object.fromEntries(BUDGET_CATEGORIES.map((c) => [c, 0])) as SpentMap;
  for (const e of expenses) map[e.category] += e.amount;
  return map;
}

/** Grand total of all spending. */
export function totalSpent(expenses: ExpenseLite[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

export interface TargetLookup {
  overall: number | null;
  food: number | null;
  lodging: number | null;
  transport: number | null;
  activities: number | null;
  shopping: number | null;
  other: number | null;
}

/** Look up planned amounts; null category → overall; missing → null. */
export function targetMap(targets: TargetLite[]): TargetLookup {
  const base: TargetLookup = {
    overall: null,
    food: null,
    lodging: null,
    transport: null,
    activities: null,
    shopping: null,
    other: null,
  };
  for (const t of targets) {
    const key = t.category ?? 'overall';
    base[key] = t.plannedAmount;
  }
  return base;
}

export interface BudgetRow {
  /** A category, or 'overall' for the roll-up. */
  category: BudgetCategory | 'overall';
  spent: number;
  planned: number | null;
  remaining: number | null; // planned - spent; negative = over
  over: boolean; // planned != null && spent > planned
  percent: number | null; // round(spent/planned*100); null when no target
}

function buildRow(
  category: BudgetCategory | 'overall',
  spent: number,
  planned: number | null,
): BudgetRow {
  if (planned === null || planned <= 0) {
    return {
      category,
      spent,
      planned,
      remaining: planned === null ? null : planned - spent,
      over: planned !== null && spent > planned,
      percent: null,
    };
  }
  return {
    category,
    spent,
    planned,
    remaining: planned - spent,
    over: spent > planned,
    percent: Math.round((spent / planned) * 100),
  };
}

/** One row per category (stable order) with planned-vs-actual derivations. */
export function buildCategoryBudgets(
  expenses: ExpenseLite[],
  targets: TargetLite[],
): BudgetRow[] {
  const spent = spentByCategory(expenses);
  const tm = targetMap(targets);
  return BUDGET_CATEGORIES.map((c) => buildRow(c, spent[c], tm[c]));
}

/** The whole-trip roll-up vs the overall target. */
export function buildOverallBudget(
  expenses: ExpenseLite[],
  targets: TargetLite[],
): BudgetRow {
  return buildRow('overall', totalSpent(expenses), targetMap(targets).overall);
}

export interface DateGroup {
  date: string; // YYYY-MM-DD
  total: number;
  items: ExpenseLite[];
}

/**
 * Group expenses by spent_on, newest date first. Items inside a date keep the
 * incoming order (the read handler returns spent_on desc, created_at desc).
 */
export function groupByDate(expenses: ExpenseLite[]): DateGroup[] {
  const byDate = new Map<string, ExpenseLite[]>();
  for (const e of expenses) {
    const list = byDate.get(e.spentOn);
    if (list) list.push(e);
    else byDate.set(e.spentOn, [e]);
  }
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([date, items]) => ({
      date,
      total: items.reduce((s, i) => s + i.amount, 0),
      items,
    }));
}

/** Progress-bar width: clamp a percent to 0..100, null → 0. */
export function clampPercent(percent: number | null): number {
  if (percent === null) return 0;
  return Math.max(0, Math.min(100, percent));
}
```

- [ ] **Step 4: Run → PASS** — `npm test -- src/lib/budgetView.test.ts`. Expect: ~9 passed.

- [ ] **Step 5: Commit** — `git add src/lib/budgetView.ts src/lib/budgetView.test.ts && git commit -m "C3.3: pure budgetView planned-vs-actual helper" --trailer "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C3.4: expenses Server Actions (`app/_actions/expenses.ts`)

**Files:**
- Create `app/_actions/expenses.ts`
- Test `app/_actions/expenses.test.ts`

Matches the `places.ts` action shape: `'use server'`, zod parse, repo call, `revalidatePath('/trip/:id/budget')`. Mutations are online-only at the UI layer (the action itself is a normal server function).

- [ ] **Step 1: Failing test** — create `app/_actions/expenses.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
}));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

import {
  addExpenseAction,
  updateExpenseAction,
  deleteExpenseAction,
} from '@/app/_actions/expenses';
import { getExpense, listExpensesForTrip } from '@/src/db/repos/expenses';

const TS = new Date('2026-06-08T12:00:00.000Z');

function seed(db: ReturnType<typeof makeTestDb>['db']) {
  db.insert(trips).values({
    id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
}

describe('expense actions', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
    revalidatePath.mockClear();
  });

  it('adds an expense and revalidates the budget path', async () => {
    const e = await addExpenseAction({
      tripId: 'trip-1',
      amount: 1530,
      category: 'food',
      spentOn: '2026-06-06',
      note: 'Ramen',
    });
    expect(e.amount).toBe(1530);
    expect(getExpense(testHandle.db, e.id)?.category).toBe('food');
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/budget');
  });

  it('rejects a non-integer or negative amount', async () => {
    await expect(
      addExpenseAction({ tripId: 'trip-1', amount: 12.5, category: 'food', spentOn: '2026-06-06' }),
    ).rejects.toThrow();
    await expect(
      addExpenseAction({ tripId: 'trip-1', amount: -1, category: 'food', spentOn: '2026-06-06' }),
    ).rejects.toThrow();
  });

  it('rejects a bad category and a bad date', async () => {
    await expect(
      // @ts-expect-error invalid category
      addExpenseAction({ tripId: 'trip-1', amount: 100, category: 'sightseeing', spentOn: '2026-06-06' }),
    ).rejects.toThrow();
    await expect(
      addExpenseAction({ tripId: 'trip-1', amount: 100, category: 'food', spentOn: '06/06/2026' }),
    ).rejects.toThrow();
  });

  it('updates an expense and revalidates', async () => {
    const e = await addExpenseAction({ tripId: 'trip-1', amount: 100, category: 'food', spentOn: '2026-06-05' });
    revalidatePath.mockClear();
    const updated = await updateExpenseAction(e.id, { amount: 250, category: 'shopping' });
    expect(updated.amount).toBe(250);
    expect(updated.category).toBe('shopping');
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/budget');
  });

  it('throws when updating a missing expense', async () => {
    await expect(updateExpenseAction('nope', { amount: 1 })).rejects.toThrow('Expense not found');
  });

  it('deletes an expense and revalidates', async () => {
    const e = await addExpenseAction({ tripId: 'trip-1', amount: 100, category: 'food', spentOn: '2026-06-05' });
    revalidatePath.mockClear();
    await deleteExpenseAction(e.id);
    expect(listExpensesForTrip(testHandle.db, 'trip-1')).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/budget');
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npm test -- app/_actions/expenses.test.ts`. Expect FAIL (Cannot find module `@/app/_actions/expenses`).

- [ ] **Step 3: Minimal impl** — create `app/_actions/expenses.ts`:

```ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import {
  addExpense,
  updateExpense,
  deleteExpense,
  getExpense,
  type Expense,
} from '@/src/db/repos/expenses';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const amount = z.number().int('Amount must be whole minor units').nonnegative();
const category = z.enum([
  'food', 'lodging', 'transport', 'activities', 'shopping', 'other',
]);

function revalidateBudget(tripId: string): void {
  revalidatePath(`/trip/${tripId}/budget`);
}

// --- addExpenseAction -----------------------------------------------------

const addSchema = z.object({
  tripId: z.string().min(1),
  amount,
  category,
  spentOn: dateStr,
  note: z.string().max(2000).nullish(),
  linkedPlaceId: z.string().min(1).nullish(),
});

export type AddExpenseActionInput = z.input<typeof addSchema>;

export async function addExpenseAction(input: AddExpenseActionInput): Promise<Expense> {
  const data = addSchema.parse(input);
  const expense = addExpense(db, {
    tripId: data.tripId,
    amount: data.amount,
    category: data.category,
    spentOn: data.spentOn,
    note: data.note ?? null,
    linkedPlaceId: data.linkedPlaceId ?? null,
  });
  revalidateBudget(data.tripId);
  return expense;
}

// --- updateExpenseAction --------------------------------------------------

const updateSchema = z.object({
  amount: amount.optional(),
  category: category.optional(),
  spentOn: dateStr.optional(),
  note: z.string().max(2000).nullish(),
  linkedPlaceId: z.string().min(1).nullish(),
});

export type UpdateExpenseActionPatch = z.input<typeof updateSchema>;

export async function updateExpenseAction(
  id: string,
  patch: UpdateExpenseActionPatch,
): Promise<Expense> {
  const existing = getExpense(db, id);
  if (!existing) throw new Error('Expense not found');
  const data = updateSchema.parse(patch);
  const updated = updateExpense(db, id, data);
  if (!updated) throw new Error('Expense not found');
  revalidateBudget(existing.tripId);
  return updated;
}

// --- deleteExpenseAction --------------------------------------------------

export async function deleteExpenseAction(id: string): Promise<void> {
  const existing = getExpense(db, id);
  if (!existing) throw new Error('Expense not found');
  deleteExpense(db, id);
  revalidateBudget(existing.tripId);
}
```

- [ ] **Step 4: Run → PASS** — `npm test -- app/_actions/expenses.test.ts`. Expect: ~6 passed.

- [ ] **Step 5: Commit** — `git add app/_actions/expenses.ts app/_actions/expenses.test.ts && git commit -m "C3.4: expense Server Actions (add/update/delete)" --trailer "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C3.5: budget-target Server Action (`app/_actions/budgetTargets.ts`)

**Files:**
- Create `app/_actions/budgetTargets.ts`
- Test `app/_actions/budgetTargets.test.ts`

`setTargetAction` upserts the overall target (null category) or a per-category target; `clearTargetAction` removes one. Passing `plannedAmount: 0` for a category is allowed but the UI uses `clearTargetAction` to remove a target entirely.

- [ ] **Step 1: Failing test** — create `app/_actions/budgetTargets.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
}));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

import { setTargetAction, clearTargetAction } from '@/app/_actions/budgetTargets';
import { listTargetsForTrip } from '@/src/db/repos/budgetTargets';

const TS = new Date('2026-06-08T12:00:00.000Z');

function seed(db: ReturnType<typeof makeTestDb>['db']) {
  db.insert(trips).values({
    id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
}

describe('budget target actions', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
    revalidatePath.mockClear();
  });

  it('sets the overall target (null category) and revalidates', async () => {
    const t = await setTargetAction({ tripId: 'trip-1', category: null, plannedAmount: 100000 });
    expect(t.category).toBeNull();
    expect(t.plannedAmount).toBe(100000);
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/budget');
  });

  it('sets a per-category target', async () => {
    const t = await setTargetAction({ tripId: 'trip-1', category: 'food', plannedAmount: 30000 });
    expect(t.category).toBe('food');
    expect(listTargetsForTrip(testHandle.db, 'trip-1')).toHaveLength(1);
  });

  it('upserts the same (trip, category) in place', async () => {
    await setTargetAction({ tripId: 'trip-1', category: null, plannedAmount: 100000 });
    await setTargetAction({ tripId: 'trip-1', category: null, plannedAmount: 120000 });
    const rows = listTargetsForTrip(testHandle.db, 'trip-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.plannedAmount).toBe(120000);
  });

  it('rejects a negative or non-integer planned amount', async () => {
    await expect(
      setTargetAction({ tripId: 'trip-1', category: null, plannedAmount: -5 }),
    ).rejects.toThrow();
    await expect(
      setTargetAction({ tripId: 'trip-1', category: 'food', plannedAmount: 1.5 }),
    ).rejects.toThrow();
  });

  it('rejects a bad category', async () => {
    await expect(
      // @ts-expect-error invalid category
      setTargetAction({ tripId: 'trip-1', category: 'sightseeing', plannedAmount: 100 }),
    ).rejects.toThrow();
  });

  it('clears a category target and revalidates', async () => {
    await setTargetAction({ tripId: 'trip-1', category: 'food', plannedAmount: 30000 });
    revalidatePath.mockClear();
    await clearTargetAction('trip-1', 'food');
    expect(listTargetsForTrip(testHandle.db, 'trip-1')).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/budget');
  });

  it('clears the overall target (null category)', async () => {
    await setTargetAction({ tripId: 'trip-1', category: null, plannedAmount: 100000 });
    await clearTargetAction('trip-1', null);
    expect(listTargetsForTrip(testHandle.db, 'trip-1')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npm test -- app/_actions/budgetTargets.test.ts`. Expect FAIL (Cannot find module `@/app/_actions/budgetTargets`).

- [ ] **Step 3: Minimal impl** — create `app/_actions/budgetTargets.ts`:

```ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import {
  setTarget,
  deleteTarget,
  type BudgetTarget,
  type TargetCategory,
} from '@/src/db/repos/budgetTargets';

const category = z.enum([
  'food', 'lodging', 'transport', 'activities', 'shopping', 'other',
]);
// null = the overall (whole-trip) target.
const targetCategory = category.nullable();

function revalidateBudget(tripId: string): void {
  revalidatePath(`/trip/${tripId}/budget`);
}

// --- setTargetAction ------------------------------------------------------

const setSchema = z.object({
  tripId: z.string().min(1),
  category: targetCategory,
  plannedAmount: z.number().int('Planned amount must be whole minor units').nonnegative(),
});

export type SetTargetActionInput = z.input<typeof setSchema>;

export async function setTargetAction(input: SetTargetActionInput): Promise<BudgetTarget> {
  const data = setSchema.parse(input);
  const target = setTarget(db, {
    tripId: data.tripId,
    category: data.category,
    plannedAmount: data.plannedAmount,
  });
  revalidateBudget(data.tripId);
  return target;
}

// --- clearTargetAction ----------------------------------------------------

export async function clearTargetAction(
  tripId: string,
  category: TargetCategory,
): Promise<void> {
  const parsedTrip = z.string().min(1).parse(tripId);
  const parsedCategory = targetCategory.parse(category);
  deleteTarget(db, parsedTrip, parsedCategory);
  revalidateBudget(parsedTrip);
}
```

- [ ] **Step 4: Run → PASS** — `npm test -- app/_actions/budgetTargets.test.ts`. Expect: ~7 passed.

- [ ] **Step 5: Commit** — `git add app/_actions/budgetTargets.ts app/_actions/budgetTargets.test.ts && git commit -m "C3.5: budget target Server Action (set overall + per-category, clear)" --trailer "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C3.6: read handler `GET /api/trips/[tripId]/budget` → `{ expenses, targets }`

**Files:**
- Create `app/api/trips/[tripId]/budget/route.ts`
- Test `app/api/trips/[tripId]/budget/route.test.ts`

Mirrors `app/api/trips/[tripId]/places/route.ts`: `force-dynamic`, 404 when the trip is missing, otherwise the two lists. Expenses carry a resolved `placeName` (batch-fetched, no N+1) for the linked-place chip. This path is under `/api/trips`, so the SW `data` matcher (`url.pathname.startsWith('${base}/api/trips')`) already SWR-caches it — confirmed in the SW step below.

- [ ] **Step 1: Failing test** — create `app/api/trips/[tripId]/budget/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places } from '@/src/db/schema';
import { addExpense } from '@/src/db/repos/expenses';
import { setTarget } from '@/src/db/repos/budgetTargets';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));

import { GET } from '@/app/api/trips/[tripId]/budget/route';

const TS = new Date('2026-06-08T12:00:00.000Z');

function seed(db: ReturnType<typeof makeTestDb>['db']) {
  db.insert(trips).values({
    id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(places).values({
    id: 'p1', tripId: 'trip-1', dayDate: null, googlePlaceId: null,
    name: 'Ichiran', address: null, lat: null, lng: null, category: 'other',
    scheduledTime: null, durationMin: null, cost: null, notes: null,
    orderIndex: 0, createdAt: TS, updatedAt: TS,
  }).run();
}

function ctx(tripId: string) {
  return { params: Promise.resolve({ tripId }) };
}

describe('GET /api/trips/[tripId]/budget', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
  });

  it('returns 404 for an unknown trip', async () => {
    const res = await GET(new Request('http://t/'), ctx('nope'));
    expect(res.status).toBe(404);
  });

  it('returns expenses (with linked place name) and targets', async () => {
    addExpense(testHandle.db, {
      tripId: 'trip-1', amount: 1500, category: 'food', spentOn: '2026-06-06', note: 'Ramen', linkedPlaceId: 'p1',
    });
    addExpense(testHandle.db, {
      tripId: 'trip-1', amount: 2000, category: 'lodging', spentOn: '2026-06-05',
    });
    setTarget(testHandle.db, { tripId: 'trip-1', category: null, plannedAmount: 100000 });
    setTarget(testHandle.db, { tripId: 'trip-1', category: 'food', plannedAmount: 30000 });

    const res = await GET(new Request('http://t/'), ctx('trip-1'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      expenses: Array<{ id: string; amount: number; spentOn: string; placeName: string | null }>;
      targets: Array<{ category: string | null; plannedAmount: number }>;
    };
    // newest spent_on first
    expect(body.expenses.map((e) => e.spentOn)).toEqual(['2026-06-06', '2026-06-05']);
    expect(body.expenses[0]!.placeName).toBe('Ichiran');
    expect(body.expenses[1]!.placeName).toBeNull();
    expect(body.targets).toHaveLength(2);
    expect(body.targets.find((t) => t.category === null)?.plannedAmount).toBe(100000);
  });

  it('returns empty arrays for a trip with no budget data', async () => {
    const res = await GET(new Request('http://t/'), ctx('trip-1'));
    const body = (await res.json()) as { expenses: unknown[]; targets: unknown[] };
    expect(body.expenses).toEqual([]);
    expect(body.targets).toEqual([]);
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npm test -- "app/api/trips/[tripId]/budget/route.test.ts"`. Expect FAIL (Cannot find module the route).

- [ ] **Step 3: Minimal impl** — create `app/api/trips/[tripId]/budget/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { listExpensesForTrip } from '@/src/db/repos/expenses';
import { listTargetsForTrip } from '@/src/db/repos/budgetTargets';
import { places, type Expense, type BudgetTarget } from '@/src/db/schema';

export const dynamic = 'force-dynamic';

/** ExpenseDTO: all Expense fields + the linked place's name (or null). */
export interface ExpenseDTO extends Expense {
  placeName: string | null;
}

export type TargetDTO = BudgetTarget;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  const trip = getTrip(db, tripId);
  if (!trip) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const rawExpenses = listExpensesForTrip(db, tripId);

  // Batch-resolve linked place names in one query (avoid N+1).
  const placeIds = rawExpenses
    .map((e) => e.linkedPlaceId)
    .filter((id): id is string => id !== null);

  const nameMap = new Map<string, string>();
  if (placeIds.length > 0) {
    const rows = db
      .select({ id: places.id, name: places.name })
      .from(places)
      .where(inArray(places.id, placeIds))
      .all();
    for (const row of rows) nameMap.set(row.id, row.name);
  }

  const expenses: ExpenseDTO[] = rawExpenses.map((e) => ({
    ...e,
    placeName: e.linkedPlaceId ? (nameMap.get(e.linkedPlaceId) ?? null) : null,
  }));

  const targets: TargetDTO[] = listTargetsForTrip(db, tripId);

  return NextResponse.json({ expenses, targets });
}
```

- [ ] **Step 4: Run → PASS** — `npm test -- "app/api/trips/[tripId]/budget/route.test.ts"`. Expect: ~3 passed.

- [ ] **Step 5: Commit** — `git add "app/api/trips/[tripId]/budget" && git commit -m "C3.6: GET /api/trips/:id/budget read handler (expenses + targets)" --trailer "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C3.7: SW data-cache coverage assertion for the budget route

**Files:**
- Modify `app/sw.test.ts` (the existing SW matcher test — add a case)

The budget route is under `/api/trips`, so the existing `data` StaleWhileRevalidate matcher already covers it. We do not change `sw.ts`; we add a regression test pinning that behavior so a future matcher refactor cannot silently drop budget offline reads.

- [ ] **Step 1: Failing test** — locate the existing `data` matcher describe block in `app/sw.test.ts` (it already tests `/api/trips` and `/api/settings`). Add this assertion inside that block (use the same `base`/matcher-lookup helpers the file already defines; the snippet below assumes a `dataMatcher` accessor consistent with the existing tests — match the file's actual helper names):

```ts
  it('SWR-caches the budget read handler (covered by the /api/trips prefix)', () => {
    const url = new URL('http://localhost/api/trips/trip-1/budget');
    expect(dataMatcher({ url } as never)).toBe(true);
  });
```

- [ ] **Step 2: Run → FAIL or PASS triage** — `npm test -- app/sw.test.ts`. If `dataMatcher` is not the helper name used in this file, the test fails to compile — open the file, copy its exact matcher-extraction idiom (the same one the existing `/api/trips` assertion uses), and rewrite the new case to match. The assertion itself MUST pass against the unchanged `sw.ts` (the prefix already matches), so the only valid failure here is a helper-name mismatch to be reconciled.

- [ ] **Step 3: Run → PASS** — `npm test -- app/sw.test.ts`. Expect: all SW matcher tests pass including the new budget case.

- [ ] **Step 4: Commit** — `git add app/sw.test.ts && git commit -m "C3.7: assert SW data cache covers the budget read handler" --trailer "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C3.8: en.json strings for the Budget tab

**Files:**
- Modify `messages/en.json`

Add a `budget` namespace (and leave the `comingSoon.budget`/`tabs.budget` keys untouched — they still feed the tab bar / other placeholders). Every visible BudgetClient string lives here.

- [ ] **Step 1: Failing test** — create `messages/budget.keys.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import en from '@/messages/en.json';

describe('en.json budget namespace', () => {
  const required = [
    'loading', 'errorHeadline', 'errorSubtext',
    'summaryTitle', 'overall', 'spentOfPlanned', 'remaining', 'overBudget', 'noTarget',
    'byCategory', 'byDay', 'setBudget', 'editBudget',
    'addExpense', 'editExpense', 'amountLabel', 'categoryLabel', 'dateLabel',
    'noteLabel', 'linkPlaceLabel', 'noLinkedPlace', 'save', 'cancel', 'delete',
    'emptyHeadline', 'emptySubtext',
    'offlineHint', 'saveFailed', 'mutationFailed',
    'overallPlannedLabel', 'categoryPlannedLabel', 'clearTarget', 'dayTotal',
  ];
  const cats = ['food', 'lodging', 'transport', 'activities', 'shopping', 'other'];

  it('defines every budget UI key', () => {
    const b = (en as Record<string, Record<string, unknown>>).budget;
    expect(b).toBeDefined();
    for (const k of required) expect(b[k], `budget.${k}`).toBeTypeOf('string');
  });

  it('defines a label for every budget category', () => {
    const c = (en as Record<string, Record<string, Record<string, unknown>>>).budget.categories;
    expect(c).toBeDefined();
    for (const k of cats) expect(c[k], `budget.categories.${k}`).toBeTypeOf('string');
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npm test -- messages/budget.keys.test.ts`. Expect FAIL (`budget` undefined). If importing JSON errors under the TS config, add `with { type: 'json' }` to match how other tests import `en.json` (grep the repo for an existing `messages/en.json` import and copy its exact import form).

- [ ] **Step 3: Minimal impl** — add the `budget` object to `messages/en.json`. Insert it immediately after the existing `comingSoon` block (sibling of `plan`, `settings`, etc.; mind the trailing comma on the preceding block):

```json
  "budget": {
    "loading": "Loading your budget…",
    "errorHeadline": "Couldn't load this budget",
    "errorSubtext": "Connect to the internet and try again.",
    "summaryTitle": "Budget",
    "overall": "Overall",
    "spentOfPlanned": "{spent} of {planned}",
    "remaining": "{amount} left",
    "overBudget": "{amount} over",
    "noTarget": "No budget set",
    "byCategory": "By category",
    "byDay": "By day",
    "setBudget": "Set budget",
    "editBudget": "Edit budget",
    "addExpense": "Add expense",
    "editExpense": "Edit expense",
    "amountLabel": "Amount",
    "categoryLabel": "Category",
    "dateLabel": "Date",
    "noteLabel": "Note",
    "linkPlaceLabel": "Link a place",
    "noLinkedPlace": "None",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "emptyHeadline": "No expenses yet",
    "emptySubtext": "Tap Add expense to start tracking what you spend.",
    "offlineHint": "Connect to the internet to make changes.",
    "saveFailed": "Couldn't save — please try again.",
    "mutationFailed": "Something went wrong — please try again.",
    "overallPlannedLabel": "Overall budget",
    "categoryPlannedLabel": "{category} budget",
    "clearTarget": "Clear",
    "dayTotal": "{amount}",
    "categories": {
      "food": "Food",
      "lodging": "Lodging",
      "transport": "Transport",
      "activities": "Activities",
      "shopping": "Shopping",
      "other": "Other"
    }
  },
```

- [ ] **Step 4: Run → PASS** — `npm test -- messages/budget.keys.test.ts`. Expect: 2 passed. Also confirm JSON validity: `node -e "require('./messages/en.json')"` exits 0.

- [ ] **Step 5: Commit** — `git add messages/en.json messages/budget.keys.test.ts && git commit -m "C3.8: en.json strings for the Budget tab" --trailer "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C3.9: `BudgetSummary` presentational component (progress bars, planned vs actual)

**Files:**
- Create `components/budget/BudgetSummary.tsx`
- Test `components/budget/BudgetSummary.test.tsx`

Pure presentational: takes the already-derived `BudgetRow[]` + overall row, renders the overall progress block and per-category bars, using `formatMoney` for every amount. No fetch, no actions — keeps the client component thin and the render logic testable.

- [ ] **Step 1: Failing test** — create `components/budget/BudgetSummary.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import { BudgetSummary } from '@/components/budget/BudgetSummary';
import type { BudgetRow } from '@/src/lib/budgetView';

function renderWith(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en as never}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const overall: BudgetRow = {
  category: 'overall', spent: 3800, planned: 10000, remaining: 6200, over: false, percent: 38,
};
const rows: BudgetRow[] = [
  { category: 'food', spent: 1500, planned: 2000, remaining: 500, over: false, percent: 75 },
  { category: 'lodging', spent: 2000, planned: 1500, remaining: -500, over: true, percent: 133 },
  { category: 'transport', spent: 300, planned: null, remaining: null, over: false, percent: null },
];

describe('BudgetSummary', () => {
  it('renders the overall block with spent of planned and remaining', () => {
    renderWith(
      <BudgetSummary overall={overall} categories={rows} currency="USD" locale="en" onSetBudget={vi.fn()} />,
    );
    expect(screen.getByText(en.budget.overall)).toBeInTheDocument();
    // formatMoney(3800,'USD') = $38.00 ; planned $100.00
    expect(screen.getByText(/\$38\.00 of \$100\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$62\.00 left/)).toBeInTheDocument();
  });

  it('shows an over-budget category with the over amount', () => {
    renderWith(
      <BudgetSummary overall={overall} categories={rows} currency="USD" locale="en" onSetBudget={vi.fn()} />,
    );
    expect(screen.getByText(en.budget.categories.lodging)).toBeInTheDocument();
    // remaining -500 minor → $5.00 over
    expect(screen.getByText(/\$5\.00 over/)).toBeInTheDocument();
  });

  it('shows “No budget set” for a category with no target', () => {
    renderWith(
      <BudgetSummary overall={overall} categories={rows} currency="USD" locale="en" onSetBudget={vi.fn()} />,
    );
    expect(screen.getByText(en.budget.categories.transport)).toBeInTheDocument();
    expect(screen.getAllByText(en.budget.noTarget).length).toBeGreaterThan(0);
  });

  it('sets progress-bar width from clamped percent (133% → 100%)', () => {
    renderWith(
      <BudgetSummary overall={overall} categories={rows} currency="USD" locale="en" onSetBudget={vi.fn()} />,
    );
    const lodgingBar = screen.getByTestId('bar-lodging');
    expect(lodgingBar).toHaveStyle({ width: '100%' });
    const foodBar = screen.getByTestId('bar-food');
    expect(foodBar).toHaveStyle({ width: '75%' });
  });

  it('fires onSetBudget when the set-budget button is pressed', async () => {
    const onSetBudget = vi.fn();
    renderWith(
      <BudgetSummary overall={{ ...overall, planned: null, remaining: null, percent: null }} categories={rows} currency="USD" locale="en" onSetBudget={onSetBudget} />,
    );
    screen.getByRole('button', { name: en.budget.setBudget }).click();
    expect(onSetBudget).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npm test -- components/budget/BudgetSummary.test.tsx`. Expect FAIL (Cannot find module).

- [ ] **Step 3: Minimal impl** — create `components/budget/BudgetSummary.tsx`:

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { formatMoney } from '@/src/lib/currency';
import { clampPercent, type BudgetRow, type BudgetCategory } from '@/src/lib/budgetView';

type Props = {
  overall: BudgetRow;
  categories: BudgetRow[];
  currency: string;
  locale: string;
  onSetBudget: () => void;
};

function RemainingLabel({
  row,
  currency,
  locale,
}: {
  row: BudgetRow;
  currency: string;
  locale: string;
}) {
  const t = useTranslations('budget');
  if (row.planned === null) {
    return <span className="text-caption text-ink-faint">{t('noTarget')}</span>;
  }
  if (row.over) {
    return (
      <span className="text-caption font-medium text-red-600">
        {t('overBudget', { amount: formatMoney(Math.abs(row.remaining ?? 0), currency, locale) })}
      </span>
    );
  }
  return (
    <span className="text-caption text-ink-muted">
      {t('remaining', { amount: formatMoney(row.remaining ?? 0, currency, locale) })}
    </span>
  );
}

function Bar({
  testId,
  row,
}: {
  testId: string;
  row: BudgetRow;
}) {
  const width = clampPercent(row.percent);
  return (
    <div className="mt-1 h-2 w-full overflow-hidden rounded-chip bg-paper shadow-inset">
      <div
        data-testid={testId}
        className={`h-full rounded-chip ${row.over ? 'bg-red-500' : 'bg-coral'}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function BudgetSummary({ overall, categories, currency, locale, onSetBudget }: Props) {
  const t = useTranslations('budget');

  return (
    <section className="rounded-card bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-heading font-semibold text-ink">{t('overall')}</h2>
        <button
          type="button"
          onClick={onSetBudget}
          className="rounded-control bg-paper px-3 py-1.5 text-caption font-medium text-ink shadow-inset"
        >
          {overall.planned === null ? t('setBudget') : t('editBudget')}
        </button>
      </div>

      <p className="mt-2 text-body text-ink [font-variant-numeric:tabular-nums]">
        {overall.planned === null
          ? formatMoney(overall.spent, currency, locale)
          : t('spentOfPlanned', {
              spent: formatMoney(overall.spent, currency, locale),
              planned: formatMoney(overall.planned, currency, locale),
            })}
      </p>
      <Bar testId="bar-overall" row={overall} />
      <p className="mt-1">
        <RemainingLabel row={overall} currency={currency} locale={locale} />
      </p>

      <ul className="mt-4 flex flex-col gap-3">
        {categories.map((row) => (
          <li key={row.category}>
            <div className="flex items-center justify-between">
              <span className="text-label font-medium text-ink">
                {t(`categories.${row.category as BudgetCategory}`)}
              </span>
              <span className="text-caption text-ink-muted [font-variant-numeric:tabular-nums]">
                {row.planned === null
                  ? formatMoney(row.spent, currency, locale)
                  : t('spentOfPlanned', {
                      spent: formatMoney(row.spent, currency, locale),
                      planned: formatMoney(row.planned, currency, locale),
                    })}
              </span>
            </div>
            <Bar testId={`bar-${row.category}`} row={row} />
            <p className="mt-1">
              <RemainingLabel row={row} currency={currency} locale={locale} />
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Run → PASS** — `npm test -- components/budget/BudgetSummary.test.tsx`. Expect: 5 passed.

- [ ] **Step 5: Commit** — `git add components/budget/BudgetSummary.tsx components/budget/BudgetSummary.test.tsx && git commit -m "C3.9: BudgetSummary progress-bar component (planned vs actual)" --trailer "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C3.10: `ExpenseSheet` (add/edit) component — amount keypad, category, date, optional place link

**Files:**
- Create `components/budget/ExpenseSheet.tsx`
- Test `components/budget/ExpenseSheet.test.tsx`

Bottom-sheet modeled on `AddPlaceSheet`: `role="dialog"`, Escape closes, inline save error, online-gated submit via `disabled`. Opens for add (no `expense` prop) or edit (an `expense` prop pre-fills + shows Delete). The amount field is a numeric keypad-friendly input (`inputMode="decimal"`); it converts the major-unit entry to integer minor units using `currencyExponent`. Calls the C3.4 actions directly (the canonical `AddPlaceSheet.commit` pattern).

- [ ] **Step 1: Failing test** — create `components/budget/ExpenseSheet.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

const addExpenseAction = vi.fn();
const updateExpenseAction = vi.fn();
const deleteExpenseAction = vi.fn();
vi.mock('@/app/_actions/expenses', () => ({
  addExpenseAction: (...a: unknown[]) => addExpenseAction(...a),
  updateExpenseAction: (...a: unknown[]) => updateExpenseAction(...a),
  deleteExpenseAction: (...a: unknown[]) => deleteExpenseAction(...a),
}));

import { ExpenseSheet } from '@/components/budget/ExpenseSheet';
import type { ExpenseDTO } from '@/app/api/trips/[tripId]/budget/route';

function renderWith(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en as never}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const places = [
  { id: 'p1', name: 'Ichiran' },
  { id: 'p2', name: 'Dotonbori' },
];

describe('ExpenseSheet', () => {
  beforeEach(() => {
    addExpenseAction.mockReset().mockResolvedValue({ id: 'e1' });
    updateExpenseAction.mockReset().mockResolvedValue({ id: 'e1' });
    deleteExpenseAction.mockReset().mockResolvedValue(undefined);
  });

  it('renders nothing when closed', () => {
    const { container } = renderWith(
      <ExpenseSheet open={false} tripId="trip-1" places={places} currency="USD" locale="en" disabled={false} today="2026-06-06" onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('adds an expense converting major → minor units (USD exponent 2)', async () => {
    const onSaved = vi.fn();
    renderWith(
      <ExpenseSheet open tripId="trip-1" places={places} currency="USD" locale="en" disabled={false} today="2026-06-06" onClose={vi.fn()} onSaved={onSaved} />,
    );
    fireEvent.change(screen.getByLabelText(en.budget.amountLabel), { target: { value: '15.30' } });
    fireEvent.change(screen.getByLabelText(en.budget.categoryLabel), { target: { value: 'food' } });
    fireEvent.change(screen.getByLabelText(en.budget.linkPlaceLabel), { target: { value: 'p1' } });
    screen.getByRole('button', { name: en.budget.save }).click();
    await waitFor(() => expect(addExpenseAction).toHaveBeenCalledTimes(1));
    expect(addExpenseAction).toHaveBeenCalledWith({
      tripId: 'trip-1',
      amount: 1530,
      category: 'food',
      spentOn: '2026-06-06',
      note: null,
      linkedPlaceId: 'p1',
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('defaults the date to today and category to food', async () => {
    renderWith(
      <ExpenseSheet open tripId="trip-1" places={places} currency="USD" locale="en" disabled={false} today="2026-06-06" onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    expect((screen.getByLabelText(en.budget.dateLabel) as HTMLInputElement).value).toBe('2026-06-06');
    expect((screen.getByLabelText(en.budget.categoryLabel) as HTMLSelectElement).value).toBe('food');
  });

  it('pre-fills + updates in edit mode and shows Delete', async () => {
    const expense = {
      id: 'e1', tripId: 'trip-1', amount: 2000, category: 'lodging', spentOn: '2026-06-05',
      note: 'Hotel', linkedPlaceId: null, placeName: null,
      createdAt: 0, updatedAt: 0,
    } as unknown as ExpenseDTO;
    renderWith(
      <ExpenseSheet open tripId="trip-1" expense={expense} places={places} currency="USD" locale="en" disabled={false} today="2026-06-06" onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    expect((screen.getByLabelText(en.budget.amountLabel) as HTMLInputElement).value).toBe('20.00');
    fireEvent.change(screen.getByLabelText(en.budget.amountLabel), { target: { value: '25' } });
    screen.getByRole('button', { name: en.budget.save }).click();
    await waitFor(() => expect(updateExpenseAction).toHaveBeenCalledTimes(1));
    expect(updateExpenseAction).toHaveBeenCalledWith('e1', expect.objectContaining({ amount: 2500, category: 'lodging' }));
    expect(screen.getByRole('button', { name: en.budget.delete })).toBeInTheDocument();
  });

  it('deletes in edit mode', async () => {
    const expense = {
      id: 'e1', tripId: 'trip-1', amount: 2000, category: 'lodging', spentOn: '2026-06-05',
      note: null, linkedPlaceId: null, placeName: null, createdAt: 0, updatedAt: 0,
    } as unknown as ExpenseDTO;
    const onSaved = vi.fn();
    renderWith(
      <ExpenseSheet open tripId="trip-1" expense={expense} places={places} currency="USD" locale="en" disabled={false} today="2026-06-06" onClose={vi.fn()} onSaved={onSaved} />,
    );
    screen.getByRole('button', { name: en.budget.delete }).click();
    await waitFor(() => expect(deleteExpenseAction).toHaveBeenCalledWith('e1'));
    expect(onSaved).toHaveBeenCalled();
  });

  it('shows an inline error and keeps the sheet open when the action rejects', async () => {
    addExpenseAction.mockRejectedValueOnce(new Error('boom'));
    const onClose = vi.fn();
    renderWith(
      <ExpenseSheet open tripId="trip-1" places={places} currency="USD" locale="en" disabled={false} today="2026-06-06" onClose={onClose} onSaved={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(en.budget.amountLabel), { target: { value: '5' } });
    screen.getByRole('button', { name: en.budget.save }).click();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.budget.saveFailed));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('rejects a zero/blank amount without calling the action', async () => {
    renderWith(
      <ExpenseSheet open tripId="trip-1" places={places} currency="USD" locale="en" disabled={false} today="2026-06-06" onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    screen.getByRole('button', { name: en.budget.save }).click();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(addExpenseAction).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npm test -- components/budget/ExpenseSheet.test.tsx`. Expect FAIL (Cannot find module).

- [ ] **Step 3: Minimal impl** — create `components/budget/ExpenseSheet.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { currencyExponent } from '@/src/lib/currency';
import { BUDGET_CATEGORIES, type BudgetCategory } from '@/src/lib/budgetView';
import {
  addExpenseAction,
  updateExpenseAction,
  deleteExpenseAction,
} from '@/app/_actions/expenses';
import type { ExpenseDTO } from '@/app/api/trips/[tripId]/budget/route';

export type PlaceOption = { id: string; name: string };

type Props = {
  open: boolean;
  tripId: string;
  /** Present → edit mode; absent → add mode. */
  expense?: ExpenseDTO;
  places: PlaceOption[];
  currency: string;
  locale: string;
  disabled: boolean; // offline → true
  today: string; // YYYY-MM-DD default for add mode
  onClose: () => void;
  onSaved: () => void;
};

/** Integer minor units → major-unit string for the amount input. */
function minorToInput(minor: number, currency: string): string {
  const exp = currencyExponent(currency);
  return (minor / 10 ** exp).toFixed(exp);
}

/** Parse a major-unit input string → integer minor units, or null if invalid/≤0. */
function inputToMinor(value: string, currency: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const major = Number(trimmed);
  if (!Number.isFinite(major) || major <= 0) return null;
  const exp = currencyExponent(currency);
  return Math.round(major * 10 ** exp);
}

export function ExpenseSheet({
  open,
  tripId,
  expense,
  places,
  currency,
  locale,
  disabled,
  today,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations('budget');
  const isEdit = !!expense;
  const [amount, setAmount] = useState(expense ? minorToInput(expense.amount, currency) : '');
  const [category, setCategory] = useState<BudgetCategory>(
    (expense?.category as BudgetCategory) ?? 'food',
  );
  const [spentOn, setSpentOn] = useState(expense?.spentOn ?? today);
  const [note, setNote] = useState(expense?.note ?? '');
  const [linkedPlaceId, setLinkedPlaceId] = useState(expense?.linkedPlaceId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // `locale` is part of the props contract for symmetry with the rest of the
  // budget UI; the amount input renders in fixed minor-unit precision so no
  // locale-specific parsing is applied here.
  void locale;

  if (!open) return null;

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') onClose();
  }

  function handleSave() {
    setError(null);
    const minor = inputToMinor(amount, currency);
    if (minor === null) {
      setError(t('saveFailed'));
      return;
    }
    const payload = {
      category,
      spentOn,
      note: note.trim() === '' ? null : note.trim(),
      linkedPlaceId: linkedPlaceId === '' ? null : linkedPlaceId,
    };
    startTransition(async () => {
      try {
        if (isEdit && expense) {
          await updateExpenseAction(expense.id, { amount: minor, ...payload });
        } else {
          await addExpenseAction({ tripId, amount: minor, ...payload });
        }
        onSaved();
        onClose();
      } catch {
        setError(t('saveFailed'));
      }
    });
  }

  function handleDelete() {
    if (!expense) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteExpenseAction(expense.id);
        onSaved();
        onClose();
      } catch {
        setError(t('mutationFailed'));
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? t('editExpense') : t('addExpense')}
      className="fixed inset-0 z-50 flex items-end bg-[rgb(110_85_68_/_0.45)]"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-card p-6 shadow-lift"
      >
        <h2 className="mb-3 text-heading font-semibold text-ink">
          {isEdit ? t('editExpense') : t('addExpense')}
        </h2>

        {error ? (
          <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-caption text-red-700">
            {error}
          </p>
        ) : null}

        {disabled ? (
          <p className="mb-3 text-caption text-ink-muted">{t('offlineHint')}</p>
        ) : null}

        <label className="block text-label font-medium text-ink" htmlFor="exp-amount">
          {t('amountLabel')}
        </label>
        <input
          id="exp-amount"
          type="text"
          inputMode="decimal"
          value={amount}
          disabled={disabled}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink [font-variant-numeric:tabular-nums] disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="exp-category">
          {t('categoryLabel')}
        </label>
        <select
          id="exp-category"
          value={category}
          disabled={disabled}
          onChange={(e) => setCategory(e.target.value as BudgetCategory)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        >
          {BUDGET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </select>

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="exp-date">
          {t('dateLabel')}
        </label>
        <input
          id="exp-date"
          type="date"
          value={spentOn}
          disabled={disabled}
          onChange={(e) => setSpentOn(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="exp-note">
          {t('noteLabel')}
        </label>
        <input
          id="exp-note"
          type="text"
          value={note}
          disabled={disabled}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="exp-place">
          {t('linkPlaceLabel')}
        </label>
        <select
          id="exp-place"
          value={linkedPlaceId}
          disabled={disabled}
          onChange={(e) => setLinkedPlaceId(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        >
          <option value="">{t('noLinkedPlace')}</option>
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || isPending}
          className="mt-5 w-full rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
        >
          {t('save')}
        </button>

        {isEdit ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={disabled || isPending}
            className="mt-2 w-full rounded-control bg-paper px-4 py-3 text-label font-medium text-red-600 shadow-inset disabled:opacity-40"
          >
            {t('delete')}
          </button>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run → PASS** — `npm test -- components/budget/ExpenseSheet.test.tsx`. Expect: 7 passed.

- [ ] **Step 5: Commit** — `git add components/budget/ExpenseSheet.tsx components/budget/ExpenseSheet.test.tsx && git commit -m "C3.10: ExpenseSheet add/edit (amount keypad, category, date, place link)" --trailer "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C3.11: `SetBudgetSheet` component — overall + per-category planned amounts

**Files:**
- Create `components/budget/SetBudgetSheet.tsx`
- Test `components/budget/SetBudgetSheet.test.tsx`

A sheet with one amount field for the overall target and one per category. On save it diffs each field against the current target: a non-empty positive value → `setTargetAction`; a cleared field that previously had a target → `clearTargetAction`. Pre-fills from the current `targets`.

- [ ] **Step 1: Failing test** — create `components/budget/SetBudgetSheet.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

const setTargetAction = vi.fn();
const clearTargetAction = vi.fn();
vi.mock('@/app/_actions/budgetTargets', () => ({
  setTargetAction: (...a: unknown[]) => setTargetAction(...a),
  clearTargetAction: (...a: unknown[]) => clearTargetAction(...a),
}));

import { SetBudgetSheet } from '@/components/budget/SetBudgetSheet';
import type { TargetDTO } from '@/app/api/trips/[tripId]/budget/route';

function renderWith(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en as never}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const targets = [
  { id: 't0', tripId: 'trip-1', category: null, plannedAmount: 100000, createdAt: 0, updatedAt: 0 },
  { id: 't1', tripId: 'trip-1', category: 'food', plannedAmount: 30000, createdAt: 0, updatedAt: 0 },
] as unknown as TargetDTO[];

describe('SetBudgetSheet', () => {
  beforeEach(() => {
    setTargetAction.mockReset().mockResolvedValue({});
    clearTargetAction.mockReset().mockResolvedValue(undefined);
  });

  it('renders nothing when closed', () => {
    const { container } = renderWith(
      <SetBudgetSheet open={false} tripId="trip-1" targets={targets} currency="USD" locale="en" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('pre-fills overall and category amounts in major units', () => {
    renderWith(
      <SetBudgetSheet open tripId="trip-1" targets={targets} currency="USD" locale="en" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    expect((screen.getByLabelText(en.budget.overallPlannedLabel) as HTMLInputElement).value).toBe('1000.00');
    const foodLabel = en.budget.categoryPlannedLabel.replace('{category}', en.budget.categories.food);
    expect((screen.getByLabelText(foodLabel) as HTMLInputElement).value).toBe('300.00');
  });

  it('saves changed targets and clears emptied ones', async () => {
    const onSaved = vi.fn();
    renderWith(
      <SetBudgetSheet open tripId="trip-1" targets={targets} currency="USD" locale="en" disabled={false} onClose={vi.fn()} onSaved={onSaved} />,
    );
    // Change overall 1000 → 1200, clear food, set lodging to 500
    fireEvent.change(screen.getByLabelText(en.budget.overallPlannedLabel), { target: { value: '1200' } });
    const foodLabel = en.budget.categoryPlannedLabel.replace('{category}', en.budget.categories.food);
    fireEvent.change(screen.getByLabelText(foodLabel), { target: { value: '' } });
    const lodgingLabel = en.budget.categoryPlannedLabel.replace('{category}', en.budget.categories.lodging);
    fireEvent.change(screen.getByLabelText(lodgingLabel), { target: { value: '500' } });

    screen.getByRole('button', { name: en.budget.save }).click();

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(setTargetAction).toHaveBeenCalledWith({ tripId: 'trip-1', category: null, plannedAmount: 120000 });
    expect(setTargetAction).toHaveBeenCalledWith({ tripId: 'trip-1', category: 'lodging', plannedAmount: 50000 });
    expect(clearTargetAction).toHaveBeenCalledWith('trip-1', 'food');
  });

  it('does not call any action for unchanged fields', async () => {
    renderWith(
      <SetBudgetSheet open tripId="trip-1" targets={targets} currency="USD" locale="en" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    // Save with no edits: overall (100000) + food (30000) unchanged, others empty/never set.
    screen.getByRole('button', { name: en.budget.save }).click();
    await waitFor(() => expect(setTargetAction).not.toHaveBeenCalled());
    expect(clearTargetAction).not.toHaveBeenCalled();
  });

  it('shows an inline error when an action rejects', async () => {
    setTargetAction.mockRejectedValueOnce(new Error('boom'));
    const onClose = vi.fn();
    renderWith(
      <SetBudgetSheet open tripId="trip-1" targets={[]} currency="USD" locale="en" disabled={false} onClose={onClose} onSaved={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(en.budget.overallPlannedLabel), { target: { value: '50' } });
    screen.getByRole('button', { name: en.budget.save }).click();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.budget.saveFailed));
    expect(onClose).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npm test -- components/budget/SetBudgetSheet.test.tsx`. Expect FAIL (Cannot find module).

- [ ] **Step 3: Minimal impl** — create `components/budget/SetBudgetSheet.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { currencyExponent } from '@/src/lib/currency';
import { BUDGET_CATEGORIES, type BudgetCategory } from '@/src/lib/budgetView';
import { setTargetAction, clearTargetAction } from '@/app/_actions/budgetTargets';
import type { TargetDTO } from '@/app/api/trips/[tripId]/budget/route';

type Props = {
  open: boolean;
  tripId: string;
  targets: TargetDTO[];
  currency: string;
  locale: string;
  disabled: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type Key = 'overall' | BudgetCategory;

function minorToInput(minor: number, currency: string): string {
  const exp = currencyExponent(currency);
  return (minor / 10 ** exp).toFixed(exp);
}

/** Major-unit string → integer minor units; '' → null; invalid/≤0 → null. */
function inputToMinor(value: string, currency: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const major = Number(trimmed);
  if (!Number.isFinite(major) || major <= 0) return null;
  return Math.round(major * 10 ** currencyExponent(currency));
}

export function SetBudgetSheet({
  open,
  tripId,
  targets,
  currency,
  locale,
  disabled,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations('budget');
  void locale;

  // Current planned minor-unit amount keyed by 'overall' | category.
  const current = new Map<Key, number>();
  for (const tgt of targets) {
    current.set((tgt.category ?? 'overall') as Key, tgt.plannedAmount);
  }

  const initial = (key: Key): string => {
    const v = current.get(key);
    return v === undefined ? '' : minorToInput(v, currency);
  };

  const [values, setValues] = useState<Record<Key, string>>(() => {
    const base = { overall: initial('overall') } as Record<Key, string>;
    for (const c of BUDGET_CATEGORIES) base[c] = initial(c);
    return base;
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') onClose();
  }

  function setValue(key: Key, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function handleSave() {
    setError(null);
    const keys: Key[] = ['overall', ...BUDGET_CATEGORIES];
    startTransition(async () => {
      try {
        for (const key of keys) {
          const category = key === 'overall' ? null : (key as BudgetCategory);
          const next = inputToMinor(values[key], currency);
          const prev = current.get(key) ?? null;
          if (next === prev) continue; // unchanged (incl. both null/empty)
          if (next === null) {
            await clearTargetAction(tripId, category);
          } else {
            await setTargetAction({ tripId, category, plannedAmount: next });
          }
        }
        onSaved();
        onClose();
      } catch {
        setError(t('saveFailed'));
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('setBudget')}
      className="fixed inset-0 z-50 flex items-end bg-[rgb(110_85_68_/_0.45)]"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-card p-6 shadow-lift"
      >
        <h2 className="mb-3 text-heading font-semibold text-ink">{t('setBudget')}</h2>

        {error ? (
          <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-caption text-red-700">
            {error}
          </p>
        ) : null}

        {disabled ? (
          <p className="mb-3 text-caption text-ink-muted">{t('offlineHint')}</p>
        ) : null}

        <label className="block text-label font-medium text-ink" htmlFor="tgt-overall">
          {t('overallPlannedLabel')}
        </label>
        <input
          id="tgt-overall"
          type="text"
          inputMode="decimal"
          value={values.overall}
          disabled={disabled}
          onChange={(e) => setValue('overall', e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink [font-variant-numeric:tabular-nums] disabled:opacity-60"
        />

        <ul className="mt-3 flex flex-col gap-3">
          {BUDGET_CATEGORIES.map((c) => {
            const label = t('categoryPlannedLabel', { category: t(`categories.${c}`) });
            return (
              <li key={c}>
                <label className="block text-label font-medium text-ink" htmlFor={`tgt-${c}`}>
                  {label}
                </label>
                <input
                  id={`tgt-${c}`}
                  aria-label={label}
                  type="text"
                  inputMode="decimal"
                  value={values[c]}
                  disabled={disabled}
                  onChange={(e) => setValue(c, e.target.value)}
                  className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink [font-variant-numeric:tabular-nums] disabled:opacity-60"
                />
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || isPending}
          className="mt-5 w-full rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
        >
          {t('save')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
```

Note: the overall field's `<label htmlFor="tgt-overall">` plus the input `id="tgt-overall"` makes `getByLabelText(en.budget.overallPlannedLabel)` resolve; the per-category inputs add an explicit `aria-label` (because the label text is interpolated) so `getByLabelText(<interpolated label>)` resolves too.

- [ ] **Step 4: Run → PASS** — `npm test -- components/budget/SetBudgetSheet.test.tsx`. Expect: 5 passed.

- [ ] **Step 5: Commit** — `git add components/budget/SetBudgetSheet.tsx components/budget/SetBudgetSheet.test.tsx && git commit -m "C3.11: SetBudgetSheet (overall + per-category planned amounts, diffed save)" --trailer "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C3.12: `BudgetClient` — static-shell data owner (fetch, toggles, expense list, sheets)

**Files:**
- Create `components/budget/BudgetClient.tsx`
- Test `components/budget/BudgetClient.test.tsx`

The client-fetch owner, modeled on `PlanClient`/`SettingsClient`: tracks `online`, fetches `withBase('/api/trips/:id')` (for the place list to populate the link dropdown) and `withBase('/api/trips/:id/budget')` in parallel, renders loading/error states, the `BudgetSummary`, a By category / By day toggle, the expense list (By day = `groupByDate`; By category = grouped by category with `categoryLabel`), and wires the `ExpenseSheet` + `SetBudgetSheet`. Mutations re-fetch on `onSaved`. Buttons are disabled while offline.

- [ ] **Step 1: Failing test** — create `components/budget/BudgetClient.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import { BudgetClient } from '@/components/budget/BudgetClient';

// Stub the sheets so this test focuses on data-owner behavior (fetch + render
// + toggle). The sheets have their own unit tests (C3.10/C3.11).
vi.mock('@/components/budget/ExpenseSheet', () => ({
  ExpenseSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="expense-sheet" /> : null,
}));
vi.mock('@/components/budget/SetBudgetSheet', () => ({
  SetBudgetSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="set-budget-sheet" /> : null,
}));

function renderWith(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en as never}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const tripBody = { trip: { id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07', coverPhoto: null } };
const placesBody = {
  places: [{ id: 'p1', name: 'Ichiran' }],
  legs: [],
};
const budgetBody = {
  expenses: [
    { id: 'e1', tripId: 'trip-1', amount: 1500, category: 'food', spentOn: '2026-06-06', note: 'Ramen', linkedPlaceId: 'p1', placeName: 'Ichiran', createdAt: 0, updatedAt: 0 },
    { id: 'e2', tripId: 'trip-1', amount: 2000, category: 'lodging', spentOn: '2026-06-05', note: null, linkedPlaceId: null, placeName: null, createdAt: 0, updatedAt: 0 },
  ],
  targets: [
    { id: 't0', tripId: 'trip-1', category: null, plannedAmount: 100000, createdAt: 0, updatedAt: 0 },
    { id: 't1', tripId: 'trip-1', category: 'food', plannedAmount: 30000, createdAt: 0, updatedAt: 0 },
  ],
};

function mockFetchOk() {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.endsWith('/budget')
      ? budgetBody
      : url.includes('/places')
        ? placesBody
        : tripBody;
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
  });
}

describe('BudgetClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetchOk());
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('shows a loading state then renders the summary and expenses', async () => {
    renderWith(<BudgetClient tripId="trip-1" currency="USD" locale="en" />);
    expect(screen.getByText(en.budget.loading)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(en.budget.overall)).toBeInTheDocument());
    // overall $38.00 of $100.00 (1500+2000 minor = 3500 → $35.00)
    expect(screen.getByText(/\$35\.00 of \$100\.00/)).toBeInTheDocument();
    // expense rows
    expect(screen.getByText('Ramen')).toBeInTheDocument();
    expect(screen.getByText('Ichiran')).toBeInTheDocument(); // linked place chip
  });

  it('fetches the budget read handler with the base-prefixed URL', async () => {
    renderWith(<BudgetClient tripId="trip-1" currency="USD" locale="en" />);
    await waitFor(() => expect(screen.getByText(en.budget.overall)).toBeInTheDocument());
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.endsWith('/api/trips/trip-1/budget'))).toBe(true);
    expect(calls.some((u) => u.endsWith('/api/trips/trip-1/places'))).toBe(true);
  });

  it('groups by day by default and switches to by-category', async () => {
    renderWith(<BudgetClient tripId="trip-1" currency="USD" locale="en" />);
    await waitFor(() => expect(screen.getByText(en.budget.overall)).toBeInTheDocument());
    // By day shows date group headers; newest first
    const dayBtn = screen.getByRole('button', { name: en.budget.byDay });
    expect(dayBtn).toHaveAttribute('aria-pressed', 'true');
    // switch to By category
    screen.getByRole('button', { name: en.budget.byCategory }).click();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: en.budget.byCategory })).toHaveAttribute('aria-pressed', 'true'),
    );
    // category group headers visible
    expect(screen.getByText(en.budget.categories.food)).toBeInTheDocument();
    expect(screen.getByText(en.budget.categories.lodging)).toBeInTheDocument();
  });

  it('opens the expense sheet from the add button', async () => {
    renderWith(<BudgetClient tripId="trip-1" currency="USD" locale="en" />);
    await waitFor(() => expect(screen.getByText(en.budget.overall)).toBeInTheDocument());
    screen.getByRole('button', { name: en.budget.addExpense }).click();
    expect(screen.getByTestId('expense-sheet')).toBeInTheDocument();
  });

  it('opens the set-budget sheet from the summary button', async () => {
    renderWith(<BudgetClient tripId="trip-1" currency="USD" locale="en" />);
    await waitFor(() => expect(screen.getByText(en.budget.overall)).toBeInTheDocument());
    screen.getByRole('button', { name: en.budget.editBudget }).click();
    expect(screen.getByTestId('set-budget-sheet')).toBeInTheDocument();
  });

  it('disables the add button when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    renderWith(<BudgetClient tripId="trip-1" currency="USD" locale="en" />);
    await waitFor(() => expect(screen.getByText(en.budget.overall)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: en.budget.addExpense })).toBeDisabled();
  });

  it('renders the error state when a fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false } as Response)));
    renderWith(<BudgetClient tripId="trip-1" currency="USD" locale="en" />);
    await waitFor(() => expect(screen.getByText(en.budget.errorHeadline)).toBeInTheDocument());
  });

  it('shows the empty state when there are no expenses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        const body = url.endsWith('/budget')
          ? { expenses: [], targets: [] }
          : url.includes('/places')
            ? placesBody
            : tripBody;
        return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
      }),
    );
    renderWith(<BudgetClient tripId="trip-1" currency="USD" locale="en" />);
    await waitFor(() => expect(screen.getByText(en.budget.emptyHeadline)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npm test -- components/budget/BudgetClient.test.tsx`. Expect FAIL (Cannot find module).

- [ ] **Step 3: Minimal impl** — create `components/budget/BudgetClient.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { withBase } from '@/src/lib/basePath';
import { formatMoney } from '@/src/lib/currency';
import {
  buildCategoryBudgets,
  buildOverallBudget,
  groupByDate,
  BUDGET_CATEGORIES,
  type BudgetCategory,
} from '@/src/lib/budgetView';
import { EmptyState } from '@/components/EmptyState';
import { BudgetSummary } from '@/components/budget/BudgetSummary';
import { ExpenseSheet, type PlaceOption } from '@/components/budget/ExpenseSheet';
import { SetBudgetSheet } from '@/components/budget/SetBudgetSheet';
import type { ExpenseDTO, TargetDTO } from '@/app/api/trips/[tripId]/budget/route';

type GroupMode = 'day' | 'category';
type BudgetData = { expenses: ExpenseDTO[]; targets: TargetDTO[]; places: PlaceOption[] };
type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; data: BudgetData };

/** Today's calendar date (YYYY-MM-DD) — used as the default for new expenses. */
function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function BudgetClient({
  tripId,
  currency,
  locale = 'en',
}: {
  tripId: string;
  currency: string;
  locale?: string;
}) {
  const t = useTranslations('budget');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [online, setOnline] = useState(true);
  const [groupMode, setGroupMode] = useState<GroupMode>('day');
  const [expenseSheet, setExpenseSheet] = useState<{ open: boolean; expense?: ExpenseDTO }>({ open: false });
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, [tripId]);

  const load = useCallback(async () => {
    try {
      const [placesRes, budgetRes] = await Promise.all([
        fetch(withBase(`/api/trips/${tripId}/places`), { credentials: 'same-origin' }),
        fetch(withBase(`/api/trips/${tripId}/budget`), { credentials: 'same-origin' }),
      ]);
      if (!placesRes.ok || !budgetRes.ok) throw new Error('load failed');
      const { places } = (await placesRes.json()) as { places: { id: string; name: string }[] };
      const { expenses, targets } = (await budgetRes.json()) as {
        expenses: ExpenseDTO[];
        targets: TargetDTO[];
      };
      if (mountedRef.current) {
        setState({
          status: 'loaded',
          data: { expenses, targets, places: places.map((p) => ({ id: p.id, name: p.name })) },
        });
      }
    } catch {
      if (mountedRef.current) setState({ status: 'error' });
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === 'loading') {
    return <p className="px-4 py-8 text-center text-body text-ink-muted">{t('loading')}</p>;
  }
  if (state.status === 'error') {
    return <EmptyState mascotAlt={t('summaryTitle')} headline={t('errorHeadline')} subtext={t('errorSubtext')} />;
  }

  const { expenses, targets, places } = state.data;
  const overall = buildOverallBudget(expenses, targets);
  const categoryRows = buildCategoryBudgets(expenses, targets);

  function ExpenseRow({ e }: { e: ExpenseDTO }) {
    return (
      <button
        type="button"
        disabled={!online}
        onClick={() => setExpenseSheet({ open: true, expense: e })}
        className="flex w-full items-center justify-between rounded-card bg-card px-4 py-3 text-left shadow-card disabled:opacity-60"
      >
        <span className="min-w-0">
          <span className="block truncate text-body text-ink">
            {e.note ?? t(`categories.${e.category as BudgetCategory}`)}
          </span>
          {e.placeName ? (
            <span className="mt-0.5 inline-block rounded-chip bg-paper px-2 py-0.5 text-caption text-ink-muted">
              {e.placeName}
            </span>
          ) : null}
        </span>
        <span className="ml-3 shrink-0 text-label font-medium text-ink [font-variant-numeric:tabular-nums]">
          {formatMoney(e.amount, currency, locale)}
        </span>
      </button>
    );
  }

  const byDayGroups = groupByDate(expenses);
  const byCategoryGroups = BUDGET_CATEGORIES.map((c) => ({
    category: c,
    items: expenses.filter((e) => e.category === c),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-24 pt-2">
      <BudgetSummary
        overall={overall}
        categories={categoryRows}
        currency={currency}
        locale={locale}
        onSetBudget={() => setBudgetSheetOpen(true)}
      />

      <div className="mt-4 flex items-center justify-between">
        <div role="group" className="flex rounded-control bg-card p-0.5 shadow-inset">
          <button
            type="button"
            aria-pressed={groupMode === 'category'}
            onClick={() => setGroupMode('category')}
            className={`rounded-control px-3 py-1.5 text-caption font-medium ${groupMode === 'category' ? 'bg-coral text-white' : 'text-ink-muted'}`}
          >
            {t('byCategory')}
          </button>
          <button
            type="button"
            aria-pressed={groupMode === 'day'}
            onClick={() => setGroupMode('day')}
            className={`rounded-control px-3 py-1.5 text-caption font-medium ${groupMode === 'day' ? 'bg-coral text-white' : 'text-ink-muted'}`}
          >
            {t('byDay')}
          </button>
        </div>
        <button
          type="button"
          disabled={!online}
          onClick={() => setExpenseSheet({ open: true })}
          className="rounded-control bg-coral px-4 py-2 text-caption font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
        >
          {t('addExpense')}
        </button>
      </div>

      {expenses.length === 0 ? (
        <div className="mt-4">
          <EmptyState mascotAlt={t('summaryTitle')} headline={t('emptyHeadline')} subtext={t('emptySubtext')} />
        </div>
      ) : groupMode === 'day' ? (
        <div className="mt-4 flex flex-col gap-4">
          {byDayGroups.map((g) => (
            <section key={g.date}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-label font-semibold text-ink">{g.date}</h3>
                <span className="text-caption text-ink-muted [font-variant-numeric:tabular-nums]">
                  {formatMoney(g.total, currency, locale)}
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {g.items.map((e) => (
                  <li key={e.id}>
                    <ExpenseRow e={e} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {byCategoryGroups.map((g) => (
            <section key={g.category}>
              <h3 className="mb-2 text-label font-semibold text-ink">{t(`categories.${g.category}`)}</h3>
              <ul className="flex flex-col gap-2">
                {g.items.map((e) => (
                  <li key={e.id}>
                    <ExpenseRow e={e} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ExpenseSheet
        open={expenseSheet.open}
        tripId={tripId}
        expense={expenseSheet.expense}
        places={places}
        currency={currency}
        locale={locale}
        disabled={!online}
        today={todayISO()}
        onClose={() => setExpenseSheet({ open: false })}
        onSaved={() => {
          setExpenseSheet({ open: false });
          void load();
        }}
      />

      <SetBudgetSheet
        open={budgetSheetOpen}
        tripId={tripId}
        targets={targets}
        currency={currency}
        locale={locale}
        disabled={!online}
        onClose={() => setBudgetSheetOpen(false)}
        onSaved={() => {
          setBudgetSheetOpen(false);
          void load();
        }}
      />
    </main>
  );
}
```

- [ ] **Step 4: Run → PASS** — `npm test -- components/budget/BudgetClient.test.tsx`. Expect: 8 passed.

- [ ] **Step 5: Commit** — `git add components/budget/BudgetClient.tsx components/budget/BudgetClient.test.tsx && git commit -m "C3.12: BudgetClient static-shell data owner (fetch, toggle, list, sheets)" --trailer "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C3.13: replace the placeholder Budget page with the static shell

**Files:**
- Modify `app/trip/[tripId]/budget/page.tsx`
- Test `app/trip/[tripId]/budget/page.test.tsx`

Swap the `EmptyState` placeholder for the static-shell `BudgetClient`, mirroring `app/trip/[tripId]/plan/page.tsx` exactly: `export const dynamic = 'force-static'`, no server DB read, pass `currency`/`locale` from `env`.

- [ ] **Step 1: Failing test** — create `app/trip/[tripId]/budget/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/src/env', () => ({ env: { DEFAULT_CURRENCY: 'JPY' } }));

// Stub BudgetClient so the page test asserts wiring (props), not the client.
const budgetClientProps = vi.fn();
vi.mock('@/components/budget/BudgetClient', () => ({
  BudgetClient: (props: Record<string, unknown>) => {
    budgetClientProps(props);
    return <div data-testid="budget-client" />;
  },
}));

import BudgetPage, { dynamic } from '@/app/trip/[tripId]/budget/page';

describe('BudgetPage (static shell)', () => {
  it('is force-static so the SW caches the shell for offline', () => {
    expect(dynamic).toBe('force-static');
  });

  it('renders BudgetClient with the trip id and env currency', async () => {
    const ui = await BudgetPage({ params: Promise.resolve({ tripId: 'trip-1' }) });
    render(ui);
    expect(screen.getByTestId('budget-client')).toBeInTheDocument();
    expect(budgetClientProps).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: 'trip-1', currency: 'JPY', locale: 'en' }),
    );
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npm test -- "app/trip/[tripId]/budget/page.test.tsx"`. Expect FAIL (current page exports neither `BudgetClient` wiring nor matches the assertions; `dynamic` is `force-static` already but the client is not rendered).

- [ ] **Step 3: Minimal impl** — overwrite `app/trip/[tripId]/budget/page.tsx`:

```tsx
import { env } from '@/src/env';
import { BudgetClient } from '@/components/budget/BudgetClient';

// Static app shell: no server DB read, no cookies() — so the SW caches the page
// document and it loads offline. BudgetClient client-fetches /api/trips/:id/budget
// (+ /places for the link dropdown), derives planned-vs-actual, and owns the
// add/edit/set-budget sheets. English-only locale matches i18n/request.ts.
export const dynamic = 'force-static';

export default async function BudgetPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <BudgetClient tripId={tripId} currency={env.DEFAULT_CURRENCY} locale="en" />;
}
```

- [ ] **Step 4: Run → PASS** — `npm test -- "app/trip/[tripId]/budget/page.test.tsx"`. Expect: 2 passed.

- [ ] **Step 5: Commit** — `git add "app/trip/[tripId]/budget/page.tsx" "app/trip/[tripId]/budget/page.test.tsx" && git commit -m "C3.13: replace Budget placeholder with static-shell BudgetClient" --trailer "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

### Task C3.14: full-suite + lint + typecheck green gate

**Files:** none (verification only)

- [ ] **Step 1: Full test run** — `npm test`. Expect: all suites pass, including the prior groups' and 1A/1B's; the new C3 files add ~50+ assertions across ~9 new test files. ("Expected: N passed" approximate.)

- [ ] **Step 2: Lint** — `npm run lint`. Expect: no errors. If an unused-import warning fires (e.g. the `void and;` guard in `expenses.ts`, or `void locale;` in the sheets), remove the dead import/guard rather than suppressing.

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit` (or the repo's `npm run typecheck` if defined — grep `package.json` scripts). Expect: clean. The key seams to verify compile: `ExpenseDTO`/`TargetDTO` imported from the route module into the components, `TargetCategory` from the budgetTargets repo into the action, and the `BudgetRow`/`BudgetCategory` types from `budgetView` into `BudgetSummary`.

- [ ] **Step 4: Commit (only if any fixups were needed)** — `git add -A && git commit -m "C3.14: lint/typecheck fixups for Budget tab" --trailer "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"` (skip if Steps 1–3 were already clean with nothing to stage).
