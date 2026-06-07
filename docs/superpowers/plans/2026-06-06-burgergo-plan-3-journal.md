# BurgerGo Plan 3 — Journal & Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship BurgerGo's last planned feature surface — the **Journal** tab (markdown+photo entries and a saved-links reading list with server-side OpenGraph previews) — plus finish the Settings **About** block. **No i18n** (the EN⇄中文 toggle is dropped).

**Architecture:** Follows the established BurgerGo shape exactly. The Journal page is a **static shell** (`force-static`) that client-fetches its data; all mutations are **online-only Server Actions**; pure repos take `(db, ...)`; reads go through `GET /api/...` cached by the service worker. Journal entry photos reuse the Plan 2 photo pipeline (`owner_type='journal'`). The link-preview route fetches user-supplied URLs and is hardened against SSRF.

**Tech Stack:** Next.js 15 App Router + TypeScript, Drizzle ORM + better-sqlite3, Serwist PWA, sharp (image resize), `react-markdown` + `remark-gfm` + `rehype-sanitize` (markdown render), `node-html-parser` (server-side OG parse), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-06-burgergo-plan-3-journal-design.md`.

---

## Conventions (apply to every task)

- Repos are **pure**: `(db, ...args)` first; `type Db = TestDb['db']`; tested with in-memory `makeTestDb()`. IDs via `newId()`; clock via `now()`; `{ mode: 'timestamp' }` columns store Unix seconds — write `new Date(now())`. Dates are `TEXT` `YYYY-MM-DD`.
- Offline-readable pages are **static shells** (`export const dynamic = 'force-static'`) that client-fetch via `withBase('/api/...')` with `credentials: 'same-origin'`. Mutations are online-only Server Actions, disabled in the UI when `!navigator.onLine`.
- Sheets remount fresh per open via a namespaced, open-aware `key` (the Plan 2 stale-form fix).
- After any `npm install`, run `node scripts/fix-lockfile.mjs` (sharp-musl lockfile guard) before committing.
- TDD throughout: write the failing test, run it (FAIL), implement, run it (PASS), commit. Commit messages are prefixed with the task id (e.g. `D1.3: ...`) and end with the standard co-author trailer.
- Groups run in order **D0 → D1 → D2 → D3** (later groups depend on earlier contracts). The full vitest suite + `tsc` + `lint` + `build` must be green at the D3 gate.

## Shared contract (names every group uses)

- Drizzle: `journalEntries` (`journal_entries`), `savedLinks` (`saved_links`). Types `JournalEntry`, `SavedLink` (`$inferSelect`).
- `journalEntries` repo: `getEntry / listEntriesForTrip (created_at desc) / addEntry / updateEntry / deleteEntry`.
- `savedLinks` repo: `getLink / listLinksForTrip (created_at desc) / addLink / updateLink / deleteLink`.
- Pure helpers: `journalView.ts` → `entrySnippet(body, maxLen?)`, `linkDomain(url)`; `linkPreview.ts` → `isHttpUrl(raw)`, `isBlockedAddress(ip)`.
- Read handler `GET /api/trips/[tripId]/journal` → `{ entries: EntryDTO[]; links: SavedLink[] }`, `EntryDTO = JournalEntry & { photos: Photo[] }`.
- Actions: `journal.ts` → `addEntryAction / updateEntryAction / deleteEntryAction`; `savedLinks.ts` → `addLinkAction / updateLinkAction / deleteLinkAction`.
- Routes: extend `POST /api/photos` (accept `ownerType='journal'`); `POST /api/links/preview` (SSRF-guarded, body `{url, tripId}`); `GET /api/links/thumb/[linkId]`.
- Components in `components/journal/`: `JournalClient`, `EntrySheet`, `EntryReader`, `LinkRow`, `LinkSheet`, `Markdown`. Plus the SW link-thumb matcher and the Settings About block.

---

## Group D0 — Schema & repos

Foundation layer for Plan 3: the two new tables (`journal_entries`, `saved_links`) with migration `0003`, their pure repos, and the two pure helper modules (`journalView`, `linkPreview`). No UI, routes, or actions here — those build on D0 in D1–D2. All repos follow the established pure pattern: `(db, ...args)` first arg, `type Db = TestDb['db']`, `newId()` / `new Date(now())`, tested against `makeTestDb()`.

### Task D0.1: Add `journal_entries` + `saved_links` to schema, generate migration `0003`

**Files:**
- Modify: `src/db/schema.ts`
- Create (generated): `drizzle/0003_*.sql`, `drizzle/meta/*` (via `npm run db:generate`)
- Test: `src/db/schema.shape.plan3.test.ts`, `src/db/migration.plan3.test.ts`

- [ ] **Step 1: Write the failing schema-shape test.** Mirrors `src/db/schema.shape.test.ts` (uses `getTableConfig`). Create `src/db/schema.shape.plan3.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the shape test — expect FAIL** (`journalEntries`/`savedLinks` are not exported yet → TS/import error):

```
npx vitest run src/db/schema.shape.plan3.test.ts
```

- [ ] **Step 3: Add the two tables + relations + types to `src/db/schema.ts`.** Insert this block immediately after the `photos` table definition (before the `// Relations` comment block), copying the Plan 2 declaration style exactly (FK cascade, `{ mode: 'timestamp' }` timestamps, named index):

```ts
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
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    byTripCreated: index('idx_links_trip').on(t.tripId, t.createdAt),
  }),
);
```

Add the relations alongside the existing ones (after `photosRelations`):

```ts
export const journalEntriesRelations = relations(journalEntries, ({ one }) => ({
  trip: one(trips, { fields: [journalEntries.tripId], references: [trips.id] }),
}));

export const savedLinksRelations = relations(savedLinks, ({ one }) => ({
  trip: one(trips, { fields: [savedLinks.tripId], references: [trips.id] }),
}));
```

Add the inferred row types at the end of the file (after `NewPhoto`):

```ts
export type JournalEntry = typeof journalEntries.$inferSelect;
export type NewJournalEntry = typeof journalEntries.$inferInsert;
export type SavedLink = typeof savedLinks.$inferSelect;
export type NewSavedLink = typeof savedLinks.$inferInsert;
```

Also extend the trip relations roll-up so the new children are reachable — change `tripsRelations` to include them:

```ts
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
```

- [ ] **Step 4: Run the shape test — expect PASS:**

```
npx vitest run src/db/schema.shape.plan3.test.ts
```

- [ ] **Step 5: Generate the migration.** Drizzle-kit will name it `0003_<adjective_word>.sql` and update `drizzle/meta/`:

```
npm run db:generate
```

- [ ] **Step 6: Confirm the generated migration created exactly the two tables + indexes** (no unintended diffs to existing tables). Inspect the new file:

```
ls drizzle/0003_*.sql && grep -E 'CREATE TABLE|CREATE INDEX' drizzle/0003_*.sql
```

Expected: `CREATE TABLE \`journal_entries\``, `CREATE TABLE \`saved_links\``, `CREATE INDEX \`idx_journal_trip_created\``, `CREATE INDEX \`idx_links_trip\`` — and nothing else.

- [ ] **Step 7: Write the failing migration test.** Mirrors `src/db/migration.plan2.test.ts` (asserts tables/indexes exist in the migrated in-memory DB and that rows cascade on trip delete). Create `src/db/migration.plan3.test.ts`:

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

describe('Plan 3 migration', () => {
  it('creates the two new tables', () => {
    const { sqlite } = makeTestDb();
    const names = tableNames(sqlite);
    expect(names.has('journal_entries')).toBe(true);
    expect(names.has('saved_links')).toBe(true);
  });

  it('creates the Plan 3 indexes', () => {
    const { sqlite } = makeTestDb();
    const names = indexNames(sqlite);
    expect(names.has('idx_journal_trip_created')).toBe(true);
    expect(names.has('idx_links_trip')).toBe(true);
  });

  it('a row in each new table cascades when its trip is deleted', () => {
    const { db, sqlite } = makeTestDb();
    const now = new Date(1_700_000_000_000);
    sqlite
      .prepare(
        'INSERT INTO trips (id, name, start_date, end_date, created_at, updated_at) VALUES (?,?,?,?,?,?)',
      )
      .run('t1', 'T', '2026-01-01', '2026-01-02', now.getTime(), now.getTime());
    sqlite
      .prepare(
        'INSERT INTO journal_entries (id, trip_id, title, body, entry_date, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
      )
      .run('j1', 't1', 'Day one', 'hello', '2026-01-01', now.getTime(), now.getTime());
    sqlite
      .prepare(
        'INSERT INTO saved_links (id, trip_id, url, title, note, thumbnail, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)',
      )
      .run('l1', 't1', 'https://example.com', null, null, null, now.getTime(), now.getTime());

    sqlite.prepare('DELETE FROM trips WHERE id = ?').run('t1');

    for (const tbl of ['journal_entries', 'saved_links']) {
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

- [ ] **Step 8: Run the migration test — expect PASS** (the migration is applied by `makeTestDb`):

```
npx vitest run src/db/migration.plan3.test.ts
```

- [ ] **Step 9: Commit:**

```
git add src/db/schema.ts src/db/schema.shape.plan3.test.ts src/db/migration.plan3.test.ts drizzle/
git commit -m "D0.1: add journal_entries + saved_links schema and migration 0003"
```

### Task D0.2: `journalEntries` repo + tests

**Files:**
- Create: `src/db/repos/journalEntries.ts`
- Test: `src/db/repos/journalEntries.test.ts`

- [ ] **Step 1: Write the failing repo test.** Mirrors `src/db/repos/expenses.test.ts` (fake timers, `makeTestDb`, `createTrip`). Covers CRUD, `created_at DESC` ordering, `updated_at` bump, nullable `entry_date`, and cascade-on-trip-delete. Create `src/db/repos/journalEntries.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { createTrip, deleteTrip } from '@/src/db/repos/trips';
import {
  addEntry,
  getEntry,
  listEntriesForTrip,
  updateEntry,
  deleteEntry,
} from '@/src/db/repos/journalEntries';

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

describe('journalEntries repo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('addEntry inserts with generated id/timestamps', () => {
    const { db, tripId } = setup();
    const e = addEntry(db, {
      tripId,
      title: 'Day one',
      body: 'Walked Shibuya.',
      entryDate: '2026-06-02',
    });
    expect(e.id).toMatch(/[0-9a-f-]{36}/);
    expect(e.title).toBe('Day one');
    expect(e.body).toBe('Walked Shibuya.');
    expect(e.entryDate).toBe('2026-06-02');
    expect(e.createdAt).toEqual(NOW);
    expect(e.updatedAt).toEqual(NOW);
    expect(getEntry(db, e.id)?.title).toBe('Day one');
  });

  it('addEntry accepts an empty body and a null entryDate', () => {
    const { db, tripId } = setup();
    const e = addEntry(db, { tripId, title: 'Untitled', body: '' });
    expect(e.body).toBe('');
    expect(e.entryDate).toBeNull();
  });

  it('listEntriesForTrip orders by created_at desc (newest written first)', () => {
    const { db, tripId } = setup();
    vi.setSystemTime(new Date('2026-06-08T10:00:00Z'));
    const first = addEntry(db, { tripId, title: 'First', body: '' });
    vi.setSystemTime(new Date('2026-06-08T11:00:00Z'));
    const second = addEntry(db, { tripId, title: 'Second', body: '' });
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
    const third = addEntry(db, { tripId, title: 'Third', body: '' });
    expect(listEntriesForTrip(db, tripId).map((e) => e.id)).toEqual([
      third.id,
      second.id,
      first.id,
    ]);
  });

  it('listEntriesForTrip is scoped to the trip', () => {
    const { db, tripId } = setup();
    addEntry(db, { tripId, title: 'Mine', body: '' });
    const other = createTrip(db, {
      name: 'X',
      startDate: '2026-07-01',
      endDate: '2026-07-02',
    });
    addEntry(db, { tripId: other.id, title: 'Theirs', body: '' });
    expect(listEntriesForTrip(db, tripId).map((e) => e.title)).toEqual(['Mine']);
  });

  it('updateEntry patches fields and bumps updatedAt', () => {
    const { db, tripId } = setup();
    const e = addEntry(db, { tripId, title: 'Old', body: 'old body' });
    vi.setSystemTime(new Date('2026-06-09T12:00:00Z'));
    const updated = updateEntry(db, e.id, {
      title: 'New',
      body: 'new body',
      entryDate: null,
    });
    expect(updated?.title).toBe('New');
    expect(updated?.body).toBe('new body');
    expect(updated?.entryDate).toBeNull();
    expect(updated?.updatedAt).toEqual(new Date('2026-06-09T12:00:00Z'));
    expect(updated?.createdAt).toEqual(NOW);
  });

  it('updateEntry returns undefined for unknown id', () => {
    const { db } = setup();
    expect(updateEntry(db, 'nope', { title: 'x' })).toBeUndefined();
  });

  it('deleteEntry removes the row', () => {
    const { db, tripId } = setup();
    const e = addEntry(db, { tripId, title: 'Bye', body: '' });
    deleteEntry(db, e.id);
    expect(getEntry(db, e.id)).toBeUndefined();
  });

  it('deleting the trip cascades to its entries', () => {
    const { db, tripId } = setup();
    const e = addEntry(db, { tripId, title: 'Doomed', body: '' });
    deleteTrip(db, tripId);
    expect(getEntry(db, e.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the repo test — expect FAIL** (module does not exist yet):

```
npx vitest run src/db/repos/journalEntries.test.ts
```

- [ ] **Step 3: Implement the repo.** Mirrors `src/db/repos/expenses.ts` exactly. Create `src/db/repos/journalEntries.ts`:

```ts
import { desc, eq } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { journalEntries, type JournalEntry } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';

export type { JournalEntry };

type Db = TestDb['db'];

/** One entry by id, or undefined. */
export function getEntry(db: Db, id: string): JournalEntry | undefined {
  return db.select().from(journalEntries).where(eq(journalEntries.id, id)).get();
}

/** All entries for a trip, newest-written first (created_at desc). */
export function listEntriesForTrip(db: Db, tripId: string): JournalEntry[] {
  return db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.tripId, tripId))
    .orderBy(desc(journalEntries.createdAt))
    .all();
}

export interface AddEntryInput {
  tripId: string;
  title: string;
  body: string; // markdown source; may be ''
  entryDate?: string | null; // YYYY-MM-DD
}

/** Insert an entry; generates id + timestamps. */
export function addEntry(db: Db, input: AddEntryInput): JournalEntry {
  const ts = new Date(now());
  const row: JournalEntry = {
    id: newId(),
    tripId: input.tripId,
    title: input.title,
    body: input.body,
    entryDate: input.entryDate ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(journalEntries).values(row).run();
  return row;
}

/** Editable subset (never id/tripId/timestamps). */
export type EntryPatch = Partial<
  Pick<JournalEntry, 'title' | 'body' | 'entryDate'>
>;

/** Patch the provided fields; bumps updatedAt. Returns the row, or undefined. */
export function updateEntry(
  db: Db,
  id: string,
  patch: EntryPatch,
): JournalEntry | undefined {
  db.update(journalEntries)
    .set({ ...patch, updatedAt: new Date(now()) })
    .where(eq(journalEntries.id, id))
    .run();
  return getEntry(db, id);
}

/** Delete an entry (its photos are removed by the journal action, not here). */
export function deleteEntry(db: Db, id: string): void {
  db.delete(journalEntries).where(eq(journalEntries.id, id)).run();
}
```

- [ ] **Step 4: Run the repo test — expect PASS:**

```
npx vitest run src/db/repos/journalEntries.test.ts
```

- [ ] **Step 5: Commit:**

```
git add src/db/repos/journalEntries.ts src/db/repos/journalEntries.test.ts
git commit -m "D0.2: add journalEntries pure repo + tests"
```

### Task D0.3: `savedLinks` repo + tests

**Files:**
- Create: `src/db/repos/savedLinks.ts`
- Test: `src/db/repos/savedLinks.test.ts`

- [ ] **Step 1: Write the failing repo test.** Same pattern as D0.2. Covers CRUD, `created_at DESC` ordering, nullable `title`/`note`/`thumbnail`, `updated_at` bump, and cascade-on-trip-delete. Create `src/db/repos/savedLinks.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { createTrip, deleteTrip } from '@/src/db/repos/trips';
import {
  addLink,
  getLink,
  listLinksForTrip,
  updateLink,
  deleteLink,
} from '@/src/db/repos/savedLinks';

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

describe('savedLinks repo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('addLink inserts with generated id/timestamps', () => {
    const { db, tripId } = setup();
    const l = addLink(db, {
      tripId,
      url: 'https://example.com/post',
      title: 'A post',
      note: 'read later',
      thumbnail: 't1/links/abc',
    });
    expect(l.id).toMatch(/[0-9a-f-]{36}/);
    expect(l.url).toBe('https://example.com/post');
    expect(l.title).toBe('A post');
    expect(l.note).toBe('read later');
    expect(l.thumbnail).toBe('t1/links/abc');
    expect(l.createdAt).toEqual(NOW);
    expect(l.updatedAt).toEqual(NOW);
    expect(getLink(db, l.id)?.url).toBe('https://example.com/post');
  });

  it('addLink defaults optional fields to null', () => {
    const { db, tripId } = setup();
    const l = addLink(db, { tripId, url: 'https://example.com' });
    expect(l.title).toBeNull();
    expect(l.note).toBeNull();
    expect(l.thumbnail).toBeNull();
  });

  it('listLinksForTrip orders by created_at desc', () => {
    const { db, tripId } = setup();
    vi.setSystemTime(new Date('2026-06-08T10:00:00Z'));
    const first = addLink(db, { tripId, url: 'https://a.com' });
    vi.setSystemTime(new Date('2026-06-08T11:00:00Z'));
    const second = addLink(db, { tripId, url: 'https://b.com' });
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
    const third = addLink(db, { tripId, url: 'https://c.com' });
    expect(listLinksForTrip(db, tripId).map((l) => l.id)).toEqual([
      third.id,
      second.id,
      first.id,
    ]);
  });

  it('listLinksForTrip is scoped to the trip', () => {
    const { db, tripId } = setup();
    addLink(db, { tripId, url: 'https://mine.com' });
    const other = createTrip(db, {
      name: 'X',
      startDate: '2026-07-01',
      endDate: '2026-07-02',
    });
    addLink(db, { tripId: other.id, url: 'https://theirs.com' });
    expect(listLinksForTrip(db, tripId).map((l) => l.url)).toEqual([
      'https://mine.com',
    ]);
  });

  it('updateLink patches fields and bumps updatedAt', () => {
    const { db, tripId } = setup();
    const l = addLink(db, { tripId, url: 'https://example.com', title: 'Old' });
    vi.setSystemTime(new Date('2026-06-09T12:00:00Z'));
    const updated = updateLink(db, l.id, { title: 'New', note: 'noted' });
    expect(updated?.title).toBe('New');
    expect(updated?.note).toBe('noted');
    expect(updated?.updatedAt).toEqual(new Date('2026-06-09T12:00:00Z'));
    expect(updated?.createdAt).toEqual(NOW);
  });

  it('updateLink can clear nullable fields', () => {
    const { db, tripId } = setup();
    const l = addLink(db, {
      tripId,
      url: 'https://example.com',
      title: 'T',
      thumbnail: 't1/links/x',
    });
    const updated = updateLink(db, l.id, { title: null, thumbnail: null });
    expect(updated?.title).toBeNull();
    expect(updated?.thumbnail).toBeNull();
  });

  it('updateLink returns undefined for unknown id', () => {
    const { db } = setup();
    expect(updateLink(db, 'nope', { title: 'x' })).toBeUndefined();
  });

  it('deleteLink removes the row', () => {
    const { db, tripId } = setup();
    const l = addLink(db, { tripId, url: 'https://example.com' });
    deleteLink(db, l.id);
    expect(getLink(db, l.id)).toBeUndefined();
  });

  it('deleting the trip cascades to its links', () => {
    const { db, tripId } = setup();
    const l = addLink(db, { tripId, url: 'https://example.com' });
    deleteTrip(db, tripId);
    expect(getLink(db, l.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the repo test — expect FAIL** (module does not exist yet):

```
npx vitest run src/db/repos/savedLinks.test.ts
```

- [ ] **Step 3: Implement the repo.** Same pure pattern. Create `src/db/repos/savedLinks.ts`:

```ts
import { desc, eq } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { savedLinks, type SavedLink } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';

export type { SavedLink };

type Db = TestDb['db'];

/** One link by id, or undefined. */
export function getLink(db: Db, id: string): SavedLink | undefined {
  return db.select().from(savedLinks).where(eq(savedLinks.id, id)).get();
}

/** All links for a trip, newest first (created_at desc). */
export function listLinksForTrip(db: Db, tripId: string): SavedLink[] {
  return db
    .select()
    .from(savedLinks)
    .where(eq(savedLinks.tripId, tripId))
    .orderBy(desc(savedLinks.createdAt))
    .all();
}

export interface AddLinkInput {
  tripId: string;
  url: string;
  title?: string | null;
  note?: string | null;
  thumbnail?: string | null; // relative derivative path
}

/** Insert a link; generates id + timestamps. */
export function addLink(db: Db, input: AddLinkInput): SavedLink {
  const ts = new Date(now());
  const row: SavedLink = {
    id: newId(),
    tripId: input.tripId,
    url: input.url,
    title: input.title ?? null,
    note: input.note ?? null,
    thumbnail: input.thumbnail ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(savedLinks).values(row).run();
  return row;
}

/** Editable subset (never id/tripId/timestamps). */
export type LinkPatch = Partial<
  Pick<SavedLink, 'url' | 'title' | 'note' | 'thumbnail'>
>;

/** Patch the provided fields; bumps updatedAt. Returns the row, or undefined. */
export function updateLink(
  db: Db,
  id: string,
  patch: LinkPatch,
): SavedLink | undefined {
  db.update(savedLinks)
    .set({ ...patch, updatedAt: new Date(now()) })
    .where(eq(savedLinks.id, id))
    .run();
  return getLink(db, id);
}

/** Delete a link (its thumbnail file is removed best-effort by the action). */
export function deleteLink(db: Db, id: string): void {
  db.delete(savedLinks).where(eq(savedLinks.id, id)).run();
}
```

- [ ] **Step 4: Run the repo test — expect PASS:**

```
npx vitest run src/db/repos/savedLinks.test.ts
```

- [ ] **Step 5: Commit:**

```
git add src/db/repos/savedLinks.ts src/db/repos/savedLinks.test.ts
git commit -m "D0.3: add savedLinks pure repo + tests"
```

### Task D0.4: `journalView` pure helpers + tests

**Files:**
- Create: `src/lib/journalView.ts`
- Test: `src/lib/journalView.test.ts`

- [ ] **Step 1: Write the failing helper test.** Mirrors `src/lib/budgetView.test.ts` / `eatsView.test.ts` (plain `describe`/`it`, no DB). Covers `entrySnippet` (strips `#`, `*`, `_`, `[]()` link syntax, code ticks; collapses whitespace; truncates at default 140 / custom maxLen with trailing ellipsis) and `linkDomain` (strips leading `www.`, lowercases host, `''` on bad input). Create `src/lib/journalView.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { entrySnippet, linkDomain } from '@/src/lib/journalView';

describe('entrySnippet', () => {
  it('returns plain text unchanged when short and unformatted', () => {
    expect(entrySnippet('A quiet day in the park.')).toBe(
      'A quiet day in the park.',
    );
  });

  it('strips heading hashes', () => {
    expect(entrySnippet('# Day One\nWe arrived.')).toBe('Day One We arrived.');
  });

  it('strips bold/italic asterisks and underscores', () => {
    expect(entrySnippet('It was **really** _great_ today.')).toBe(
      'It was really great today.',
    );
  });

  it('strips inline code backticks', () => {
    expect(entrySnippet('Run `npm run dev` first.')).toBe(
      'Run npm run dev first.',
    );
  });

  it('reduces markdown links to their text', () => {
    expect(entrySnippet('See [the map](https://maps.example.com) here.')).toBe(
      'See the map here.',
    );
  });

  it('collapses runs of whitespace and newlines to single spaces', () => {
    expect(entrySnippet('Line one\n\n  Line   two')).toBe('Line one Line two');
  });

  it('truncates to the default 140 chars with a trailing ellipsis', () => {
    const long = 'a'.repeat(200);
    const out = entrySnippet(long);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBe(141); // 140 chars + the ellipsis
    expect(out.slice(0, 140)).toBe('a'.repeat(140));
  });

  it('honors a custom maxLen', () => {
    expect(entrySnippet('abcdefghij', 5)).toBe('abcde…');
  });

  it('does not append an ellipsis when exactly at the limit', () => {
    expect(entrySnippet('abcde', 5)).toBe('abcde');
  });

  it('returns an empty string for an empty body', () => {
    expect(entrySnippet('')).toBe('');
  });
});

describe('linkDomain', () => {
  it('returns the hostname for a normal URL', () => {
    expect(linkDomain('https://example.com/path?q=1')).toBe('example.com');
  });

  it('strips a leading www.', () => {
    expect(linkDomain('https://www.example.com/post')).toBe('example.com');
  });

  it('lowercases the host', () => {
    expect(linkDomain('https://Example.COM/x')).toBe('example.com');
  });

  it('keeps non-www subdomains', () => {
    expect(linkDomain('https://blog.example.com')).toBe('blog.example.com');
  });

  it('returns empty string for unparseable input', () => {
    expect(linkDomain('not a url')).toBe('');
    expect(linkDomain('')).toBe('');
  });
});
```

- [ ] **Step 2: Run the helper test — expect FAIL** (module does not exist yet):

```
npx vitest run src/lib/journalView.test.ts
```

- [ ] **Step 3: Implement the helpers.** Create `src/lib/journalView.ts`:

```ts
/**
 * Pure Journal view helpers (Plan 3 §4–§5). Shared by JournalClient, the entry
 * feed, and LinkRow so UI and tests use one source of truth. No DB / DOM access.
 */

const DEFAULT_SNIPPET_LEN = 140;

/**
 * Plain-text excerpt of a markdown body for feed cards. Strips the common
 * inline/block markdown syntax (heading `#`, emphasis `*`/`_`, inline code
 * backticks, and `[text](url)` links → `text`), collapses whitespace, and
 * truncates to `maxLen` with a trailing ellipsis when it had to cut.
 */
export function entrySnippet(body: string, maxLen = DEFAULT_SNIPPET_LEN): string {
  const plain = body
    .replace(/`([^`]*)`/g, '$1') // inline code → its contents
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images → drop
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → link text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // ATX heading markers
    .replace(/[*_]+/g, '') // bold/italic markers
    .replace(/\s+/g, ' ') // collapse whitespace/newlines
    .trim();
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen)}…`;
}

/**
 * Display domain for a saved link: the URL hostname without a leading `www.`,
 * lowercased. Returns '' when the input is not a parseable absolute URL.
 */
export function linkDomain(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.replace(/^www\./, '');
  } catch {
    return '';
  }
}
```

- [ ] **Step 4: Run the helper test — expect PASS:**

```
npx vitest run src/lib/journalView.test.ts
```

- [ ] **Step 5: Commit:**

```
git add src/lib/journalView.ts src/lib/journalView.test.ts
git commit -m "D0.4: add journalView pure helpers (entrySnippet, linkDomain) + tests"
```

### Task D0.5: `linkPreview` pure helpers + tests

**Files:**
- Create: `src/lib/linkPreview.ts`
- Test: `src/lib/linkPreview.test.ts`

- [ ] **Step 1: Write the failing helper test.** Pure/synchronous (no DNS — the route resolves and passes each IP to `isBlockedAddress`). Covers `isHttpUrl` (http/https only) and `isBlockedAddress` across every blocked range plus public IPs that must pass. Create `src/lib/linkPreview.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isHttpUrl, isBlockedAddress } from '@/src/lib/linkPreview';

describe('isHttpUrl', () => {
  it('accepts http and https', () => {
    expect(isHttpUrl('http://example.com')).toBe(true);
    expect(isHttpUrl('https://example.com/path')).toBe(true);
  });

  it('rejects other schemes', () => {
    expect(isHttpUrl('ftp://example.com')).toBe(false);
    expect(isHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('data:text/html,x')).toBe(false);
  });

  it('rejects non-URLs', () => {
    expect(isHttpUrl('not a url')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
  });
});

describe('isBlockedAddress', () => {
  it('blocks IPv4 loopback (127/8)', () => {
    expect(isBlockedAddress('127.0.0.1')).toBe(true);
    expect(isBlockedAddress('127.255.255.254')).toBe(true);
  });

  it('blocks IPv6 loopback (::1)', () => {
    expect(isBlockedAddress('::1')).toBe(true);
  });

  it('blocks RFC1918 private 10/8', () => {
    expect(isBlockedAddress('10.0.0.1')).toBe(true);
    expect(isBlockedAddress('10.255.255.255')).toBe(true);
  });

  it('blocks RFC1918 private 172.16/12', () => {
    expect(isBlockedAddress('172.16.0.1')).toBe(true);
    expect(isBlockedAddress('172.31.255.255')).toBe(true);
  });

  it('does not block 172.15/172.32 (just outside 172.16/12)', () => {
    expect(isBlockedAddress('172.15.255.255')).toBe(false);
    expect(isBlockedAddress('172.32.0.1')).toBe(false);
  });

  it('blocks RFC1918 private 192.168/16', () => {
    expect(isBlockedAddress('192.168.0.1')).toBe(true);
    expect(isBlockedAddress('192.168.255.255')).toBe(true);
  });

  it('blocks IPv4 link-local 169.254/16', () => {
    expect(isBlockedAddress('169.254.1.1')).toBe(true);
  });

  it('blocks the cloud-metadata address 169.254.169.254', () => {
    expect(isBlockedAddress('169.254.169.254')).toBe(true);
  });

  it('blocks IPv6 link-local fe80::/10', () => {
    expect(isBlockedAddress('fe80::1')).toBe(true);
    expect(isBlockedAddress('febf::1')).toBe(true);
  });

  it('blocks IPv6 unique-local fc00::/7', () => {
    expect(isBlockedAddress('fc00::1')).toBe(true);
    expect(isBlockedAddress('fd12:3456::1')).toBe(true);
  });

  it('blocks CGNAT 100.64/10', () => {
    expect(isBlockedAddress('100.64.0.1')).toBe(true);
    expect(isBlockedAddress('100.127.255.255')).toBe(true);
  });

  it('does not block 100.63/100.128 (just outside CGNAT 100.64/10)', () => {
    expect(isBlockedAddress('100.63.255.255')).toBe(false);
    expect(isBlockedAddress('100.128.0.1')).toBe(false);
  });

  it('allows ordinary public IPv4 addresses', () => {
    expect(isBlockedAddress('8.8.8.8')).toBe(false);
    expect(isBlockedAddress('1.1.1.1')).toBe(false);
    expect(isBlockedAddress('93.184.216.34')).toBe(false);
  });

  it('allows ordinary public IPv6 addresses', () => {
    expect(isBlockedAddress('2606:4700:4700::1111')).toBe(false);
  });

  it('treats unparseable input as blocked (fail closed)', () => {
    expect(isBlockedAddress('not an ip')).toBe(true);
    expect(isBlockedAddress('')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the helper test — expect FAIL** (module does not exist yet):

```
npx vitest run src/lib/linkPreview.test.ts
```

- [ ] **Step 3: Implement the helpers.** Pure/synchronous; DNS resolution lives in the D2 route, which calls `isBlockedAddress` on each resolved IP. Create `src/lib/linkPreview.ts`:

```ts
/**
 * Pure URL/SSRF guard primitives for the link-preview route (Plan 3 §6.4).
 * These are synchronous and dependency-free so they unit-test in isolation;
 * the route does DNS resolution and calls `isBlockedAddress` on every resolved
 * IP (initial host + each redirect hop). Helpers fail CLOSED: anything we
 * cannot parse is treated as blocked.
 */

/** True only for absolute http:/https: URLs. */
export function isHttpUrl(raw: string): boolean {
  try {
    const proto = new URL(raw).protocol;
    return proto === 'http:' || proto === 'https:';
  } catch {
    return false;
  }
}

/** Parse a dotted-quad IPv4 string to a 32-bit number, or null if invalid. */
function parseIPv4(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value >>> 0;
}

/** True if `value` is inside the CIDR block `base/prefix` (IPv4, 32-bit ints). */
function inV4Cidr(value: number, base: string, prefix: number): boolean {
  const baseNum = parseIPv4(base);
  if (baseNum === null) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (baseNum & mask);
}

/**
 * True if the IP is one we must never fetch: loopback (127/8, ::1), RFC1918
 * private (10/8, 172.16/12, 192.168/16), link-local (169.254/16, fe80::/10),
 * IPv6 unique-local (fc00::/7), CGNAT (100.64/10), or the cloud-metadata
 * address 169.254.169.254. Unparseable input returns true (fail closed).
 */
export function isBlockedAddress(ip: string): boolean {
  const v4 = parseIPv4(ip);
  if (v4 !== null) {
    return (
      inV4Cidr(v4, '127.0.0.0', 8) || // loopback
      inV4Cidr(v4, '10.0.0.0', 8) || // private
      inV4Cidr(v4, '172.16.0.0', 12) || // private
      inV4Cidr(v4, '192.168.0.0', 16) || // private
      inV4Cidr(v4, '169.254.0.0', 16) || // link-local (incl. 169.254.169.254)
      inV4Cidr(v4, '100.64.0.0', 10) // CGNAT
    );
  }

  // IPv6 (and IPv4-mapped) — normalize and inspect the leading hextets.
  const lower = ip.toLowerCase();
  if (lower === '::1') return true; // loopback

  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — re-check the embedded IPv4.
  const mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isBlockedAddress(mapped[1]);

  const firstHextet = lower.split(':')[0];
  if (!/^[0-9a-f]{1,4}$/.test(firstHextet)) return true; // unparseable → blocked
  const block = parseInt(firstHextet, 16);

  // fc00::/7 unique-local → first 7 bits are 1111110.
  if ((block & 0xfe00) === 0xfc00) return true;
  // fe80::/10 link-local → first 10 bits are 1111111010.
  if ((block & 0xffc0) === 0xfe80) return true;

  return false;
}
```

- [ ] **Step 4: Run the helper test — expect PASS:**

```
npx vitest run src/lib/linkPreview.test.ts
```

- [ ] **Step 5: Commit:**

```
git add src/lib/linkPreview.ts src/lib/linkPreview.test.ts
git commit -m "D0.5: add linkPreview SSRF guard helpers (isHttpUrl, isBlockedAddress) + tests"
```

## Group D1 — Journal Entries (data + UI)

### Task D1.1: Add markdown rendering dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (regenerated)

- [ ] **Step 1: Install the markdown deps and repair the lockfile.** Run:
  ```bash
  npm install react-markdown@^9 remark-gfm@^4 rehype-sanitize@^6
  node scripts/fix-lockfile.mjs
  ```
  These are the three render-side deps named in spec §4.1 (the editor toolbar inserts plain markdown into a `<textarea>`, so no editor library is needed). `scripts/fix-lockfile.mjs` is the sharp-musl lockfile guard documented in spec §4.1 / the deployment notes — it MUST run after every `npm install` or the Docker build breaks.
- [ ] **Step 2: Verify the deps resolved and the lockfile is consistent.** Run:
  ```bash
  node -e "require.resolve('react-markdown'); require.resolve('remark-gfm'); require.resolve('rehype-sanitize'); console.log('ok')"
  npm ci --dry-run
  ```
  Expect `ok` and a clean `npm ci` dry-run (no "lockfile out of sync" error).
- [ ] **Step 3: Commit.**
  ```bash
  git add package.json package-lock.json
  git commit -m "D1.1: add react-markdown + remark-gfm + rehype-sanitize"
  ```

---

### Task D1.2: Extend POST /api/photos to accept journal owners

**Files:**
- Modify: `app/api/photos/route.ts`
- Test: `app/api/photos/route.test.ts`

> Depends on D0's `journal_entries` table + `getEntry` repo. `getEntry(db, id)` returns a `JournalEntry | undefined` whose `tripId` field names its trip (mirrors `getPlace`).

- [ ] **Step 1: Add failing tests for the journal-owner path.** Append these cases inside the existing `describe('POST /api/photos', …)` block in `app/api/photos/route.test.ts`, and extend `seed()` to also insert a journal entry. The file already mocks `@/src/db/client`, `@/src/env`, `@/src/lib/clock`, and `processPhoto`; reuse `uploadReq`/`imageBlob`/`listByOwner`/`TS`.

  Add the import + seed (top of file, after the existing schema import):
  ```ts
  import { trips, places, journalEntries } from '@/src/db/schema';
  ```
  Extend `seed()` with:
  ```ts
    db.insert(journalEntries).values({
      id: 'entry-1', tripId: 'trip-1', title: 'Day 1', body: '', entryDate: null,
      createdAt: TS, updatedAt: TS,
    }).run();
  ```
  Add the cases:
  ```ts
  it('uploads a journal photo when the entry belongs to the trip', async () => {
    const res = await POST(uploadReq({ image: imageBlob(), tripId: 'trip-1', ownerType: 'journal', ownerId: 'entry-1' }));
    expect(res.status).toBe(201);
    const body = await res.json() as { photo: { ownerId: string } };
    expect(body.photo.ownerId).toBe('entry-1');
    expect(listByOwner(testHandle.db, 'journal', 'entry-1')).toHaveLength(1);
  });

  it('returns 404 when the journal owner does not exist', async () => {
    const res = await POST(uploadReq({ image: imageBlob(), tripId: 'trip-1', ownerType: 'journal', ownerId: 'nope' }));
    expect(res.status).toBe(404);
    expect(processPhoto).not.toHaveBeenCalled();
  });

  it('returns 404 when the journal owner belongs to another trip', async () => {
    testHandle.db.insert(trips).values({
      id: 'trip-2', name: 'Other', startDate: '2026-07-01', endDate: '2026-07-02',
      coverPhoto: null, createdAt: TS, updatedAt: TS,
    }).run();
    const res = await POST(uploadReq({ image: imageBlob(), tripId: 'trip-2', ownerType: 'journal', ownerId: 'entry-1' }));
    expect(res.status).toBe(404);
  });

  it('enforces the per-owner max for journal photos', async () => {
    for (let i = 0; i < 12; i++) {
      const r = await POST(uploadReq({ image: imageBlob(), tripId: 'trip-1', ownerType: 'journal', ownerId: 'entry-1' }));
      expect(r.status).toBe(201);
    }
    const over = await POST(uploadReq({ image: imageBlob(), tripId: 'trip-1', ownerType: 'journal', ownerId: 'entry-1' }));
    expect(over.status).toBe(409);
  });
  ```
  The existing `it('returns 400 for an invalid ownerType', …)` (with `ownerType: 'bogus'`) stays — it now guards the widened-but-still-closed enum.
- [ ] **Step 2: Run the test — expect FAIL.**
  ```bash
  npx vitest run app/api/photos/route.test.ts
  ```
  Fails: the route returns `bad_owner_type` (400) for `ownerType:'journal'` (and `journalEntries` isn't imported into the route).
- [ ] **Step 3: Extend the route to accept journal owners.** Replace the whole of `app/api/photos/route.ts` with:
  ```ts
  import { NextResponse } from 'next/server';
  import { db } from '@/src/db/client';
  import { env } from '@/src/env';
  import { getTrip } from '@/src/db/repos/trips';
  import { getPlace } from '@/src/db/repos/places';
  import { getEntry } from '@/src/db/repos/journalEntries';
  import {
    addPhoto,
    listByOwner,
    type Photo,
    type PhotoOwnerType,
  } from '@/src/db/repos/photos';
  import {
    validateUpload,
    processPhoto,
  } from '@/src/lib/photos/pipeline';
  import { newId } from '@/src/db/ids';

  export const dynamic = 'force-dynamic';

  /** Per-owner max personal photos (Plan-2 public-app guard; reused for journal). */
  const MAX_PER_OWNER = 12;

  /** Owner types that may receive uploads (Plan 3 adds 'journal'). */
  const OWNER_TYPES: readonly PhotoOwnerType[] = ['place', 'journal'];

  /** Photo DTO returned to the client (full row). */
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
    if (typeof ownerType !== 'string' || !OWNER_TYPES.includes(ownerType as PhotoOwnerType)) {
      return NextResponse.json({ error: 'bad_owner_type' }, { status: 400 });
    }
    const owner = ownerType as PhotoOwnerType;

    // Image guards (content type + size cap) before any decode/disk work.
    const guard = validateUpload({ contentType: image.type, byteLength: image.size });
    if (!guard.ok) {
      const status = guard.reason === 'too_large' ? 413 : 415;
      return NextResponse.json({ error: guard.reason }, { status });
    }

    // Owner must exist and belong to the named trip.
    const trip = getTrip(db, tripId);
    if (!trip) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (owner === 'place') {
      const place = getPlace(db, ownerId);
      if (!place || place.tripId !== tripId) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
    } else {
      const entry = getEntry(db, ownerId);
      if (!entry || entry.tripId !== tripId) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
    }

    // Per-owner count cap.
    if (listByOwner(db, owner, ownerId).length >= MAX_PER_OWNER) {
      return NextResponse.json({ error: 'too_many' }, { status: 409 });
    }

    // Pre-generate the id so the on-disk path base matches the DB row.
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

    // Insert the row with the same id used for the disk path.
    const photo = addPhoto(db, {
      id: photoId,
      tripId,
      ownerType: owner,
      ownerId,
      width: result.width,
      height: result.height,
    });

    return NextResponse.json({ photo }, { status: 201 });
  }
  ```
- [ ] **Step 4: Run the test — expect PASS.**
  ```bash
  npx vitest run app/api/photos/route.test.ts
  ```
- [ ] **Step 5: Commit.**
  ```bash
  git add app/api/photos/route.ts app/api/photos/route.test.ts
  git commit -m "D1.2: accept ownerType='journal' in POST /api/photos"
  ```

---

### Task D1.3: GET /api/trips/[tripId]/journal read handler + EntryDTO

**Files:**
- Create: `app/api/trips/[tripId]/journal/route.ts`
- Test: `app/api/trips/[tripId]/journal/route.test.ts`

> Depends on D0: `listEntriesForTrip(db, tripId)` (created_at DESC) + `type JournalEntry` from `journalEntries.ts`; `listByTrip(db, tripId)` from `savedLinks.ts` returning `SavedLink[]`; `addEntry`/`addLink` repos for seeding.

- [ ] **Step 1: Write the failing handler test.** Create `app/api/trips/[tripId]/journal/route.test.ts`:
  ```ts
  import { describe, it, expect, beforeEach, vi } from 'vitest';
  import { makeTestDb } from '@/src/db/testDb';
  import { trips, photos } from '@/src/db/schema';
  import { addEntry } from '@/src/db/repos/journalEntries';
  import { addLink } from '@/src/db/repos/savedLinks';

  const testHandle = { db: makeTestDb().db };
  vi.mock('@/src/db/client', () => ({
    get db() { return testHandle.db; },
    sqlite: {},
  }));

  import { GET } from '@/app/api/trips/[tripId]/journal/route';

  const TS = new Date('2026-06-08T12:00:00.000Z');

  function seed(db: ReturnType<typeof makeTestDb>['db']) {
    db.insert(trips).values({
      id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
      coverPhoto: null, createdAt: TS, updatedAt: TS,
    }).run();
  }

  function ctx(tripId: string) {
    return { params: Promise.resolve({ tripId }) };
  }

  describe('GET /api/trips/[tripId]/journal', () => {
    beforeEach(() => {
      testHandle.db = makeTestDb().db;
      seed(testHandle.db);
    });

    it('returns 404 for an unknown trip', async () => {
      const res = await GET(new Request('http://t/'), ctx('nope'));
      expect(res.status).toBe(404);
    });

    it('returns entries newest-first, each with its journal photos, plus links', async () => {
      const a = addEntry(testHandle.db, { tripId: 'trip-1', title: 'First', body: 'hello', entryDate: '2026-06-05' });
      const b = addEntry(testHandle.db, { tripId: 'trip-1', title: 'Second', body: '', entryDate: null });
      // a photo for entry `a` only (owner_type journal)
      testHandle.db.insert(photos).values({
        id: 'ph1', tripId: 'trip-1', ownerType: 'journal', ownerId: a.id,
        path: `trip-1/ph1`, width: 800, height: 600, orderIndex: 0, createdAt: TS,
      }).run();
      // a non-journal photo on the same trip must NOT leak into any entry
      testHandle.db.insert(photos).values({
        id: 'ph2', tripId: 'trip-1', ownerType: 'place', ownerId: 'some-place',
        path: `trip-1/ph2`, width: 800, height: 600, orderIndex: 0, createdAt: TS,
      }).run();
      addLink(testHandle.db, { tripId: 'trip-1', url: 'https://example.com', title: 'Ex', note: null, thumbnail: null });

      const res = await GET(new Request('http://t/'), ctx('trip-1'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        entries: Array<{ id: string; title: string; photos: Array<{ id: string }> }>;
        links: Array<{ url: string }>;
      };
      // newest-written (created_at DESC) first → b before a
      expect(body.entries.map((e) => e.id)).toEqual([b.id, a.id]);
      expect(body.entries.find((e) => e.id === a.id)!.photos.map((p) => p.id)).toEqual(['ph1']);
      expect(body.entries.find((e) => e.id === b.id)!.photos).toEqual([]);
      expect(body.links.map((l) => l.url)).toEqual(['https://example.com']);
    });

    it('returns empty arrays for a trip with no journal data', async () => {
      const res = await GET(new Request('http://t/'), ctx('trip-1'));
      const body = (await res.json()) as { entries: unknown[]; links: unknown[] };
      expect(body.entries).toEqual([]);
      expect(body.links).toEqual([]);
    });
  });
  ```
- [ ] **Step 2: Run the test — expect FAIL.**
  ```bash
  npx vitest run "app/api/trips/[tripId]/journal/route.test.ts"
  ```
  Fails: `app/api/trips/[tripId]/journal/route.ts` does not exist.
- [ ] **Step 3: Create the read handler.** Create `app/api/trips/[tripId]/journal/route.ts` (mirrors the budget GET: `force-dynamic`, 404 on missing trip, batched photos via `inArray` to avoid N+1):
  ```ts
  import { NextResponse } from 'next/server';
  import { and, eq, inArray } from 'drizzle-orm';
  import { db } from '@/src/db/client';
  import { getTrip } from '@/src/db/repos/trips';
  import { listEntriesForTrip, type JournalEntry } from '@/src/db/repos/journalEntries';
  import { listByTrip as listLinksForTrip, type SavedLink } from '@/src/db/repos/savedLinks';
  import { photos, type Photo } from '@/src/db/schema';

  export const dynamic = 'force-dynamic';

  /** EntryDTO: a journal entry row + its attached journal photos (order_index asc). */
  export type EntryDTO = JournalEntry & { photos: Photo[] };

  export async function GET(
    _req: Request,
    ctx: { params: Promise<{ tripId: string }> },
  ) {
    const { tripId } = await ctx.params;
    const trip = getTrip(db, tripId);
    if (!trip) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const rawEntries = listEntriesForTrip(db, tripId);
    const entryIds = rawEntries.map((e) => e.id);

    // Batch all journal photos for this trip's entries in one query (no N+1).
    const photoMap = new Map<string, Photo[]>();
    if (entryIds.length > 0) {
      const rows = db
        .select()
        .from(photos)
        .where(and(eq(photos.ownerType, 'journal'), inArray(photos.ownerId, entryIds)))
        .orderBy(photos.orderIndex)
        .all();
      for (const row of rows) {
        const list = photoMap.get(row.ownerId) ?? [];
        list.push(row);
        photoMap.set(row.ownerId, list);
      }
    }

    const entries: EntryDTO[] = rawEntries.map((e) => ({
      ...e,
      photos: photoMap.get(e.id) ?? [],
    }));

    const links: SavedLink[] = listLinksForTrip(db, tripId);

    return NextResponse.json({ entries, links });
  }
  ```
- [ ] **Step 4: Run the test — expect PASS.**
  ```bash
  npx vitest run "app/api/trips/[tripId]/journal/route.test.ts"
  ```
- [ ] **Step 5: Commit.**
  ```bash
  git add "app/api/trips/[tripId]/journal/route.ts" "app/api/trips/[tripId]/journal/route.test.ts"
  git commit -m "D1.3: GET /api/trips/[tripId]/journal read handler + EntryDTO"
  ```

---

### Task D1.4: Journal Server Actions (add/update/delete, delete cascades photos)

**Files:**
- Create: `app/_actions/journal.ts`
- Test: `app/_actions/journal.test.ts`

> Depends on D0: `getEntry/listEntriesForTrip/addEntry/updateEntry/deleteEntry` + `type JournalEntry` from `journalEntries.ts`. Reuses the existing photos repo (`listByOwner('journal', id)`, `deletePhoto`) and the `deletePhotoAction` path-traversal idiom (`join` → `resolve` → `startsWith(root + sep)`, strictly under `UPLOADS_DIR`).

- [ ] **Step 1: Write the failing actions test.** Create `app/_actions/journal.test.ts`. It mocks `@/src/db/client`, `@/src/env`, `next/cache`, and `node:fs/promises` (to assert the per-photo derivative-dir cleanup without touching disk):
  ```ts
  import { describe, it, expect, beforeEach, vi } from 'vitest';
  import { makeTestDb } from '@/src/db/testDb';
  import { trips, photos } from '@/src/db/schema';

  const testHandle = { db: makeTestDb().db };
  vi.mock('@/src/db/client', () => ({
    get db() { return testHandle.db; },
    sqlite: {},
  }));
  vi.mock('@/src/env', () => ({ env: { UPLOADS_DIR: '/uploads' } }));
  const revalidatePath = vi.fn();
  vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
  const rm = vi.fn(async () => {});
  vi.mock('node:fs/promises', () => ({ rm: (...a: unknown[]) => rm(...a) }));

  import { addEntryAction, updateEntryAction, deleteEntryAction } from '@/app/_actions/journal';
  import { getEntry, addEntry } from '@/src/db/repos/journalEntries';
  import { listByOwner } from '@/src/db/repos/photos';

  const TS = new Date('2026-06-08T12:00:00.000Z');

  function seedTrip() {
    testHandle.db.insert(trips).values({
      id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
      coverPhoto: null, createdAt: TS, updatedAt: TS,
    }).run();
  }

  describe('journal actions', () => {
    beforeEach(() => {
      testHandle.db = makeTestDb().db;
      seedTrip();
      revalidatePath.mockClear();
      rm.mockClear();
    });

    it('addEntryAction inserts an entry and revalidates the journal path', async () => {
      const entry = await addEntryAction({ tripId: 'trip-1', title: 'Day 1', body: '# hi', entryDate: '2026-06-05' });
      expect(entry.title).toBe('Day 1');
      expect(getEntry(testHandle.db, entry.id)).toBeTruthy();
      expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/journal');
    });

    it('addEntryAction rejects an empty title', async () => {
      await expect(addEntryAction({ tripId: 'trip-1', title: '', body: '', entryDate: null }))
        .rejects.toThrow();
    });

    it('updateEntryAction patches an entry', async () => {
      const e = addEntry(testHandle.db, { tripId: 'trip-1', title: 'Old', body: '', entryDate: null });
      const updated = await updateEntryAction(e.id, { title: 'New', body: 'changed' });
      expect(updated.title).toBe('New');
      expect(updated.body).toBe('changed');
      expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/journal');
    });

    it('updateEntryAction throws for a missing entry', async () => {
      await expect(updateEntryAction('ghost', { title: 'x' })).rejects.toThrow();
    });

    it('deleteEntryAction removes the entry, its photo rows, and their derivative dirs', async () => {
      const e = addEntry(testHandle.db, { tripId: 'trip-1', title: 'Bye', body: '', entryDate: null });
      testHandle.db.insert(photos).values({
        id: 'ph1', tripId: 'trip-1', ownerType: 'journal', ownerId: e.id,
        path: `trip-1/ph1`, width: 1, height: 1, orderIndex: 0, createdAt: TS,
      }).run();
      testHandle.db.insert(photos).values({
        id: 'ph2', tripId: 'trip-1', ownerType: 'journal', ownerId: e.id,
        path: `trip-1/ph2`, width: 1, height: 1, orderIndex: 1, createdAt: TS,
      }).run();

      await deleteEntryAction(e.id);

      expect(getEntry(testHandle.db, e.id)).toBeUndefined();
      expect(listByOwner(testHandle.db, 'journal', e.id)).toHaveLength(0);
      // one rm() per derivative dir, each strictly under the uploads root
      expect(rm).toHaveBeenCalledTimes(2);
      expect(rm).toHaveBeenCalledWith('/uploads/trip-1/ph1', { recursive: true, force: true });
      expect(rm).toHaveBeenCalledWith('/uploads/trip-1/ph2', { recursive: true, force: true });
      expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/journal');
    });

    it('deleteEntryAction throws for a missing entry', async () => {
      await expect(deleteEntryAction('ghost')).rejects.toThrow();
    });
  });
  ```
- [ ] **Step 2: Run the test — expect FAIL.**
  ```bash
  npx vitest run app/_actions/journal.test.ts
  ```
  Fails: `app/_actions/journal.ts` does not exist.
- [ ] **Step 3: Create the actions.** Create `app/_actions/journal.ts`:
  ```ts
  'use server';

  import { z } from 'zod';
  import { rm } from 'node:fs/promises';
  import { join, resolve, sep } from 'node:path';
  import { revalidatePath } from 'next/cache';
  import { db } from '@/src/db/client';
  import { env } from '@/src/env';
  import {
    getEntry,
    addEntry,
    updateEntry,
    deleteEntry,
    type JournalEntry,
  } from '@/src/db/repos/journalEntries';
  import { listByOwner, deletePhoto } from '@/src/db/repos/photos';

  const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
  const title = z.string().trim().min(1, 'Title is required');
  const body = z.string().max(50_000);

  function revalidateJournal(tripId: string): void {
    revalidatePath(`/trip/${tripId}/journal`);
  }

  // --- addEntryAction -------------------------------------------------------

  const addSchema = z.object({
    tripId: z.string().min(1),
    title,
    body,
    entryDate: dateStr.nullish(),
  });

  export type AddEntryActionInput = z.input<typeof addSchema>;

  export async function addEntryAction(input: AddEntryActionInput): Promise<JournalEntry> {
    const data = addSchema.parse(input);
    const entry = addEntry(db, {
      tripId: data.tripId,
      title: data.title,
      body: data.body,
      entryDate: data.entryDate ?? null,
    });
    revalidateJournal(data.tripId);
    return entry;
  }

  // --- updateEntryAction ----------------------------------------------------

  const updateSchema = z.object({
    title: title.optional(),
    body: body.optional(),
    entryDate: dateStr.nullish(),
  });

  export type UpdateEntryActionPatch = z.input<typeof updateSchema>;

  export async function updateEntryAction(
    id: string,
    patch: UpdateEntryActionPatch,
  ): Promise<JournalEntry> {
    const existing = getEntry(db, id);
    if (!existing) throw new Error('Entry not found');
    const data = updateSchema.parse(patch);
    const updated = updateEntry(db, id, data);
    if (!updated) throw new Error('Entry not found');
    revalidateJournal(existing.tripId);
    return updated;
  }

  // --- deleteEntryAction ----------------------------------------------------

  /**
   * Delete an entry and its journal photos: remove each photo's on-disk
   * derivative dir (path-traversal-guarded, strictly *under* the uploads root —
   * never the root itself), delete the photo rows, then the entry, then
   * revalidate. Online-only (a Server Action). Mirrors deletePhotoAction's guard.
   */
  export async function deleteEntryAction(id: string): Promise<void> {
    const existing = getEntry(db, id);
    if (!existing) throw new Error('Entry not found');

    const root = resolve(env.UPLOADS_DIR);
    const galleryPhotos = listByOwner(db, 'journal', id);
    for (const photo of galleryPhotos) {
      const absPath = join(env.UPLOADS_DIR, photo.path);
      if (!resolve(absPath).startsWith(root + sep)) {
        throw new Error('Invalid photo path');
      }
      // Best-effort disk cleanup (force:true → no throw if already gone).
      await rm(absPath, { recursive: true, force: true });
      deletePhoto(db, photo.id);
    }

    deleteEntry(db, id);
    revalidateJournal(existing.tripId);
  }
  ```
- [ ] **Step 4: Run the test — expect PASS.**
  ```bash
  npx vitest run app/_actions/journal.test.ts
  ```
- [ ] **Step 5: Commit.**
  ```bash
  git add app/_actions/journal.ts app/_actions/journal.test.ts
  git commit -m "D1.4: journal Server Actions (delete cascades journal photos)"
  ```

---

### Task D1.5: Markdown.tsx (sanitized render wrapper)

**Files:**
- Create: `components/journal/Markdown.tsx`
- Test: `components/journal/Markdown.test.tsx`

- [ ] **Step 1: Write the failing test.** Create `components/journal/Markdown.test.tsx` — covers GFM rendering, link hardening, and sanitization of a script/raw-HTML payload (spec §4.1):
  ```tsx
  import { describe, it, expect } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import { Markdown } from '@/components/journal/Markdown';

  describe('Markdown', () => {
    it('renders standard markdown formatting', () => {
      render(<Markdown source={'# Title\n\nSome **bold** and *italic* text.'} />);
      expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument();
      expect(screen.getByText('bold')).toBeInTheDocument();
    });

    it('renders GFM lists', () => {
      render(<Markdown source={'- one\n- two'} />);
      expect(screen.getByText('one')).toBeInTheDocument();
      expect(screen.getByText('two')).toBeInTheDocument();
    });

    it('hardens links with target/rel', () => {
      render(<Markdown source={'[ex](https://example.com)'} />);
      const link = screen.getByRole('link', { name: 'ex' });
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });

    it('strips a script / raw-HTML payload (sanitization)', () => {
      const { container } = render(
        <Markdown source={'hello <script>window.__x=1</script><img src=x onerror="window.__y=1">'} />,
      );
      // No executable script element survives.
      expect(container.querySelector('script')).toBeNull();
      // No event handler attribute survives on any rendered element.
      expect(container.querySelector('[onerror]')).toBeNull();
      // The benign text is still present.
      expect(screen.getByText(/hello/)).toBeInTheDocument();
    });

    it('strips a javascript: link href (sanitization)', () => {
      const { container } = render(<Markdown source={'[x](javascript:alert(1))'} />);
      const anchor = container.querySelector('a');
      // rehype-sanitize drops the dangerous href entirely.
      expect(anchor?.getAttribute('href') ?? '').not.toContain('javascript:');
    });
  });
  ```
- [ ] **Step 2: Run the test — expect FAIL.**
  ```bash
  npx vitest run components/journal/Markdown.test.tsx
  ```
  Fails: `components/journal/Markdown.tsx` does not exist.
- [ ] **Step 3: Create the component.** Create `components/journal/Markdown.tsx`. It extends `rehype-sanitize`'s `defaultSchema` to keep link `target`/`rel`, and a `rehype` plugin forces `target="_blank" rel="noopener noreferrer"` on every anchor (so even bare `<a>` from autolinks are hardened). No `rehype-raw` → raw HTML is never parsed as HTML:
  ```tsx
  'use client';

  import ReactMarkdown from 'react-markdown';
  import remarkGfm from 'remark-gfm';
  import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
  import type { Root, Element } from 'hast';

  /**
   * Sanitize schema (spec §4.1): the rehype-sanitize default (standard
   * inline/block formatting; raw HTML & scripts already dropped) plus the `a`
   * `target`/`rel` attributes we set below. Cloned so we never mutate the import.
   */
  const schema = {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      a: [...(defaultSchema.attributes?.a ?? []), 'target', 'rel'],
    },
  };

  /** Force every anchor open in a new tab with a hardened rel (spec §4.1). */
  function rehypeHardenLinks() {
    return (tree: Root) => {
      const visit = (node: Root | Element) => {
        const children = node.children ?? [];
        for (const child of children) {
          if (child.type === 'element') {
            if (child.tagName === 'a') {
              child.properties = {
                ...child.properties,
                target: '_blank',
                rel: 'noopener noreferrer',
              };
            }
            visit(child);
          }
        }
      };
      visit(tree);
    };
  }

  /** Render sanitized markdown source. Runs client-side so it works offline. */
  export function Markdown({ source }: { source: string }) {
    return (
      <div className="prose-journal text-body text-ink [&_a]:text-teal [&_a]:underline [&_h1]:mt-3 [&_h1]:text-heading [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:text-label [&_h2]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_p]:mt-2 [&_strong]:font-semibold">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize.bind(null, schema), rehypeHardenLinks]}
        >
          {source}
        </ReactMarkdown>
      </div>
    );
  }
  ```
  > Note: `rehype-sanitize` runs *before* `rehypeHardenLinks`, and the schema whitelists `target`/`rel`, so the hardening attributes survive the sanitizer pass ordering. If `rehypeSanitize.bind` typing is awkward, use `[[rehypeSanitize, schema], rehypeHardenLinks]` (react-markdown accepts the `[plugin, options]` tuple form).
- [ ] **Step 4: Run the test — expect PASS.**
  ```bash
  npx vitest run components/journal/Markdown.test.tsx
  ```
- [ ] **Step 5: Commit.**
  ```bash
  git add components/journal/Markdown.tsx components/journal/Markdown.test.tsx
  git commit -m "D1.5: sanitized Markdown render wrapper"
  ```

---

### Task D1.6: EntryReader.tsx (markdown body + photo gallery)

**Files:**
- Create: `components/journal/EntryReader.tsx`
- Test: `components/journal/EntryReader.test.tsx`

> Reuses `PhotoGallery` (read-only here: `disabled` + a no-op `onDelete`) and `Markdown`. Renders `title`, optional `entry_date` + weekday, the markdown body, then the gallery. `EntryDTO` comes from the D1.3 read handler.

- [ ] **Step 1: Write the failing test.** Create `components/journal/EntryReader.test.tsx`. It mocks `PhotoGallery` and `Markdown` so the test focuses on EntryReader's own composition:
  ```tsx
  import { describe, it, expect, vi } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import { NextIntlClientProvider } from 'next-intl';
  import en from '@/messages/en.json';

  vi.mock('@/components/journal/Markdown', () => ({
    Markdown: ({ source }: { source: string }) => <div data-testid="md">{source}</div>,
  }));
  vi.mock('@/components/plan/PhotoGallery', () => ({
    PhotoGallery: ({ photos }: { photos: Array<{ id: string }> }) => (
      <div data-testid="gallery">{photos.length}</div>
    ),
  }));

  import { EntryReader } from '@/components/journal/EntryReader';
  import type { EntryDTO } from '@/app/api/trips/[tripId]/journal/route';

  function renderWith(ui: React.ReactElement) {
    return render(
      <NextIntlClientProvider locale="en" messages={en as never}>
        {ui}
      </NextIntlClientProvider>,
    );
  }

  const baseEntry = {
    id: 'e1', tripId: 'trip-1', title: 'Day One', body: '# hi', entryDate: '2026-06-05',
    createdAt: 0, updatedAt: 0,
    photos: [{ id: 'ph1', width: 800, height: 600 }],
  } as unknown as EntryDTO;

  describe('EntryReader', () => {
    it('renders the title, the markdown body, and the photo gallery', () => {
      renderWith(<EntryReader entry={baseEntry} onEdit={vi.fn()} onClose={vi.fn()} online />);
      expect(screen.getByText('Day One')).toBeInTheDocument();
      expect(screen.getByTestId('md')).toHaveTextContent('# hi');
      expect(screen.getByTestId('gallery')).toHaveTextContent('1');
    });

    it('shows the entry date when present', () => {
      renderWith(<EntryReader entry={baseEntry} onEdit={vi.fn()} onClose={vi.fn()} online />);
      expect(screen.getByText(/2026-06-05/)).toBeInTheDocument();
    });

    it('disables the Edit control when offline', () => {
      renderWith(<EntryReader entry={baseEntry} onEdit={vi.fn()} onClose={vi.fn()} online={false} />);
      expect(screen.getByRole('button', { name: en.journal.edit })).toBeDisabled();
    });
  });
  ```
- [ ] **Step 2: Run the test — expect FAIL.**
  ```bash
  npx vitest run components/journal/EntryReader.test.tsx
  ```
  Fails: `components/journal/EntryReader.tsx` does not exist (and `en.journal` keys land in D1.10 — if running this task before D1.10, temporarily-missing keys surface as raw key strings, which the `disabled` assertion still tolerates; D1.10 makes the label assertions exact).
- [ ] **Step 3: Create the component.** Create `components/journal/EntryReader.tsx`:
  ```tsx
  'use client';

  import { useTranslations } from 'next-intl';
  import { Markdown } from '@/components/journal/Markdown';
  import { PhotoGallery } from '@/components/plan/PhotoGallery';
  import type { EntryDTO } from '@/app/api/trips/[tripId]/journal/route';

  type Props = {
    entry: EntryDTO;
    online: boolean;
    onEdit: () => void;
    onClose: () => void;
  };

  /** Human weekday for an ISO date, e.g. "Friday". Empty string if unparseable. */
  function weekday(iso: string): string {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en', { weekday: 'long' }).format(d);
  }

  /** Full-bleed entry reader: title, date, sanitized markdown body, photo gallery. */
  export function EntryReader({ entry, online, onEdit, onClose }: Props) {
    const t = useTranslations('journal');
    const wd = entry.entryDate ? weekday(entry.entryDate) : '';

    return (
      <main className="mx-auto w-full max-w-md px-4 pb-24 pt-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="rounded-control bg-paper px-3 py-1.5 text-caption font-medium text-ink shadow-inset"
          >
            {t('back')}
          </button>
          <button
            type="button"
            disabled={!online}
            onClick={onEdit}
            className="rounded-control bg-coral px-4 py-1.5 text-caption font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
          >
            {t('edit')}
          </button>
        </div>

        <h1 className="mt-4 text-heading font-semibold text-ink">{entry.title}</h1>
        {entry.entryDate ? (
          <p className="mt-1 text-caption text-ink-muted">
            {entry.entryDate}{wd ? ` · ${wd}` : ''}
          </p>
        ) : null}

        {entry.body.trim() !== '' ? (
          <div className="mt-4">
            <Markdown source={entry.body} />
          </div>
        ) : null}

        <PhotoGallery
          photos={entry.photos.map((p) => ({ id: p.id, width: p.width, height: p.height }))}
          placeName={entry.title}
          disabled
          onDelete={() => {}}
        />
      </main>
    );
  }
  ```
  > `PhotoGallery` uses `useTranslations('plan')` for its `photosLabel`/`photoOf`/etc. keys — those already exist in `en.json` (Plan 2), so the reader's gallery needs no new strings.
- [ ] **Step 4: Run the test — expect PASS.** (Run after D1.10 for the exact-label assertions; the structural assertions pass now.)
  ```bash
  npx vitest run components/journal/EntryReader.test.tsx
  ```
- [ ] **Step 5: Commit.**
  ```bash
  git add components/journal/EntryReader.tsx components/journal/EntryReader.test.tsx
  git commit -m "D1.6: EntryReader (markdown body + photo gallery)"
  ```

---

### Task D1.7: EntrySheet.tsx (add/edit bottom sheet with markdown editor + photos)

**Files:**
- Create: `components/journal/EntrySheet.tsx`
- Test: `components/journal/EntrySheet.test.tsx`

> Mirrors `ExpenseSheet` (bottom sheet, keyed-remount, inline error, offline-disabled) and `PlaceDetailSheet`'s photo attach flow (`usePhotoUpload` + `PhotoGallery` + `deletePhotoAction`, enabled only in edit mode). The markdown editor is a toolbar that wraps the `<textarea>` selection in markdown syntax. Delete is behind an inline confirm.

- [ ] **Step 1: Write the failing test.** Create `components/journal/EntrySheet.test.tsx`. It mocks the journal + photo actions, the upload hook, and `PhotoGallery`:
  ```tsx
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render, screen, fireEvent, waitFor } from '@testing-library/react';
  import { NextIntlClientProvider } from 'next-intl';
  import en from '@/messages/en.json';

  const addEntryAction = vi.fn();
  const updateEntryAction = vi.fn();
  const deleteEntryAction = vi.fn();
  vi.mock('@/app/_actions/journal', () => ({
    addEntryAction: (...a: unknown[]) => addEntryAction(...a),
    updateEntryAction: (...a: unknown[]) => updateEntryAction(...a),
    deleteEntryAction: (...a: unknown[]) => deleteEntryAction(...a),
  }));
  const deletePhotoAction = vi.fn();
  vi.mock('@/app/_actions/photos', () => ({
    deletePhotoAction: (...a: unknown[]) => deletePhotoAction(...a),
  }));
  const upload = vi.fn();
  vi.mock('@/components/plan/usePhotoUpload', () => ({
    usePhotoUpload: () => ({ upload, uploading: false, error: null }),
  }));
  vi.mock('@/components/plan/PhotoGallery', () => ({
    PhotoGallery: ({ photos }: { photos: Array<{ id: string }> }) => (
      <div data-testid="gallery">{photos.length}</div>
    ),
  }));

  import { EntrySheet } from '@/components/journal/EntrySheet';
  import type { EntryDTO } from '@/app/api/trips/[tripId]/journal/route';

  function renderWith(ui: React.ReactElement) {
    return render(
      <NextIntlClientProvider locale="en" messages={en as never}>
        {ui}
      </NextIntlClientProvider>,
    );
  }

  const editEntry = {
    id: 'e1', tripId: 'trip-1', title: 'Day One', body: 'hello', entryDate: '2026-06-05',
    createdAt: 0, updatedAt: 0,
    photos: [{ id: 'ph1', width: 800, height: 600 }],
  } as unknown as EntryDTO;

  describe('EntrySheet', () => {
    beforeEach(() => {
      addEntryAction.mockReset().mockResolvedValue({ id: 'e-new' });
      updateEntryAction.mockReset().mockResolvedValue({ id: 'e1' });
      deleteEntryAction.mockReset().mockResolvedValue(undefined);
      deletePhotoAction.mockReset().mockResolvedValue(undefined);
      upload.mockReset().mockResolvedValue({ photo: { id: 'ph2' }, errorCode: null });
    });

    it('renders nothing when closed', () => {
      const { container } = renderWith(
        <EntrySheet open={false} tripId="trip-1" today="2026-06-06" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('defaults the date to today in add mode and hides the photo control', () => {
      renderWith(
        <EntrySheet open tripId="trip-1" today="2026-06-06" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
      );
      expect((screen.getByLabelText(en.journal.dateLabel) as HTMLInputElement).value).toBe('2026-06-06');
      // photos require an entry id → add mode shows the hint, not a file input
      expect(screen.getByText(en.journal.photosAfterSaveHint)).toBeInTheDocument();
      expect(screen.queryByLabelText(en.journal.addPhoto)).toBeNull();
    });

    it('rejects a blank title with the validation message (no action call)', async () => {
      renderWith(
        <EntrySheet open tripId="trip-1" today="2026-06-06" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
      );
      screen.getByRole('button', { name: en.journal.save }).click();
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.journal.titleRequired));
      expect(addEntryAction).not.toHaveBeenCalled();
    });

    it('adds an entry with title/body/entryDate', async () => {
      const onSaved = vi.fn();
      renderWith(
        <EntrySheet open tripId="trip-1" today="2026-06-06" disabled={false} onClose={vi.fn()} onSaved={onSaved} />,
      );
      fireEvent.change(screen.getByLabelText(en.journal.titleLabel), { target: { value: 'My Day' } });
      fireEvent.change(screen.getByLabelText(en.journal.bodyLabel), { target: { value: 'It rained.' } });
      screen.getByRole('button', { name: en.journal.save }).click();
      await waitFor(() => expect(addEntryAction).toHaveBeenCalledTimes(1));
      expect(addEntryAction).toHaveBeenCalledWith({
        tripId: 'trip-1', title: 'My Day', body: 'It rained.', entryDate: '2026-06-06',
      });
      expect(onSaved).toHaveBeenCalled();
    });

    it('sends null entryDate when the date is cleared', async () => {
      renderWith(
        <EntrySheet open tripId="trip-1" today="2026-06-06" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
      );
      fireEvent.change(screen.getByLabelText(en.journal.titleLabel), { target: { value: 'X' } });
      fireEvent.change(screen.getByLabelText(en.journal.dateLabel), { target: { value: '' } });
      screen.getByRole('button', { name: en.journal.save }).click();
      await waitFor(() => expect(addEntryAction).toHaveBeenCalledWith(
        expect.objectContaining({ entryDate: null }),
      ));
    });

    it('inserts bold markdown around the selection via the toolbar', () => {
      renderWith(
        <EntrySheet open tripId="trip-1" today="2026-06-06" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
      );
      const ta = screen.getByLabelText(en.journal.bodyLabel) as HTMLTextAreaElement;
      fireEvent.change(ta, { target: { value: 'word' } });
      ta.setSelectionRange(0, 4);
      screen.getByRole('button', { name: en.journal.mdBold }).click();
      expect(ta.value).toBe('**word**');
    });

    it('pre-fills, updates, and shows the photo gallery + Delete in edit mode', async () => {
      renderWith(
        <EntrySheet open tripId="trip-1" entry={editEntry} today="2026-06-06" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
      );
      expect((screen.getByLabelText(en.journal.titleLabel) as HTMLInputElement).value).toBe('Day One');
      expect(screen.getByTestId('gallery')).toHaveTextContent('1');
      fireEvent.change(screen.getByLabelText(en.journal.titleLabel), { target: { value: 'Edited' } });
      screen.getByRole('button', { name: en.journal.save }).click();
      await waitFor(() => expect(updateEntryAction).toHaveBeenCalledWith('e1', expect.objectContaining({ title: 'Edited' })));
      expect(screen.getByRole('button', { name: en.journal.delete })).toBeInTheDocument();
    });

    it('deletes only after the inline confirm in edit mode', async () => {
      const onSaved = vi.fn();
      renderWith(
        <EntrySheet open tripId="trip-1" entry={editEntry} today="2026-06-06" disabled={false} onClose={vi.fn()} onSaved={onSaved} />,
      );
      screen.getByRole('button', { name: en.journal.delete }).click();
      expect(deleteEntryAction).not.toHaveBeenCalled();
      screen.getByRole('button', { name: en.journal.confirmDelete }).click();
      await waitFor(() => expect(deleteEntryAction).toHaveBeenCalledWith('e1'));
      expect(onSaved).toHaveBeenCalled();
    });

    it('shows an inline error and keeps the sheet open when save rejects', async () => {
      addEntryAction.mockRejectedValueOnce(new Error('boom'));
      const onClose = vi.fn();
      renderWith(
        <EntrySheet open tripId="trip-1" today="2026-06-06" disabled={false} onClose={onClose} onSaved={vi.fn()} />,
      );
      fireEvent.change(screen.getByLabelText(en.journal.titleLabel), { target: { value: 'X' } });
      screen.getByRole('button', { name: en.journal.save }).click();
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.journal.saveFailed));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('disables Save and shows the offline notice when offline', () => {
      renderWith(
        <EntrySheet open tripId="trip-1" today="2026-06-06" disabled onClose={vi.fn()} onSaved={vi.fn()} />,
      );
      expect(screen.getByRole('button', { name: en.journal.save })).toBeDisabled();
      expect(screen.getByText(en.journal.offlineHint)).toBeInTheDocument();
    });
  });
  ```
- [ ] **Step 2: Run the test — expect FAIL.**
  ```bash
  npx vitest run components/journal/EntrySheet.test.tsx
  ```
  Fails: `components/journal/EntrySheet.tsx` does not exist.
- [ ] **Step 3: Create the component.** Create `components/journal/EntrySheet.tsx`:
  ```tsx
  'use client';

  import { useRef, useState, useTransition } from 'react';
  import { useTranslations } from 'next-intl';
  import {
    addEntryAction,
    updateEntryAction,
    deleteEntryAction,
  } from '@/app/_actions/journal';
  import { deletePhotoAction } from '@/app/_actions/photos';
  import { usePhotoUpload } from '@/components/plan/usePhotoUpload';
  import { PhotoGallery } from '@/components/plan/PhotoGallery';
  import type { EntryDTO } from '@/app/api/trips/[tripId]/journal/route';

  type Props = {
    open: boolean;
    tripId: string;
    /** Present → edit mode; absent → add mode. */
    entry?: EntryDTO;
    disabled: boolean; // offline → true
    today: string; // YYYY-MM-DD default for add mode
    onClose: () => void;
    /** Called after any successful mutation (save/delete/photo) so the owner reloads. */
    onSaved: () => void;
  };

  /** One markdown toolbar action: wrap the selection (or insert at the caret). */
  type MdAction = { id: 'bold' | 'italic' | 'heading' | 'list' | 'link'; before: string; after: string };
  const MD_ACTIONS: MdAction[] = [
    { id: 'bold', before: '**', after: '**' },
    { id: 'italic', before: '*', after: '*' },
    { id: 'heading', before: '# ', after: '' },
    { id: 'list', before: '- ', after: '' },
    { id: 'link', before: '[', after: '](https://)' },
  ];

  export function EntrySheet({
    open,
    tripId,
    entry,
    disabled,
    today,
    onClose,
    onSaved,
  }: Props) {
    const t = useTranslations('journal');
    const isEdit = !!entry;
    const [title, setTitle] = useState(entry?.title ?? '');
    const [body, setBody] = useState(entry?.body ?? '');
    const [entryDate, setEntryDate] = useState(entry?.entryDate ?? today);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [photoError, setPhotoError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const bodyRef = useRef<HTMLTextAreaElement>(null);
    const { upload, uploading } = usePhotoUpload();

    if (!open) return null;

    function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
      if (e.key === 'Escape') onClose();
    }

    /** Wrap the current textarea selection in the action's markdown syntax. */
    function applyMarkdown(action: MdAction) {
      const ta = bodyRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = body.slice(start, end);
      const next = body.slice(0, start) + action.before + selected + action.after + body.slice(end);
      setBody(next);
      // Restore a sensible caret/selection after React re-renders.
      const caretStart = start + action.before.length;
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(caretStart, caretStart + selected.length);
      });
    }

    function handleSave() {
      setError(null);
      const trimmed = title.trim();
      if (trimmed === '') {
        setError(t('titleRequired'));
        return;
      }
      const payload = {
        title: trimmed,
        body,
        entryDate: entryDate === '' ? null : entryDate,
      };
      startTransition(async () => {
        try {
          if (isEdit && entry) {
            await updateEntryAction(entry.id, payload);
          } else {
            await addEntryAction({ tripId, ...payload });
          }
          onSaved();
          onClose();
        } catch {
          setError(t('saveFailed'));
        }
      });
    }

    function handleDelete() {
      if (!entry) return;
      setError(null);
      startTransition(async () => {
        try {
          await deleteEntryAction(entry.id);
          onSaved();
          onClose();
        } catch {
          setError(t('mutationFailed'));
        }
      });
    }

    async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      e.target.value = ''; // allow re-picking the same file
      if (!file || !entry) return;
      setPhotoError(null);
      if (!file.type.startsWith('image/')) { setPhotoError(t('photoNotImage')); return; }
      const { photo, errorCode } = await upload({ file, tripId, ownerId: entry.id });
      if (photo) {
        onSaved(); // owner reloads → gallery refreshes with the new photo
      } else if (errorCode === 'too_large') {
        setPhotoError(t('photoTooLarge'));
      } else if (errorCode === 'too_many') {
        setPhotoError(t('photoTooMany'));
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

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? t('editEntry') : t('newEntry')}
        className="fixed inset-0 z-50 flex items-end bg-[rgb(110_85_68_/_0.45)]"
        onClick={onClose}
        onKeyDown={handleKeyDown}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-card p-6 shadow-lift"
        >
          <h2 className="mb-3 text-heading font-semibold text-ink">
            {isEdit ? t('editEntry') : t('newEntry')}
          </h2>

          {error ? (
            <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-caption text-red-700">
              {error}
            </p>
          ) : null}

          {disabled ? (
            <p className="mb-3 text-caption text-ink-muted">{t('offlineHint')}</p>
          ) : null}

          <label className="block text-label font-medium text-ink" htmlFor="je-title">
            {t('titleLabel')}
          </label>
          <input
            id="je-title"
            type="text"
            value={title}
            disabled={disabled}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
          />

          <label className="mt-3 block text-label font-medium text-ink" htmlFor="je-date">
            {t('dateLabel')}
          </label>
          <input
            id="je-date"
            type="date"
            value={entryDate}
            disabled={disabled}
            onChange={(e) => setEntryDate(e.target.value)}
            className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
          />

          <label className="mt-3 block text-label font-medium text-ink" htmlFor="je-body">
            {t('bodyLabel')}
          </label>
          <div role="toolbar" aria-label={t('mdToolbar')} className="mt-1 flex flex-wrap gap-1">
            {MD_ACTIONS.map((a) => (
              <button
                key={a.id}
                type="button"
                disabled={disabled}
                onClick={() => applyMarkdown(a)}
                className="rounded-control bg-paper px-3 py-1.5 text-caption font-medium text-ink shadow-inset disabled:opacity-40"
              >
                {t(`md${a.id.charAt(0).toUpperCase()}${a.id.slice(1)}` as `md${'Bold' | 'Italic' | 'Heading' | 'List' | 'Link'}`)}
              </button>
            ))}
          </div>
          <textarea
            id="je-body"
            ref={bodyRef}
            rows={8}
            value={body}
            disabled={disabled}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 font-mono text-body text-ink disabled:opacity-60"
          />

          {photoError ? (
            <p role="alert" className="mt-3 rounded-control bg-red-50 px-3 py-2 text-caption text-red-700">
              {photoError}
            </p>
          ) : null}

          {isEdit && entry ? (
            <>
              <PhotoGallery
                photos={entry.photos.map((p) => ({ id: p.id, width: p.width, height: p.height }))}
                placeName={entry.title}
                disabled={disabled}
                onDelete={handlePhotoDelete}
              />
              <label className="mt-3 block text-label font-medium text-ink" htmlFor="je-photo">
                {t('addPhoto')}
              </label>
              {disabled ? <p className="text-caption text-ink-muted">{t('addPhotoOffline')}</p> : null}
              <input
                id="je-photo"
                type="file"
                accept="image/*"
                disabled={disabled || uploading}
                onChange={handlePhotoChange}
                className="mt-1 w-full text-body text-ink disabled:opacity-60"
              />
              {uploading ? (
                <p className="mt-1 text-caption text-ink-muted">{t('uploadingPhoto')}</p>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-caption text-ink-muted">{t('photosAfterSaveHint')}</p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={disabled || isPending}
            className="mt-5 w-full rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
          >
            {t('save')}
          </button>

          {isEdit ? (
            confirmingDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={disabled || isPending}
                className="mt-2 w-full rounded-control bg-red-50 px-4 py-3 text-label font-medium text-red-700 shadow-inset disabled:opacity-40"
              >
                {t('confirmDelete')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={disabled || isPending}
                className="mt-2 w-full rounded-control bg-paper px-4 py-3 text-label font-medium text-red-600 shadow-inset disabled:opacity-40"
              >
                {t('delete')}
              </button>
            )
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
  > Photo edits (upload/delete) call `onSaved()` to make the owner reload, but the sheet stays open so the user can keep editing — matching `PlaceDetailSheet`. The owner keys the sheet's remount per open (D1.8), so the freshly-loaded `entry.photos` flow back in on the next open; within one open session the gallery reflects the pre-load snapshot, identical to Plan 2's place-photo behavior.
- [ ] **Step 4: Run the test — expect PASS.** (Run after D1.10 for the exact i18n labels.)
  ```bash
  npx vitest run components/journal/EntrySheet.test.tsx
  ```
- [ ] **Step 5: Commit.**
  ```bash
  git add components/journal/EntrySheet.tsx components/journal/EntrySheet.test.tsx
  git commit -m "D1.7: EntrySheet (markdown editor + photo attach + delete-confirm)"
  ```

---

### Task D1.8: JournalClient.tsx (entries feed + segmented control + read-handler fetch)

**Files:**
- Create: `components/journal/JournalClient.tsx`
- Test: `components/journal/JournalClient.test.tsx`

> Static-shell data owner, mirrors `BudgetClient`: online/offline tracking, mounted-ref guard, loading/error/loaded states, `withBase` + `credentials:'same-origin'` fetch of `GET /api/trips/[tripId]/journal`, keyed-remount-on-open sheets. Adds a segmented **Entries ⇄ Reading list** control. The Reading-list sub-view renders a placeholder `<p>` — **D2 replaces it with `LinkRow`/`LinkSheet`**. Uses `entrySnippet` from D0's `journalView.ts` for feed excerpts.

> Depends on D0: `entrySnippet(body: string, max?: number): string` in `src/lib/journalView.ts` (plain-text excerpt of markdown source).

- [ ] **Step 1: Write the failing test.** Create `components/journal/JournalClient.test.tsx`. It stubs `EntrySheet`/`EntryReader` (own unit tests in D1.6/D1.7) and mocks `journalView`:
  ```tsx
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render, screen, waitFor } from '@testing-library/react';
  import userEvent from '@testing-library/user-event';
  import { NextIntlClientProvider } from 'next-intl';
  import en from '@/messages/en.json';

  vi.mock('@/components/journal/EntrySheet', () => ({
    EntrySheet: ({ open }: { open: boolean }) => (open ? <div data-testid="entry-sheet" /> : null),
  }));
  vi.mock('@/components/journal/EntryReader', () => ({
    EntryReader: ({ entry }: { entry: { title: string } }) => <div data-testid="entry-reader">{entry.title}</div>,
  }));
  vi.mock('@/src/lib/journalView', () => ({
    entrySnippet: (body: string) => `snippet:${body}`,
  }));

  import { JournalClient } from '@/components/journal/JournalClient';

  function renderWith(ui: React.ReactElement) {
    return render(
      <NextIntlClientProvider locale="en" messages={en as never}>
        {ui}
      </NextIntlClientProvider>,
    );
  }

  const journalBody = {
    entries: [
      { id: 'e1', tripId: 'trip-1', title: 'Day Two', body: 'rain', entryDate: '2026-06-06', createdAt: 2, updatedAt: 2, photos: [{ id: 'ph1', width: 800, height: 600 }] },
      { id: 'e2', tripId: 'trip-1', title: 'Day One', body: 'sun', entryDate: '2026-06-05', createdAt: 1, updatedAt: 1, photos: [] },
    ],
    links: [],
  };

  function mockFetchOk(body: unknown = journalBody) {
    return vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response));
  }

  describe('JournalClient', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', mockFetchOk());
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    });

    it('shows a loading state then renders the entries feed', async () => {
      renderWith(<JournalClient tripId="trip-1" />);
      expect(screen.getByText(en.journal.loading)).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText('Day Two')).toBeInTheDocument());
      expect(screen.getByText('Day One')).toBeInTheDocument();
      expect(screen.getByText('snippet:rain')).toBeInTheDocument();
    });

    it('fetches the journal read handler with the base-prefixed URL', async () => {
      renderWith(<JournalClient tripId="trip-1" />);
      await waitFor(() => expect(screen.getByText('Day Two')).toBeInTheDocument());
      const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.endsWith('/api/trips/trip-1/journal'))).toBe(true);
    });

    it('toggles to the reading-list placeholder and back', async () => {
      renderWith(<JournalClient tripId="trip-1" />);
      await waitFor(() => expect(screen.getByText('Day Two')).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: en.journal.readingList }));
      expect(screen.getByRole('button', { name: en.journal.readingList })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText(en.journal.readingListComingSoon)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: en.journal.entries }));
      expect(screen.getByText('Day Two')).toBeInTheDocument();
    });

    it('opens the editor in add mode from the new-entry button', async () => {
      renderWith(<JournalClient tripId="trip-1" />);
      await waitFor(() => expect(screen.getByText('Day Two')).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: en.journal.newEntry }));
      expect(screen.getByTestId('entry-sheet')).toBeInTheDocument();
    });

    it('opens the reader when an entry card is tapped', async () => {
      renderWith(<JournalClient tripId="trip-1" />);
      await waitFor(() => expect(screen.getByText('Day Two')).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: /Day Two/ }));
      expect(screen.getByTestId('entry-reader')).toHaveTextContent('Day Two');
    });

    it('disables the new-entry button when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      renderWith(<JournalClient tripId="trip-1" />);
      await waitFor(() => expect(screen.getByText('Day Two')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: en.journal.newEntry })).toBeDisabled();
    });

    it('renders the error state when the fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false } as Response)));
      renderWith(<JournalClient tripId="trip-1" />);
      await waitFor(() => expect(screen.getByText(en.journal.errorHeadline)).toBeInTheDocument());
    });

    it('shows the empty state when there are no entries', async () => {
      vi.stubGlobal('fetch', mockFetchOk({ entries: [], links: [] }));
      renderWith(<JournalClient tripId="trip-1" />);
      await waitFor(() => expect(screen.getByText(en.journal.emptyHeadline)).toBeInTheDocument());
    });
  });
  ```
- [ ] **Step 2: Run the test — expect FAIL.**
  ```bash
  npx vitest run components/journal/JournalClient.test.tsx
  ```
  Fails: `components/journal/JournalClient.tsx` does not exist.
- [ ] **Step 3: Create the component.** Create `components/journal/JournalClient.tsx`:
  ```tsx
  'use client';

  import { useCallback, useEffect, useRef, useState } from 'react';
  import { useTranslations } from 'next-intl';
  import { withBase } from '@/src/lib/basePath';
  import { personalPhotoUrl } from '@/src/lib/planUrl';
  import { entrySnippet } from '@/src/lib/journalView';
  import { EmptyState } from '@/components/EmptyState';
  import { EntrySheet } from '@/components/journal/EntrySheet';
  import { EntryReader } from '@/components/journal/EntryReader';
  import type { EntryDTO } from '@/app/api/trips/[tripId]/journal/route';
  import type { SavedLink } from '@/src/db/repos/savedLinks';

  type Tab = 'entries' | 'links';
  type JournalData = { entries: EntryDTO[]; links: SavedLink[] };
  type LoadState =
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'loaded'; data: JournalData };

  /** Today's calendar date (YYYY-MM-DD) — default for new entries (en-CA idiom). */
  function todayISO(): string {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  export function JournalClient({ tripId }: { tripId: string }) {
    const t = useTranslations('journal');
    const [state, setState] = useState<LoadState>({ status: 'loading' });
    const [online, setOnline] = useState(true);
    const [tab, setTab] = useState<Tab>('entries');
    const [reading, setReading] = useState<EntryDTO | null>(null);
    const [entrySheet, setEntrySheet] = useState<{ open: boolean; entry?: EntryDTO }>({ open: false });
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
        const res = await fetch(withBase(`/api/trips/${tripId}/journal`), { credentials: 'same-origin' });
        if (!res.ok) throw new Error('load failed');
        const { entries, links } = (await res.json()) as JournalData;
        if (mountedRef.current) setState({ status: 'loaded', data: { entries, links } });
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
      return <EmptyState mascotAlt={t('entries')} headline={t('errorHeadline')} subtext={t('errorSubtext')} />;
    }

    const { entries } = state.data;

    // The reader is a full-view replacement (like opening a detail page).
    if (reading) {
      // Keep the reader bound to the latest loaded copy of this entry.
      const fresh = entries.find((e) => e.id === reading.id) ?? reading;
      return (
        <EntryReader
          entry={fresh}
          online={online}
          onClose={() => setReading(null)}
          onEdit={() => {
            setReading(null);
            setEntrySheet({ open: true, entry: fresh });
          }}
        />
      );
    }

    return (
      <main className="mx-auto w-full max-w-md px-4 pb-24 pt-2">
        <div className="mt-2 flex items-center justify-between">
          <div role="group" className="flex rounded-control bg-card p-0.5 shadow-inset">
            <button
              type="button"
              aria-pressed={tab === 'entries'}
              onClick={() => setTab('entries')}
              className={`rounded-control px-3 py-1.5 text-caption font-medium ${tab === 'entries' ? 'bg-coral text-white' : 'text-ink-muted'}`}
            >
              {t('entries')}
            </button>
            <button
              type="button"
              aria-pressed={tab === 'links'}
              onClick={() => setTab('links')}
              className={`rounded-control px-3 py-1.5 text-caption font-medium ${tab === 'links' ? 'bg-coral text-white' : 'text-ink-muted'}`}
            >
              {t('readingList')}
            </button>
          </div>
          {tab === 'entries' ? (
            <button
              type="button"
              disabled={!online}
              onClick={() => setEntrySheet({ open: true })}
              className="rounded-control bg-coral px-4 py-2 text-caption font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
            >
              {t('newEntry')}
            </button>
          ) : null}
        </div>

        {tab === 'links' ? (
          // D2 replaces this placeholder with the LinkRow list + add-link sheet.
          <p className="mt-8 px-4 py-8 text-center text-body text-ink-muted">
            {t('readingListComingSoon')}
          </p>
        ) : entries.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              mascotAlt={t('entries')}
              headline={t('emptyHeadline')}
              subtext={t('emptySubtext')}
              actionLabel={online ? t('newEntry') : undefined}
              onAction={online ? () => setEntrySheet({ open: true }) : undefined}
            />
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {entries.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setReading(e)}
                  className="block w-full rounded-card bg-card p-4 text-left shadow-card"
                >
                  <span className="block text-label font-semibold text-ink">{e.title}</span>
                  {e.entryDate ? (
                    <span className="mt-0.5 block text-caption text-ink-muted">{e.entryDate}</span>
                  ) : null}
                  {e.body.trim() !== '' ? (
                    <span className="mt-1 block line-clamp-2 text-body text-ink-muted">
                      {entrySnippet(e.body)}
                    </span>
                  ) : null}
                  {e.photos.length > 0 ? (
                    <span className="mt-2 flex gap-2">
                      {e.photos.slice(0, 4).map((p) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={p.id}
                          src={personalPhotoUrl(p.id, 'thumb')}
                          alt={e.title}
                          width={56}
                          height={56}
                          className="h-14 w-14 shrink-0 rounded-control object-cover"
                        />
                      ))}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}

        <EntrySheet
          key={`entry:${entrySheet.open ? (entrySheet.entry?.id ?? 'new') : 'closed'}`}
          open={entrySheet.open}
          tripId={tripId}
          entry={entrySheet.entry}
          disabled={!online}
          today={todayISO()}
          onClose={() => setEntrySheet({ open: false })}
          onSaved={() => {
            void load();
          }}
        />
      </main>
    );
  }
  ```
  > `onSaved` only reloads (it does not force-close), so a photo upload in edit mode refreshes the feed/reader data while the sheet stays open; `handleSave`/`handleDelete` inside `EntrySheet` call `onClose` themselves. The card `<button>` exposes the entry title as its accessible name, which the reader-open test selects via `{ name: /Day Two/ }`.
- [ ] **Step 4: Run the test — expect PASS.** (Run after D1.10 for the exact i18n labels.)
  ```bash
  npx vitest run components/journal/JournalClient.test.tsx
  ```
- [ ] **Step 5: Commit.**
  ```bash
  git add components/journal/JournalClient.tsx components/journal/JournalClient.test.tsx
  git commit -m "D1.8: JournalClient entries feed + segmented control + read fetch"
  ```

---

### Task D1.9: Journal page (static shell rendering JournalClient)

**Files:**
- Modify: `app/trip/[tripId]/journal/page.tsx` (replace the placeholder)
- Test: `app/trip/[tripId]/journal/page.test.tsx`

> Replaces the "coming soon" placeholder with the real static shell so the feature is testable end-to-end. Mirrors `app/trip/[tripId]/budget/page.tsx` (`force-static`, resolve `tripId` from params, no DB read, no `cookies()`). D3 finalizes the broader page wiring (Settings About etc.); this task makes the journal tab live.

- [ ] **Step 1: Write the failing page test.** Create `app/trip/[tripId]/journal/page.test.tsx` (mirrors `budget/page.test.tsx`):
  ```tsx
  import { describe, it, expect, vi } from 'vitest';
  import { render, screen } from '@testing-library/react';

  // Stub JournalClient so the page test asserts wiring (props), not the client.
  const journalClientProps = vi.fn();
  vi.mock('@/components/journal/JournalClient', () => ({
    JournalClient: (props: Record<string, unknown>) => {
      journalClientProps(props);
      return <div data-testid="journal-client" />;
    },
  }));

  import JournalPage, { dynamic } from '@/app/trip/[tripId]/journal/page';

  describe('JournalPage (static shell)', () => {
    it('is force-static so the SW caches the shell for offline', () => {
      expect(dynamic).toBe('force-static');
    });

    it('renders JournalClient with the trip id', async () => {
      const ui = await JournalPage({ params: Promise.resolve({ tripId: 'trip-1' }) });
      render(ui);
      expect(screen.getByTestId('journal-client')).toBeInTheDocument();
      expect(journalClientProps).toHaveBeenCalledWith(
        expect.objectContaining({ tripId: 'trip-1' }),
      );
    });
  });
  ```
- [ ] **Step 2: Run the test — expect FAIL.**
  ```bash
  npx vitest run "app/trip/[tripId]/journal/page.test.tsx"
  ```
  Fails: the page still renders the `EmptyState` placeholder (no `JournalClient`).
- [ ] **Step 3: Replace the page.** Overwrite `app/trip/[tripId]/journal/page.tsx`:
  ```tsx
  import { JournalClient } from '@/components/journal/JournalClient';

  // Static app shell: no server DB read, no cookies() — so the SW caches the page
  // document and it loads offline. JournalClient client-fetches
  // /api/trips/:id/journal, owns the entries feed/reader/editor, and (in D2) the
  // reading list. English-only locale matches i18n/request.ts.
  export const dynamic = 'force-static';

  export default async function JournalPage({
    params,
  }: {
    params: Promise<{ tripId: string }>;
  }) {
    const { tripId } = await params;
    return <JournalClient tripId={tripId} />;
  }
  ```
- [ ] **Step 4: Run the test — expect PASS.**
  ```bash
  npx vitest run "app/trip/[tripId]/journal/page.test.tsx"
  ```
- [ ] **Step 5: Commit.**
  ```bash
  git add "app/trip/[tripId]/journal/page.tsx" "app/trip/[tripId]/journal/page.test.tsx"
  git commit -m "D1.9: journal page static shell rendering JournalClient"
  ```

---

### Task D1.10: Journal i18n keys + keys-coverage test

**Files:**
- Modify: `messages/en.json` (add the `journal` namespace)
- Test: `messages/journal.keys.test.ts`

> Adds every `journal` string referenced by D1.6–D1.9. Mirrors `messages/budget.keys.test.ts`. The component tests in D1.6–D1.8 assert exact `en.journal.*` labels, so re-run them at the end of this task to confirm the full D1 surface is green.

- [ ] **Step 1: Write the failing keys-coverage test.** Create `messages/journal.keys.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import en from '@/messages/en.json';

  describe('en.json journal namespace', () => {
    const required = [
      // load + segmented control
      'loading', 'errorHeadline', 'errorSubtext', 'entries', 'readingList',
      'readingListComingSoon',
      // entries feed
      'newEntry', 'emptyHeadline', 'emptySubtext',
      // reader
      'back', 'edit',
      // editor sheet
      'newEntry', 'editEntry', 'titleLabel', 'dateLabel', 'bodyLabel',
      'save', 'cancel', 'delete', 'confirmDelete',
      'titleRequired', 'saveFailed', 'mutationFailed', 'offlineHint',
      // markdown toolbar
      'mdToolbar', 'mdBold', 'mdItalic', 'mdHeading', 'mdList', 'mdLink',
      // photos (edit mode)
      'addPhoto', 'addPhotoOffline', 'uploadingPhoto', 'photosAfterSaveHint',
      'photoNotImage', 'photoTooLarge', 'photoTooMany', 'photoUploadFailed',
    ];

    it('defines every journal UI key', () => {
      const j: Record<string, unknown> = en.journal as unknown as Record<string, unknown>;
      expect(j).toBeDefined();
      for (const k of required) expect(j[k], `journal.${k}`).toBeTypeOf('string');
    });
  });
  ```
- [ ] **Step 2: Run the test — expect FAIL.**
  ```bash
  npx vitest run messages/journal.keys.test.ts
  ```
  Fails: `en.journal` is undefined.
- [ ] **Step 3: Add the `journal` namespace.** Add this top-level key to `messages/en.json` (insert as a sibling of the existing `budget` namespace — keep valid JSON, add a comma after the preceding namespace):
  ```json
  "journal": {
    "loading": "Loading your journal…",
    "errorHeadline": "Couldn't load your journal",
    "errorSubtext": "Check your connection and try again.",
    "entries": "Entries",
    "readingList": "Reading list",
    "readingListComingSoon": "Reading list coming soon.",
    "newEntry": "New entry",
    "emptyHeadline": "No journal entries yet",
    "emptySubtext": "Write about your day, add a few photos.",
    "back": "Back",
    "edit": "Edit",
    "editEntry": "Edit entry",
    "titleLabel": "Title",
    "dateLabel": "Date",
    "bodyLabel": "Entry",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete entry",
    "confirmDelete": "Tap again to delete",
    "titleRequired": "Add a title for this entry.",
    "saveFailed": "Couldn't save. Try again.",
    "mutationFailed": "Something went wrong. Try again.",
    "offlineHint": "You're offline — editing is paused until you reconnect.",
    "mdToolbar": "Formatting",
    "mdBold": "Bold",
    "mdItalic": "Italic",
    "mdHeading": "Heading",
    "mdList": "List",
    "mdLink": "Link",
    "addPhoto": "Add a photo",
    "addPhotoOffline": "Reconnect to add photos.",
    "uploadingPhoto": "Uploading…",
    "photosAfterSaveHint": "Save the entry first, then add photos.",
    "photoNotImage": "That file isn't an image.",
    "photoTooLarge": "That image is too large (max 10 MB).",
    "photoTooMany": "You've reached the photo limit for this entry.",
    "photoUploadFailed": "Couldn't upload that photo. Try again."
  }
  ```
- [ ] **Step 4: Run the keys test — expect PASS.**
  ```bash
  npx vitest run messages/journal.keys.test.ts
  ```
- [ ] **Step 5: Run the full D1 component suite — expect PASS** (now that every `en.journal.*` label resolves):
  ```bash
  npx vitest run components/journal app/_actions/journal.test.ts "app/api/trips/[tripId]/journal/route.test.ts" app/api/photos/route.test.ts "app/trip/[tripId]/journal/page.test.tsx" messages/journal.keys.test.ts
  ```
- [ ] **Step 6: Commit.**
  ```bash
  git add messages/en.json messages/journal.keys.test.ts
  git commit -m "D1.10: journal i18n namespace + keys-coverage test"
  ```

## Group D2 — Reading list & link preview

### Task D2.1: Add `node-html-parser` dependency

**Files:**
- `package.json` (+ dependency)
- `package-lock.json` (regenerated, then run through the sharp-musl lockfile guard)

- [ ] Install the server-only HTML parser used by the preview route. It is a small, no-eval DOM parser (does not execute scripts), the right tool for SSRF-safe OpenGraph extraction:
  ```bash
  npm install node-html-parser@^6
  ```
- [ ] Re-run the sharp-musl lockfile guard (the repo's standing post-install step):
  ```bash
  node scripts/fix-lockfile.mjs
  ```
- [ ] Confirm the dependency landed in `package.json` (a non-empty version string):
  ```bash
  node -e "const p=require('./package.json'); if(!p.dependencies['node-html-parser']) throw new Error('node-html-parser missing'); console.log('node-html-parser', p.dependencies['node-html-parser']);"
  ```
  Expected: prints `node-html-parser ^6.x.x`.
- [ ] Confirm the full suite still loads/builds with the new dep (smoke — no new tests yet):
  ```bash
  npx tsc --noEmit
  ```
  Expected: PASS (no type errors).
- [ ] Commit:
  ```bash
  git add package.json package-lock.json
  git commit -m "D2.1: add node-html-parser dep for server-side OG parsing"
  ```

---

### Task D2.2: Saved-link Server Actions (`app/_actions/savedLinks.ts`)

**Files:**
- `app/_actions/savedLinks.test.ts` (new)
- `app/_actions/savedLinks.ts` (new)

Depends on D0's `src/db/repos/savedLinks.ts` (`getLink/listLinksForTrip/addLink/updateLink/deleteLink`, `type SavedLink`) and `src/lib/linkPreview.ts` (`isHttpUrl`). The delete action best-effort removes the thumbnail file under `UPLOADS_DIR` using the Plan-2 path-traversal guard (strictly under root, never the root itself).

- [ ] Write the failing test:
  ```ts
  // app/_actions/savedLinks.test.ts
  import { describe, it, expect, beforeEach, vi } from 'vitest';
  import { makeTestDb } from '@/src/db/testDb';
  import { trips } from '@/src/db/schema';

  const testHandle = { db: makeTestDb().db };
  vi.mock('@/src/db/client', () => ({ get db() { return testHandle.db; }, sqlite: {} }));
  vi.mock('@/src/env', () => ({ env: { UPLOADS_DIR: '/uploads' } }));
  vi.mock('@/src/lib/clock', () => ({ now: () => 1_700_000_000_000 }));

  const revalidatePath = vi.fn();
  vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rmFn = vi.fn(async (..._args: any[]) => undefined);
  vi.mock('node:fs/promises', () => ({
    default: { rm: (p: string, o?: unknown) => rmFn(p, o) },
    rm: (p: string, o?: unknown) => rmFn(p, o),
  }));

  import {
    addLinkAction,
    updateLinkAction,
    deleteLinkAction,
  } from '@/app/_actions/savedLinks';
  import { getLink, listLinksForTrip } from '@/src/db/repos/savedLinks';

  const TS = new Date(1_700_000_000_000);

  function seed(db: ReturnType<typeof makeTestDb>['db']) {
    db.insert(trips).values({
      id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
      coverPhoto: null, createdAt: TS, updatedAt: TS,
    }).run();
  }

  describe('saved-link actions', () => {
    beforeEach(() => {
      testHandle.db = makeTestDb().db;
      seed(testHandle.db);
      revalidatePath.mockClear();
      rmFn.mockClear();
    });

    it('adds a link and revalidates the journal path', async () => {
      const link = await addLinkAction({
        tripId: 'trip-1',
        url: 'https://example.com/post',
        title: 'A Post',
        note: 'read me',
        thumbnail: 'trip-1/links/thumb-1.webp',
      });
      expect(link.url).toBe('https://example.com/post');
      expect(getLink(testHandle.db, link.id)?.title).toBe('A Post');
      expect(getLink(testHandle.db, link.id)?.thumbnail).toBe('trip-1/links/thumb-1.webp');
      expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/journal');
    });

    it('rejects a non-http(s) url', async () => {
      await expect(
        addLinkAction({ tripId: 'trip-1', url: 'javascript:alert(1)' }),
      ).rejects.toThrow();
      await expect(
        addLinkAction({ tripId: 'trip-1', url: 'ftp://example.com/x' }),
      ).rejects.toThrow();
      expect(listLinksForTrip(testHandle.db, 'trip-1')).toHaveLength(0);
    });

    it('updates a link and revalidates', async () => {
      const link = await addLinkAction({ tripId: 'trip-1', url: 'https://example.com' });
      revalidatePath.mockClear();
      const updated = await updateLinkAction(link.id, { title: 'New title', note: 'n' });
      expect(updated.title).toBe('New title');
      expect(updated.note).toBe('n');
      expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/journal');
    });

    it('throws when updating a missing link', async () => {
      await expect(updateLinkAction('nope', { title: 'x' })).rejects.toThrow('Link not found');
    });

    it('deletes a link, best-effort removes its thumbnail file, and revalidates', async () => {
      const link = await addLinkAction({
        tripId: 'trip-1', url: 'https://example.com', thumbnail: 'trip-1/links/t.webp',
      });
      revalidatePath.mockClear();
      await deleteLinkAction(link.id);
      expect(getLink(testHandle.db, link.id)).toBeUndefined();
      expect(rmFn).toHaveBeenCalledWith('/uploads/trip-1/links/t.webp', { force: true });
      expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/journal');
    });

    it('deletes a link with no thumbnail without touching the disk', async () => {
      const link = await addLinkAction({ tripId: 'trip-1', url: 'https://example.com' });
      await deleteLinkAction(link.id);
      expect(getLink(testHandle.db, link.id)).toBeUndefined();
      expect(rmFn).not.toHaveBeenCalled();
    });

    it('does NOT rm when a tampered thumbnail path traverses outside UPLOADS_DIR', async () => {
      const link = await addLinkAction({
        tripId: 'trip-1', url: 'https://example.com', thumbnail: '../../etc/passwd',
      });
      await deleteLinkAction(link.id);
      // Row still deleted; the disk cleanup is skipped because the path escapes root.
      expect(getLink(testHandle.db, link.id)).toBeUndefined();
      expect(rmFn).not.toHaveBeenCalled();
    });

    it('does NOT rm when the thumbnail path resolves to the uploads root itself', async () => {
      const link = await addLinkAction({ tripId: 'trip-1', url: 'https://example.com', thumbnail: '' });
      await deleteLinkAction(link.id);
      expect(rmFn).not.toHaveBeenCalled();
    });

    it('throws when deleting a missing link', async () => {
      await expect(deleteLinkAction('nope')).rejects.toThrow('Link not found');
    });
  });
  ```
- [ ] Run it — expect FAIL (module does not exist yet):
  ```bash
  npx vitest run app/_actions/savedLinks.test.ts
  ```
  Expected: FAIL — `Cannot find module '@/app/_actions/savedLinks'`.
- [ ] Implement the actions:
  ```ts
  // app/_actions/savedLinks.ts
  'use server';

  import { z } from 'zod';
  import { rm } from 'node:fs/promises';
  import { join, resolve, sep } from 'node:path';
  import { revalidatePath } from 'next/cache';
  import { db } from '@/src/db/client';
  import { env } from '@/src/env';
  import {
    getLink,
    addLink,
    updateLink,
    deleteLink,
    type SavedLink,
  } from '@/src/db/repos/savedLinks';
  import { isHttpUrl } from '@/src/lib/linkPreview';

  function revalidateJournal(tripId: string): void {
    revalidatePath(`/trip/${tripId}/journal`);
  }

  const urlField = z.string().min(1).refine(isHttpUrl, 'Must be an http(s) URL');

  // --- addLinkAction --------------------------------------------------------

  const addSchema = z.object({
    tripId: z.string().min(1),
    url: urlField,
    title: z.string().max(2000).nullish(),
    note: z.string().max(4000).nullish(),
    thumbnail: z.string().max(1000).nullish(),
  });

  export type AddLinkActionInput = z.input<typeof addSchema>;

  export async function addLinkAction(input: AddLinkActionInput): Promise<SavedLink> {
    const data = addSchema.parse(input);
    const link = addLink(db, {
      tripId: data.tripId,
      url: data.url,
      title: data.title ?? null,
      note: data.note ?? null,
      thumbnail: data.thumbnail ?? null,
    });
    revalidateJournal(data.tripId);
    return link;
  }

  // --- updateLinkAction -----------------------------------------------------

  const updateSchema = z.object({
    url: urlField.optional(),
    title: z.string().max(2000).nullish(),
    note: z.string().max(4000).nullish(),
    thumbnail: z.string().max(1000).nullish(),
  });

  export type UpdateLinkActionPatch = z.input<typeof updateSchema>;

  export async function updateLinkAction(
    id: string,
    patch: UpdateLinkActionPatch,
  ): Promise<SavedLink> {
    const existing = getLink(db, id);
    if (!existing) throw new Error('Link not found');
    const data = updateSchema.parse(patch);
    const updated = updateLink(db, id, data);
    if (!updated) throw new Error('Link not found');
    revalidateJournal(existing.tripId);
    return updated;
  }

  // --- deleteLinkAction -----------------------------------------------------

  export async function deleteLinkAction(id: string): Promise<void> {
    const existing = getLink(db, id);
    if (!existing) throw new Error('Link not found');

    // Best-effort thumbnail cleanup. Guard against a path-traversal attack via a
    // tampered `thumbnail` column: the resolved file must be strictly *under* the
    // uploads root — never the root itself (an empty path would otherwise target
    // UPLOADS_DIR). Mirrors the Plan-2 photo-delete guard.
    if (existing.thumbnail) {
      const absPath = join(env.UPLOADS_DIR, existing.thumbnail);
      const root = resolve(env.UPLOADS_DIR);
      if (resolve(absPath).startsWith(root + sep)) {
        await rm(absPath, { force: true });
      }
    }

    deleteLink(db, id);
    revalidateJournal(existing.tripId);
  }
  ```
- [ ] Run it — expect PASS:
  ```bash
  npx vitest run app/_actions/savedLinks.test.ts
  ```
  Expected: PASS (all cases green).
- [ ] Commit:
  ```bash
  git add app/_actions/savedLinks.ts app/_actions/savedLinks.test.ts
  git commit -m "D2.2: saved-link server actions (add/update/delete + thumb cleanup guard)"
  ```

---

### Task D2.3: `POST /api/links/preview` — SSRF-guarded OpenGraph fetch

**Files:**
- `app/api/links/preview/route.test.ts` (new)
- `app/api/links/preview/route.ts` (new)

`force-dynamic`, online-only, POST. Body `{ url, tripId }`. Composes D0's `isHttpUrl` + `isBlockedAddress` with `node:dns/promises` `lookup(host, { all: true })` to reject SSRF targets; re-validates every redirect hop's host; caps HTML at ~2 MB with a 5 s `AbortSignal.timeout`; parses `og:title`/`<title>` and `og:image` with `node-html-parser`; if an image is found, fetches it under the same guards and pipes it through `sharp` to one resized WebP at `<UPLOADS_DIR>/<tripId>/links/<thumbId>.webp` (stored relative path `<tripId>/links/<thumbId>.webp`). Returns `{ title?, thumbnailPath? }` (200) on success and `{}` (200) on any failure (non-fatal).

- [ ] Write the failing test (SSRF cases are mandatory: private/loopback host rejected via mocked dns, redirect to a blocked host rejected, non-http scheme → 400):
  ```ts
  // @vitest-environment node
  import { describe, it, expect, beforeEach, vi } from 'vitest';

  vi.mock('@/src/env', () => ({ env: { UPLOADS_DIR: '/uploads' } }));
  vi.mock('@/src/db/ids', () => ({ newId: () => 'thumb-fixed' }));

  // Mock DNS: default → a public address; override per-test via dnsMap.
  const dnsMap: Record<string, string> = {};
  const lookup = vi.fn(async (host: string) => {
    const addr = dnsMap[host] ?? '93.184.216.34'; // example.com (public)
    return [{ address: addr, family: addr.includes(':') ? 6 : 4 }];
  });
  vi.mock('node:dns/promises', () => ({ default: { lookup }, lookup }));

  // Mock the sharp pipeline for the OG-image derivative.
  const writeThumb = vi.fn(async () => ({ relPath: 'trip-1/links/thumb-fixed.webp' }));
  vi.mock('@/src/lib/links/thumbPipeline', () => ({
    writeLinkThumb: (...a: unknown[]) => writeThumb(...(a as [unknown])),
  }));

  import { POST } from '@/app/api/links/preview/route';

  function req(body: unknown) {
    return new Request('http://x/api/links/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  // Drive global fetch per-test.
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    lookup.mockClear();
    writeThumb.mockClear();
    for (const k of Object.keys(dnsMap)) delete dnsMap[k];
    vi.stubGlobal('fetch', fetchMock);
  });

  function htmlResponse(html: string, finalUrl = 'https://example.com/post') {
    return new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
      // node's fetch sets res.url; emulate via a plain object property.
    }) as Response & { url: string };
  }

  describe('POST /api/links/preview', () => {
    it('returns 400 for a non-http(s) scheme', async () => {
      const res = await POST(req({ url: 'javascript:alert(1)', tripId: 'trip-1' }));
      expect(res.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 400 when url or tripId is missing', async () => {
      expect((await POST(req({ tripId: 'trip-1' }))).status).toBe(400);
      expect((await POST(req({ url: 'https://example.com' }))).status).toBe(400);
    });

    it('rejects a host that resolves to a loopback/private address (SSRF) with {}', async () => {
      dnsMap['internal.example.com'] = '127.0.0.1';
      const res = await POST(req({ url: 'https://internal.example.com/x', tripId: 'trip-1' }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({});
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects a literal private-IP host (SSRF) with {}', async () => {
      const res = await POST(req({ url: 'http://169.254.169.254/latest/meta-data', tripId: 'trip-1' }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({});
      // Literal IP → no DNS needed, no fetch.
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects a redirect to a blocked host with {} (re-validates each hop)', async () => {
      // First hop: a 302 to an internal host. The route follows manually and
      // must re-resolve+reject the redirect target before fetching it.
      dnsMap['evil.example.com'] = '93.184.216.34'; // public (passes first check)
      dnsMap['metadata.internal'] = '169.254.169.254'; // blocked on the hop
      fetchMock.mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: 'https://metadata.internal/secret' } }),
      );
      const res = await POST(req({ url: 'https://evil.example.com/start', tripId: 'trip-1' }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({});
      // Only the first hop was fetched; the blocked hop was never requested.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('parses og:title + og:image, stores a thumbnail, and returns title + thumbnailPath', async () => {
      const html = `<html><head>
        <meta property="og:title" content="Great Post" />
        <meta property="og:image" content="https://example.com/cover.jpg" />
        <title>fallback</title></head><body>hi</body></html>`;
      fetchMock
        .mockResolvedValueOnce(htmlResponse(html))
        .mockResolvedValueOnce(
          new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { 'content-type': 'image/jpeg' },
          }),
        );
      const res = await POST(req({ url: 'https://example.com/post', tripId: 'trip-1' }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ title: 'Great Post', thumbnailPath: 'trip-1/links/thumb-fixed.webp' });
      expect(writeThumb).toHaveBeenCalledWith(expect.objectContaining({ tripId: 'trip-1' }));
    });

    it('falls back to <title> when og:title is absent and omits thumbnail when no og:image', async () => {
      const html = `<html><head><title>Just A Title</title></head><body>hi</body></html>`;
      fetchMock.mockResolvedValueOnce(htmlResponse(html));
      const res = await POST(req({ url: 'https://example.com/post', tripId: 'trip-1' }));
      expect(await res.json()).toEqual({ title: 'Just A Title' });
      expect(writeThumb).not.toHaveBeenCalled();
    });

    it('returns {} when the page is not HTML', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('PK...', { status: 200, headers: { 'content-type': 'application/zip' } }),
      );
      const res = await POST(req({ url: 'https://example.com/file.zip', tripId: 'trip-1' }));
      expect(await res.json()).toEqual({});
    });

    it('returns {} on a fetch timeout/network error (non-fatal)', async () => {
      fetchMock.mockRejectedValueOnce(new Error('aborted'));
      const res = await POST(req({ url: 'https://example.com/post', tripId: 'trip-1' }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({});
    });

    it('still returns the title when the og:image fetch fails (thumbnail is best-effort)', async () => {
      const html = `<html><head>
        <meta property="og:title" content="Has Image" />
        <meta property="og:image" content="https://example.com/cover.jpg" /></head></html>`;
      fetchMock
        .mockResolvedValueOnce(htmlResponse(html))
        .mockRejectedValueOnce(new Error('image fetch failed'));
      const res = await POST(req({ url: 'https://example.com/post', tripId: 'trip-1' }));
      expect(await res.json()).toEqual({ title: 'Has Image' });
    });
  });
  ```
- [ ] Run it — expect FAIL (route + thumbPipeline do not exist):
  ```bash
  npx vitest run app/api/links/preview/route.test.ts
  ```
  Expected: FAIL — `Cannot find module '@/app/api/links/preview/route'`.
- [ ] Implement the link-thumbnail pipeline helper (sharp → one resized WebP under `<tripId>/links/<thumbId>.webp`):
  ```ts
  // src/lib/links/thumbPipeline.ts
  import { mkdir } from 'node:fs/promises';
  import { join } from 'node:path';
  import sharp from 'sharp';

  /** Long-edge cap for a link OG thumbnail (card-sized derivative). */
  export const LINK_THUMB_EDGE = 800;

  export interface WriteLinkThumbInput {
    buffer: Buffer;
    uploadsDir: string;
    tripId: string;
    thumbId: string;
  }

  export interface WriteLinkThumbResult {
    /** Path relative to uploadsDir: '<tripId>/links/<thumbId>.webp'. */
    relPath: string;
  }

  /**
   * Decode `buffer` and write a single resized WebP (EXIF-stripped, never
   * enlarged) to `<uploadsDir>/<tripId>/links/<thumbId>.webp`. Throws if the
   * buffer is not a decodable image (defence against a spoofed content type).
   * `limitInputPixels` is sharp's decompression-bomb guard (set explicitly).
   */
  export async function writeLinkThumb(input: WriteLinkThumbInput): Promise<WriteLinkThumbResult> {
    const { buffer, uploadsDir, tripId, thumbId } = input;
    const dir = join(uploadsDir, tripId, 'links');
    await mkdir(dir, { recursive: true });

    await sharp(buffer, { limitInputPixels: 268_402_689 })
      .rotate()
      .resize(LINK_THUMB_EDGE, LINK_THUMB_EDGE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(join(dir, `${thumbId}.webp`));

    return { relPath: `${tripId}/links/${thumbId}.webp` };
  }
  ```
- [ ] Implement the route:
  ```ts
  // app/api/links/preview/route.ts
  import { lookup } from 'node:dns/promises';
  import { isIP } from 'node:net';
  import { NextResponse } from 'next/server';
  import { parse } from 'node-html-parser';
  import { env } from '@/src/env';
  import { newId } from '@/src/db/ids';
  import { isHttpUrl, isBlockedAddress } from '@/src/lib/linkPreview';
  import { writeLinkThumb } from '@/src/lib/links/thumbPipeline';

  export const dynamic = 'force-dynamic';

  const FETCH_TIMEOUT_MS = 5000;
  const MAX_HTML_BYTES = 2 * 1024 * 1024; // ~2 MB HTML cap
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // OG-image cap before sharp
  const MAX_REDIRECTS = 3;

  /** Resolve a host to addresses and reject if any address is SSRF-blocked. */
  async function assertHostAllowed(host: string): Promise<boolean> {
    // Literal IP host → check directly, no DNS.
    if (isIP(host)) return !isBlockedAddress(host);
    let records: { address: string }[];
    try {
      records = await lookup(host, { all: true });
    } catch {
      return false;
    }
    if (records.length === 0) return false;
    return records.every((r) => !isBlockedAddress(r.address));
  }

  /** Read a response body with a hard byte cap; returns null if exceeded. */
  async function readCapped(res: Response, cap: number): Promise<Buffer | null> {
    const reader = res.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > cap) {
          await reader.cancel();
          return null;
        }
        chunks.push(value);
      }
    }
    return Buffer.concat(chunks);
  }

  /**
   * Fetch a URL following up to MAX_REDIRECTS manual redirects, re-validating
   * every hop's host against the SSRF blocklist. Returns the final Response, or
   * null if a hop is blocked / too many redirects / a network error occurs.
   */
  async function safeFetch(initialUrl: string): Promise<Response | null> {
    let current = initialUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      let parsed: URL;
      try {
        parsed = new URL(current);
      } catch {
        return null;
      }
      if (!isHttpUrl(current)) return null;
      if (!(await assertHostAllowed(parsed.hostname))) return null;

      let res: Response;
      try {
        res = await fetch(current, {
          redirect: 'manual',
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          headers: { accept: 'text/html,application/xhtml+xml' },
        });
      } catch {
        return null;
      }

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) return null;
        current = new URL(loc, current).toString();
        continue; // re-validate the redirect target host on the next iteration
      }
      return res;
    }
    return null; // too many redirects
  }

  export async function POST(req: Request): Promise<Response> {
    let body: { url?: unknown; tripId?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }
    const url = body.url;
    const tripId = body.tripId;
    if (typeof url !== 'string' || typeof tripId !== 'string' || tripId === '') {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }
    if (!isHttpUrl(url)) {
      return NextResponse.json({ error: 'bad_scheme' }, { status: 400 });
    }

    // Everything past validation is best-effort: any failure → {} with 200.
    try {
      const pageRes = await safeFetch(url);
      if (!pageRes || !pageRes.ok) return NextResponse.json({});
      const ct = pageRes.headers.get('content-type') ?? '';
      if (!/text\/html|application\/xhtml\+xml/.test(ct)) return NextResponse.json({});

      const htmlBuf = await readCapped(pageRes, MAX_HTML_BYTES);
      if (!htmlBuf) return NextResponse.json({});
      const root = parse(htmlBuf.toString('utf8'));

      const ogTitle = root
        .querySelector('meta[property="og:title"]')
        ?.getAttribute('content')
        ?.trim();
      const docTitle = root.querySelector('title')?.text?.trim();
      const title = ogTitle || docTitle || undefined;

      const ogImage = root
        .querySelector('meta[property="og:image"]')
        ?.getAttribute('content')
        ?.trim();

      const result: { title?: string; thumbnailPath?: string } = {};
      if (title) result.title = title;

      if (ogImage) {
        try {
          const imageUrl = new URL(ogImage, url).toString();
          const imgRes = await safeFetch(imageUrl);
          if (imgRes && imgRes.ok) {
            const imgCt = imgRes.headers.get('content-type') ?? '';
            if (imgCt.startsWith('image/')) {
              const imgBuf = await readCapped(imgRes, MAX_IMAGE_BYTES);
              if (imgBuf) {
                const { relPath } = await writeLinkThumb({
                  buffer: imgBuf,
                  uploadsDir: env.UPLOADS_DIR,
                  tripId,
                  thumbId: newId(),
                });
                result.thumbnailPath = relPath;
              }
            }
          }
        } catch {
          // Thumbnail is best-effort; keep the title-only result.
        }
      }

      return NextResponse.json(result);
    } catch {
      return NextResponse.json({});
    }
  }
  ```
- [ ] Run it — expect PASS:
  ```bash
  npx vitest run app/api/links/preview/route.test.ts
  ```
  Expected: PASS (SSRF rejection, redirect-hop rejection, 400 scheme, OG parse + thumbnail all green).
- [ ] Commit:
  ```bash
  git add app/api/links/preview/route.ts app/api/links/preview/route.test.ts src/lib/links/thumbPipeline.ts
  git commit -m "D2.3: SSRF-guarded link preview route + link-thumb sharp pipeline"
  ```

---

### Task D2.4: `GET /api/links/thumb/[linkId]` — serve link thumbnail

**Files:**
- `app/api/links/thumb/[linkId]/route.test.ts` (new)
- `app/api/links/thumb/[linkId]/route.ts` (new)

Looks up the `saved_links` row, resolves `UPLOADS_DIR + '/' + link.thumbnail`, applies the path-traversal guard (strictly under root), streams the WebP with long-cache headers; 404 if the link / thumbnail / file is missing.

- [ ] Write the failing test:
  ```ts
  // @vitest-environment node
  import { describe, it, expect, beforeEach, vi } from 'vitest';
  import { makeTestDb } from '@/src/db/testDb';
  import { trips, savedLinks } from '@/src/db/schema';

  const testHandle = { db: makeTestDb().db };
  vi.mock('@/src/db/client', () => ({ get db() { return testHandle.db; }, sqlite: {} }));
  vi.mock('@/src/env', () => ({ env: { UPLOADS_DIR: '/uploads' } }));

  const THUMB_BYTES = Buffer.from('FAKE_WEBP');
  vi.mock('node:fs/promises', () => {
    const read = async (path: string) => {
      if (path === '/uploads/trip-1/links/ok.webp') return THUMB_BYTES;
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    };
    return { default: { readFile: vi.fn(read) }, readFile: vi.fn(read) };
  });

  import { GET } from '@/app/api/links/thumb/[linkId]/route';

  const TS = new Date(1_700_000_000_000);

  function seed(db: ReturnType<typeof makeTestDb>['db']) {
    db.insert(trips).values({
      id: 'trip-1', name: 'T', startDate: '2026-06-05', endDate: '2026-06-07',
      coverPhoto: null, createdAt: TS, updatedAt: TS,
    }).run();
    db.insert(savedLinks).values({
      id: 'link-ok', tripId: 'trip-1', url: 'https://example.com', title: null,
      note: null, thumbnail: 'trip-1/links/ok.webp', createdAt: TS, updatedAt: TS,
    }).run();
    db.insert(savedLinks).values({
      id: 'link-nothumb', tripId: 'trip-1', url: 'https://example.com', title: null,
      note: null, thumbnail: null, createdAt: TS, updatedAt: TS,
    }).run();
    db.insert(savedLinks).values({
      id: 'link-trav', tripId: 'trip-1', url: 'https://example.com', title: null,
      note: null, thumbnail: '../../etc/passwd', createdAt: TS, updatedAt: TS,
    }).run();
  }

  function ctx(linkId: string) {
    return { params: Promise.resolve({ linkId }) };
  }

  describe('GET /api/links/thumb/[linkId]', () => {
    beforeEach(() => {
      testHandle.db = makeTestDb().db;
      seed(testHandle.db);
    });

    it('streams the link thumbnail webp with long-cache headers', async () => {
      const res = await GET(new Request('http://x/api/links/thumb/link-ok'), ctx('link-ok'));
      expect(res.status).toBe(200);
      expect(Buffer.from(await res.arrayBuffer())).toEqual(THUMB_BYTES);
      expect(res.headers.get('content-type')).toBe('image/webp');
      expect(res.headers.get('cache-control')).toContain('immutable');
    });

    it('returns 404 for an unknown link id', async () => {
      const res = await GET(new Request('http://x/api/links/thumb/nope'), ctx('nope'));
      expect(res.status).toBe(404);
    });

    it('returns 404 when the link has no thumbnail', async () => {
      const res = await GET(new Request('http://x/api/links/thumb/link-nothumb'), ctx('link-nothumb'));
      expect(res.status).toBe(404);
    });

    it('returns 404 when the file is missing on disk', async () => {
      // Insert a link whose thumbnail path is valid (under root) but not on disk.
      testHandle.db.insert(savedLinks).values({
        id: 'link-gone', tripId: 'trip-1', url: 'https://example.com', title: null,
        note: null, thumbnail: 'trip-1/links/gone.webp', createdAt: TS, updatedAt: TS,
      }).run();
      const res = await GET(new Request('http://x/api/links/thumb/link-gone'), ctx('link-gone'));
      expect(res.status).toBe(404);
    });

    it('returns 404 (no read) when the stored thumbnail path traverses out of UPLOADS_DIR', async () => {
      const res = await GET(new Request('http://x/api/links/thumb/link-trav'), ctx('link-trav'));
      expect(res.status).toBe(404);
      expect(((await res.json()) as { error: string }).error).toBe('not_found');
    });
  });
  ```
- [ ] Run it — expect FAIL (route does not exist):
  ```bash
  npx vitest run "app/api/links/thumb/[linkId]/route.test.ts"
  ```
  Expected: FAIL — `Cannot find module '@/app/api/links/thumb/[linkId]/route'`.
- [ ] Implement the route:
  ```ts
  // app/api/links/thumb/[linkId]/route.ts
  import { readFile } from 'node:fs/promises';
  import { join, resolve, sep } from 'node:path';
  import { NextResponse } from 'next/server';
  import { db } from '@/src/db/client';
  import { env } from '@/src/env';
  import { getLink } from '@/src/db/repos/savedLinks';

  export const dynamic = 'force-dynamic';

  export async function GET(
    _req: Request,
    ctx: { params: Promise<{ linkId: string }> },
  ): Promise<Response> {
    const { linkId } = await ctx.params;

    const link = getLink(db, linkId);
    if (!link || !link.thumbnail) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    // Resolve <UPLOADS_DIR>/<thumbnail> and constrain strictly under UPLOADS_DIR.
    const filePath = join(env.UPLOADS_DIR, link.thumbnail);
    const resolved = resolve(filePath);
    const root = resolve(env.UPLOADS_DIR);
    if (!resolved.startsWith(root + sep)) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    try {
      const bytes = await readFile(filePath);
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
- [ ] Run it — expect PASS:
  ```bash
  npx vitest run "app/api/links/thumb/[linkId]/route.test.ts"
  ```
  Expected: PASS.
- [ ] Commit:
  ```bash
  git add "app/api/links/thumb/[linkId]/route.ts" "app/api/links/thumb/[linkId]/route.test.ts"
  git commit -m "D2.4: serve link-thumbnail route with path-traversal guard"
  ```

---

### Task D2.5: SW link-thumb matcher (`app/sw.ts`)

**Files:**
- `app/sw.test.ts` (modified)
- `app/sw.ts` (modified)

Add `/api/links/thumb/<id>` to the existing `photos` CacheFirst entry so cached link thumbnails are offline-readable (spec §7). `buildRuntimeCaching(base)` stays pure + unit-tested.

- [ ] Add failing assertions to the `photos` block of the SW test. Insert this new `it` immediately after the existing `'does NOT CacheFirst the single-segment upload endpoint /api/photos'` test (line 75):
  ```ts
    it('CacheFirst matches the link-thumbnail path /api/links/thumb/<id> (root + basePath)', () => {
      const root = buildRuntimeCaching('').find((e) => e.name === 'photos')!;
      const rootUrl = new URL('http://x/api/links/thumb/link-1');
      expect(root.matcher({ url: rootUrl, request: new Request(rootUrl), sameOrigin: true })).toBe(true);

      const sub = buildRuntimeCaching('/burgergo').find((e) => e.name === 'photos')!;
      const subUrl = new URL('http://x/burgergo/api/links/thumb/link-1');
      expect(sub.matcher({ url: subUrl, request: new Request(subUrl), sameOrigin: true })).toBe(true);

      // The single-segment collection path must NOT match.
      const collUrl = new URL('http://x/api/links/thumb');
      expect(root.matcher({ url: collUrl, request: new Request(collUrl), sameOrigin: true })).toBe(false);
    });
  ```
- [ ] Run it — expect FAIL (matcher not extended yet):
  ```bash
  npx vitest run app/sw.test.ts
  ```
  Expected: FAIL on the new `link-thumbnail path` assertion (`expected false to be true`).
- [ ] Extend the `photos` matcher in `app/sw.ts`. Replace the existing matcher body:
  ```ts
      matcher({ url }: TestableMatcherOptions) {
        return (
          url.pathname === `${base}/burgergo-logo.png` ||
          url.pathname.startsWith(`${base}/icons/`) ||
          // 1B cached-Google photos: /api/photos/<placeId>/<variant>
          new RegExp(`^${base}/api/photos/[^/]+/[^/]+$`).test(url.pathname) ||
          // Plan-2 personal photos: /api/photos/p/<photoId>/<size>
          new RegExp(`^${base}/api/photos/p/[^/]+/[^/]+$`).test(url.pathname)
        );
      },
  ```
  with:
  ```ts
      matcher({ url }: TestableMatcherOptions) {
        return (
          url.pathname === `${base}/burgergo-logo.png` ||
          url.pathname.startsWith(`${base}/icons/`) ||
          // 1B cached-Google photos: /api/photos/<placeId>/<variant>
          new RegExp(`^${base}/api/photos/[^/]+/[^/]+$`).test(url.pathname) ||
          // Plan-2 personal photos: /api/photos/p/<photoId>/<size>
          new RegExp(`^${base}/api/photos/p/[^/]+/[^/]+$`).test(url.pathname) ||
          // Plan-3 link thumbnails: /api/links/thumb/<linkId>
          new RegExp(`^${base}/api/links/thumb/[^/]+$`).test(url.pathname)
        );
      },
  ```
- [ ] Run it — expect PASS:
  ```bash
  npx vitest run app/sw.test.ts
  ```
  Expected: PASS (all SW routing tests green).
- [ ] Commit:
  ```bash
  git add app/sw.ts app/sw.test.ts
  git commit -m "D2.5: SW CacheFirst matcher for /api/links/thumb/<id>"
  ```

---

### Task D2.6: Reading-list i18n keys (`journal` namespace)

**Files:**
- `messages/journal.keys.test.ts` (new)
- `messages/en.json` (modified — add/extend the `journal` namespace with reading-list keys)

Extends the `journal` namespace (created in D1) with reading-list strings. A keys-coverage test (mirrors `messages/budget.keys.test.ts`) asserts every required key exists.

- [ ] Write the failing test:
  ```ts
  // messages/journal.keys.test.ts
  import { describe, it, expect } from 'vitest';
  import en from '@/messages/en.json';

  describe('en.json journal namespace — reading list', () => {
    const required = [
      'readingListTab',
      'addLink', 'editLink',
      'urlLabel', 'titleLabel', 'noteLabel',
      'previewFetching', 'previewFailed',
      'openLink', 'edit', 'delete', 'save', 'cancel',
      'linksEmptyHeadline', 'linksEmptySubtext',
      'invalidUrl', 'saveFailed', 'mutationFailed', 'offlineHint',
    ];

    it('defines every reading-list UI key', () => {
      const j = en.journal as unknown as Record<string, unknown>;
      expect(j, 'journal namespace').toBeDefined();
      for (const k of required) expect(j[k], `journal.${k}`).toBeTypeOf('string');
    });
  });
  ```
- [ ] Run it — expect FAIL (keys absent):
  ```bash
  npx vitest run messages/journal.keys.test.ts
  ```
  Expected: FAIL — `journal.readingListTab` (etc.) is not a string.
- [ ] Add the keys to the `journal` namespace in `messages/en.json`. If the `journal` object already exists (from D1), merge these members in; otherwise add the whole object. The reading-list members to ensure present:
  ```json
  "journal": {
    "readingListTab": "Reading list",
    "addLink": "Add link",
    "editLink": "Edit link",
    "urlLabel": "URL",
    "titleLabel": "Title",
    "noteLabel": "Note",
    "previewFetching": "Fetching preview…",
    "previewFailed": "Couldn't fetch a preview — add the details yourself.",
    "openLink": "Open",
    "edit": "Edit",
    "delete": "Delete",
    "save": "Save",
    "cancel": "Cancel",
    "linksEmptyHeadline": "No saved links yet",
    "linksEmptySubtext": "Save blogs and articles to read before your trip.",
    "invalidUrl": "Enter a valid http(s) link.",
    "saveFailed": "Couldn't save. Try again.",
    "mutationFailed": "Something went wrong. Try again.",
    "offlineHint": "You're offline — changes are paused until you reconnect."
  }
  ```
  (If D1 already defined `save`/`cancel`/`delete`/`edit`/`offlineHint` in `journal`, keep the existing values and only add the missing reading-list-specific keys — the test only requires that each key resolves to a string.)
- [ ] Run it — expect PASS:
  ```bash
  npx vitest run messages/journal.keys.test.ts
  ```
  Expected: PASS.
- [ ] Commit:
  ```bash
  git add messages/en.json messages/journal.keys.test.ts
  git commit -m "D2.6: reading-list i18n keys under the journal namespace"
  ```

---

### Task D2.7: `LinkRow` component (`components/journal/LinkRow.tsx`)

**Files:**
- `components/journal/LinkRow.test.tsx` (new)
- `components/journal/LinkRow.tsx` (new)

A reading-list row: thumbnail via `/api/links/thumb/<id>` through `withBase` (or the bundled mascot fallback when `thumbnail` is null), title-or-host, source domain from `linkDomain(url)` (D0's `journalView`/`linkPreview` helper), and note. The row opens `url` in a new tab (`rel="noopener noreferrer"`); a ⋯ control offers Edit / Delete.

- [ ] Write the failing test:
  ```tsx
  import { describe, it, expect, vi } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import { NextIntlClientProvider } from 'next-intl';
  import en from '@/messages/en.json';

  // linkDomain is a D0 pure helper; mock it so this test is isolated from D0.
  vi.mock('@/src/lib/linkPreview', () => ({
    linkDomain: (url: string) => new URL(url).hostname.replace(/^www\./, ''),
    isHttpUrl: () => true,
  }));

  import { LinkRow } from '@/components/journal/LinkRow';
  import type { SavedLink } from '@/src/db/repos/savedLinks';

  function renderWith(ui: React.ReactElement) {
    return render(
      <NextIntlClientProvider locale="en" messages={en as never}>
        {ui}
      </NextIntlClientProvider>,
    );
  }

  const base: SavedLink = {
    id: 'link-1', tripId: 'trip-1', url: 'https://www.example.com/post',
    title: 'My Article', note: 'read this', thumbnail: 'trip-1/links/t.webp',
    createdAt: new Date(0), updatedAt: new Date(0),
  } as unknown as SavedLink;

  describe('LinkRow', () => {
    it('renders title, domain, note, and an anchor opening the url in a new tab', () => {
      renderWith(<LinkRow link={base} onEdit={vi.fn()} onDelete={vi.fn()} />);
      expect(screen.getByText('My Article')).toBeInTheDocument();
      expect(screen.getByText('example.com')).toBeInTheDocument();
      expect(screen.getByText('read this')).toBeInTheDocument();
      const anchor = screen.getByRole('link', { name: /My Article/ });
      expect(anchor).toHaveAttribute('href', 'https://www.example.com/post');
      expect(anchor).toHaveAttribute('target', '_blank');
      expect(anchor).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('falls back to the domain as the title when title is null', () => {
      const noTitle = { ...base, title: null } as unknown as SavedLink;
      renderWith(<LinkRow link={noTitle} onEdit={vi.fn()} onDelete={vi.fn()} />);
      // Domain shown both as the title fallback and the source line.
      expect(screen.getAllByText('example.com').length).toBeGreaterThanOrEqual(1);
    });

    it('renders the thumbnail img through withBase when thumbnail is set', () => {
      renderWith(<LinkRow link={base} onEdit={vi.fn()} onDelete={vi.fn()} />);
      const img = screen.getByRole('img');
      expect(img.getAttribute('src')).toBe('/api/links/thumb/link-1');
    });

    it('renders the mascot fallback tile when thumbnail is null', () => {
      const noThumb = { ...base, thumbnail: null } as unknown as SavedLink;
      renderWith(<LinkRow link={noThumb} onEdit={vi.fn()} onDelete={vi.fn()} />);
      const img = screen.getByRole('img');
      expect(img.getAttribute('src')).toBe('/burgergo-logo.png');
    });

    it('fires onEdit and onDelete from the overflow menu', () => {
      const onEdit = vi.fn();
      const onDelete = vi.fn();
      renderWith(<LinkRow link={base} onEdit={onEdit} onDelete={onDelete} />);
      screen.getByRole('button', { name: en.journal.edit }).click();
      expect(onEdit).toHaveBeenCalledWith('link-1');
      screen.getByRole('button', { name: en.journal.delete }).click();
      expect(onDelete).toHaveBeenCalledWith('link-1');
    });
  });
  ```
- [ ] Run it — expect FAIL (component does not exist):
  ```bash
  npx vitest run components/journal/LinkRow.test.tsx
  ```
  Expected: FAIL — `Cannot find module '@/components/journal/LinkRow'`.
- [ ] Implement the component:
  ```tsx
  // components/journal/LinkRow.tsx
  'use client';

  import { useTranslations } from 'next-intl';
  import { withBase } from '@/src/lib/basePath';
  import { linkDomain } from '@/src/lib/linkPreview';
  import type { SavedLink } from '@/src/db/repos/savedLinks';

  type Props = {
    link: SavedLink;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
  };

  export function LinkRow({ link, onEdit, onDelete }: Props) {
    const t = useTranslations('journal');
    const domain = linkDomain(link.url);
    const heading = link.title?.trim() ? link.title : domain;
    // Bundled mascot → always renders offline; the served thumb is SW-cached.
    const thumbSrc = link.thumbnail
      ? withBase(`/api/links/thumb/${link.id}`)
      : withBase('/burgergo-logo.png');

    return (
      <div className="flex items-stretch gap-3 rounded-card bg-card p-3 shadow-card">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={heading}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <img
            src={thumbSrc}
            alt=""
            className={`h-14 w-14 shrink-0 rounded-control object-cover ${
              link.thumbnail ? 'bg-paper' : 'bg-sun/20 p-1'
            }`}
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-body font-bold text-ink">{heading}</span>
            <span className="truncate text-caption text-ink-muted">{domain}</span>
            {link.note ? (
              <span className="truncate text-caption text-ink-muted">{link.note}</span>
            ) : null}
          </span>
        </a>

        <div className="flex shrink-0 flex-col justify-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(link.id)}
            className="rounded-control px-2 py-1 text-caption font-medium text-ink shadow-inset"
          >
            {t('edit')}
          </button>
          <button
            type="button"
            onClick={() => onDelete(link.id)}
            className="rounded-control px-2 py-1 text-caption font-medium text-red-600 shadow-inset"
          >
            {t('delete')}
          </button>
        </div>
      </div>
    );
  }
  ```
- [ ] Run it — expect PASS:
  ```bash
  npx vitest run components/journal/LinkRow.test.tsx
  ```
  Expected: PASS.
- [ ] Commit:
  ```bash
  git add components/journal/LinkRow.tsx components/journal/LinkRow.test.tsx
  git commit -m "D2.7: LinkRow reading-list row (thumb/mascot, domain, edit/delete)"
  ```

---

### Task D2.8: `LinkSheet` add/edit sheet (`components/journal/LinkSheet.tsx`)

**Files:**
- `components/journal/LinkSheet.test.tsx` (new)
- `components/journal/LinkSheet.tsx` (new)

Bottom-sheet (like `ExpenseSheet`): URL (required), Title, Note; Save / (edit) Delete; offline-gated; keyed remount per open (the parent supplies the `key`). On URL blur in add mode + online, POST `/api/links/preview` (via `withBase`) to prefill Title (if empty) and stash `thumbnailPath`. Save calls `addLinkAction`/`updateLinkAction`.

- [ ] Write the failing test:
  ```tsx
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render, screen, fireEvent, waitFor } from '@testing-library/react';
  import { NextIntlClientProvider } from 'next-intl';
  import en from '@/messages/en.json';

  const addLinkAction = vi.fn();
  const updateLinkAction = vi.fn();
  const deleteLinkAction = vi.fn();
  vi.mock('@/app/_actions/savedLinks', () => ({
    addLinkAction: (...a: unknown[]) => addLinkAction(...a),
    updateLinkAction: (...a: unknown[]) => updateLinkAction(...a),
    deleteLinkAction: (...a: unknown[]) => deleteLinkAction(...a),
  }));

  import { LinkSheet } from '@/components/journal/LinkSheet';
  import type { SavedLink } from '@/src/db/repos/savedLinks';

  function renderWith(ui: React.ReactElement) {
    return render(
      <NextIntlClientProvider locale="en" messages={en as never}>
        {ui}
      </NextIntlClientProvider>,
    );
  }

  const fetchMock = vi.fn();

  describe('LinkSheet', () => {
    beforeEach(() => {
      addLinkAction.mockReset().mockResolvedValue({ id: 'link-1' });
      updateLinkAction.mockReset().mockResolvedValue({ id: 'link-1' });
      deleteLinkAction.mockReset().mockResolvedValue(undefined);
      fetchMock.mockReset();
      vi.stubGlobal('fetch', fetchMock);
    });

    it('renders nothing when closed', () => {
      const { container } = renderWith(
        <LinkSheet open={false} tripId="trip-1" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('rejects a blank/invalid url with invalidUrl and does not call the action', async () => {
      renderWith(
        <LinkSheet open tripId="trip-1" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
      );
      screen.getByRole('button', { name: en.journal.save }).click();
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.journal.invalidUrl));
      expect(addLinkAction).not.toHaveBeenCalled();
    });

    it('on URL blur in add mode (online) fetches a preview and prefills the title', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ title: 'Fetched Title', thumbnailPath: 'trip-1/links/x.webp' }),
      });
      renderWith(
        <LinkSheet open tripId="trip-1" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
      );
      const url = screen.getByLabelText(en.journal.urlLabel);
      fireEvent.change(url, { target: { value: 'https://example.com/post' } });
      fireEvent.blur(url);
      await waitFor(() =>
        expect((screen.getByLabelText(en.journal.titleLabel) as HTMLInputElement).value).toBe('Fetched Title'),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/links/preview',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('saves a new link including the stashed thumbnailPath', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ title: 'T', thumbnailPath: 'trip-1/links/x.webp' }),
      });
      const onSaved = vi.fn();
      renderWith(
        <LinkSheet open tripId="trip-1" disabled={false} onClose={vi.fn()} onSaved={onSaved} />,
      );
      const url = screen.getByLabelText(en.journal.urlLabel);
      fireEvent.change(url, { target: { value: 'https://example.com/post' } });
      fireEvent.blur(url);
      await waitFor(() =>
        expect((screen.getByLabelText(en.journal.titleLabel) as HTMLInputElement).value).toBe('T'),
      );
      screen.getByRole('button', { name: en.journal.save }).click();
      await waitFor(() => expect(addLinkAction).toHaveBeenCalledTimes(1));
      expect(addLinkAction).toHaveBeenCalledWith({
        tripId: 'trip-1',
        url: 'https://example.com/post',
        title: 'T',
        note: null,
        thumbnail: 'trip-1/links/x.webp',
      });
      expect(onSaved).toHaveBeenCalled();
    });

    it('does NOT fetch a preview in edit mode and pre-fills from the link', async () => {
      const link = {
        id: 'link-1', tripId: 'trip-1', url: 'https://example.com', title: 'Old', note: 'n',
        thumbnail: null, createdAt: new Date(0), updatedAt: new Date(0),
      } as unknown as SavedLink;
      renderWith(
        <LinkSheet open tripId="trip-1" link={link} disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
      );
      expect((screen.getByLabelText(en.journal.titleLabel) as HTMLInputElement).value).toBe('Old');
      fireEvent.blur(screen.getByLabelText(en.journal.urlLabel));
      // No preview fetch in edit mode.
      expect(fetchMock).not.toHaveBeenCalled();
      fireEvent.change(screen.getByLabelText(en.journal.titleLabel), { target: { value: 'New' } });
      screen.getByRole('button', { name: en.journal.save }).click();
      await waitFor(() => expect(updateLinkAction).toHaveBeenCalledTimes(1));
      expect(updateLinkAction).toHaveBeenCalledWith('link-1', expect.objectContaining({ title: 'New' }));
      expect(screen.getByRole('button', { name: en.journal.delete })).toBeInTheDocument();
    });

    it('deletes in edit mode', async () => {
      const link = {
        id: 'link-1', tripId: 'trip-1', url: 'https://example.com', title: 'Old', note: null,
        thumbnail: null, createdAt: new Date(0), updatedAt: new Date(0),
      } as unknown as SavedLink;
      const onSaved = vi.fn();
      renderWith(
        <LinkSheet open tripId="trip-1" link={link} disabled={false} onClose={vi.fn()} onSaved={onSaved} />,
      );
      screen.getByRole('button', { name: en.journal.delete }).click();
      await waitFor(() => expect(deleteLinkAction).toHaveBeenCalledWith('link-1'));
      expect(onSaved).toHaveBeenCalled();
    });

    it('does not fetch a preview when offline; manual entry still saves', async () => {
      renderWith(
        <LinkSheet open tripId="trip-1" disabled onClose={vi.fn()} onSaved={vi.fn()} />,
      );
      // Disabled (offline) → the offline hint is shown and inputs are disabled.
      expect(screen.getByText(en.journal.offlineHint)).toBeInTheDocument();
      expect((screen.getByLabelText(en.journal.urlLabel) as HTMLInputElement).disabled).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
  ```
- [ ] Run it — expect FAIL (component does not exist):
  ```bash
  npx vitest run components/journal/LinkSheet.test.tsx
  ```
  Expected: FAIL — `Cannot find module '@/components/journal/LinkSheet'`.
- [ ] Implement the component:
  ```tsx
  // components/journal/LinkSheet.tsx
  'use client';

  import { useState, useTransition } from 'react';
  import { useTranslations } from 'next-intl';
  import { withBase } from '@/src/lib/basePath';
  import { isHttpUrl } from '@/src/lib/linkPreview';
  import {
    addLinkAction,
    updateLinkAction,
    deleteLinkAction,
  } from '@/app/_actions/savedLinks';
  import type { SavedLink } from '@/src/db/repos/savedLinks';

  type Props = {
    open: boolean;
    tripId: string;
    /** Present → edit mode; absent → add mode. */
    link?: SavedLink;
    disabled: boolean; // offline → true
    onClose: () => void;
    onSaved: () => void;
  };

  export function LinkSheet({ open, tripId, link, disabled, onClose, onSaved }: Props) {
    const t = useTranslations('journal');
    const isEdit = !!link;
    const [url, setUrl] = useState(link?.url ?? '');
    const [title, setTitle] = useState(link?.title ?? '');
    const [note, setNote] = useState(link?.note ?? '');
    // Thumbnail path is preserved in edit mode; refreshed by a preview in add mode.
    const [thumbnail, setThumbnail] = useState<string | null>(link?.thumbnail ?? null);
    const [previewing, setPreviewing] = useState(false);
    const [previewFailed, setPreviewFailed] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    if (!open) return null;

    function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
      if (e.key === 'Escape') onClose();
    }

    async function handleUrlBlur() {
      // Preview only in add mode, online, with a valid http(s) URL.
      if (isEdit || disabled) return;
      const value = url.trim();
      if (!isHttpUrl(value)) return;
      setPreviewing(true);
      setPreviewFailed(false);
      try {
        const res = await fetch(withBase('/api/links/preview'), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ url: value, tripId }),
        });
        const data = (await res.json()) as { title?: string; thumbnailPath?: string };
        if (data.title && title.trim() === '') setTitle(data.title);
        if (data.thumbnailPath) setThumbnail(data.thumbnailPath);
        if (!data.title && !data.thumbnailPath) setPreviewFailed(true);
      } catch {
        setPreviewFailed(true);
      } finally {
        setPreviewing(false);
      }
    }

    function handleSave() {
      setError(null);
      const value = url.trim();
      if (!isHttpUrl(value)) {
        setError(t('invalidUrl'));
        return;
      }
      const payload = {
        url: value,
        title: title.trim() === '' ? null : title.trim(),
        note: note.trim() === '' ? null : note.trim(),
        thumbnail,
      };
      startTransition(async () => {
        try {
          if (isEdit && link) {
            await updateLinkAction(link.id, payload);
          } else {
            await addLinkAction({ tripId, ...payload });
          }
          onSaved();
          onClose();
        } catch {
          setError(t('saveFailed'));
        }
      });
    }

    function handleDelete() {
      if (!link) return;
      setError(null);
      startTransition(async () => {
        try {
          await deleteLinkAction(link.id);
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
        aria-label={isEdit ? t('editLink') : t('addLink')}
        className="fixed inset-0 z-50 flex items-end bg-[rgb(110_85_68_/_0.45)]"
        onClick={onClose}
        onKeyDown={handleKeyDown}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-card p-6 shadow-lift"
        >
          <h2 className="mb-3 text-heading font-semibold text-ink">
            {isEdit ? t('editLink') : t('addLink')}
          </h2>

          {error ? (
            <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-caption text-red-700">
              {error}
            </p>
          ) : null}

          {disabled ? (
            <p className="mb-3 text-caption text-ink-muted">{t('offlineHint')}</p>
          ) : null}

          <label className="block text-label font-medium text-ink" htmlFor="link-url">
            {t('urlLabel')}
          </label>
          <input
            id="link-url"
            type="url"
            inputMode="url"
            value={url}
            disabled={disabled}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={handleUrlBlur}
            className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
          />

          {previewing ? (
            <p className="mt-1 text-caption text-ink-muted">{t('previewFetching')}</p>
          ) : null}
          {previewFailed ? (
            <p className="mt-1 text-caption text-ink-muted">{t('previewFailed')}</p>
          ) : null}

          <label className="mt-3 block text-label font-medium text-ink" htmlFor="link-title">
            {t('titleLabel')}
          </label>
          <input
            id="link-title"
            type="text"
            value={title}
            disabled={disabled}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
          />

          <label className="mt-3 block text-label font-medium text-ink" htmlFor="link-note">
            {t('noteLabel')}
          </label>
          <input
            id="link-note"
            type="text"
            value={note}
            disabled={disabled}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
          />

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
- [ ] Run it — expect PASS:
  ```bash
  npx vitest run components/journal/LinkSheet.test.tsx
  ```
  Expected: PASS.
- [ ] Commit:
  ```bash
  git add components/journal/LinkSheet.tsx components/journal/LinkSheet.test.tsx
  git commit -m "D2.8: LinkSheet add/edit (online preview prefill, offline-gated)"
  ```

---

### Task D2.9: Wire the reading list into `JournalClient`

**Files:**
- `components/journal/JournalClient.test.tsx` (modified — add reading-list rendering tests)
- `components/journal/JournalClient.tsx` (modified — render the reading-list sub-view)

D1 created `JournalClient` with a placeholder Reading-list sub-view and the journal fetch (`{ entries, links }`). This task replaces the placeholder with a `LinkRow` list + an "Add link" button + the `LinkSheet`, driven by the `links` already in the fetch state. Online-gating mirrors the existing entries sub-view; the sheet is keyed to remount fresh per open.

- [ ] Add failing reading-list tests. Append these to the existing `components/journal/JournalClient.test.tsx` (it already mocks the journal fetch from D1; this block asserts the reading-list sub-view). If the file mocks `fetch` once globally, reuse that mock; the snippet below shows the self-contained additions to drop into the existing `describe`:
  ```tsx
  // --- D2: reading-list sub-view -------------------------------------------
  // (added to components/journal/JournalClient.test.tsx)
  describe('JournalClient — reading list', () => {
    const links = [
      {
        id: 'link-1', tripId: 'trip-1', url: 'https://example.com/a', title: 'Article A',
        note: null, thumbnail: null, createdAt: 0, updatedAt: 0,
      },
    ];

    function mockJournalFetch(payload: { entries?: unknown[]; links?: unknown[] }) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          json: async () => ({ entries: payload.entries ?? [], links: payload.links ?? [] }),
        })),
      );
    }

    beforeEach(() => {
      // Online by default for the gating assertions.
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    });

    it('renders saved links as rows under the reading-list tab', async () => {
      mockJournalFetch({ links });
      renderWith(<JournalClient tripId="trip-1" />);
      // Switch to the reading-list sub-view.
      (await screen.findByRole('button', { name: en.journal.readingListTab })).click();
      expect(await screen.findByText('Article A')).toBeInTheDocument();
    });

    it('shows the links empty state when there are no links', async () => {
      mockJournalFetch({ links: [] });
      renderWith(<JournalClient tripId="trip-1" />);
      (await screen.findByRole('button', { name: en.journal.readingListTab })).click();
      expect(await screen.findByText(en.journal.linksEmptyHeadline)).toBeInTheDocument();
    });

    it('opens the LinkSheet from the Add link button (online)', async () => {
      mockJournalFetch({ links: [] });
      renderWith(<JournalClient tripId="trip-1" />);
      (await screen.findByRole('button', { name: en.journal.readingListTab })).click();
      (await screen.findByRole('button', { name: en.journal.addLink })).click();
      expect(await screen.findByRole('dialog', { name: en.journal.addLink })).toBeInTheDocument();
    });
  });
  ```
- [ ] Run it — expect FAIL (reading-list rendering not wired yet):
  ```bash
  npx vitest run components/journal/JournalClient.test.tsx
  ```
  Expected: FAIL on the new reading-list assertions (rows/empty-state/sheet not rendered).
- [ ] Wire the reading-list sub-view in `components/journal/JournalClient.tsx`. The component already owns `{ entries, links }` fetch state, online tracking, and the segmented Entries ⇄ Reading-list switch from D1. Make these edits:

  1. Add imports near the existing component imports:
  ```tsx
  import { useState } from 'react';
  import { EmptyState } from '@/components/EmptyState';
  import { LinkRow } from '@/components/journal/LinkRow';
  import { LinkSheet } from '@/components/journal/LinkSheet';
  import type { SavedLink } from '@/src/db/repos/savedLinks';
  ```
  (Keep any existing `useState`/import lines — do not duplicate them; merge the named imports.)

  2. Inside the component body, add the reading-list sheet state alongside the existing sub-view state:
  ```tsx
  // Reading-list add/edit sheet. `linkSheetKey` bumps on every open so the
  // sheet remounts with fresh state (the Plan-2 stale-form fix).
  const [linkSheetOpen, setLinkSheetOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<SavedLink | undefined>(undefined);
  const [linkSheetKey, setLinkSheetKey] = useState(0);

  function openAddLink() {
    setEditingLink(undefined);
    setLinkSheetKey((k) => k + 1);
    setLinkSheetOpen(true);
  }
  function openEditLink(id: string) {
    const found = links.find((l) => l.id === id);
    setEditingLink(found);
    setLinkSheetKey((k) => k + 1);
    setLinkSheetOpen(true);
  }
  function handleLinkDelete(id: string) {
    const found = links.find((l) => l.id === id);
    setEditingLink(found);
    setLinkSheetKey((k) => k + 1);
    setLinkSheetOpen(true);
  }
  ```
  (`links` is the fetched array already in scope from D1; `offline` is the existing online-tracking flag — reuse whatever D1 named it. If D1 named it differently, substitute that variable below.)

  3. Replace the placeholder reading-list sub-view JSX (the D1 placeholder block rendered when the segmented control is on "Reading list") with:
  ```tsx
  <div className="flex flex-col gap-3">
    <div className="flex justify-end">
      <button
        type="button"
        onClick={openAddLink}
        disabled={offline}
        className="rounded-control bg-coral px-4 py-2 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
      >
        {t('addLink')}
      </button>
    </div>

    {links.length === 0 ? (
      <EmptyState
        mascotAlt={t('addLink')}
        headline={t('linksEmptyHeadline')}
        subtext={t('linksEmptySubtext')}
      />
    ) : (
      <ul className="flex flex-col gap-3">
        {links.map((link) => (
          <li key={link.id}>
            <LinkRow link={link} onEdit={openEditLink} onDelete={handleLinkDelete} />
          </li>
        ))}
      </ul>
    )}

    <LinkSheet
      key={`link-sheet-${linkSheetKey}`}
      open={linkSheetOpen}
      tripId={tripId}
      link={editingLink}
      disabled={offline}
      onClose={() => setLinkSheetOpen(false)}
      onSaved={reload}
    />
  </div>
  ```
  (`t` is the existing `useTranslations('journal')` instance; `reload` is the existing fetch-refetch callback from D1 — substitute D1's actual name if different. Delete is surfaced through the edit sheet's Delete button, matching `ExpenseSheet`; `handleLinkDelete` opens the sheet on the chosen link so the user confirms via that Delete button.)
- [ ] Run it — expect PASS:
  ```bash
  npx vitest run components/journal/JournalClient.test.tsx
  ```
  Expected: PASS (reading-list rows, empty state, and add-sheet all render).
- [ ] Run the full journal-related suite to confirm no regressions across D2:
  ```bash
  npx vitest run app/_actions/savedLinks.test.ts app/api/links app/sw.test.ts messages/journal.keys.test.ts components/journal
  ```
  Expected: PASS (all D2 suites green).
- [ ] Commit:
  ```bash
  git add components/journal/JournalClient.tsx components/journal/JournalClient.test.tsx
  git commit -m "D2.9: render reading list in JournalClient (rows, empty state, add/edit sheet)"

## Group D3 — Settings About & green gate

### Task D3.1: Settings About strings + keys-coverage test

**Files:**
- Create: `messages/settings.keys.test.ts`
- Modify: `messages/en.json` (extend `settings` namespace)

- [ ] **Step 1: Write the failing keys-coverage test.** Create `messages/settings.keys.test.ts` (mirrors `messages/budget.keys.test.ts`):
  ```ts
  import { describe, it, expect } from 'vitest';
  import en from '@/messages/en.json';

  describe('en.json settings namespace', () => {
    // Existing 1A keys plus the new Plan 3 About strings.
    const required = [
      'title', 'language', 'currency', 'comingSoon', 'about', 'aboutTagline',
      'aboutVersion',
      'offlineInstallTitle', 'offlineInstallBody',
      'yourDataTitle', 'yourDataBody', 'yourDataBackup',
    ];

    it('defines every settings UI key', () => {
      const s: Record<string, unknown> = en.settings as unknown as Record<string, unknown>;
      expect(s).toBeDefined();
      for (const k of required) expect(s[k], `settings.${k}`).toBeTypeOf('string');
    });

    it('formats the version label with a {version} placeholder', () => {
      const s = en.settings as unknown as Record<string, string>;
      expect(s.aboutVersion).toContain('{version}');
    });
  });
  ```

- [ ] **Step 2: Run the test — expect FAIL.** Run `npx vitest run messages/settings.keys.test.ts`. Expected: FAIL — `settings.aboutVersion` (and the other new keys) are `undefined`, not a `string`; the `{version}` assertion also fails.

- [ ] **Step 3: Add the new strings to `en.json`.** Replace the existing `settings` block:
  ```json
  "settings": {
    "title": "Settings",
    "language": "Language",
    "currency": "Currency",
    "comingSoon": "Settings controls are on their way.",
    "about": "About",
    "aboutTagline": "Your personal travel companion"
  },
  ```
  with:
  ```json
  "settings": {
    "title": "Settings",
    "language": "Language",
    "currency": "Currency",
    "comingSoon": "Settings controls are on their way.",
    "about": "About",
    "aboutTagline": "Your personal travel companion",
    "aboutVersion": "Version {version}",
    "offlineInstallTitle": "Offline & install",
    "offlineInstallBody": "Works offline for reading. Installing the app and using your location need HTTPS or localhost.",
    "yourDataTitle": "Your data",
    "yourDataBody": "All your data lives in a SQLite database on your own server.",
    "yourDataBackup": "Back it up by copying that database file."
  },
  ```

- [ ] **Step 4: Run the test — expect PASS.** Run `npx vitest run messages/settings.keys.test.ts`. Expected: PASS (both tests green).

- [ ] **Step 5: Commit.** `git commit -am "D3.1: settings About strings + keys-coverage test"`

---

### Task D3.2: App-version build-time constant wiring

**Files:**
- Create: `src/lib/appVersion.ts`
- Create: `src/lib/appVersion.test.ts`
- Modify: `next.config.ts` (inline `NEXT_PUBLIC_APP_VERSION` from `package.json` version)

Mechanism (chosen and fully specified): read `version` from `package.json` in `next.config.ts` and expose it as `env.NEXT_PUBLIC_APP_VERSION`. Next inlines `env` entries as **string literals** at build time, so `src/lib/appVersion.ts` reads `process.env.NEXT_PUBLIC_APP_VERSION` as a literal — identical on server and client, and it does **not** force-dynamic the static settings page (no runtime/server I/O in the component). This mirrors the existing `NEXT_PUBLIC_BASE_PATH` literal-read pattern in `src/lib/basePath.ts`.

- [ ] **Step 1: Write the failing constant test.** Create `src/lib/appVersion.test.ts`:
  ```ts
  import { describe, it, expect, afterEach, vi } from 'vitest';

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    vi.resetModules();
  });

  describe('APP_VERSION', () => {
    it('reads the inlined NEXT_PUBLIC_APP_VERSION literal', async () => {
      process.env.NEXT_PUBLIC_APP_VERSION = '1.2.3';
      const { APP_VERSION } = await import('./appVersion');
      expect(APP_VERSION).toBe('1.2.3');
    });

    it('falls back to "dev" when the env var is unset', async () => {
      vi.resetModules();
      const { APP_VERSION } = await import('./appVersion');
      expect(APP_VERSION).toBe('dev');
    });
  });
  ```

- [ ] **Step 2: Run the test — expect FAIL.** Run `npx vitest run src/lib/appVersion.test.ts`. Expected: FAIL — module `./appVersion` does not exist (import error).

- [ ] **Step 3: Create the constant module.** Create `src/lib/appVersion.ts`:
  ```ts
  /**
   * App version surfaced in Settings → About.
   *
   * `NEXT_PUBLIC_APP_VERSION` is populated from `package.json` `version` in
   * `next.config.ts` and inlined as a string literal at build time (same
   * mechanism as `NEXT_PUBLIC_BASE_PATH`). Because this is a build-time literal
   * with no runtime/server I/O, reading it in a client component does NOT
   * force-dynamic the static settings route. Falls back to `'dev'` in test/dev
   * runs where the var is unset.
   */
  export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';
  ```

- [ ] **Step 4: Run the test — expect PASS.** Run `npx vitest run src/lib/appVersion.test.ts`. Expected: PASS (both cases green).

- [ ] **Step 5: Wire the env var in `next.config.ts`.** Add the `package.json` import at the top of the file (after the existing imports):
  ```ts
  import pkg from './package.json' with { type: 'json' };
  ```
  Then add an `env` entry to the `nextConfig` object. Change:
  ```ts
  const nextConfig: NextConfig = {
    output: 'standalone',
    reactStrictMode: true,
    basePath,
    assetPrefix: basePath,
    eslint: {
      // Lint is run explicitly via `npm run lint`; don't fail the standalone build on it.
      ignoreDuringBuilds: true,
    },
    serverExternalPackages: ['better-sqlite3'],
  };
  ```
  to:
  ```ts
  const nextConfig: NextConfig = {
    output: 'standalone',
    reactStrictMode: true,
    basePath,
    assetPrefix: basePath,
    // Inlined as a string literal at build time (read via src/lib/appVersion.ts).
    // No runtime I/O, so the static settings route stays static (`○`).
    env: {
      NEXT_PUBLIC_APP_VERSION: pkg.version,
    },
    eslint: {
      // Lint is run explicitly via `npm run lint`; don't fail the standalone build on it.
      ignoreDuringBuilds: true,
    },
    serverExternalPackages: ['better-sqlite3'],
  };
  ```

- [ ] **Step 6: Verify tsc + the constant test still pass.** Run `npx tsc --noEmit` (expected: no errors — `resolveJsonModule` is already on, as `en.json` is imported across the suite) then `npx vitest run src/lib/appVersion.test.ts`. Expected: PASS.

- [ ] **Step 7: Commit.** `git commit -am "D3.2: build-time NEXT_PUBLIC_APP_VERSION constant wiring"`

---

### Task D3.3: Settings About block in `SettingsClient`

**Files:**
- Modify: `components/SettingsClient.tsx` (extend the existing About section; do NOT touch the language/currency controls)
- Modify: `components/SettingsClient.test.tsx` (add About-block render assertions)

Keep `SettingsClient` a client component (`'use client'` stays) and keep `app/(home)/settings/page.tsx` a static shell — this task only adds presentational markup driven by the build-time `APP_VERSION` literal plus i18n strings; no `force-dynamic`, no server DB read.

- [ ] **Step 1: Add the failing About-block assertions.** Append these tests inside the existing `describe('SettingsClient', ...)` block in `components/SettingsClient.test.tsx` (the file already imports `render`, `screen`, `NextIntlClientProvider`, `en`, and defines `renderSettings()` / `mockFetchSettings()`):
  ```ts
  it('renders the About block: wordmark, tagline, version, and both info rows', () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '9.9.9';
    mockFetchSettings({ language: 'en', currency: 'USD' });
    renderSettings();

    // Wordmark + tagline (mascot image + app name).
    expect(screen.getByText(en.app.name)).toBeInTheDocument();
    expect(screen.getByText(en.settings.aboutTagline)).toBeInTheDocument();

    // Version line — value is the inlined literal at module-eval time. The
    // string is formatted as `Version {version}`; assert the label prefix and
    // that some version token is shown (env is read at import; see note below).
    expect(screen.getByText(/^Version\b/)).toBeInTheDocument();

    // Both quiet info rows render their titles + bodies.
    expect(screen.getByText(en.settings.offlineInstallTitle)).toBeInTheDocument();
    expect(screen.getByText(en.settings.offlineInstallBody)).toBeInTheDocument();
    expect(screen.getByText(en.settings.yourDataTitle)).toBeInTheDocument();
    expect(screen.getByText(en.settings.yourDataBody)).toBeInTheDocument();
    expect(screen.getByText(en.settings.yourDataBackup)).toBeInTheDocument();
  });

  it('shows the "dev" version fallback when NEXT_PUBLIC_APP_VERSION is unset', async () => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    const { SettingsClient: Fresh } = await import('./SettingsClient');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ language: 'en', currency: 'USD' }) })) as unknown as typeof fetch,
    );
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <Fresh />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('Version dev')).toBeInTheDocument();
  });
  ```
  Also extend the existing `afterEach` cleanup to clear the new env var. Change:
  ```ts
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    vi.resetModules();
  });
  ```
  to:
  ```ts
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    vi.resetModules();
  });
  ```

- [ ] **Step 2: Run the test — expect FAIL.** Run `npx vitest run components/SettingsClient.test.tsx`. Expected: FAIL — the About block does not render `offlineInstallTitle`/`yourDataTitle`/the version line yet (`getByText` matchers throw "unable to find an element").

- [ ] **Step 3: Implement the About block.** Replace the entire contents of `components/SettingsClient.tsx` with:
  ```tsx
  'use client';

  import { useEffect, useState } from 'react';
  import Link from 'next/link';
  import { useTranslations } from 'next-intl';
  import { withBase } from '@/src/lib/basePath';
  import { APP_VERSION } from '@/src/lib/appVersion';

  type SettingsRow = { language: string; currency: string } | null;

  /**
   * Settings data owner. The page is a static shell; this client fetches the
   * read-only `/api/settings` row (SWR-cached by the SW) so it works offline.
   * Language/currency stay read-only placeholders (1A); the About block is
   * fully static — i18n strings + a build-time version literal, no I/O.
   */
  export function SettingsClient() {
    const t = useTranslations();
    const [settings, setSettings] = useState<SettingsRow>(null);

    useEffect(() => {
      let cancelled = false;
      void (async () => {
        try {
          const res = await fetch(withBase('/api/settings'), { credentials: 'same-origin' });
          if (!res.ok) return;
          const row = (await res.json()) as SettingsRow;
          if (!cancelled) setSettings(row);
        } catch {
          // Offline with no cached settings → keep the en/USD placeholder defaults.
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []);

    return (
      <main className="mx-auto w-full max-w-md px-4 pb-24 pt-2">
        <header className="flex items-center gap-2 py-2">
          <Link
            href="/"
            aria-label={t('trip.back')}
            className="flex h-11 w-11 items-center justify-center rounded-chip text-ink"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-title font-bold text-ink">{t('settings.title')}</h1>
        </header>

        <section className="mt-2 rounded-card bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-body text-ink">{t('settings.language')}</span>
            <span className="text-label font-medium text-ink-muted">
              {settings?.language ?? 'en'}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <span className="text-body text-ink">{t('settings.currency')}</span>
            <span className="text-label font-medium text-ink-muted [font-variant-numeric:tabular-nums]">
              {settings?.currency ?? 'USD'}
            </span>
          </div>
          <p className="mt-3 text-caption text-ink-faint">{t('settings.comingSoon')}</p>
        </section>

        <section className="mt-4 rounded-card bg-card p-6 text-center shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={withBase('/burgergo-logo.png')}
            alt={t('mascot.alt')}
            width={88}
            height={88}
            className="mx-auto h-[88px] w-[88px] opacity-90"
          />
          <p className="mt-3 text-heading font-semibold text-ink">{t('app.name')}</p>
          <p className="mt-1 text-caption text-ink-muted">{t('settings.aboutTagline')}</p>
          <p className="mt-2 text-caption text-ink-faint [font-variant-numeric:tabular-nums]">
            {t('settings.aboutVersion', { version: APP_VERSION })}
          </p>
        </section>

        <section className="mt-4 rounded-card bg-card p-4 shadow-card">
          <div>
            <p className="text-label font-medium text-ink">{t('settings.offlineInstallTitle')}</p>
            <p className="mt-1 text-caption text-ink-muted">{t('settings.offlineInstallBody')}</p>
          </div>
          <div className="mt-3 border-t border-line pt-3">
            <p className="text-label font-medium text-ink">{t('settings.yourDataTitle')}</p>
            <p className="mt-1 text-caption text-ink-muted">{t('settings.yourDataBody')}</p>
            <p className="mt-1 text-caption text-ink-faint">{t('settings.yourDataBackup')}</p>
          </div>
        </section>
      </main>
    );
  }
  ```

- [ ] **Step 4: Run the test — expect PASS.** Run `npx vitest run components/SettingsClient.test.tsx`. Expected: PASS — all existing 1A tests plus the two new About-block tests are green.

- [ ] **Step 5: Confirm the settings page is untouched / still a static shell.** Run `npx vitest run app` for any page-level settings tests if present, then visually confirm `app/(home)/settings/page.tsx` is unchanged (no `export const dynamic`, no server DB read). No edit needed.

- [ ] **Step 6: Commit.** `git commit -am "D3.3: Settings About block (wordmark, version, offline & data rows)"`

---

### Task D3.4: Green gate — full suite, types, lint, build, static-page assertion

**Files:** none created/modified by this task except a possible lockfile fix (commit only if regenerated).

This task adds no new code — it is verification only. Run each command and confirm the expected output before proceeding.

- [ ] **Step 1: Full vitest suite — expect PASS.** Run `npx vitest run`. Expected: all test files pass, `0 failed`. (This includes `messages/settings.keys.test.ts`, `src/lib/appVersion.test.ts`, `components/SettingsClient.test.tsx`, and every Plan 0–2 + D0–D2 suite.)

- [ ] **Step 2: Type check — expect PASS.** Run `npx tsc --noEmit`. Expected: no output (zero type errors), including the `import pkg from './package.json'` in `next.config.ts`.

- [ ] **Step 3: Lint — expect PASS.** Run `npm run lint`. Expected: `✔ No ESLint warnings or errors` (the only `no-img-element` usages are the pre-existing eslint-disable lines).

- [ ] **Step 4: Production build — expect SUCCESS + static settings/journal/budget/eats pages.** Run `npm run build`. Expected: build completes (`✓ Compiled successfully`), `NEXT_PUBLIC_APP_VERSION` is inlined (no runtime warning), and the route table marks the relevant pages **Static (`○`)**. Confirm in the printed route summary that the settings, journal, budget, and eats routes carry the `○` (Static) symbol — none should be `ƒ` (Dynamic). Specifically verify:
  - `/settings` → `○`
  - `/trip/[tripId]/journal` → `○`
  - `/trip/[tripId]/budget` → `○`
  - `/trip/[tripId]/eats` → `○`

  If any of these shows `ƒ`, stop and remove the source of force-dynamic (most likely an accidental `cookies()`/server DB read or an `export const dynamic`) before continuing.

- [ ] **Step 5: Commit any lockfile fix only.** If `npm run build` (or a preceding `npm install`) regenerated `package-lock.json` (e.g. the sharp/lockfile drift noted in the deploy gotchas), commit just that: `git commit -am "D3.4: refresh lockfile after green-gate build"`. If nothing changed, skip this step (no empty commit).

- [ ] **Step 6: Proceed to release.** With the full suite, `tsc`, `lint`, and `build` all green and the settings/journal/budget/eats pages confirmed Static (`○`): proceed to subagent-driven-development's final whole-plan review, live browser smoke test, merge, and `./scripts/deploy.sh`.
