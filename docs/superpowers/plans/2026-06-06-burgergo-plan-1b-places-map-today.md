# BurgerGo Plan 1B — Places, Map, Routing & Today Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the trip shell into a working planner — add/organize places into days and a Saved wishlist, see them on an interactive Google map with real route lines and per-leg travel times, hand off to native Google Maps, and land on a "today" next-stop card.

**Architecture:** Builds on Plan 1A (merged). Google calls go through cache-backed server routes/functions (Place Details, reverse Geocode, Directions) keyed in SQLite (`place_details_cache`, `travel_legs` + a new `polyline` column); the in-app map uses Google Maps JS (online only). Following 1A's offline contract, the Plan tab is a **static shell that client-fetches** `/api/trips/[tripId]/places`, so itinerary + cached legs stay readable offline while the live map and mutations require connectivity. A single `PlanClient` owns List/Days/Saved/Today and mounts a **self-contained `PlanMap`** (pure props) in map view.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript (strict), Tailwind, Drizzle/SQLite, Serwist PWA, Google Maps JS + Places + Directions/Geocoding, Vitest + Testing Library. Build/test with **mocked** Google calls (no API key needed); real keys are supplied at runtime via `.env`.

---

## Foundation & Conventions

Same conventions as Plan 1A (npm/Node 22; Next 15 App Router; TS strict; `@/*` → repo root; Vitest jsdom + RTL + in-memory `makeTestDb`; repos pure with `db` first arg and `type Db = TestDb['db']`; money integer minor units; dates TEXT `YYYY-MM-DD`; timestamps `{mode:'timestamp'}` via `new Date(now())`; TDD red→green→commit per task with the `Co-Authored-By` trailer; "Expected: N passed" counts approximate). **Offline rule (load-bearing):** offline-readable pages are **static shells + client-fetch** — never `force-dynamic` page-level DB reads, never `cookies()`/dynamic APIs on cacheable routes. All Google network/loader calls are **mocked in tests**.

### Canonical seams (so the groups compose)
- **Data:** `GET /api/trips/[tripId]/places` -> `{ places: PlaceDTO[], legs: LegDTO[] }`. `PlaceDTO` carries `photoPath` (from `place_details_cache.photoLocalPath`); `LegDTO` carries `polyline`.
- **Legs:** ONE `src/db/repos/legs.ts` (B0 cache primitives, B1 extends). `getOrFetchLeg` (server, cache-backed Directions, persists `polyline`) feeds `recomputeDayLegsAction(tripId,dayDate,mode)`; PlanClient calls it online when a day's stops or mode change.
- **Google client wrappers (B0):** `usePlacesAutocomplete()` (`components/plan/useGooglePlaces.ts`) and `reverseGeocode()` (`components/plan/googleClient.ts`).
- **PlanClient (B2)** `({tripId, tz, currency, locale})` mounts **PlanMap (B3)** by this prop seam: `{ bucket, dayGroups, legs, mode, visibleDates, onToggleDate, onSelectPlace, onOpenDayRoute, online }`. PlanMap is pure-props and never imports PlanClient.
- Single sources: `TravelMode` from `@/src/lib/googleMapsUrl`; one `src/lib/landingDate.ts`; one `components/plan/TodayHero.tsx` (transient next-stop pointer via effect; no persistence).
- **Out of 1B:** per-leg mode override, personal photo upload, Eats/Budget/Journal, geolocation, zh i18n.

## How tasks are organized
Groups run in dependency order **B0 -> B1 -> B2 -> B3** (46 bite-sized TDD tasks total):
- **B0** (10) — Google integration: proxies, JS loader + Autocomplete hook + reverseGeocode, `polyline` migration, leg cache primitives.
- **B1** (10) — Places & Legs repos, Server Actions (incl. `recomputeDayLegsAction`), read handler + photo route.
- **B2** (17) — Plan tab: `PlanClient` (List/Days/Saved/Today/add-place/detail), `TodayHero`, `landingDate`, auto-land.
- **B3** (9) — `PlanMap`: self-contained Google map (pins, real route polylines, per-day filter, deep-links, offline placeholder).

---

## File Map

All files created or modified across this plan (tests colocated), by responsibility:

**DB / repos**
- `src/db/repos/legs.test.ts`
- `src/db/repos/legs.ts`
- `src/db/repos/places.test.ts`
- `src/db/repos/places.ts`
- `src/db/schema.ts`

**Shared libs**
- `src/lib/landingDate.test.ts`
- `src/lib/landingDate.ts`
- `src/lib/legView.test.ts`
- `src/lib/legView.ts`
- `src/lib/planMessages.test.ts`
- `src/lib/planUrl.test.ts`
- `src/lib/planUrl.ts`
- `src/lib/planView.test.ts`
- `src/lib/planView.ts`

**Google libs**
- `src/lib/google/getOrFetchLeg.test.ts`
- `src/lib/google/getOrFetchLeg.ts`
- `src/lib/google/loader.test.ts`
- `src/lib/google/loader.ts`
- `src/lib/google/server.test.ts`
- `src/lib/google/server.ts`

**Google proxies (API)**
- `app/api/google/details/route.test.ts`
- `app/api/google/details/route.ts`
- `app/api/google/geocode/route.test.ts`
- `app/api/google/geocode/route.ts`

**Read handlers (API)**
- `app/api/trips/[tripId]/places/route.test.ts`
- `app/api/trips/[tripId]/places/route.ts`

**Photos (API)**
- `app/api/photos/[placeId]/[variant]/route.test.ts`
- `app/api/photos/[placeId]/[variant]/route.ts`

**Server Actions**
- `app/_actions/places.test.ts`
- `app/_actions/places.ts`

**Plan route**
- `app/trip/[tripId]/plan/page.test.tsx`
- `app/trip/[tripId]/plan/page.tsx`

**Plan UI (components/plan)**
- `components/plan/AddPlaceSheet.test.tsx`
- `components/plan/AddPlaceSheet.tsx`
- `components/plan/DayItinerary.test.tsx`
- `components/plan/DayItinerary.tsx`
- `components/plan/DayModeControl.test.tsx`
- `components/plan/DayModeControl.tsx`
- `components/plan/DayStrip.test.tsx`
- `components/plan/DayStrip.tsx`
- `components/plan/LegConnector.test.tsx`
- `components/plan/LegConnector.tsx`
- `components/plan/PlaceCard.test.tsx`
- `components/plan/PlaceCard.tsx`
- `components/plan/PlaceDetailSheet.test.tsx`
- `components/plan/PlaceDetailSheet.tsx`
- `components/plan/PlanClient.test.tsx`
- `components/plan/PlanClient.tsx`
- `components/plan/PlanMap.test.tsx`
- `components/plan/PlanMap.tsx`
- `components/plan/SavedList.test.tsx`
- `components/plan/SavedList.tsx`
- `components/plan/TodayHero.test.tsx`
- `components/plan/TodayHero.tsx`
- `components/plan/googleClient.test.ts`
- `components/plan/googleClient.ts`
- `components/plan/useGooglePlaces.test.ts`
- `components/plan/useGooglePlaces.ts`

**Map libs**
- `src/lib/map/bounds.test.ts`
- `src/lib/map/bounds.ts`
- `src/lib/map/colors.test.ts`
- `src/lib/map/colors.ts`
- `src/lib/map/markers.test.ts`
- `src/lib/map/markers.ts`
- `src/lib/map/polyline.test.ts`
- `src/lib/map/polyline.ts`
- `src/lib/map/types.ts`

**Components**
- `components/TripShellClient.test.tsx`
- `components/TripShellClient.tsx`
- `components/map/GoogleMapCanvas.test.tsx`
- `components/map/GoogleMapCanvas.tsx`
- `components/map/MapLegend.test.tsx`
- `components/map/MapLegend.tsx`
- `components/map/PlaceInfoCard.test.tsx`
- `components/map/PlaceInfoCard.tsx`

**i18n**
- `messages/en.json`

---

## Tasks

## Task-Group B0 — Google Integration (cache-backed, all network/loader calls mocked in tests)

> **Scope.** This group builds: (B0.1) a Drizzle migration adding nullable `polyline TEXT` to `travel_legs`; (B0.2) `src/db/repos/legs.ts` with the two cache primitives `getCachedLeg`/`upsertLeg` that persist `polyline`; (B0.3) `src/lib/google/server.ts` — normalized fetch wrappers for Place Details, Reverse Geocode, and Directions; (B0.4) `GET /api/google/details` proxy (placeCache-backed); (B0.5) `GET /api/google/geocode` passthrough; (B0.6) `src/lib/google/loader.ts` — Maps JS loader + `SessionTokenManager`; (B0.7) `components/plan/googleClient.ts` — `reverseGeocode(lat,lng)` client helper; (B0.8) `components/plan/useGooglePlaces.ts` — `usePlacesAutocomplete()` hook; (B0.9) server `getOrFetchLeg` — the cache-backed Directions entry point used by B1's recompute action; (B0.10) whole-group verification. **B1 extends `legs.ts` (same file) with `legsForDay` + `invalidateLegsTouchingPlace`.**

> **Conventions (from 1A).** Repos: pure functions, `db` first arg, `type Db = TestDb['db']`; ids via `newId()` from `@/src/db/ids`; timestamps `new Date(now())` from `@/src/lib/clock`; route handlers import `db` from `@/src/db/client` and `env` from `@/src/env`; tests mock `@/src/db/client` with the `get db()` getter and `sqlite: {}`, and mock `@/src/env` with a partial. `TravelMode` is imported ONLY from `@/src/lib/googleMapsUrl` everywhere.

---

### Task B0.1: Drizzle migration — add nullable `polyline TEXT` to `travel_legs`

The RESOLUTIONS require that `getOrFetchLeg` persists the Directions `overview_polyline` alongside the duration/distance so the PlanMap (B3) can draw real road routes offline. The schema change is a nullable column (existing rows become `polyline = NULL`, which maps to the straight-line fallback).

**Files:**
- Modify `src/db/schema.ts` — add `polyline` column to `travelLegs` table
- Generate migration with `npm run db:generate` — commit the resulting SQL file in `drizzle/`

- [ ] **Step 1: Add `polyline` to the schema.**

  Edit `src/db/schema.ts`. In the `travelLegs` table definition, add the `polyline` column after `distanceMeters`:

  ```ts
  // existing columns …
  distanceMeters: integer('distance_meters').notNull(),
  polyline: text('polyline'),  // nullable: NULL until Google Directions returns it
  computedAt: integer('computed_at', { mode: 'timestamp' }).notNull(),
  ```

  Also update the inferred `TravelLeg` type — no change needed, `type TravelLeg = typeof travelLegs.$inferSelect` picks it up automatically.

- [ ] **Step 2: Generate the migration SQL.**
  ```bash
  npm run db:generate
  ```
  Drizzle Kit diffs the schema and writes a new file, e.g. `drizzle/0001_add_polyline.sql`, containing:
  ```sql
  ALTER TABLE `travel_legs` ADD `polyline` text;
  ```
  The exact filename is chosen by Drizzle Kit; whatever it generates is correct. Verify the file exists:
  ```bash
  ls drizzle/*.sql
  ```

- [ ] **Step 3: Commit schema + migration.**
  ```bash
  git add src/db/schema.ts drizzle/
  git commit -m "feat(schema): add nullable polyline TEXT to travel_legs (Drizzle migration)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B0.2: `src/db/repos/legs.ts` — cache primitives `getCachedLeg` / `upsertLeg`

These two functions are the foundation of the Directions cache. `upsertLeg` persists `polyline` in addition to duration/distance (required by RESOLUTIONS). B1 will **extend this same file** with `legsForDay` and `invalidateLegsTouchingPlace` — do not create a second legs repo there.

`TravelMode` is imported from `@/src/lib/googleMapsUrl` (the single source of truth); it is NOT redefined or re-exported here.

**Files:**
- Create `src/db/repos/legs.ts`
- Create `src/db/repos/legs.test.ts`

- [ ] **Step 1: Write the failing test.**

  Create `src/db/repos/legs.test.ts`:
  ```ts
  import { describe, it, expect, beforeEach, vi } from 'vitest';
  import { makeTestDb } from '@/src/db/testDb';
  import { trips, places } from '@/src/db/schema';
  import { getCachedLeg, upsertLeg } from '@/src/db/repos/legs';

  // Deterministic clock so computedAt is assertable.
  vi.mock('@/src/lib/clock', () => ({ now: () => 1_700_000_000_000 }));

  const TS = new Date(1_700_000_000_000);

  type Db = ReturnType<typeof makeTestDb>['db'];

  function seed(db: Db) {
    db.insert(trips).values({
      id: 'trip-1',
      name: 'Tokyo',
      startDate: '2026-06-05',
      endDate: '2026-06-07',
      coverPhoto: null,
      createdAt: TS,
      updatedAt: TS,
    }).run();
    db.insert(places).values([
      {
        id: 'p-a', tripId: 'trip-1', dayDate: '2026-06-05', googlePlaceId: null,
        name: 'A', address: null, lat: 35.0, lng: 139.0, category: 'sightseeing',
        scheduledTime: null, durationMin: null, cost: null, notes: null,
        orderIndex: 0, createdAt: TS, updatedAt: TS,
      },
      {
        id: 'p-b', tripId: 'trip-1', dayDate: '2026-06-05', googlePlaceId: null,
        name: 'B', address: null, lat: 35.1, lng: 139.1, category: 'sightseeing',
        scheduledTime: null, durationMin: null, cost: null, notes: null,
        orderIndex: 1, createdAt: TS, updatedAt: TS,
      },
    ]).run();
  }

  describe('legs repo cache primitives', () => {
    let db: Db;
    let sqlite: ReturnType<typeof makeTestDb>['sqlite'];

    beforeEach(() => {
      const h = makeTestDb();
      db = h.db;
      sqlite = h.sqlite;
      seed(db);
    });

    it('getCachedLeg returns undefined on a miss', () => {
      expect(getCachedLeg(db, 'p-a', 'p-b', 'walk')).toBeUndefined();
    });

    it('upsertLeg inserts a leg and getCachedLeg reads it back', () => {
      const leg = upsertLeg(db, {
        tripId: 'trip-1',
        fromPlaceId: 'p-a',
        toPlaceId: 'p-b',
        mode: 'walk',
        durationSeconds: 600,
        distanceMeters: 800,
        polyline: 'abc123',
      });
      expect(leg.id).toBeTruthy();
      expect(leg.computedAt).toEqual(TS);
      expect(leg.polyline).toBe('abc123');

      const got = getCachedLeg(db, 'p-a', 'p-b', 'walk');
      expect(got).toBeDefined();
      expect(got!.durationSeconds).toBe(600);
      expect(got!.distanceMeters).toBe(800);
      expect(got!.polyline).toBe('abc123');
      expect(got!.mode).toBe('walk');
    });

    it('upsertLeg refreshes an existing (from,to,mode) row in place', () => {
      upsertLeg(db, {
        tripId: 'trip-1', fromPlaceId: 'p-a', toPlaceId: 'p-b', mode: 'drive',
        durationSeconds: 300, distanceMeters: 4000, polyline: 'P1',
      });
      upsertLeg(db, {
        tripId: 'trip-1', fromPlaceId: 'p-a', toPlaceId: 'p-b', mode: 'drive',
        durationSeconds: 360, distanceMeters: 4200, polyline: 'P2',
      });

      const got = getCachedLeg(db, 'p-a', 'p-b', 'drive');
      expect(got!.durationSeconds).toBe(360);
      expect(got!.distanceMeters).toBe(4200);
      expect(got!.polyline).toBe('P2');

      const { c } = sqlite.prepare('SELECT count(*) AS c FROM travel_legs').get() as { c: number };
      expect(c).toBe(1);
    });

    it('upsertLeg accepts null polyline (no Directions result yet)', () => {
      const leg = upsertLeg(db, {
        tripId: 'trip-1', fromPlaceId: 'p-a', toPlaceId: 'p-b', mode: 'transit',
        durationSeconds: 240, distanceMeters: 900, polyline: null,
      });
      expect(leg.polyline).toBeNull();
    });

    it('keeps modes distinct for the same pair (composite unique key)', () => {
      upsertLeg(db, {
        tripId: 'trip-1', fromPlaceId: 'p-a', toPlaceId: 'p-b', mode: 'walk',
        durationSeconds: 600, distanceMeters: 800, polyline: 'W',
      });
      upsertLeg(db, {
        tripId: 'trip-1', fromPlaceId: 'p-a', toPlaceId: 'p-b', mode: 'transit',
        durationSeconds: 240, distanceMeters: 900, polyline: 'T',
      });
      expect(getCachedLeg(db, 'p-a', 'p-b', 'walk')!.durationSeconds).toBe(600);
      expect(getCachedLeg(db, 'p-a', 'p-b', 'transit')!.durationSeconds).toBe(240);
      const { c } = sqlite.prepare('SELECT count(*) AS c FROM travel_legs').get() as { c: number };
      expect(c).toBe(2);
    });
  });
  ```

- [ ] **Step 2: Run — expect FAIL.**
  ```bash
  npx vitest run src/db/repos/legs.test.ts
  ```
  Expect failure: `Failed to resolve import "@/src/db/repos/legs"`.

- [ ] **Step 3: Implement the cache primitives.**

  Create `src/db/repos/legs.ts`:
  ```ts
  /**
   * Travel-legs repo (spec §6.3 / §9.2). B0 creates the two cache primitives;
   * B1 EXTENDS THIS SAME FILE with legsForDay + invalidateLegsTouchingPlace.
   *
   * TravelMode is imported from @/src/lib/googleMapsUrl — never redefined here.
   */
  import { and, eq } from 'drizzle-orm';
  import type { TestDb } from '@/src/db/testDb';
  import { travelLegs, type TravelLeg } from '@/src/db/schema';
  import { newId } from '@/src/db/ids';
  import { now } from '@/src/lib/clock';
  import type { TravelMode } from '@/src/lib/googleMapsUrl';

  export type { TravelLeg };

  type Db = TestDb['db'];

  /**
   * Read the cached leg for an exact (from, to, mode) triple, or undefined.
   * Matches the `uniq_leg` composite unique index in the schema.
   */
  export function getCachedLeg(
    db: Db,
    fromPlaceId: string,
    toPlaceId: string,
    mode: TravelMode,
  ): TravelLeg | undefined {
    return db
      .select()
      .from(travelLegs)
      .where(
        and(
          eq(travelLegs.fromPlaceId, fromPlaceId),
          eq(travelLegs.toPlaceId, toPlaceId),
          eq(travelLegs.mode, mode),
        ),
      )
      .get();
  }

  export interface UpsertLegInput {
    tripId: string;
    fromPlaceId: string;
    toPlaceId: string;
    mode: TravelMode;
    durationSeconds: number;
    distanceMeters: number;
    /** Overview polyline from Google Directions; null when not yet fetched. */
    polyline: string | null;
  }

  /**
   * Insert or refresh the cached leg for (from, to, mode). On conflict against
   * the `uniq_leg` index the duration/distance/polyline/computedAt are
   * overwritten; the row id is preserved. `tripId` is also kept in the
   * conflict-set so a trip reassignment is always reflected. Returns the row.
   */
  export function upsertLeg(db: Db, input: UpsertLegInput): TravelLeg {
    const computedAt = new Date(now());
    db.insert(travelLegs)
      .values({
        id: newId(),
        tripId: input.tripId,
        fromPlaceId: input.fromPlaceId,
        toPlaceId: input.toPlaceId,
        mode: input.mode,
        durationSeconds: input.durationSeconds,
        distanceMeters: input.distanceMeters,
        polyline: input.polyline,
        computedAt,
      })
      .onConflictDoUpdate({
        target: [travelLegs.fromPlaceId, travelLegs.toPlaceId, travelLegs.mode],
        set: {
          tripId: input.tripId,
          durationSeconds: input.durationSeconds,
          distanceMeters: input.distanceMeters,
          polyline: input.polyline,
          computedAt,
        },
      })
      .run();
    return getCachedLeg(db, input.fromPlaceId, input.toPlaceId, input.mode) as TravelLeg;
  }
  ```

- [ ] **Step 4: Run — expect PASS.**
  ```bash
  npx vitest run src/db/repos/legs.test.ts
  ```
  Expected: 5 passed.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/db/repos/legs.ts src/db/repos/legs.test.ts
  git commit -m "feat(legs): travel_legs cache primitives repo (getCachedLeg/upsertLeg with polyline)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B0.3: `src/lib/google/server.ts` — normalized Google web-service client

A thin, mockable wrapper over `fetch` that calls Place Details, Geocoding (reverse), and Directions with the server key and normalizes each response. Pure normalizers are tested directly against captured JSON shapes; fetch wrappers are tested via `vi.stubGlobal('fetch', ...)` — no real key ever needed.

**Files:**
- Create `src/lib/google/server.ts`
- Create `src/lib/google/server.test.ts`

- [ ] **Step 1: Write the failing test.**

  Create `src/lib/google/server.test.ts`:
  ```ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import {
    normalizeDetails,
    normalizeReverseGeocode,
    normalizeDirections,
    fetchPlaceDetails,
    fetchReverseGeocode,
    fetchDirections,
    GoogleApiError,
  } from '@/src/lib/google/server';

  describe('normalizeDetails', () => {
    it('maps a Place Details OK payload to the normalized shape', () => {
      const raw = {
        status: 'OK',
        result: {
          place_id: 'gpid-1',
          name: 'Senso-ji Temple',
          formatted_address: '2 Chome-3-1 Asakusa, Tokyo',
          geometry: { location: { lat: 35.714765, lng: 139.796655 } },
          types: ['tourist_attraction', 'place_of_worship', 'point_of_interest'],
          photos: [{ photo_reference: 'PHOTO_REF_A', width: 4000, height: 3000 }],
        },
      };
      expect(normalizeDetails(raw)).toEqual({
        googlePlaceId: 'gpid-1',
        name: 'Senso-ji Temple',
        address: '2 Chome-3-1 Asakusa, Tokyo',
        lat: 35.714765,
        lng: 139.796655,
        categoryGuess: 'sightseeing',
        photoRef: 'PHOTO_REF_A',
      });
    });

    it('maps lodging types to lodging and unknown to other; tolerates no photo', () => {
      expect(
        normalizeDetails({
          status: 'OK',
          result: {
            place_id: 'h1', name: 'Hotel', formatted_address: 'X',
            geometry: { location: { lat: 1, lng: 2 } },
            types: ['lodging'],
          },
        }).categoryGuess,
      ).toBe('lodging');
      expect(
        normalizeDetails({
          status: 'OK',
          result: {
            place_id: 'z1', name: 'Mystery', formatted_address: 'Y',
            geometry: { location: { lat: 1, lng: 2 } },
            types: ['locality'],
          },
        }).categoryGuess,
      ).toBe('other');
    });

    it('throws GoogleApiError on a non-OK status', () => {
      expect(() => normalizeDetails({ status: 'OVER_QUERY_LIMIT' })).toThrow(GoogleApiError);
    });
  });

  describe('normalizeReverseGeocode', () => {
    it('returns the first formatted_address on OK', () => {
      const raw = {
        status: 'OK',
        results: [
          { formatted_address: '1-1 Marunouchi, Chiyoda City, Tokyo' },
          { formatted_address: 'Chiyoda City, Tokyo' },
        ],
      };
      expect(normalizeReverseGeocode(raw)).toEqual({
        address: '1-1 Marunouchi, Chiyoda City, Tokyo',
      });
    });

    it('returns address:null on ZERO_RESULTS (no throw)', () => {
      expect(normalizeReverseGeocode({ status: 'ZERO_RESULTS', results: [] })).toEqual({
        address: null,
      });
    });

    it('throws GoogleApiError on REQUEST_DENIED', () => {
      expect(() => normalizeReverseGeocode({ status: 'REQUEST_DENIED' })).toThrow(GoogleApiError);
    });
  });

  describe('normalizeDirections', () => {
    it('extracts duration/distance seconds+meters and the overview polyline', () => {
      const raw = {
        status: 'OK',
        routes: [
          {
            overview_polyline: { points: 'abc123_polyline' },
            legs: [{ duration: { value: 642 }, distance: { value: 815 } }],
          },
        ],
      };
      expect(normalizeDirections(raw)).toEqual({
        durationSeconds: 642,
        distanceMeters: 815,
        polyline: 'abc123_polyline',
      });
    });

    it('sums multiple legs (waypoint splits) into a single duration/distance', () => {
      const raw = {
        status: 'OK',
        routes: [
          {
            overview_polyline: { points: 'poly' },
            legs: [
              { duration: { value: 100 }, distance: { value: 200 } },
              { duration: { value: 50 }, distance: { value: 75 } },
            ],
          },
        ],
      };
      expect(normalizeDirections(raw)).toMatchObject({ durationSeconds: 150, distanceMeters: 275 });
    });

    it('throws GoogleApiError on ZERO_RESULTS for directions', () => {
      expect(() => normalizeDirections({ status: 'ZERO_RESULTS', routes: [] })).toThrow(GoogleApiError);
    });
  });

  describe('fetch wrappers (injected fetch, no real key)', () => {
    const okJson = (body: unknown) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);

    let fetchSpy: ReturnType<typeof vi.fn>;
    beforeEach(() => {
      fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
    });

    it('fetchPlaceDetails calls the details endpoint with key + place_id and returns normalized data', async () => {
      fetchSpy.mockReturnValueOnce(
        okJson({
          status: 'OK',
          result: {
            place_id: 'gpid-1',
            name: 'Senso-ji Temple',
            formatted_address: 'Asakusa',
            geometry: { location: { lat: 1, lng: 2 } },
            types: ['tourist_attraction'],
            photos: [{ photo_reference: 'R' }],
          },
        }),
      );
      const out = await fetchPlaceDetails({ placeId: 'gpid-1', sessionToken: 'sess-1', apiKey: 'SERVER_KEY' });
      expect(out.googlePlaceId).toBe('gpid-1');
      expect(out.categoryGuess).toBe('sightseeing');

      const url = new URL(fetchSpy.mock.calls[0]![0] as string);
      expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/place/details/json');
      expect(url.searchParams.get('place_id')).toBe('gpid-1');
      expect(url.searchParams.get('key')).toBe('SERVER_KEY');
      expect(url.searchParams.get('sessiontoken')).toBe('sess-1');
      expect(url.searchParams.get('fields')).toContain('place_id');
    });

    it('fetchReverseGeocode calls the geocode endpoint with latlng + key', async () => {
      fetchSpy.mockReturnValueOnce(
        okJson({ status: 'OK', results: [{ formatted_address: 'Somewhere' }] }),
      );
      const out = await fetchReverseGeocode({ lat: 35.1, lng: 139.2, apiKey: 'SERVER_KEY' });
      expect(out.address).toBe('Somewhere');

      const url = new URL(fetchSpy.mock.calls[0]![0] as string);
      expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/geocode/json');
      expect(url.searchParams.get('latlng')).toBe('35.1,139.2');
      expect(url.searchParams.get('key')).toBe('SERVER_KEY');
    });

    it('fetchDirections maps walk→walking, passes ordered waypoints, returns normalized data', async () => {
      fetchSpy.mockReturnValueOnce(
        okJson({
          status: 'OK',
          routes: [{ overview_polyline: { points: 'P' }, legs: [{ duration: { value: 60 }, distance: { value: 90 } }] }],
        }),
      );
      const out = await fetchDirections({
        origin: { lat: 1, lng: 2 },
        destination: { lat: 5, lng: 6 },
        waypoints: [{ lat: 3, lng: 4 }],
        mode: 'walk',
        apiKey: 'SERVER_KEY',
      });
      expect(out).toEqual({ durationSeconds: 60, distanceMeters: 90, polyline: 'P' });

      const url = new URL(fetchSpy.mock.calls[0]![0] as string);
      expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/directions/json');
      expect(url.searchParams.get('origin')).toBe('1,2');
      expect(url.searchParams.get('destination')).toBe('5,6');
      expect(url.searchParams.get('waypoints')).toBe('3,4');
      expect(url.searchParams.get('mode')).toBe('walking');
      expect(url.searchParams.get('key')).toBe('SERVER_KEY');
    });

    it('throws GoogleApiError when the HTTP response is not ok', async () => {
      fetchSpy.mockReturnValueOnce(Promise.resolve({ ok: false, status: 502 } as Response));
      await expect(
        fetchReverseGeocode({ lat: 1, lng: 2, apiKey: 'K' }),
      ).rejects.toBeInstanceOf(GoogleApiError);
    });
  });
  ```

- [ ] **Step 2: Run — expect FAIL.**
  ```bash
  npx vitest run src/lib/google/server.test.ts
  ```
  Expect failure: `Failed to resolve import "@/src/lib/google/server"`.

- [ ] **Step 3: Implement.**

  Create `src/lib/google/server.ts`:
  ```ts
  /**
   * Server-side Google web-service client. Calls Place Details, Geocoding
   * (reverse), and Directions with the server key and normalizes responses.
   * `fetch` is read from globalThis so tests can stub it; no real key is
   * required to build or test. Every billable call is cache-gated by the
   * proxy route that wraps it.
   */
  import type { TravelMode } from '@/src/lib/googleMapsUrl';

  const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
  const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
  const DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';

  /** Minimal Place Details field mask — keeps the Details SKU on the basic tier. */
  const DETAILS_FIELDS = 'place_id,name,formatted_address,geometry/location,types,photos';

  /** Google Directions `mode` param mapping. */
  const DIRECTIONS_MODE: Record<TravelMode, string> = {
    walk: 'walking',
    drive: 'driving',
    transit: 'transit',
  };

  /** A non-OK Google status (or non-2xx HTTP). */
  export class GoogleApiError extends Error {
    constructor(
      public readonly status: string,
      message?: string,
    ) {
      super(message ?? `Google API error: ${status}`);
      this.name = 'GoogleApiError';
    }
  }

  export type CategoryGuess = 'sightseeing' | 'lodging' | 'transport' | 'activity' | 'other';

  /** Normalized Place Details — written into `place_details_cache`. */
  export interface NormalizedDetails {
    googlePlaceId: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    categoryGuess: CategoryGuess;
    photoRef: string | null;
  }

  /** Normalized reverse-geocode result. */
  export interface NormalizedReverseGeocode {
    address: string | null;
  }

  /** Normalized Directions — summed across legs; polyline written into `travel_legs`. */
  export interface NormalizedDirections {
    durationSeconds: number;
    distanceMeters: number;
    polyline: string;
  }

  function guessCategory(types: string[] | undefined): CategoryGuess {
    const t = new Set(types ?? []);
    if (t.has('lodging')) return 'lodging';
    if (
      t.has('airport') || t.has('train_station') || t.has('subway_station') ||
      t.has('bus_station') || t.has('transit_station')
    ) return 'transport';
    if (
      t.has('tourist_attraction') || t.has('museum') || t.has('place_of_worship') ||
      t.has('park') || t.has('art_gallery')
    ) return 'sightseeing';
    if (
      t.has('amusement_park') || t.has('zoo') || t.has('aquarium') ||
      t.has('stadium') || t.has('spa') || t.has('night_club')
    ) return 'activity';
    return 'other';
  }

  // --- Pure normalizers (unit-tested directly) ----------------------------------

  export function normalizeDetails(raw: unknown): NormalizedDetails {
    const r = raw as {
      status?: string;
      result?: {
        place_id?: string;
        name?: string;
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
        types?: string[];
        photos?: Array<{ photo_reference?: string }>;
      };
    };
    if (r.status !== 'OK' || !r.result) {
      throw new GoogleApiError(r.status ?? 'UNKNOWN', 'Place Details lookup failed');
    }
    const res = r.result;
    return {
      googlePlaceId: res.place_id ?? '',
      name: res.name ?? '',
      address: res.formatted_address ?? '',
      lat: res.geometry?.location?.lat ?? 0,
      lng: res.geometry?.location?.lng ?? 0,
      categoryGuess: guessCategory(res.types),
      photoRef: res.photos?.[0]?.photo_reference ?? null,
    };
  }

  export function normalizeReverseGeocode(raw: unknown): NormalizedReverseGeocode {
    const r = raw as { status?: string; results?: Array<{ formatted_address?: string }> };
    if (r.status === 'ZERO_RESULTS') return { address: null };
    if (r.status !== 'OK') {
      throw new GoogleApiError(r.status ?? 'UNKNOWN', 'Reverse geocode failed');
    }
    return { address: r.results?.[0]?.formatted_address ?? null };
  }

  export function normalizeDirections(raw: unknown): NormalizedDirections {
    const r = raw as {
      status?: string;
      routes?: Array<{
        overview_polyline?: { points?: string };
        legs?: Array<{ duration?: { value?: number }; distance?: { value?: number } }>;
      }>;
    };
    const route = r.routes?.[0];
    if (r.status !== 'OK' || !route) {
      throw new GoogleApiError(r.status ?? 'UNKNOWN', 'Directions lookup failed');
    }
    const legs = route.legs ?? [];
    return {
      durationSeconds: legs.reduce((s, l) => s + (l.duration?.value ?? 0), 0),
      distanceMeters: legs.reduce((s, l) => s + (l.distance?.value ?? 0), 0),
      polyline: route.overview_polyline?.points ?? '',
    };
  }

  // --- Fetch wrappers (network injected via globalThis.fetch) -------------------

  async function getJson(url: string): Promise<unknown> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new GoogleApiError(`HTTP_${res.status}`, `Google HTTP ${res.status}`);
    }
    return res.json();
  }

  export interface FetchDetailsInput {
    placeId: string;
    apiKey: string;
    sessionToken?: string;
  }

  export async function fetchPlaceDetails(input: FetchDetailsInput): Promise<NormalizedDetails> {
    const params = new URLSearchParams({
      place_id: input.placeId,
      fields: DETAILS_FIELDS,
      key: input.apiKey,
    });
    if (input.sessionToken) params.set('sessiontoken', input.sessionToken);
    return normalizeDetails(await getJson(`${DETAILS_URL}?${params.toString()}`));
  }

  export interface FetchReverseGeocodeInput {
    lat: number;
    lng: number;
    apiKey: string;
  }

  export async function fetchReverseGeocode(input: FetchReverseGeocodeInput): Promise<NormalizedReverseGeocode> {
    const params = new URLSearchParams({
      latlng: `${input.lat},${input.lng}`,
      key: input.apiKey,
    });
    return normalizeReverseGeocode(await getJson(`${GEOCODE_URL}?${params.toString()}`));
  }

  export interface FetchDirectionsInput {
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
    waypoints: Array<{ lat: number; lng: number }>;
    mode: TravelMode;
    apiKey: string;
  }

  export async function fetchDirections(input: FetchDirectionsInput): Promise<NormalizedDirections> {
    const params = new URLSearchParams({
      origin: `${input.origin.lat},${input.origin.lng}`,
      destination: `${input.destination.lat},${input.destination.lng}`,
      mode: DIRECTIONS_MODE[input.mode],
      key: input.apiKey,
    });
    if (input.waypoints.length > 0) {
      params.set('waypoints', input.waypoints.map((w) => `${w.lat},${w.lng}`).join('|'));
    }
    return normalizeDirections(await getJson(`${DIRECTIONS_URL}?${params.toString()}`));
  }
  ```

- [ ] **Step 4: Run — expect PASS.**
  ```bash
  npx vitest run src/lib/google/server.test.ts
  ```
  Expected: 11 passed.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/lib/google/server.ts src/lib/google/server.test.ts
  git commit -m "feat(google): server web-service client + normalized Details/Geocode/Directions shapes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B0.4: `GET /api/google/details` — cache-first placeCache proxy

Checks `place_details_cache` first; on a miss calls Google, writes back, returns the normalized row. On a Google failure with a stale cache row present, serves the cached value.

**Files:**
- Create `app/api/google/details/route.ts`
- Create `app/api/google/details/route.test.ts`

- [ ] **Step 1: Write the failing test.**

  Create `app/api/google/details/route.test.ts`:
  ```ts
  import { describe, it, expect, beforeEach, vi } from 'vitest';
  import { makeTestDb } from '@/src/db/testDb';
  import { placeDetailsCache } from '@/src/db/schema';

  const testHandle = { db: makeTestDb().db };
  vi.mock('@/src/db/client', () => ({
    get db() { return testHandle.db; },
    sqlite: {},
  }));
  vi.mock('@/src/env', () => ({ env: { GOOGLE_MAPS_SERVER_KEY: 'SERVER_KEY' } }));
  vi.mock('@/src/lib/clock', () => ({ now: () => 1_700_000_000_000 }));

  import { GET } from '@/app/api/google/details/route';

  function req(qs: string) {
    return new Request(`http://x/api/google/details?${qs}`);
  }

  describe('GET /api/google/details', () => {
    let fetchSpy: ReturnType<typeof vi.fn>;
    beforeEach(() => {
      testHandle.db = makeTestDb().db;
      fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
    });

    it('returns 400 when placeId is missing', async () => {
      const res = await GET(req(''));
      expect(res.status).toBe(400);
    });

    it('cache MISS: calls Google, writes the cache row, returns normalized details', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'OK',
          result: {
            place_id: 'gpid-1',
            name: 'Senso-ji Temple',
            formatted_address: 'Asakusa',
            geometry: { location: { lat: 35.7, lng: 139.8 } },
            types: ['tourist_attraction'],
            photos: [{ photo_reference: 'R' }],
          },
        }),
      });

      const res = await GET(req('placeId=gpid-1&sessionToken=sess-1'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        googlePlaceId: string; categoryGuess: string; cached: boolean;
      };
      expect(body.googlePlaceId).toBe('gpid-1');
      expect(body.categoryGuess).toBe('sightseeing');
      expect(body.cached).toBe(false);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Cache row was written.
      expect(testHandle.db.select().from(placeDetailsCache).all().length).toBe(1);
    });

    it('cache HIT: does not call Google and returns cached:true', async () => {
      testHandle.db.insert(placeDetailsCache).values({
        googlePlaceId: 'gpid-1',
        name: 'Cached Name',
        address: 'Cached Addr',
        lat: 1,
        lng: 2,
        categoryGuess: 'lodging',
        photoRef: 'cref',
        photoLocalPath: null,
        rawJson: '{}',
        fetchedAt: new Date(1_699_000_000_000),
      }).run();

      const res = await GET(req('placeId=gpid-1'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { name: string; cached: boolean; categoryGuess: string };
      expect(body.name).toBe('Cached Name');
      expect(body.categoryGuess).toBe('lodging');
      expect(body.cached).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('Google fails with NO cache row: returns 502 soft error', async () => {
      fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'REQUEST_DENIED' }) });
      const res = await GET(req('placeId=missing'));
      expect(res.status).toBe(502);
      await expect(res.json()).resolves.toMatchObject({ error: 'google_unavailable' });
    });

    it('Google fails WITH a stale cache row: serves the cached value', async () => {
      testHandle.db.insert(placeDetailsCache).values({
        googlePlaceId: 'gpid-2',
        name: 'Stale But Good',
        address: 'A',
        lat: 1,
        lng: 2,
        categoryGuess: 'other',
        photoRef: null,
        photoLocalPath: null,
        rawJson: '{}',
        fetchedAt: new Date(1_699_000_000_000),
      }).run();
      fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'OVER_QUERY_LIMIT' }) });

      const res = await GET(req('placeId=gpid-2&refresh=1'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { name: string; cached: boolean };
      expect(body.name).toBe('Stale But Good');
      expect(body.cached).toBe(true);
    });
  });
  ```

- [ ] **Step 2: Run — expect FAIL.**
  ```bash
  npx vitest run app/api/google/details/route.test.ts
  ```
  Expect failure: `Failed to resolve import "@/app/api/google/details/route"`.

- [ ] **Step 3: Implement.**

  Create `app/api/google/details/route.ts`:
  ```ts
  import { NextResponse } from 'next/server';
  import { db } from '@/src/db/client';
  import { env } from '@/src/env';
  import { now } from '@/src/lib/clock';
  import { getCachedDetails, upsertDetails } from '@/src/db/repos/placeCache';
  import { fetchPlaceDetails, type CategoryGuess } from '@/src/lib/google/server';
  import type { PlaceDetailsCacheRow } from '@/src/db/schema';

  export const dynamic = 'force-dynamic';

  interface DetailsResponse {
    googlePlaceId: string;
    name: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
    categoryGuess: string | null;
    photoRef: string | null;
    photoLocalPath: string | null;
    cached: boolean;
  }

  function toResponse(row: PlaceDetailsCacheRow, cached: boolean): DetailsResponse {
    return {
      googlePlaceId: row.googlePlaceId,
      name: row.name,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      categoryGuess: row.categoryGuess,
      photoRef: row.photoRef,
      photoLocalPath: row.photoLocalPath,
      cached,
    };
  }

  export async function GET(req: Request) {
    const url = new URL(req.url);
    const placeId = url.searchParams.get('placeId');
    const sessionToken = url.searchParams.get('sessionToken') ?? undefined;
    const refresh = url.searchParams.get('refresh') === '1';
    if (!placeId) {
      return NextResponse.json({ error: 'missing_placeId' }, { status: 400 });
    }

    const existing = getCachedDetails(db, placeId);
    if (existing && !refresh) {
      return NextResponse.json(toResponse(existing, true));
    }

    if (!env.GOOGLE_MAPS_SERVER_KEY) {
      if (existing) return NextResponse.json(toResponse(existing, true));
      return NextResponse.json({ error: 'google_unavailable' }, { status: 502 });
    }

    try {
      const d = await fetchPlaceDetails({
        placeId,
        sessionToken,
        apiKey: env.GOOGLE_MAPS_SERVER_KEY,
      });
      const saved = upsertDetails(db, {
        googlePlaceId: d.googlePlaceId || placeId,
        name: d.name,
        address: d.address,
        lat: d.lat,
        lng: d.lng,
        categoryGuess: d.categoryGuess satisfies CategoryGuess,
        photoRef: d.photoRef,
        photoLocalPath: null,
        rawJson: JSON.stringify(d),
        fetchedAt: new Date(now()),
      });
      return NextResponse.json(toResponse(saved, false));
    } catch {
      if (existing) return NextResponse.json(toResponse(existing, true));
      return NextResponse.json({ error: 'google_unavailable' }, { status: 502 });
    }
  }
  ```

- [ ] **Step 4: Run — expect PASS.**
  ```bash
  npx vitest run app/api/google/details/route.test.ts
  ```
  Expected: 5 passed.

- [ ] **Step 5: Commit.**
  ```bash
  git add app/api/google/details/route.ts app/api/google/details/route.test.ts
  git commit -m "feat(api): /api/google/details cache-first proxy (placeCache + soft fallback)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B0.5: `GET /api/google/geocode` — reverse-geocode passthrough

Resolves a long-press `lat,lng` to an address. No dedicated cache table — the address is written into the Place row by the caller (B1). Key-guarded passthrough.

**Files:**
- Create `app/api/google/geocode/route.ts`
- Create `app/api/google/geocode/route.test.ts`

- [ ] **Step 1: Write the failing test.**

  Create `app/api/google/geocode/route.test.ts`:
  ```ts
  import { describe, it, expect, beforeEach, vi } from 'vitest';

  vi.mock('@/src/db/client', () => ({ db: {}, sqlite: {} }));
  vi.mock('@/src/env', () => ({ env: { GOOGLE_MAPS_SERVER_KEY: 'SERVER_KEY' } }));

  import { GET } from '@/app/api/google/geocode/route';

  function req(qs: string) {
    return new Request(`http://x/api/google/geocode?${qs}`);
  }

  describe('GET /api/google/geocode', () => {
    let fetchSpy: ReturnType<typeof vi.fn>;
    beforeEach(() => {
      fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
    });

    it('returns 400 when lat or lng is missing / non-numeric', async () => {
      expect((await GET(req('lat=35.1'))).status).toBe(400);
      expect((await GET(req('lat=abc&lng=139.2'))).status).toBe(400);
    });

    it('returns the first formatted_address on OK', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'OK', results: [{ formatted_address: '1-1 Marunouchi, Tokyo' }] }),
      });
      const res = await GET(req('lat=35.681&lng=139.767'));
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ address: '1-1 Marunouchi, Tokyo' });

      const u = new URL(fetchSpy.mock.calls[0]![0] as string);
      expect(u.searchParams.get('latlng')).toBe('35.681,139.767');
      expect(u.searchParams.get('key')).toBe('SERVER_KEY');
    });

    it('returns address:null on ZERO_RESULTS', async () => {
      fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [] }) });
      const res = await GET(req('lat=0&lng=0'));
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ address: null });
    });

    it('returns 502 on a Google error status', async () => {
      fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'REQUEST_DENIED' }) });
      const res = await GET(req('lat=1&lng=2'));
      expect(res.status).toBe(502);
      await expect(res.json()).resolves.toMatchObject({ error: 'google_unavailable' });
    });
  });
  ```

- [ ] **Step 2: Run — expect FAIL.**
  ```bash
  npx vitest run app/api/google/geocode/route.test.ts
  ```
  Expect failure: `Failed to resolve import "@/app/api/google/geocode/route"`.

- [ ] **Step 3: Implement.**

  Create `app/api/google/geocode/route.ts`:
  ```ts
  import { NextResponse } from 'next/server';
  import { env } from '@/src/env';
  import { fetchReverseGeocode } from '@/src/lib/google/server';

  export const dynamic = 'force-dynamic';

  export async function GET(req: Request) {
    const url = new URL(req.url);
    const lat = Number(url.searchParams.get('lat'));
    const lng = Number(url.searchParams.get('lng'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
        url.searchParams.get('lat') === null || url.searchParams.get('lng') === null) {
      return NextResponse.json({ error: 'missing_latlng' }, { status: 400 });
    }
    if (!env.GOOGLE_MAPS_SERVER_KEY) {
      return NextResponse.json({ error: 'google_unavailable' }, { status: 502 });
    }
    try {
      const out = await fetchReverseGeocode({ lat, lng, apiKey: env.GOOGLE_MAPS_SERVER_KEY });
      return NextResponse.json(out);
    } catch {
      return NextResponse.json({ error: 'google_unavailable' }, { status: 502 });
    }
  }
  ```

- [ ] **Step 4: Run — expect PASS.**
  ```bash
  npx vitest run app/api/google/geocode/route.test.ts
  ```
  Expected: 4 passed.

- [ ] **Step 5: Commit.**
  ```bash
  git add app/api/google/geocode/route.ts app/api/google/geocode/route.test.ts
  git commit -m "feat(api): /api/google/geocode reverse-geocode proxy (key-guarded passthrough)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B0.6: `src/lib/google/loader.ts` — Maps JS loader + `SessionTokenManager`

Browser-only. Loads the Maps JS API (with `places` library) using the public key, memoizes the load promise (one script tag), and manages Autocomplete session tokens. Script injection is isolated behind an injectable `loadScript` so it is testable in jsdom without a network.

**Files:**
- Create `src/lib/google/loader.ts`
- Create `src/lib/google/loader.test.ts`

- [ ] **Step 1: Write the failing test.**

  Create `src/lib/google/loader.test.ts`:
  ```ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';

  vi.mock('@/src/env', () => ({ env: { NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: 'BROWSER_KEY' } }));

  import {
    buildMapsScriptUrl,
    loadGoogleMaps,
    __resetMapsLoaderForTests,
    SessionTokenManager,
  } from '@/src/lib/google/loader';

  describe('buildMapsScriptUrl', () => {
    it('includes the browser key, places library, async loading, and a callback', () => {
      const u = new URL(buildMapsScriptUrl('BROWSER_KEY', 'cb'));
      expect(u.origin + u.pathname).toBe('https://maps.googleapis.com/maps/api/js');
      expect(u.searchParams.get('key')).toBe('BROWSER_KEY');
      expect(u.searchParams.get('libraries')).toBe('places');
      expect(u.searchParams.get('loading')).toBe('async');
      expect(u.searchParams.get('callback')).toBe('cb');
    });
  });

  describe('loadGoogleMaps', () => {
    beforeEach(() => {
      __resetMapsLoaderForTests();
    });

    it('injects exactly one script and resolves with window.google after the script loads', async () => {
      const fakeGoogle = { maps: { Map: vi.fn(), places: {} } };
      const loadScript = vi.fn(async () => {
        (globalThis as unknown as { google: unknown }).google = fakeGoogle;
      });

      const p1 = loadGoogleMaps({ loadScript });
      const p2 = loadGoogleMaps({ loadScript });
      const [g1, g2] = await Promise.all([p1, p2]);

      expect(g1).toBe(fakeGoogle);
      expect(g2).toBe(fakeGoogle);
      // Memoized: only one injection even with two concurrent callers.
      expect(loadScript).toHaveBeenCalledTimes(1);
      const calledUrl = loadScript.mock.calls[0]![0] as string;
      expect(calledUrl).toContain('key=BROWSER_KEY');
    });

    it('rejects when no browser key is configured', async () => {
      const loadScript = vi.fn(async () => {});
      await expect(loadGoogleMaps({ loadScript, apiKey: '' })).rejects.toThrow(/key/i);
      expect(loadScript).not.toHaveBeenCalled();
    });
  });

  describe('SessionTokenManager', () => {
    it('returns a stable token until consumed, then mints a fresh one', () => {
      let n = 0;
      const mint = () => ({ id: `tok-${++n}` });
      const mgr = new SessionTokenManager(mint);

      const a = mgr.current();
      const b = mgr.current();
      expect(a).toBe(b); // same token across keystrokes in one session

      mgr.consume(); // Place Details was fetched → session ends
      const c = mgr.current();
      expect(c).not.toBe(a); // fresh session after selection
      expect((c as { id: string }).id).toBe('tok-2');
    });

    it('reset() also mints a fresh token (blur/cancel)', () => {
      let n = 0;
      const mgr = new SessionTokenManager(() => ({ id: `t${++n}` }));
      const a = mgr.current();
      mgr.reset();
      expect(mgr.current()).not.toBe(a);
    });
  });
  ```

- [ ] **Step 2: Run — expect FAIL.**
  ```bash
  npx vitest run src/lib/google/loader.test.ts
  ```
  Expect failure: `Failed to resolve import "@/src/lib/google/loader"`.

- [ ] **Step 3: Implement.**

  Create `src/lib/google/loader.ts`:
  ```ts
  /**
   * Client-side Google Maps JS loader. Loads the Maps JS API with the `places`
   * library using the public browser key, memoizing the load promise so the
   * script is injected at most once per page.
   *
   * Script injection is isolated behind an injectable `loadScript` so the loader
   * is unit-testable in jsdom with no network. Also exports the Autocomplete
   * session-token lifecycle (one token per search→selection).
   */
  import { env } from '@/src/env';

  const MAPS_JS_BASE = 'https://maps.googleapis.com/maps/api/js';

  export interface GoogleNamespace {
    maps: unknown;
  }

  export function buildMapsScriptUrl(apiKey: string, callbackName: string): string {
    const params = new URLSearchParams({
      key: apiKey,
      libraries: 'places',
      loading: 'async',
      v: 'weekly',
      callback: callbackName,
    });
    return `${MAPS_JS_BASE}?${params.toString()}`;
  }

  /** Default browser script injector — appends a <script> and resolves on load. */
  function defaultLoadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.async = true;
      el.onerror = () => reject(new Error('Failed to load Google Maps JS'));
      el.onload = () => resolve();
      document.head.appendChild(el);
    });
  }

  let loadPromise: Promise<GoogleNamespace> | null = null;

  export interface LoadOptions {
    /** Injectable for tests; defaults to a real <script> tag injector. */
    loadScript?: (src: string) => Promise<void>;
    /** Override the key (tests); defaults to the configured browser key. */
    apiKey?: string;
  }

  /**
   * Load (or reuse) the Maps JS API. Resolves with `window.google`. Concurrent
   * callers share one in-flight promise; a settled load is returned immediately.
   */
  export function loadGoogleMaps(opts: LoadOptions = {}): Promise<GoogleNamespace> {
    if (loadPromise) return loadPromise;

    const apiKey = opts.apiKey ?? env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return Promise.reject(new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (browser key)'));
    }
    const loadScript = opts.loadScript ?? defaultLoadScript;

    loadPromise = (async () => {
      const existing = (globalThis as unknown as { google?: GoogleNamespace }).google;
      if (existing) return existing;
      const callbackName = `__burgergoMapsCb_${Date.now()}`;
      const src = buildMapsScriptUrl(apiKey, callbackName);
      await loadScript(src);
      const g = (globalThis as unknown as { google?: GoogleNamespace }).google;
      if (!g) throw new Error('Google Maps JS loaded but window.google is undefined');
      return g;
    })();

    return loadPromise;
  }

  /** Test-only: clear the memoized load so each test starts clean. */
  export function __resetMapsLoaderForTests(): void {
    loadPromise = null;
    delete (globalThis as unknown as { google?: unknown }).google;
  }

  /**
   * Autocomplete session-token lifecycle. One token spans a typing session and
   * is consumed by the matching Place Details fetch; a fresh token is minted
   * after consume/reset.
   */
  export class SessionTokenManager<T = unknown> {
    private token: T | null = null;
    constructor(private readonly mint: () => T) {}

    /** The current session token, minting one lazily if needed. */
    current(): T {
      if (this.token === null) this.token = this.mint();
      return this.token;
    }

    /** Mark the session as spent (Place Details fetched) → next current() mints fresh. */
    consume(): void {
      this.token = null;
    }

    /** Discard the current session without consuming (blur/cancel). */
    reset(): void {
      this.token = null;
    }
  }
  ```

- [ ] **Step 4: Run — expect PASS.**
  ```bash
  npx vitest run src/lib/google/loader.test.ts
  ```
  Expected: 4 passed.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/lib/google/loader.ts src/lib/google/loader.test.ts
  git commit -m "feat(google): client Maps JS loader (memoized) + Autocomplete session-token manager

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B0.7: `components/plan/googleClient.ts` — `reverseGeocode` client helper

A thin client-side wrapper that calls `GET /api/google/geocode`. Tests mock `fetch`.

**Files:**
- Create `components/plan/googleClient.ts`
- Create `components/plan/googleClient.test.ts`

- [ ] **Step 1: Write the failing test.**

  Create `components/plan/googleClient.test.ts`:
  ```ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { reverseGeocode } from '@/components/plan/googleClient';

  describe('reverseGeocode', () => {
    let fetchSpy: ReturnType<typeof vi.fn>;
    beforeEach(() => {
      fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
    });

    it('calls /api/google/geocode with lat+lng and returns the address', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ address: '1-1 Marunouchi, Tokyo' }),
      });
      const result = await reverseGeocode(35.681, 139.767);
      expect(result).toBe('1-1 Marunouchi, Tokyo');

      const url = new URL(fetchSpy.mock.calls[0]![0] as string, 'http://x');
      expect(url.pathname).toBe('/api/google/geocode');
      expect(url.searchParams.get('lat')).toBe('35.681');
      expect(url.searchParams.get('lng')).toBe('139.767');
    });

    it('returns null when address is null (ocean / unnamed coord)', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ address: null }),
      });
      expect(await reverseGeocode(0, 0)).toBeNull();
    });

    it('returns null on a non-ok response (server error / no key)', async () => {
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 502 });
      expect(await reverseGeocode(1, 2)).toBeNull();
    });
  });
  ```

- [ ] **Step 2: Run — expect FAIL.**
  ```bash
  npx vitest run components/plan/googleClient.test.ts
  ```
  Expect failure: `Failed to resolve import "@/components/plan/googleClient"`.

- [ ] **Step 3: Implement.**

  Create `components/plan/googleClient.ts`:
  ```ts
  /**
   * Client-side Google wrappers (spec §6.1/§6.5). All Google network calls go
   * through the server proxies (/api/google/*) so the server key is never
   * exposed to the browser and all calls are cache-gated.
   */

  /**
   * Reverse-geocode a lat/lng to a human-readable address via the server proxy.
   * Returns null on a zero-result, network failure, or missing key.
   */
  export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      const res = await fetch(`/api/google/geocode?lat=${lat}&lng=${lng}`);
      if (!res.ok) return null;
      const data = (await res.json()) as { address: string | null };
      return data.address;
    } catch {
      return null;
    }
  }
  ```

- [ ] **Step 4: Run — expect PASS.**
  ```bash
  npx vitest run components/plan/googleClient.test.ts
  ```
  Expected: 3 passed.

- [ ] **Step 5: Commit.**
  ```bash
  git add components/plan/googleClient.ts components/plan/googleClient.test.ts
  git commit -m "feat(client): reverseGeocode client helper → /api/google/geocode proxy

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B0.8: `components/plan/useGooglePlaces.ts` — `usePlacesAutocomplete()` hook

Places JS autocomplete with one `AutocompleteSessionToken` per search→select cycle. On select, calls `GET /api/google/details` to get the normalized place data. The loader and fetch are mocked in tests.

**Files:**
- Create `components/plan/useGooglePlaces.ts`
- Create `components/plan/useGooglePlaces.test.ts`

- [ ] **Step 1: Write the failing test.**

  Create `components/plan/useGooglePlaces.test.ts`:
  ```ts
  /**
   * @vitest-environment jsdom
   */
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { renderHook, act } from '@testing-library/react';

  // Mock the loader so no real Maps JS is injected.
  vi.mock('@/src/lib/google/loader', () => {
    const SessionTokenManager = class<T> {
      private token: T | null = null;
      constructor(private mint: () => T) {}
      current(): T { if (!this.token) this.token = this.mint(); return this.token; }
      consume(): void { this.token = null; }
      reset(): void { this.token = null; }
    };
    return {
      loadGoogleMaps: vi.fn().mockResolvedValue({
        maps: {
          places: {
            AutocompleteService: class {
              getPlacePredictions(
                _req: unknown,
                cb: (r: unknown[], s: string) => void,
              ) {
                cb(
                  [{ place_id: 'pid-1', description: 'Senso-ji Temple, Tokyo' }],
                  'OK',
                );
              }
            },
            AutocompleteSessionToken: class { id = 'tok-1'; },
          },
        },
      }),
      SessionTokenManager,
      __resetMapsLoaderForTests: vi.fn(),
    };
  });

  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  import { usePlacesAutocomplete } from '@/components/plan/useGooglePlaces';

  describe('usePlacesAutocomplete', () => {
    it('returns an empty predictions array initially', () => {
      const { result } = renderHook(() => usePlacesAutocomplete());
      expect(result.current.predictions).toEqual([]);
      expect(result.current.loading).toBe(false);
    });

    it('populates predictions after search is called', async () => {
      const { result } = renderHook(() => usePlacesAutocomplete());
      await act(async () => {
        await result.current.search('senso');
      });
      expect(result.current.predictions).toHaveLength(1);
      expect(result.current.predictions[0]!.placeId).toBe('pid-1');
      expect(result.current.predictions[0]!.description).toBe('Senso-ji Temple, Tokyo');
    });

    it('calls /api/google/details on select and returns the normalized place', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          googlePlaceId: 'pid-1',
          name: 'Senso-ji Temple',
          address: 'Asakusa, Tokyo',
          lat: 35.71,
          lng: 139.79,
          categoryGuess: 'sightseeing',
          photoRef: 'R',
          photoLocalPath: null,
          cached: false,
        }),
      });
      const { result } = renderHook(() => usePlacesAutocomplete());
      await act(async () => { await result.current.search('senso'); });

      let place: Awaited<ReturnType<typeof result.current.select>> | undefined;
      await act(async () => {
        place = await result.current.select('pid-1', 'sess-token');
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const calledUrl = fetchSpy.mock.calls[0]![0] as string;
      expect(calledUrl).toContain('/api/google/details');
      expect(calledUrl).toContain('placeId=pid-1');

      expect(place?.name).toBe('Senso-ji Temple');
      expect(place?.categoryGuess).toBe('sightseeing');
    });
  });
  ```

- [ ] **Step 2: Run — expect FAIL.**
  ```bash
  npx vitest run components/plan/useGooglePlaces.test.ts
  ```
  Expect failure: `Failed to resolve import "@/components/plan/useGooglePlaces"`.

- [ ] **Step 3: Implement.**

  Create `components/plan/useGooglePlaces.ts`:
  ```ts
  'use client';

  import { useState, useRef, useCallback } from 'react';
  import { loadGoogleMaps, SessionTokenManager } from '@/src/lib/google/loader';

  export interface Prediction {
    placeId: string;
    description: string;
  }

  export interface PlaceDetails {
    googlePlaceId: string;
    name: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
    categoryGuess: string | null;
    photoRef: string | null;
    photoLocalPath: string | null;
    cached: boolean;
  }

  export interface UsePlacesAutocompleteResult {
    predictions: Prediction[];
    loading: boolean;
    search: (input: string) => Promise<void>;
    select: (placeId: string, sessionToken?: string) => Promise<PlaceDetails | null>;
    clear: () => void;
  }

  /**
   * Autocomplete hook: one AutocompleteSessionToken per search→select cycle
   * (bundles the typing session + Details call into one billing unit). The
   * loader and fetch are mockable so tests need no real Maps JS or server key.
   */
  export function usePlacesAutocomplete(): UsePlacesAutocompleteResult {
    const [predictions, setPredictions] = useState<Prediction[]>([]);
    const [loading, setLoading] = useState(false);

    // One session-token manager per hook instance; stable across renders.
    const tokenMgrRef = useRef<SessionTokenManager<{ id: string }> | null>(null);
    function getTokenMgr(): SessionTokenManager<{ id: string }> {
      if (!tokenMgrRef.current) {
        tokenMgrRef.current = new SessionTokenManager(() => ({ id: crypto.randomUUID() }));
      }
      return tokenMgrRef.current;
    }

    const search = useCallback(async (input: string) => {
      if (!input.trim()) { setPredictions([]); return; }
      setLoading(true);
      try {
        const google = await loadGoogleMaps();
        const maps = google.maps as {
          places: {
            AutocompleteService: new () => {
              getPlacePredictions: (
                req: { input: string; sessionToken: unknown },
                cb: (results: Array<{ place_id: string; description: string }>, status: string) => void,
              ) => void;
            };
            AutocompleteSessionToken: new () => unknown;
          };
        };
        const service = new maps.places.AutocompleteService();
        const token = new maps.places.AutocompleteSessionToken();
        // Stash the real Maps token for the select call.
        tokenMgrRef.current = new SessionTokenManager(() => token as { id: string });

        await new Promise<void>((resolve) => {
          service.getPlacePredictions({ input, sessionToken: token }, (results, status) => {
            if (status === 'OK' && results) {
              setPredictions(results.map((r) => ({ placeId: r.place_id, description: r.description })));
            } else {
              setPredictions([]);
            }
            resolve();
          });
        });
      } catch {
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    }, []);

    const select = useCallback(async (placeId: string, _sessionToken?: string): Promise<PlaceDetails | null> => {
      const mgr = getTokenMgr();
      const token = mgr.current();
      try {
        const tokenId = (token as { id: string }).id;
        const res = await fetch(`/api/google/details?placeId=${encodeURIComponent(placeId)}&sessionToken=${encodeURIComponent(tokenId)}`);
        if (!res.ok) return null;
        const data = (await res.json()) as PlaceDetails;
        mgr.consume(); // session complete
        return data;
      } catch {
        return null;
      }
    }, []);

    const clear = useCallback(() => {
      setPredictions([]);
      getTokenMgr().reset();
    }, []);

    return { predictions, loading, search, select, clear };
  }
  ```

- [ ] **Step 4: Run — expect PASS.**
  ```bash
  npx vitest run components/plan/useGooglePlaces.test.ts
  ```
  Expected: 3 passed.

- [ ] **Step 5: Commit.**
  ```bash
  git add components/plan/useGooglePlaces.ts components/plan/useGooglePlaces.test.ts
  git commit -m "feat(client): usePlacesAutocomplete hook (Places JS + session-token + details proxy)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B0.9: `src/lib/google/getOrFetchLeg.ts` — server cache-backed Directions entry point

This is the function B1's `recomputeDayLegsAction` calls per consecutive stop pair. Cache hit → return the stored leg; miss → call Google Directions → `upsertLeg` with `polyline` → return. All network is mocked in tests.

**Files:**
- Create `src/lib/google/getOrFetchLeg.ts`
- Create `src/lib/google/getOrFetchLeg.test.ts`

- [ ] **Step 1: Write the failing test.**

  Create `src/lib/google/getOrFetchLeg.test.ts`:
  ```ts
  import { describe, it, expect, beforeEach, vi } from 'vitest';
  import { makeTestDb } from '@/src/db/testDb';
  import { trips, places } from '@/src/db/schema';
  import { getCachedLeg } from '@/src/db/repos/legs';
  import { getOrFetchLeg } from '@/src/lib/google/getOrFetchLeg';

  vi.mock('@/src/lib/clock', () => ({ now: () => 1_700_000_000_000 }));

  const TS = new Date(1_700_000_000_000);

  type Db = ReturnType<typeof makeTestDb>['db'];

  function seed(db: Db) {
    db.insert(trips).values({
      id: 'trip-1', name: 'T', startDate: '2026-06-05', endDate: '2026-06-06',
      coverPhoto: null, createdAt: TS, updatedAt: TS,
    }).run();
    db.insert(places).values([
      {
        id: 'p-a', tripId: 'trip-1', dayDate: '2026-06-05', googlePlaceId: null,
        name: 'A', address: null, lat: 35.0, lng: 139.0, category: 'sightseeing',
        scheduledTime: null, durationMin: null, cost: null, notes: null,
        orderIndex: 0, createdAt: TS, updatedAt: TS,
      },
      {
        id: 'p-b', tripId: 'trip-1', dayDate: '2026-06-05', googlePlaceId: null,
        name: 'B', address: null, lat: 35.1, lng: 139.1, category: 'sightseeing',
        scheduledTime: null, durationMin: null, cost: null, notes: null,
        orderIndex: 1, createdAt: TS, updatedAt: TS,
      },
    ]).run();
  }

  describe('getOrFetchLeg', () => {
    let db: Db;
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      db = makeTestDb().db;
      seed(db);
      fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
    });

    const placeA = { id: 'p-a', tripId: 'trip-1', lat: 35.0, lng: 139.0 };
    const placeB = { id: 'p-b', tripId: 'trip-1', lat: 35.1, lng: 139.1 };

    it('cache HIT: returns the existing leg without calling Google', async () => {
      // Pre-seed a cached leg.
      const { upsertLeg } = await import('@/src/db/repos/legs');
      upsertLeg(db, {
        tripId: 'trip-1', fromPlaceId: 'p-a', toPlaceId: 'p-b', mode: 'walk',
        durationSeconds: 500, distanceMeters: 700, polyline: 'CACHED',
      });

      const leg = await getOrFetchLeg(db, placeA, placeB, 'walk', 'SERVER_KEY');
      expect(leg.durationSeconds).toBe(500);
      expect(leg.polyline).toBe('CACHED');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('cache MISS: calls Directions, upserts with polyline, returns the leg', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'OK',
          routes: [{
            overview_polyline: { points: 'FRESH_POLY' },
            legs: [{ duration: { value: 600 }, distance: { value: 800 } }],
          }],
        }),
      });

      const leg = await getOrFetchLeg(db, placeA, placeB, 'walk', 'SERVER_KEY');
      expect(leg.durationSeconds).toBe(600);
      expect(leg.polyline).toBe('FRESH_POLY');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Persisted in the cache.
      const cached = getCachedLeg(db, 'p-a', 'p-b', 'walk');
      expect(cached?.polyline).toBe('FRESH_POLY');
    });

    it('throws when places have no coordinates', async () => {
      await expect(
        getOrFetchLeg(db, { id: 'p-a', tripId: 'trip-1', lat: null, lng: null }, placeB, 'drive', 'K'),
      ).rejects.toThrow(/coordinates/i);
    });
  });
  ```

- [ ] **Step 2: Run — expect FAIL.**
  ```bash
  npx vitest run src/lib/google/getOrFetchLeg.test.ts
  ```
  Expect failure: `Failed to resolve import "@/src/lib/google/getOrFetchLeg"`.

- [ ] **Step 3: Implement.**

  Create `src/lib/google/getOrFetchLeg.ts`:
  ```ts
  /**
   * Server entry point for cache-backed Directions (spec §6.3). Used by
   * B1's recomputeDayLegsAction for each consecutive stop pair.
   *
   * Cache hit  → return the stored TravelLeg (no Google call).
   * Cache miss → fetchDirections → upsertLeg (with polyline) → return.
   */
  import type { TestDb } from '@/src/db/testDb';
  import type { TravelLeg } from '@/src/db/schema';
  import type { TravelMode } from '@/src/lib/googleMapsUrl';
  import { getCachedLeg, upsertLeg } from '@/src/db/repos/legs';
  import { fetchDirections } from '@/src/lib/google/server';

  type Db = TestDb['db'];

  interface PlaceRef {
    id: string;
    tripId: string;
    lat: number | null;
    lng: number | null;
  }

  /**
   * Return the cached leg for (fromPlace, toPlace, mode), or fetch from Google
   * Directions, upsert with polyline, and return the persisted row. Throws if
   * either place lacks coordinates or if Google returns an error.
   */
  export async function getOrFetchLeg(
    db: Db,
    fromPlace: PlaceRef,
    toPlace: PlaceRef,
    mode: TravelMode,
    apiKey: string,
  ): Promise<TravelLeg> {
    const cached = getCachedLeg(db, fromPlace.id, toPlace.id, mode);
    if (cached) return cached;

    if (fromPlace.lat == null || fromPlace.lng == null || toPlace.lat == null || toPlace.lng == null) {
      throw new Error('getOrFetchLeg: both places must have coordinates');
    }

    const result = await fetchDirections({
      origin: { lat: fromPlace.lat, lng: fromPlace.lng },
      destination: { lat: toPlace.lat, lng: toPlace.lng },
      waypoints: [],
      mode,
      apiKey,
    });

    return upsertLeg(db, {
      tripId: fromPlace.tripId,
      fromPlaceId: fromPlace.id,
      toPlaceId: toPlace.id,
      mode,
      durationSeconds: result.durationSeconds,
      distanceMeters: result.distanceMeters,
      polyline: result.polyline,
    });
  }
  ```

- [ ] **Step 4: Run — expect PASS.**
  ```bash
  npx vitest run src/lib/google/getOrFetchLeg.test.ts
  ```
  Expected: 3 passed.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/lib/google/getOrFetchLeg.ts src/lib/google/getOrFetchLeg.test.ts
  git commit -m "feat(google): getOrFetchLeg server cache-backed Directions entry point (persists polyline)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B0.10: Whole-group verification

**Files:** (no source changes — verification only)

- [ ] **Step 1: Run the whole test suite.**
  ```bash
  npm test
  ```
  Expected: all suites pass — the pre-existing 1A tests plus the new B0 files:
  - `src/db/repos/legs.test.ts` (5 tests)
  - `src/lib/google/server.test.ts` (11 tests)
  - `app/api/google/details/route.test.ts` (5 tests)
  - `app/api/google/geocode/route.test.ts` (4 tests)
  - `src/lib/google/loader.test.ts` (4 tests)
  - `components/plan/googleClient.test.ts` (3 tests)
  - `components/plan/useGooglePlaces.test.ts` (3 tests)
  - `src/lib/google/getOrFetchLeg.test.ts` (3 tests)

- [ ] **Step 2: Typecheck.**
  ```bash
  npx tsc --noEmit -p tsconfig.json
  ```
  Expected: exits 0. Confirms the `polyline` column in the Drizzle schema is picked up correctly and all new modules typecheck under `strict` + `noUncheckedIndexedAccess`.

- [ ] **Step 3: Lint.**
  ```bash
  npm run lint
  ```
  Expected: no errors.

- [ ] **Step 4: Production build.**
  ```bash
  npm run build
  ```
  Expected: build succeeds. The new route handlers appear as dynamic (`ƒ`) routes. No key is read at build time — only at request time inside each handler.

- [ ] **Step 5: Commit any incidental fixups only.**
  If Steps 1–4 were already green with nothing to stage, skip. Otherwise:
  ```bash
  git add -A
  git commit -m "chore(google): fix B0 typecheck/lint issues found during group verification

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

**B0 deliverables (file paths):**
- `src/db/schema.ts` (polyline column added)
- `drizzle/0001_add_polyline.sql` (generated migration)
- `src/db/repos/legs.ts` + `legs.test.ts` — `getCachedLeg` / `upsertLeg` (B1 extends this file)
- `src/lib/google/server.ts` + `server.test.ts` — normalized fetch wrappers
- `app/api/google/details/route.ts` + `route.test.ts`
- `app/api/google/geocode/route.ts` + `route.test.ts`
- `src/lib/google/loader.ts` + `loader.test.ts`
- `components/plan/googleClient.ts` + `googleClient.test.ts`
- `components/plan/useGooglePlaces.ts` + `useGooglePlaces.test.ts`
- `src/lib/google/getOrFetchLeg.ts` + `getOrFetchLeg.test.ts`

**Normalized shapes for downstream groups (B1/B2+):**
- `NormalizedDetails`, `NormalizedReverseGeocode`, `NormalizedDirections`, `CategoryGuess`, `GoogleApiError` from `@/src/lib/google/server`
- `loadGoogleMaps`, `buildMapsScriptUrl`, `SessionTokenManager`, `__resetMapsLoaderForTests` from `@/src/lib/google/loader`
- `reverseGeocode(lat,lng) → string|null` from `@/components/plan/googleClient`
- `usePlacesAutocomplete()` from `@/components/plan/useGooglePlaces`
- `getOrFetchLeg(db, fromPlace, toPlace, mode, apiKey) → Promise<TravelLeg>` from `@/src/lib/google/getOrFetchLeg`
- `getCachedLeg`, `upsertLeg`, `TravelLeg` from `@/src/db/repos/legs` (B1 adds `legsForDay`, `invalidateLegsTouchingPlace` to same file)

---

## Task-Group B1 — Places & Legs Domain

> **Scope.** This group builds the complete places and legs data layer: (B1.1–B1.3) `src/db/repos/places.ts` (all 9 functions from RESOLUTIONS); (B1.4–B1.5) extends `src/db/repos/legs.ts` (the SAME file created in B0) with `legsForDay` + `invalidateLegsTouchingPlace`; (B1.6–B1.7) `app/_actions/places.ts` (add/update/delete/reorder/promote/moveToSaved actions + `recomputeDayLegsAction`); (B1.8) `GET /api/trips/[tripId]/places` returning `{ places: PlaceDTO[], legs: LegDTO[] }`; (B1.9) `GET /api/photos/[placeId]/[variant]` streaming cached photo files; (B1.10) group verification.

> **Conventions (from 1A).** Repos: pure, `db` first arg, `type Db = TestDb['db']`; ids via `newId()`; timestamps `new Date(now())`; `TravelMode` from `@/src/lib/googleMapsUrl`; raw SQL counts in tests via `sqlite.prepare(...)` from `makeTestDb().sqlite` (not `db.$client`); route handlers export `dynamic = 'force-dynamic'` + async `GET(_req, ctx)` awaiting `ctx.params`; Server Actions import `db` from `@/src/db/client` and `revalidatePath` from `next/cache`.

> **Prerequisites.** B0 must be complete: `src/db/repos/legs.ts` exists with `getCachedLeg`/`upsertLeg`, the `polyline` column migration is applied, and `getOrFetchLeg` lives at `src/lib/google/getOrFetchLeg.ts`.

---

### Task B1.1: Places repo — read functions (`listByDay` / `listSaved` / `listAllForTrip`)

**Files:**
- Create `src/db/repos/places.ts`
- Create `src/db/repos/places.test.ts`

- [ ] **Step 1: Write the failing test.**

  Create `src/db/repos/places.test.ts`:
  ```ts
  import { describe, it, expect, beforeEach } from 'vitest';
  import { makeTestDb } from '@/src/db/testDb';
  import { trips, places } from '@/src/db/schema';
  import {
    listByDay,
    listSaved,
    listAllForTrip,
  } from '@/src/db/repos/places';

  const TS = new Date('2026-06-08T12:00:00.000Z');

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

  function seedPlace(
    db: Db,
    over: Partial<typeof places.$inferInsert> & { id: string },
  ) {
    db.insert(places)
      .values({
        tripId: 'trip-1',
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
        ...over,
      })
      .run();
  }

  describe('places repo — reads', () => {
    let db: Db;
    beforeEach(() => {
      db = makeTestDb().db;
      seedTrip(db);
      // Day 06-05: insert out of order to prove ordering by orderIndex.
      seedPlace(db, { id: 'd1-b', dayDate: '2026-06-05', name: 'Castle', orderIndex: 1 });
      seedPlace(db, { id: 'd1-a', dayDate: '2026-06-05', name: 'Shrine', orderIndex: 0 });
      // Day 06-06.
      seedPlace(db, { id: 'd2-a', dayDate: '2026-06-06', name: 'Market', orderIndex: 0 });
      // Saved bucket (dayDate NULL), out of order.
      seedPlace(db, { id: 's-b', dayDate: null, name: 'Aquarium', orderIndex: 1 });
      seedPlace(db, { id: 's-a', dayDate: null, name: 'Museum', orderIndex: 0 });
      // A different trip's place must never leak in.
      seedTrip(db, 'trip-2');
      seedPlace(db, { id: 'other', tripId: 'trip-2', dayDate: '2026-06-05', name: 'Nope', orderIndex: 0 });
    });

    it('listByDay returns one day, ordered by orderIndex', () => {
      const rows = listByDay(db, 'trip-1', '2026-06-05');
      expect(rows.map((p) => p.id)).toEqual(['d1-a', 'd1-b']);
      expect(rows.map((p) => p.name)).toEqual(['Shrine', 'Castle']);
    });

    it('listByDay returns [] for an empty day', () => {
      expect(listByDay(db, 'trip-1', '2026-06-07')).toEqual([]);
    });

    it('listSaved returns only NULL-day rows, ordered by orderIndex', () => {
      const rows = listSaved(db, 'trip-1');
      expect(rows.map((p) => p.id)).toEqual(['s-a', 's-b']);
    });

    it('listAllForTrip returns every place for the trip, scoped by tripId', () => {
      const rows = listAllForTrip(db, 'trip-1');
      expect(rows.map((p) => p.id).sort()).toEqual(
        ['d1-a', 'd1-b', 'd2-a', 's-a', 's-b'].sort(),
      );
      expect(rows.every((p) => p.tripId === 'trip-1')).toBe(true);
    });

    it('listAllForTrip orders by dayDate (NULLs last) then orderIndex', () => {
      const rows = listAllForTrip(db, 'trip-1');
      expect(rows.map((p) => p.id)).toEqual([
        'd1-a', 'd1-b', 'd2-a', 's-a', 's-b',
      ]);
    });
  });
  ```

- [ ] **Step 2: Run — expect FAIL.**
  ```bash
  npx vitest run src/db/repos/places.test.ts
  ```
  Expect failure: `Failed to resolve import "@/src/db/repos/places"`.

- [ ] **Step 3: Implement the three read functions.**

  Create `src/db/repos/places.ts`:
  ```ts
  import { and, asc, eq, isNull, sql } from 'drizzle-orm';
  import type { TestDb } from '@/src/db/testDb';
  import { places, type Place } from '@/src/db/schema';

  export type { Place };

  type Db = TestDb['db'];

  /** All places on one day for a trip, ordered by orderIndex (0-based). */
  export function listByDay(db: Db, tripId: string, dayDate: string): Place[] {
    return db
      .select()
      .from(places)
      .where(and(eq(places.tripId, tripId), eq(places.dayDate, dayDate)))
      .orderBy(asc(places.orderIndex))
      .all();
  }

  /** All Saved (day_date IS NULL) places for a trip, ordered by orderIndex. */
  export function listSaved(db: Db, tripId: string): Place[] {
    return db
      .select()
      .from(places)
      .where(and(eq(places.tripId, tripId), isNull(places.dayDate)))
      .orderBy(asc(places.orderIndex))
      .all();
  }

  /**
   * Every place for a trip, ordered by dayDate ascending with NULL (Saved)
   * last, then orderIndex. The client buckets these by day_date.
   */
  export function listAllForTrip(db: Db, tripId: string): Place[] {
    return db
      .select()
      .from(places)
      .where(eq(places.tripId, tripId))
      .orderBy(
        sql`${places.dayDate} IS NULL`,
        asc(places.dayDate),
        asc(places.orderIndex),
      )
      .all();
  }
  ```

- [ ] **Step 4: Run — expect PASS.**
  ```bash
  npx vitest run src/db/repos/places.test.ts
  ```
  Expected: 5 passed.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/db/repos/places.ts src/db/repos/places.test.ts
  git commit -m "feat(places-repo): read fns listByDay/listSaved/listAllForTrip

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B1.2: Places repo — `addPlace` / `updatePlace` / `deletePlace` / `getPlace`

**Files:**
- Modify `src/db/repos/places.ts`
- Modify `src/db/repos/places.test.ts`

- [ ] **Step 1: Add failing tests.**

  Update the import at the top of `src/db/repos/places.test.ts` to include the new functions, and add the clock mock and new imports:
  ```ts
  import { describe, it, expect, beforeEach, vi } from 'vitest';
  import { makeTestDb } from '@/src/db/testDb';
  import { trips, places } from '@/src/db/schema';
  import {
    listByDay,
    listSaved,
    listAllForTrip,
    addPlace,
    updatePlace,
    deletePlace,
    getPlace,
  } from '@/src/db/repos/places';

  vi.mock('@/src/lib/clock', () => ({ now: () => 1_700_000_000_000 }));
  ```

  Append the following `describe` blocks to `src/db/repos/places.test.ts`:
  ```ts
  describe('places repo — addPlace', () => {
    let db: Db;
    beforeEach(() => {
      db = makeTestDb().db;
      seedTrip(db);
    });

    it('inserts into the Saved bucket with orderIndex 0 when empty', () => {
      const row = addPlace(db, {
        tripId: 'trip-1',
        dayDate: null,
        name: 'Museum',
        category: 'sightseeing',
      });
      expect(row.id).toMatch(/[0-9a-f-]{36}/);
      expect(row.dayDate).toBeNull();
      expect(row.orderIndex).toBe(0);
      expect(row.googlePlaceId).toBeNull();
      expect(row.lat).toBeNull();
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(listSaved(db, 'trip-1').map((p) => p.id)).toEqual([row.id]);
    });

    it('appends to a day at max(orderIndex)+1', () => {
      seedPlace(db, { id: 'd1-a', dayDate: '2026-06-05', orderIndex: 0 });
      seedPlace(db, { id: 'd1-b', dayDate: '2026-06-05', orderIndex: 1 });
      const row = addPlace(db, {
        tripId: 'trip-1',
        dayDate: '2026-06-05',
        name: 'Park',
        category: 'activity',
      });
      expect(row.orderIndex).toBe(2);
      expect(listByDay(db, 'trip-1', '2026-06-05').map((p) => p.id)).toEqual([
        'd1-a', 'd1-b', row.id,
      ]);
    });

    it('persists all optional fields when provided', () => {
      const row = addPlace(db, {
        tripId: 'trip-1',
        dayDate: '2026-06-05',
        googlePlaceId: 'gpid-1',
        name: 'Tower',
        address: '1-2-3',
        lat: 35.0,
        lng: 139.0,
        category: 'sightseeing',
        scheduledTime: '09:30',
        durationMin: 90,
        cost: 1500,
        notes: 'bring camera',
      });
      expect(row.googlePlaceId).toBe('gpid-1');
      expect(row.lat).toBeCloseTo(35.0, 4);
      expect(row.scheduledTime).toBe('09:30');
      expect(row.durationMin).toBe(90);
      expect(row.cost).toBe(1500);
      expect(row.notes).toBe('bring camera');
    });
  });

  describe('places repo — updatePlace', () => {
    let db: Db;
    beforeEach(() => {
      db = makeTestDb().db;
      seedTrip(db);
      seedPlace(db, { id: 'p1', dayDate: '2026-06-05', name: 'Old', orderIndex: 0 });
    });

    it('patches provided fields and bumps updatedAt, returns the row', () => {
      const before = listByDay(db, 'trip-1', '2026-06-05')[0]!;
      const row = updatePlace(db, 'p1', {
        name: 'New',
        scheduledTime: '10:00',
        cost: 500,
      });
      expect(row?.name).toBe('New');
      expect(row?.scheduledTime).toBe('10:00');
      expect(row?.cost).toBe(500);
      // Untouched fields preserved.
      expect(row?.dayDate).toBe('2026-06-05');
      expect(row?.orderIndex).toBe(0);
      expect(row!.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
    });

    it('can clear a nullable field by passing null', () => {
      updatePlace(db, 'p1', { scheduledTime: '09:00' });
      const row = updatePlace(db, 'p1', { scheduledTime: null });
      expect(row?.scheduledTime).toBeNull();
    });

    it('returns undefined for an unknown id', () => {
      expect(updatePlace(db, 'nope', { name: 'X' })).toBeUndefined();
    });
  });

  describe('places repo — deletePlace', () => {
    let db: Db;
    beforeEach(() => {
      db = makeTestDb().db;
      seedTrip(db);
      seedPlace(db, { id: 'p1', dayDate: '2026-06-05', orderIndex: 0 });
    });

    it('removes the row', () => {
      deletePlace(db, 'p1');
      expect(listByDay(db, 'trip-1', '2026-06-05')).toEqual([]);
    });
  });

  describe('places repo — getPlace', () => {
    let db: Db;
    beforeEach(() => {
      db = makeTestDb().db;
      seedTrip(db);
      seedPlace(db, { id: 'p1', dayDate: '2026-06-05', orderIndex: 0 });
    });

    it('returns the row when found', () => {
      expect(getPlace(db, 'p1')?.id).toBe('p1');
    });

    it('returns undefined when not found', () => {
      expect(getPlace(db, 'nope')).toBeUndefined();
    });
  });
  ```

- [ ] **Step 2: Run — expect FAIL.**
  ```bash
  npx vitest run src/db/repos/places.test.ts
  ```
  Expect failure: `addPlace`/`updatePlace`/`deletePlace`/`getPlace` not exported.

- [ ] **Step 3: Implement.**

  Update the import block at the top of `src/db/repos/places.ts` to:
  ```ts
  import { and, asc, eq, isNull, max, sql } from 'drizzle-orm';
  import type { TestDb } from '@/src/db/testDb';
  import { places, type Place } from '@/src/db/schema';
  import { newId } from '@/src/db/ids';
  import { now } from '@/src/lib/clock';
  ```

  Append these functions to `src/db/repos/places.ts`:
  ```ts
  /** One place by id, or undefined. */
  export function getPlace(db: Db, id: string): Place | undefined {
    return db.select().from(places).where(eq(places.id, id)).get();
  }

  /** Highest orderIndex in a bucket, or -1 if the bucket is empty. */
  function maxOrderIndex(db: Db, tripId: string, dayDate: string | null): number {
    const where =
      dayDate === null
        ? and(eq(places.tripId, tripId), isNull(places.dayDate))
        : and(eq(places.tripId, tripId), eq(places.dayDate, dayDate));
    const row = db
      .select({ m: max(places.orderIndex) })
      .from(places)
      .where(where)
      .get();
    return row?.m ?? -1;
  }

  export interface AddPlaceInput {
    tripId: string;
    dayDate?: string | null;
    googlePlaceId?: string | null;
    name: string;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
    category: Place['category'];
    scheduledTime?: string | null;
    durationMin?: number | null;
    cost?: number | null;
    notes?: string | null;
  }

  /**
   * Insert a place, auto-assigning orderIndex = max(bucket) + 1.
   * Generates id + timestamps.
   */
  export function addPlace(db: Db, input: AddPlaceInput): Place {
    const ts = new Date(now());
    const dayDate = input.dayDate ?? null;
    const row: Place = {
      id: newId(),
      tripId: input.tripId,
      dayDate,
      googlePlaceId: input.googlePlaceId ?? null,
      name: input.name,
      address: input.address ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      category: input.category,
      scheduledTime: input.scheduledTime ?? null,
      durationMin: input.durationMin ?? null,
      cost: input.cost ?? null,
      notes: input.notes ?? null,
      orderIndex: maxOrderIndex(db, input.tripId, dayDate) + 1,
      createdAt: ts,
      updatedAt: ts,
    };
    db.insert(places).values(row).run();
    return row;
  }

  /** Editable subset of a place (never id/tripId/orderIndex/timestamps). */
  export type PlacePatch = Partial<
    Pick<
      Place,
      | 'googlePlaceId'
      | 'name'
      | 'address'
      | 'lat'
      | 'lng'
      | 'category'
      | 'scheduledTime'
      | 'durationMin'
      | 'cost'
      | 'notes'
    >
  >;

  /** Patch the provided fields; bumps updatedAt. Returns the row, or undefined. */
  export function updatePlace(db: Db, id: string, patch: PlacePatch): Place | undefined {
    db.update(places)
      .set({ ...patch, updatedAt: new Date(now()) })
      .where(eq(places.id, id))
      .run();
    return getPlace(db, id);
  }

  /** Delete a place; dependent travel_legs cascade via FK onDelete. */
  export function deletePlace(db: Db, id: string): void {
    db.delete(places).where(eq(places.id, id)).run();
  }
  ```

- [ ] **Step 4: Run — expect PASS.**
  ```bash
  npx vitest run src/db/repos/places.test.ts
  ```
  Expected: ~14 passed (5 reads + 9 new).

- [ ] **Step 5: Commit.**
  ```bash
  git add src/db/repos/places.ts src/db/repos/places.test.ts
  git commit -m "feat(places-repo): getPlace/addPlace/updatePlace/deletePlace with contiguous orderIndex

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B1.3: Places repo — `reorderDay` / `promoteToDay` / `moveToSaved`

**Files:**
- Modify `src/db/repos/places.ts`
- Modify `src/db/repos/places.test.ts`

- [ ] **Step 1: Add failing tests.**

  Update the import from the places repo in `src/db/repos/places.test.ts` to include:
  ```ts
  import {
    listByDay,
    listSaved,
    listAllForTrip,
    addPlace,
    updatePlace,
    deletePlace,
    getPlace,
    reorderDay,
    promoteToDay,
    moveToSaved,
  } from '@/src/db/repos/places';
  ```

  Append:
  ```ts
  describe('places repo — reorderDay', () => {
    let db: Db;
    beforeEach(() => {
      db = makeTestDb().db;
      seedTrip(db);
      seedPlace(db, { id: 'a', dayDate: '2026-06-05', orderIndex: 0 });
      seedPlace(db, { id: 'b', dayDate: '2026-06-05', orderIndex: 1 });
      seedPlace(db, { id: 'c', dayDate: '2026-06-05', orderIndex: 2 });
    });

    it('rewrites orderIndex to match the given id order (0-based contiguous)', () => {
      reorderDay(db, 'trip-1', '2026-06-05', ['c', 'a', 'b']);
      const rows = listByDay(db, 'trip-1', '2026-06-05');
      expect(rows.map((p) => p.id)).toEqual(['c', 'a', 'b']);
      expect(rows.map((p) => p.orderIndex)).toEqual([0, 1, 2]);
    });

    it('ignores ids that are not in the target day', () => {
      seedTrip(db, 'trip-2');
      seedPlace(db, { id: 'z', tripId: 'trip-2', dayDate: '2026-06-05', orderIndex: 0 });
      reorderDay(db, 'trip-1', '2026-06-05', ['b', 'z', 'a', 'c']);
      const rows = listByDay(db, 'trip-1', '2026-06-05');
      // 'z' is skipped; remaining are renumbered contiguously by their position.
      expect(rows.map((p) => p.id)).toEqual(['b', 'a', 'c']);
      expect(rows.map((p) => p.orderIndex)).toEqual([0, 1, 2]);
    });
  });

  describe('places repo — promoteToDay', () => {
    let db: Db;
    beforeEach(() => {
      db = makeTestDb().db;
      seedTrip(db);
      seedPlace(db, { id: 'd-0', dayDate: '2026-06-05', orderIndex: 0 });
      seedPlace(db, { id: 's-0', dayDate: null, orderIndex: 0 });
      seedPlace(db, { id: 's-1', dayDate: null, orderIndex: 1 });
    });

    it('sets day_date and appends at max(day order)+1', () => {
      const row = promoteToDay(db, 's-1', '2026-06-05');
      expect(row?.dayDate).toBe('2026-06-05');
      expect(row?.orderIndex).toBe(1); // existing d-0 is 0, so next is 1
      expect(listByDay(db, 'trip-1', '2026-06-05').map((p) => p.id)).toEqual([
        'd-0', 's-1',
      ]);
    });

    it('promotes to an empty day at orderIndex 0', () => {
      const row = promoteToDay(db, 's-0', '2026-06-06');
      expect(row?.dayDate).toBe('2026-06-06');
      expect(row?.orderIndex).toBe(0);
    });

    it('returns undefined for an unknown id', () => {
      expect(promoteToDay(db, 'nope', '2026-06-05')).toBeUndefined();
    });
  });

  describe('places repo — moveToSaved', () => {
    let db: Db;
    beforeEach(() => {
      db = makeTestDb().db;
      seedTrip(db);
      seedPlace(db, { id: 'd-0', dayDate: '2026-06-05', orderIndex: 0 });
      seedPlace(db, { id: 's-0', dayDate: null, orderIndex: 0 });
    });

    it('nulls day_date and appends at the end of the Saved bucket', () => {
      const row = moveToSaved(db, 'd-0');
      expect(row?.dayDate).toBeNull();
      expect(row?.orderIndex).toBe(1); // s-0 occupies 0
      expect(listSaved(db, 'trip-1').map((p) => p.id)).toEqual(['s-0', 'd-0']);
    });

    it('returns undefined for an unknown id', () => {
      expect(moveToSaved(db, 'nope')).toBeUndefined();
    });
  });
  ```

- [ ] **Step 2: Run — expect FAIL.**
  ```bash
  npx vitest run src/db/repos/places.test.ts
  ```
  Expect failure: `reorderDay`/`promoteToDay`/`moveToSaved` not exported.

- [ ] **Step 3: Implement.**

  Append to `src/db/repos/places.ts`:
  ```ts
  /**
   * Renumber a day's places to match `orderedIds`. Ids not in the target day
   * are ignored; the remaining matched ids become orderIndex 0..n-1.
   */
  export function reorderDay(
    db: Db,
    tripId: string,
    dayDate: string,
    orderedIds: string[],
  ): void {
    const inDay = new Set(listByDay(db, tripId, dayDate).map((p) => p.id));
    const ts = new Date(now());
    let i = 0;
    for (const id of orderedIds) {
      if (!inDay.has(id)) continue;
      db.update(places)
        .set({ orderIndex: i, updatedAt: ts })
        .where(eq(places.id, id))
        .run();
      i += 1;
    }
  }

  /**
   * Move a place (Saved or other day) onto `dayDate`, appending at
   * max(day order)+1. Returns the updated row, or undefined if not found.
   */
  export function promoteToDay(db: Db, id: string, dayDate: string): Place | undefined {
    const existing = getPlace(db, id);
    if (!existing) return undefined;
    db.update(places)
      .set({
        dayDate,
        orderIndex: maxOrderIndex(db, existing.tripId, dayDate) + 1,
        updatedAt: new Date(now()),
      })
      .where(eq(places.id, id))
      .run();
    return getPlace(db, id);
  }

  /**
   * Move a place into the Saved bucket (day_date = NULL), appending at the
   * end of Saved. Returns the updated row, or undefined if not found.
   */
  export function moveToSaved(db: Db, id: string): Place | undefined {
    const existing = getPlace(db, id);
    if (!existing) return undefined;
    db.update(places)
      .set({
        dayDate: null,
        orderIndex: maxOrderIndex(db, existing.tripId, null) + 1,
        updatedAt: new Date(now()),
      })
      .where(eq(places.id, id))
      .run();
    return getPlace(db, id);
  }
  ```

- [ ] **Step 4: Run — expect PASS.**
  ```bash
  npx vitest run src/db/repos/places.test.ts
  ```
  Expected: ~21 passed.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/db/repos/places.ts src/db/repos/places.test.ts
  git commit -m "feat(places-repo): reorderDay/promoteToDay/moveToSaved bucket movers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B1.4: Legs repo — extend with `legsForDay`

**Prerequisite:** B0 must already exist with `getCachedLeg` / `upsertLeg` in `src/db/repos/legs.ts`.

This task **extends the existing B0 `legs.ts` file** — do not recreate it. `legsForDay` returns the consecutive cached legs (or `null` placeholders) for one day in one travel mode, in itinerary order. It reuses `listByDay` from the places repo.

**Files:**
- Modify `src/db/repos/legs.ts`
- Modify `src/db/repos/legs.test.ts`

- [ ] **Step 1: Add failing tests.**

  Add `legsForDay` to the import and append this block to `src/db/repos/legs.test.ts`:
  ```ts
  import {
    getCachedLeg,
    upsertLeg,
    legsForDay,
  } from '@/src/db/repos/legs';
  ```

  Append:
  ```ts
  describe('legs repo — legsForDay', () => {
    let db: Db;
    let sqlite: ReturnType<typeof makeTestDb>['sqlite'];

    beforeEach(() => {
      const h = makeTestDb();
      db = h.db;
      sqlite = h.sqlite;
      seed(db);
      // Add a third place so we have three consecutive stops.
      db.insert(places).values({
        id: 'p-c', tripId: 'trip-1', dayDate: '2026-06-05', googlePlaceId: null,
        name: 'C', address: null, lat: 35.2, lng: 139.2, category: 'sightseeing',
        scheduledTime: null, durationMin: null, cost: null, notes: null,
        orderIndex: 2, createdAt: TS, updatedAt: TS,
      }).run();
    });

    it('returns one entry per consecutive pair in itinerary order', () => {
      upsertLeg(db, { tripId: 'trip-1', fromPlaceId: 'p-a', toPlaceId: 'p-b', mode: 'walk', durationSeconds: 600, distanceMeters: 750, polyline: 'W1' });
      upsertLeg(db, { tripId: 'trip-1', fromPlaceId: 'p-b', toPlaceId: 'p-c', mode: 'walk', durationSeconds: 420, distanceMeters: 500, polyline: 'W2' });
      const legs = legsForDay(db, 'trip-1', '2026-06-05', 'walk');
      expect(legs).toHaveLength(2);
      expect(legs[0]).toMatchObject({ fromPlaceId: 'p-a', toPlaceId: 'p-b', durationSeconds: 600 });
      expect(legs[1]).toMatchObject({ fromPlaceId: 'p-b', toPlaceId: 'p-c', durationSeconds: 420 });
    });

    it('yields null for a not-yet-computed leg', () => {
      upsertLeg(db, { tripId: 'trip-1', fromPlaceId: 'p-a', toPlaceId: 'p-b', mode: 'walk', durationSeconds: 600, distanceMeters: 750, polyline: null });
      const legs = legsForDay(db, 'trip-1', '2026-06-05', 'walk');
      expect(legs[0]).toMatchObject({ fromPlaceId: 'p-a', toPlaceId: 'p-b' });
      expect(legs[1]).toBeNull(); // p-b→p-c not yet computed
    });

    it('returns [] for a day with fewer than two places', () => {
      expect(legsForDay(db, 'trip-1', '2026-06-07', 'walk')).toEqual([]);
    });
  });
  ```

- [ ] **Step 2: Run — expect FAIL.**
  ```bash
  npx vitest run src/db/repos/legs.test.ts
  ```
  Expect failure: `legsForDay` not exported.

- [ ] **Step 3: Append to `src/db/repos/legs.ts`.**

  Add `listByDay` import at the top of the existing imports:
  ```ts
  import { listByDay } from '@/src/db/repos/places';
  ```

  Append to `src/db/repos/legs.ts`:
  ```ts
  /**
   * Cached legs for a day in one travel mode, in itinerary order: one entry
   * per consecutive place pair (place[i] → place[i+1]). A pair with no cached
   * leg yields `null` so the caller knows which legs need recomputing.
   */
  export function legsForDay(
    db: Db,
    tripId: string,
    dayDate: string,
    mode: TravelMode,
  ): Array<TravelLeg | null> {
    const ordered = listByDay(db, tripId, dayDate);
    const out: Array<TravelLeg | null> = [];
    for (let i = 0; i < ordered.length - 1; i += 1) {
      out.push(
        getCachedLeg(db, ordered[i]!.id, ordered[i + 1]!.id, mode) ?? null,
      );
    }
    return out;
  }
  ```

- [ ] **Step 4: Run — expect PASS.**
  ```bash
  npx vitest run src/db/repos/legs.test.ts
  ```
  Expected: all previous tests + 3 new = passing.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/db/repos/legs.ts src/db/repos/legs.test.ts
  git commit -m "feat(legs-repo): legsForDay (extends B0 file)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B1.5: Legs repo — extend with `invalidateLegsTouchingPlace`

**Files:**
- Modify `src/db/repos/legs.ts`
- Modify `src/db/repos/legs.test.ts`

- [ ] **Step 1: Add failing test.**

  Add `invalidateLegsTouchingPlace` to the import and append:
  ```ts
  import {
    getCachedLeg,
    upsertLeg,
    legsForDay,
    invalidateLegsTouchingPlace,
  } from '@/src/db/repos/legs';
  ```

  Append:
  ```ts
  describe('legs repo — invalidateLegsTouchingPlace', () => {
    let db: Db;
    let sqlite: ReturnType<typeof makeTestDb>['sqlite'];

    beforeEach(() => {
      const h = makeTestDb();
      db = h.db;
      sqlite = h.sqlite;
      seed(db);
      db.insert(places).values({
        id: 'p-c', tripId: 'trip-1', dayDate: '2026-06-05', googlePlaceId: null,
        name: 'C', address: null, lat: 35.2, lng: 139.2, category: 'sightseeing',
        scheduledTime: null, durationMin: null, cost: null, notes: null,
        orderIndex: 2, createdAt: TS, updatedAt: TS,
      }).run();
      upsertLeg(db, { tripId: 'trip-1', fromPlaceId: 'p-a', toPlaceId: 'p-b', mode: 'walk', durationSeconds: 600, distanceMeters: 750, polyline: null });
      upsertLeg(db, { tripId: 'trip-1', fromPlaceId: 'p-b', toPlaceId: 'p-c', mode: 'walk', durationSeconds: 420, distanceMeters: 500, polyline: null });
      upsertLeg(db, { tripId: 'trip-1', fromPlaceId: 'p-a', toPlaceId: 'p-c', mode: 'drive', durationSeconds: 200, distanceMeters: 900, polyline: null });
    });

    it('deletes every leg where the place is from OR to, across all modes', () => {
      const removed = invalidateLegsTouchingPlace(db, 'p-b');
      expect(removed).toBe(2); // p-a→p-b and p-b→p-c
      expect(getCachedLeg(db, 'p-a', 'p-b', 'walk')).toBeUndefined();
      expect(getCachedLeg(db, 'p-b', 'p-c', 'walk')).toBeUndefined();
      // p-a→p-c (drive) does not touch p-b and survives.
      expect(getCachedLeg(db, 'p-a', 'p-c', 'drive')?.durationSeconds).toBe(200);
    });

    it('returns 0 when the place is in no legs', () => {
      expect(invalidateLegsTouchingPlace(db, 'unknown-place')).toBe(0);
    });
  });
  ```

- [ ] **Step 2: Run — expect FAIL.**
  ```bash
  npx vitest run src/db/repos/legs.test.ts
  ```
  Expect failure: `invalidateLegsTouchingPlace` not exported.

- [ ] **Step 3: Append to `src/db/repos/legs.ts`.**

  Add `or` to the `drizzle-orm` import at the top, then append:
  ```ts
  /**
   * Delete every cached leg referencing `placeId` as its from- OR to-end
   * (all modes). Called after coords change or place is removed from a day.
   * Returns the count of legs deleted.
   */
  export function invalidateLegsTouchingPlace(db: Db, placeId: string): number {
    const res = db
      .delete(travelLegs)
      .where(
        or(
          eq(travelLegs.fromPlaceId, placeId),
          eq(travelLegs.toPlaceId, placeId),
        ),
      )
      .run();
    return res.changes;
  }
  ```

  The top import line becomes:
  ```ts
  import { and, eq, or } from 'drizzle-orm';
  ```

- [ ] **Step 4: Run — expect PASS.**
  ```bash
  npx vitest run src/db/repos/legs.test.ts
  ```
  Expected: all tests pass.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/db/repos/legs.ts src/db/repos/legs.test.ts
  git commit -m "feat(legs-repo): invalidateLegsTouchingPlace (extends B0 file)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B1.6: Server Actions — `addPlaceAction` / `updatePlaceAction`

**Files:**
- Create `app/_actions/places.ts`
- Create `app/_actions/places.test.ts`

- [ ] **Step 1: Write the failing test.**

  Create `app/_actions/places.test.ts`:
  ```ts
  import { describe, it, expect, beforeEach, vi } from 'vitest';
  import { makeTestDb } from '@/src/db/testDb';
  import { trips, places } from '@/src/db/schema';

  const testHandle = { db: makeTestDb().db };
  vi.mock('@/src/db/client', () => ({
    get db() { return testHandle.db; },
  }));

  const revalidatePath = vi.fn();
  vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => revalidatePath(...args),
  }));

  import {
    addPlaceAction,
    updatePlaceAction,
  } from '@/app/_actions/places';
  import { getPlace } from '@/src/db/repos/places';
  import { upsertLeg, getCachedLeg } from '@/src/db/repos/legs';

  const TS = new Date('2026-06-08T12:00:00.000Z');

  function seed(db: ReturnType<typeof makeTestDb>['db']) {
    db.insert(trips).values({
      id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
      coverPhoto: null, createdAt: TS, updatedAt: TS,
    }).run();
  }

  function seedTwoPlaces(db: ReturnType<typeof makeTestDb>['db']) {
    for (const [id, order] of [['a', 0], ['b', 1]] as const) {
      db.insert(places).values({
        id, tripId: 'trip-1', dayDate: '2026-06-05', googlePlaceId: null,
        name: id.toUpperCase(), address: null, lat: 35, lng: 139,
        category: 'sightseeing', scheduledTime: null, durationMin: null,
        cost: null, notes: null, orderIndex: order, createdAt: TS, updatedAt: TS,
      }).run();
    }
  }

  describe('addPlaceAction', () => {
    beforeEach(() => {
      testHandle.db = makeTestDb().db;
      seed(testHandle.db);
      revalidatePath.mockClear();
    });

    it('adds a place to a day and revalidates the trip plan path', async () => {
      const place = await addPlaceAction({
        tripId: 'trip-1',
        dayDate: '2026-06-05',
        name: 'Castle',
        category: 'sightseeing',
        lat: 34.9,
        lng: 135.7,
      });
      expect(place.name).toBe('Castle');
      expect(place.orderIndex).toBe(0);
      expect(getPlace(testHandle.db, place.id)?.name).toBe('Castle');
      expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/plan');
    });

    it('adds to the Saved bucket when dayDate is omitted', async () => {
      const place = await addPlaceAction({
        tripId: 'trip-1',
        name: 'Wishlist Spot',
        category: 'other',
      });
      expect(place.dayDate).toBeNull();
    });

    it('rejects an empty name', async () => {
      await expect(
        addPlaceAction({ tripId: 'trip-1', name: '', category: 'other' }),
      ).rejects.toThrow();
    });

    it('rejects an unknown category', async () => {
      await expect(
        addPlaceAction({
          tripId: 'trip-1',
          name: 'X',
          // @ts-expect-error invalid category for the test
          category: 'bogus',
        }),
      ).rejects.toThrow();
    });
  });

  describe('updatePlaceAction', () => {
    beforeEach(() => {
      testHandle.db = makeTestDb().db;
      seed(testHandle.db);
      seedTwoPlaces(testHandle.db);
      revalidatePath.mockClear();
    });

    it('patches fields and revalidates without touching legs when coords unchanged', async () => {
      upsertLeg(testHandle.db, {
        tripId: 'trip-1', fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk',
        durationSeconds: 600, distanceMeters: 750, polyline: 'P',
      });
      const row = await updatePlaceAction('a', { name: 'Renamed', cost: 100 });
      expect(row.name).toBe('Renamed');
      // No lat/lng in patch ⇒ leg cache preserved.
      expect(getCachedLeg(testHandle.db, 'a', 'b', 'walk')?.durationSeconds).toBe(600);
      expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/plan');
    });

    it('invalidates legs touching the place when lat/lng change', async () => {
      upsertLeg(testHandle.db, {
        tripId: 'trip-1', fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk',
        durationSeconds: 600, distanceMeters: 750, polyline: 'P',
      });
      await updatePlaceAction('a', { lat: 34.0, lng: 135.0 });
      expect(getCachedLeg(testHandle.db, 'a', 'b', 'walk')).toBeUndefined();
    });

    it('throws when the place id is unknown', async () => {
      await expect(updatePlaceAction('nope', { name: 'X' })).rejects.toThrow();
    });
  });
  ```

- [ ] **Step 2: Run — expect FAIL.**
  ```bash
  npx vitest run app/_actions/places.test.ts
  ```
  Expect failure: `Failed to resolve import "@/app/_actions/places"`.

- [ ] **Step 3: Implement.**

  Create `app/_actions/places.ts`:
  ```ts
  'use server';

  import { z } from 'zod';
  import { revalidatePath } from 'next/cache';
  import { db } from '@/src/db/client';
  import {
    addPlace,
    updatePlace,
    deletePlace,
    reorderDay,
    promoteToDay,
    moveToSaved,
    listByDay,
    getPlace,
    type Place,
  } from '@/src/db/repos/places';
  import { invalidateLegsTouchingPlace } from '@/src/db/repos/legs';

  const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
  const timeStr = z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM');
  const category = z.enum([
    'sightseeing', 'lodging', 'transport', 'activity', 'other',
  ]);

  function revalidatePlan(tripId: string): void {
    revalidatePath(`/trip/${tripId}/plan`);
  }

  // --- addPlaceAction -------------------------------------------------------

  const addSchema = z.object({
    tripId: z.string().min(1),
    dayDate: dateStr.nullish(),
    googlePlaceId: z.string().min(1).nullish(),
    name: z.string().trim().min(1, 'Name is required').max(200),
    address: z.string().max(500).nullish(),
    lat: z.number().nullish(),
    lng: z.number().nullish(),
    category,
    scheduledTime: timeStr.nullish(),
    durationMin: z.number().int().nonnegative().nullish(),
    cost: z.number().int().nullish(),
    notes: z.string().max(2000).nullish(),
  });

  export type AddPlaceActionInput = z.input<typeof addSchema>;

  export async function addPlaceAction(input: AddPlaceActionInput): Promise<Place> {
    const data = addSchema.parse(input);
    const place = addPlace(db, {
      tripId: data.tripId,
      dayDate: data.dayDate ?? null,
      googlePlaceId: data.googlePlaceId ?? null,
      name: data.name,
      address: data.address ?? null,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      category: data.category,
      scheduledTime: data.scheduledTime ?? null,
      durationMin: data.durationMin ?? null,
      cost: data.cost ?? null,
      notes: data.notes ?? null,
    });
    revalidatePlan(data.tripId);
    return place;
  }

  // --- updatePlaceAction ----------------------------------------------------

  const updateSchema = z.object({
    googlePlaceId: z.string().min(1).nullish(),
    name: z.string().trim().min(1).max(200).optional(),
    address: z.string().max(500).nullish(),
    lat: z.number().nullish(),
    lng: z.number().nullish(),
    category: category.optional(),
    scheduledTime: timeStr.nullish(),
    durationMin: z.number().int().nonnegative().nullish(),
    cost: z.number().int().nullish(),
    notes: z.string().max(2000).nullish(),
  });

  export type UpdatePlaceActionPatch = z.input<typeof updateSchema>;

  export async function updatePlaceAction(
    id: string,
    patch: UpdatePlaceActionPatch,
  ): Promise<Place> {
    const existing = getPlace(db, id);
    if (!existing) throw new Error('Place not found');
    const data = updateSchema.parse(patch);
    const coordsTouched =
      Object.prototype.hasOwnProperty.call(patch, 'lat') ||
      Object.prototype.hasOwnProperty.call(patch, 'lng');
    const updated = updatePlace(db, id, data);
    if (!updated) throw new Error('Place not found');
    if (coordsTouched) {
      invalidateLegsTouchingPlace(db, id);
    }
    revalidatePlan(existing.tripId);
    return updated;
  }
  ```

- [ ] **Step 4: Run — expect PASS.**
  ```bash
  npx vitest run app/_actions/places.test.ts
  ```
  Expected: 7 passed.

- [ ] **Step 5: Commit.**
  ```bash
  git add app/_actions/places.ts app/_actions/places.test.ts
  git commit -m "feat(places-actions): addPlaceAction/updatePlaceAction with coord-change leg invalidation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B1.7: Server Actions — `deletePlaceAction` / `reorderDayAction` / `promoteToDayAction` / `moveToSavedAction` / `recomputeDayLegsAction`

**Files:**
- Modify `app/_actions/places.ts`
- Modify `app/_actions/places.test.ts`

- [ ] **Step 1: Add failing tests.**

  Update the import from `@/app/_actions/places` in `app/_actions/places.test.ts` to include the new actions, and add the `TravelLeg` import:
  ```ts
  import {
    addPlaceAction,
    updatePlaceAction,
    deletePlaceAction,
    reorderDayAction,
    promoteToDayAction,
    moveToSavedAction,
    recomputeDayLegsAction,
  } from '@/app/_actions/places';
  import type { TravelLeg } from '@/src/db/schema';
  ```

  Also add this mock for `@/src/lib/google/getOrFetchLeg` (so `recomputeDayLegsAction` tests don't hit real Google):
  ```ts
  const getOrFetchLegMock = vi.fn();
  vi.mock('@/src/lib/google/getOrFetchLeg', () => ({
    getOrFetchLeg: (...args: unknown[]) => getOrFetchLegMock(...args),
  }));
  vi.mock('@/src/env', () => ({ env: { GOOGLE_MAPS_SERVER_KEY: 'SERVER_KEY' } }));
  ```

  Append:
  ```ts
  describe('deletePlaceAction', () => {
    beforeEach(() => {
      testHandle.db = makeTestDb().db;
      seed(testHandle.db);
      seedTwoPlaces(testHandle.db);
      revalidatePath.mockClear();
    });

    it('deletes the place, invalidates its legs, and revalidates', async () => {
      upsertLeg(testHandle.db, {
        tripId: 'trip-1', fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk',
        durationSeconds: 600, distanceMeters: 750, polyline: 'P',
      });
      await deletePlaceAction('a');
      expect(getPlace(testHandle.db, 'a')).toBeUndefined();
      expect(getCachedLeg(testHandle.db, 'a', 'b', 'walk')).toBeUndefined();
      expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/plan');
    });

    it('throws when the id is unknown', async () => {
      await expect(deletePlaceAction('nope')).rejects.toThrow();
    });
  });

  describe('reorderDayAction', () => {
    beforeEach(() => {
      testHandle.db = makeTestDb().db;
      seed(testHandle.db);
      seedTwoPlaces(testHandle.db);
      revalidatePath.mockClear();
    });

    it('reorders the day, invalidates affected legs, and revalidates', async () => {
      upsertLeg(testHandle.db, {
        tripId: 'trip-1', fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk',
        durationSeconds: 600, distanceMeters: 750, polyline: 'P',
      });
      await reorderDayAction('trip-1', '2026-06-05', ['b', 'a']);
      expect(getPlace(testHandle.db, 'b')?.orderIndex).toBe(0);
      expect(getPlace(testHandle.db, 'a')?.orderIndex).toBe(1);
      // Reorder changed adjacency ⇒ old a→b leg invalidated.
      expect(getCachedLeg(testHandle.db, 'a', 'b', 'walk')).toBeUndefined();
      expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/plan');
    });
  });

  describe('promoteToDayAction', () => {
    beforeEach(() => {
      testHandle.db = makeTestDb().db;
      seed(testHandle.db);
      revalidatePath.mockClear();
    });

    it('promotes a Saved place onto a day and revalidates', async () => {
      const saved = await addPlaceAction({
        tripId: 'trip-1', name: 'Wish', category: 'other',
      });
      revalidatePath.mockClear();
      const row = await promoteToDayAction(saved.id, '2026-06-05');
      expect(row.dayDate).toBe('2026-06-05');
      expect(row.orderIndex).toBe(0);
      expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/plan');
    });

    it('throws when the id is unknown', async () => {
      await expect(promoteToDayAction('nope', '2026-06-05')).rejects.toThrow();
    });
  });

  describe('moveToSavedAction', () => {
    beforeEach(() => {
      testHandle.db = makeTestDb().db;
      seed(testHandle.db);
      seedTwoPlaces(testHandle.db);
      revalidatePath.mockClear();
    });

    it('moves a place to Saved, invalidates its legs, and revalidates', async () => {
      upsertLeg(testHandle.db, {
        tripId: 'trip-1', fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk',
        durationSeconds: 600, distanceMeters: 750, polyline: 'P',
      });
      const row = await moveToSavedAction('a');
      expect(row.dayDate).toBeNull();
      expect(getCachedLeg(testHandle.db, 'a', 'b', 'walk')).toBeUndefined();
      expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/plan');
    });

    it('throws when the id is unknown', async () => {
      await expect(moveToSavedAction('nope')).rejects.toThrow();
    });
  });

  describe('recomputeDayLegsAction', () => {
    beforeEach(() => {
      testHandle.db = makeTestDb().db;
      seed(testHandle.db);
      seedTwoPlaces(testHandle.db);
      revalidatePath.mockClear();
      getOrFetchLegMock.mockClear();
    });

    it('calls getOrFetchLeg for each consecutive pair and returns the day legs', async () => {
      const fakeLeg: Partial<TravelLeg> = {
        id: 'leg-x', tripId: 'trip-1', fromPlaceId: 'a', toPlaceId: 'b',
        mode: 'walk', durationSeconds: 600, distanceMeters: 800, polyline: 'P',
        computedAt: new Date(1_700_000_000_000),
      };
      getOrFetchLegMock.mockResolvedValue(fakeLeg);

      const legs = await recomputeDayLegsAction('trip-1', '2026-06-05', 'walk');
      expect(getOrFetchLegMock).toHaveBeenCalledTimes(1); // one pair: a→b
      expect(legs).toHaveLength(1);
      expect(legs[0]).toMatchObject({ fromPlaceId: 'a', toPlaceId: 'b' });
    });

    it('returns [] for a day with fewer than two places', async () => {
      const legs = await recomputeDayLegsAction('trip-1', '2026-06-07', 'walk');
      expect(legs).toEqual([]);
      expect(getOrFetchLegMock).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 2: Run — expect FAIL.**
  ```bash
  npx vitest run app/_actions/places.test.ts
  ```
  Expect failure: the five new actions are not exported.

- [ ] **Step 3: Append to `app/_actions/places.ts`.**

  Add the `getOrFetchLeg` and `env` imports, and add `TravelLeg` to the schema import:
  ```ts
  import { env } from '@/src/env';
  import { getOrFetchLeg } from '@/src/lib/google/getOrFetchLeg';
  import type { TravelLeg } from '@/src/db/schema';
  import type { TravelMode } from '@/src/lib/googleMapsUrl';
  ```

  Append these functions:
  ```ts
  export async function deletePlaceAction(id: string): Promise<void> {
    const existing = getPlace(db, id);
    if (!existing) throw new Error('Place not found');
    invalidateLegsTouchingPlace(db, id);
    deletePlace(db, id);
    revalidatePlan(existing.tripId);
  }

  export async function reorderDayAction(
    tripId: string,
    dayDate: string,
    ids: string[],
  ): Promise<void> {
    const parsedTrip = z.string().min(1).parse(tripId);
    const parsedDay = dateStr.parse(dayDate);
    const parsedIds = z.array(z.string().min(1)).parse(ids);
    // Reordering changes adjacency ⇒ every leg touching a place in this day is stale.
    for (const place of listByDay(db, parsedTrip, parsedDay)) {
      invalidateLegsTouchingPlace(db, place.id);
    }
    reorderDay(db, parsedTrip, parsedDay, parsedIds);
    revalidatePlan(parsedTrip);
  }

  export async function promoteToDayAction(id: string, dayDate: string): Promise<Place> {
    const existing = getPlace(db, id);
    if (!existing) throw new Error('Place not found');
    const parsedDay = dateStr.parse(dayDate);
    invalidateLegsTouchingPlace(db, id);
    const updated = promoteToDay(db, id, parsedDay);
    if (!updated) throw new Error('Place not found');
    revalidatePlan(existing.tripId);
    return updated;
  }

  export async function moveToSavedAction(id: string): Promise<Place> {
    const existing = getPlace(db, id);
    if (!existing) throw new Error('Place not found');
    invalidateLegsTouchingPlace(db, id);
    const updated = moveToSaved(db, id);
    if (!updated) throw new Error('Place not found');
    revalidatePlan(existing.tripId);
    return updated;
  }

  /**
   * Recompute all legs for a day in one travel mode (online path only).
   * For each consecutive stop pair: cache hit → reuse; miss → Google Directions
   * → upsertLeg with polyline. Returns the resulting legs.
   * Called by PlanClient (B2) after add/reorder/delete/promote/mode-change.
   */
  export async function recomputeDayLegsAction(
    tripId: string,
    dayDate: string,
    mode: TravelMode,
  ): Promise<TravelLeg[]> {
    const parsedTrip = z.string().min(1).parse(tripId);
    const parsedDay = dateStr.parse(dayDate);
    const ordered = listByDay(db, parsedTrip, parsedDay);
    if (ordered.length < 2) return [];
    if (!env.GOOGLE_MAPS_SERVER_KEY) return [];

    const legs: TravelLeg[] = [];
    for (let i = 0; i < ordered.length - 1; i++) {
      const from = ordered[i]!;
      const to = ordered[i + 1]!;
      if (from.lat == null || from.lng == null || to.lat == null || to.lng == null) {
        continue; // skip pairs missing coords
      }
      try {
        const leg = await getOrFetchLeg(
          db,
          { id: from.id, tripId: from.tripId, lat: from.lat, lng: from.lng },
          { id: to.id, tripId: to.tripId, lat: to.lat, lng: to.lng },
          mode,
          env.GOOGLE_MAPS_SERVER_KEY,
        );
        legs.push(leg);
      } catch {
        // Log and continue — a single failed pair should not block the rest.
      }
    }
    return legs;
  }
  ```

- [ ] **Step 4: Run — expect PASS.**
  ```bash
  npx vitest run app/_actions/places.test.ts
  ```
  Expected: ~17 passed (7 from B1.6 + 10 new).

- [ ] **Step 5: Commit.**
  ```bash
  git add app/_actions/places.ts app/_actions/places.test.ts
  git commit -m "feat(places-actions): delete/reorder/promote/moveToSaved/recomputeDayLegs with leg invalidation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B1.8: `GET /api/trips/[tripId]/places` — `{ places: PlaceDTO[], legs: LegDTO[] }`

Returns all places for the trip (ordered dayDate asc, NULLs last, then orderIndex) with `photoPath` pulled from `place_details_cache`, plus all cached legs with `polyline`. Both arrays are embedded in one response so the SW data cache holds them together for offline rendering.

**Files:**
- Create `app/api/trips/[tripId]/places/route.ts`
- Create `app/api/trips/[tripId]/places/route.test.ts`

- [ ] **Step 1: Write the failing test.**

  Create `app/api/trips/[tripId]/places/route.test.ts`:
  ```ts
  import { describe, it, expect, beforeEach, vi } from 'vitest';
  import { makeTestDb } from '@/src/db/testDb';
  import { trips, places, travelLegs, placeDetailsCache } from '@/src/db/schema';

  const testHandle = { db: makeTestDb().db };
  vi.mock('@/src/db/client', () => ({
    get db() { return testHandle.db; },
    sqlite: {},
  }));

  import { GET } from '@/app/api/trips/[tripId]/places/route';

  const TS = new Date('2026-06-08T12:00:00.000Z');

  function seed(db: ReturnType<typeof makeTestDb>['db']) {
    db.insert(trips).values({
      id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
      coverPhoto: null, createdAt: TS, updatedAt: TS,
    }).run();
    db.insert(places).values([
      {
        id: 'b', tripId: 'trip-1', dayDate: '2026-06-05', googlePlaceId: 'gpid-b',
        name: 'Castle', address: null, lat: 34.9, lng: 135.7, category: 'sightseeing',
        scheduledTime: null, durationMin: null, cost: null, notes: null,
        orderIndex: 1, createdAt: TS, updatedAt: TS,
      },
      {
        id: 'a', tripId: 'trip-1', dayDate: '2026-06-05', googlePlaceId: null,
        name: 'Shrine', address: null, lat: 34.8, lng: 135.6, category: 'sightseeing',
        scheduledTime: null, durationMin: null, cost: null, notes: null,
        orderIndex: 0, createdAt: TS, updatedAt: TS,
      },
      {
        id: 's', tripId: 'trip-1', dayDate: null, googlePlaceId: null,
        name: 'Museum', address: null, lat: null, lng: null, category: 'sightseeing',
        scheduledTime: null, durationMin: null, cost: null, notes: null,
        orderIndex: 0, createdAt: TS, updatedAt: TS,
      },
    ]).run();
    // Cache row for place 'b' (has a local photo path).
    db.insert(placeDetailsCache).values({
      googlePlaceId: 'gpid-b',
      name: 'Castle',
      address: 'Osaka Castle',
      lat: 34.9,
      lng: 135.7,
      categoryGuess: 'sightseeing',
      photoRef: 'R',
      photoLocalPath: 'place-photos/gpid-b/card.webp',
      rawJson: '{}',
      fetchedAt: TS,
    }).run();
    db.insert(travelLegs).values({
      id: 'leg-1', tripId: 'trip-1', fromPlaceId: 'a', toPlaceId: 'b',
      mode: 'walk', durationSeconds: 600, distanceMeters: 750,
      polyline: 'POLY_AB', computedAt: TS,
    }).run();
  }

  function ctx(tripId: string) {
    return { params: Promise.resolve({ tripId }) };
  }

  describe('GET /api/trips/[tripId]/places', () => {
    beforeEach(() => {
      testHandle.db = makeTestDb().db;
      seed(testHandle.db);
    });

    it('returns 200 with PlaceDTO array (sorted) and LegDTO array with polyline', async () => {
      const res = await GET(
        new Request('http://x/api/trips/trip-1/places'),
        ctx('trip-1'),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        places: Array<{ id: string; dayDate: string | null; orderIndex: number; photoPath: string | null }>;
        legs: Array<{ id: string; fromPlaceId: string; toPlaceId: string; mode: string; polyline: string | null }>;
      };
      // dayDate asc, NULLs last, then orderIndex: a(0), b(1), s(null).
      expect(body.places.map((p) => p.id)).toEqual(['a', 'b', 's']);
      // photoPath from place_details_cache for place with googlePlaceId 'gpid-b'.
      expect(body.places.find((p) => p.id === 'b')?.photoPath).toBe('place-photos/gpid-b/card.webp');
      // No cache row for place 'a' or 's'.
      expect(body.places.find((p) => p.id === 'a')?.photoPath).toBeNull();
      expect(body.places.find((p) => p.id === 's')?.photoPath).toBeNull();
      // Leg with polyline.
      expect(body.legs).toHaveLength(1);
      expect(body.legs[0]).toMatchObject({
        id: 'leg-1', fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk', polyline: 'POLY_AB',
      });
    });

    it('returns 404 for an unknown trip', async () => {
      const res = await GET(new Request('http://x/api/trips/nope/places'), ctx('nope'));
      expect(res.status).toBe(404);
      await expect(res.json()).resolves.toEqual({ error: 'not_found' });
    });

    it('returns empty arrays for a trip with no places', async () => {
      testHandle.db = makeTestDb().db;
      testHandle.db.insert(trips).values({
        id: 'trip-empty', name: 'Empty', startDate: '2026-06-05', endDate: '2026-06-05',
        coverPhoto: null, createdAt: TS, updatedAt: TS,
      }).run();
      const res = await GET(
        new Request('http://x/api/trips/trip-empty/places'),
        ctx('trip-empty'),
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ places: [], legs: [] });
    });
  });
  ```

- [ ] **Step 2: Run — expect FAIL.**
  ```bash
  npx vitest run "app/api/trips/[tripId]/places/route.test.ts"
  ```
  Expect failure: cannot resolve the route module.

- [ ] **Step 3: Implement.**

  Create `app/api/trips/[tripId]/places/route.ts`:
  ```ts
  import { NextResponse } from 'next/server';
  import { eq } from 'drizzle-orm';
  import { db } from '@/src/db/client';
  import { getTrip } from '@/src/db/repos/trips';
  import { listAllForTrip } from '@/src/db/repos/places';
  import { getCachedDetails } from '@/src/db/repos/placeCache';
  import { travelLegs, type Place, type TravelLeg } from '@/src/db/schema';

  export const dynamic = 'force-dynamic';

  /**
   * PlaceDTO: all Place fields + photoPath resolved from place_details_cache
   * via googlePlaceId. photoPath is null when there is no cache row.
   */
  export interface PlaceDTO extends Place {
    photoPath: string | null;
  }

  /**
   * LegDTO: all TravelLeg fields (including polyline from the schema).
   */
  export type LegDTO = TravelLeg;

  export async function GET(
    _req: Request,
    ctx: { params: Promise<{ tripId: string }> },
  ) {
    const { tripId } = await ctx.params;
    const trip = getTrip(db, tripId);
    if (!trip) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const rawPlaces = listAllForTrip(db, tripId);

    // Build PlaceDTO by joining photoLocalPath from place_details_cache.
    const places: PlaceDTO[] = rawPlaces.map((p) => {
      let photoPath: string | null = null;
      if (p.googlePlaceId) {
        const cacheRow = getCachedDetails(db, p.googlePlaceId);
        photoPath = cacheRow?.photoLocalPath ?? null;
      }
      return { ...p, photoPath };
    });

    const legs: LegDTO[] = db
      .select()
      .from(travelLegs)
      .where(eq(travelLegs.tripId, tripId))
      .all();

    return NextResponse.json({ places, legs });
  }
  ```

- [ ] **Step 4: Run — expect PASS.**
  ```bash
  npx vitest run "app/api/trips/[tripId]/places/route.test.ts"
  ```
  Expected: 3 passed.

- [ ] **Step 5: Commit.**
  ```bash
  git add "app/api/trips/[tripId]/places/route.ts" "app/api/trips/[tripId]/places/route.test.ts"
  git commit -m "feat(api): GET /api/trips/[tripId]/places returns PlaceDTO (with photoPath) + LegDTO (with polyline)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B1.9: `GET /api/photos/[placeId]/[variant]` — stream cached place photo

Resolves `placeId` → `place_details_cache.photoLocalPath` (via the place's `googlePlaceId`) and streams the file. Returns 404 if no cache row or no local file. The SW `photos` CacheFirst rule already matches `/api/photos/…` per `app/sw.ts`.

**Files:**
- Create `app/api/photos/[placeId]/[variant]/route.ts`
- Create `app/api/photos/[placeId]/[variant]/route.test.ts`

- [ ] **Step 1: Write the failing test.**

  Create `app/api/photos/[placeId]/[variant]/route.test.ts`:
  ```ts
  import { describe, it, expect, beforeEach, vi } from 'vitest';
  import { makeTestDb } from '@/src/db/testDb';
  import { trips, places, placeDetailsCache } from '@/src/db/schema';

  const testHandle = { db: makeTestDb().db };
  vi.mock('@/src/db/client', () => ({
    get db() { return testHandle.db; },
    sqlite: {},
  }));

  // Mock the Node fs module: readFileSync succeeds when the path is our known fixture.
  const PHOTO_BYTES = Buffer.from('FAKE_JPEG_DATA');
  vi.mock('node:fs', () => ({
    readFileSync: vi.fn((path: string) => {
      if (path.includes('gpid-1')) return PHOTO_BYTES;
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      throw err;
    }),
    existsSync: vi.fn((path: string) => path.includes('gpid-1')),
  }));
  vi.mock('@/src/env', () => ({ env: { UPLOADS_DIR: '/uploads' } }));

  import { GET } from '@/app/api/photos/[placeId]/[variant]/route';

  const TS = new Date('2026-06-08T12:00:00.000Z');

  function seed(db: ReturnType<typeof makeTestDb>['db']) {
    db.insert(trips).values({
      id: 'trip-1', name: 'T', startDate: '2026-06-05', endDate: '2026-06-05',
      coverPhoto: null, createdAt: TS, updatedAt: TS,
    }).run();
    db.insert(places).values({
      id: 'place-1', tripId: 'trip-1', dayDate: null, googlePlaceId: 'gpid-1',
      name: 'Tower', address: null, lat: null, lng: null, category: 'sightseeing',
      scheduledTime: null, durationMin: null, cost: null, notes: null,
      orderIndex: 0, createdAt: TS, updatedAt: TS,
    }).run();
    db.insert(placeDetailsCache).values({
      googlePlaceId: 'gpid-1',
      name: 'Tower',
      address: null,
      lat: null,
      lng: null,
      categoryGuess: 'sightseeing',
      photoRef: 'R',
      photoLocalPath: 'place-photos/gpid-1/card.webp',
      rawJson: '{}',
      fetchedAt: TS,
    }).run();
  }

  function ctx(placeId: string, variant: string) {
    return { params: Promise.resolve({ placeId, variant }) };
  }

  describe('GET /api/photos/[placeId]/[variant]', () => {
    beforeEach(() => {
      testHandle.db = makeTestDb().db;
      seed(testHandle.db);
    });

    it('streams the photo bytes for a known place with a cached photo', async () => {
      const res = await GET(
        new Request('http://x/api/photos/place-1/card'),
        ctx('place-1', 'card'),
      );
      expect(res.status).toBe(200);
      const buf = await res.arrayBuffer();
      expect(Buffer.from(buf)).toEqual(PHOTO_BYTES);
      expect(res.headers.get('content-type')).toMatch(/image/);
    });

    it('returns 404 for an unknown place id', async () => {
      const res = await GET(
        new Request('http://x/api/photos/unknown/card'),
        ctx('unknown', 'card'),
      );
      expect(res.status).toBe(404);
    });

    it('returns 404 for a place with no googlePlaceId', async () => {
      testHandle.db.insert(places).values({
        id: 'no-gid', tripId: 'trip-1', dayDate: null, googlePlaceId: null,
        name: 'Drop Pin', address: null, lat: 35, lng: 139, category: 'other',
        scheduledTime: null, durationMin: null, cost: null, notes: null,
        orderIndex: 1, createdAt: TS, updatedAt: TS,
      }).run();
      const res = await GET(
        new Request('http://x/api/photos/no-gid/card'),
        ctx('no-gid', 'card'),
      );
      expect(res.status).toBe(404);
    });

    it('returns 404 when the cache row has no photoLocalPath', async () => {
      testHandle.db.insert(places).values({
        id: 'no-photo', tripId: 'trip-1', dayDate: null, googlePlaceId: 'gpid-2',
        name: 'Bare', address: null, lat: null, lng: null, category: 'other',
        scheduledTime: null, durationMin: null, cost: null, notes: null,
        orderIndex: 2, createdAt: TS, updatedAt: TS,
      }).run();
      testHandle.db.insert(placeDetailsCache).values({
        googlePlaceId: 'gpid-2', name: 'Bare', address: null, lat: null, lng: null,
        categoryGuess: 'other', photoRef: null, photoLocalPath: null,
        rawJson: '{}', fetchedAt: TS,
      }).run();
      const res = await GET(
        new Request('http://x/api/photos/no-photo/card'),
        ctx('no-photo', 'card'),
      );
      expect(res.status).toBe(404);
    });
  });
  ```

- [ ] **Step 2: Run — expect FAIL.**
  ```bash
  npx vitest run "app/api/photos/[placeId]/[variant]/route.test.ts"
  ```
  Expect failure: cannot resolve the route module.

- [ ] **Step 3: Implement.**

  Create `app/api/photos/[placeId]/[variant]/route.ts`:
  ```ts
  import { readFileSync } from 'node:fs';
  import { join, extname } from 'node:path';
  import { NextResponse } from 'next/server';
  import { eq } from 'drizzle-orm';
  import { db } from '@/src/db/client';
  import { env } from '@/src/env';
  import { places, placeDetailsCache } from '@/src/db/schema';
  import { getCachedDetails } from '@/src/db/repos/placeCache';

  export const dynamic = 'force-dynamic';

  const MIME: Record<string, string> = {
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
  };

  export async function GET(
    _req: Request,
    ctx: { params: Promise<{ placeId: string; variant: string }> },
  ) {
    const { placeId } = await ctx.params;

    // Look up the place to get its googlePlaceId.
    const place = db
      .select()
      .from(places)
      .where(eq(places.id, placeId))
      .get();
    if (!place) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (!place.googlePlaceId) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    // Look up the cache row for the photo local path.
    const cacheRow = getCachedDetails(db, place.googlePlaceId);
    if (!cacheRow?.photoLocalPath) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    // Stream the file from the uploads directory.
    const filePath = join(env.UPLOADS_DIR, cacheRow.photoLocalPath);
    try {
      const bytes = readFileSync(filePath);
      const ext = extname(filePath).toLowerCase();
      const contentType = MIME[ext] ?? 'application/octet-stream';
      return new Response(bytes, {
        status: 200,
        headers: {
          'content-type': contentType,
          'cache-control': 'public, max-age=31536000, immutable',
        },
      });
    } catch {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
  }
  ```

- [ ] **Step 4: Run — expect PASS.**
  ```bash
  npx vitest run "app/api/photos/[placeId]/[variant]/route.test.ts"
  ```
  Expected: 4 passed.

- [ ] **Step 5: Commit.**
  ```bash
  git add "app/api/photos/[placeId]/[variant]/route.ts" "app/api/photos/[placeId]/[variant]/route.test.ts"
  git commit -m "feat(api): GET /api/photos/[placeId]/[variant] streams cached place photo (404 if none)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B1.10: Group verification — full suite + typecheck + lint

**Files:** (no source changes — verification only)

- [ ] **Step 1: Run the full test suite.**
  ```bash
  npm test
  ```
  Expected: all suites pass, including:
  - `src/db/repos/places.test.ts` (~21 tests)
  - `src/db/repos/legs.test.ts` (all B0 tests + B1.4/B1.5 additions)
  - `app/_actions/places.test.ts` (~17 tests)
  - `app/api/trips/[tripId]/places/route.test.ts` (3 tests)
  - `app/api/photos/[placeId]/[variant]/route.test.ts` (4 tests)
  - All pre-existing 1A and B0 suites still passing.

- [ ] **Step 2: Typecheck.**
  ```bash
  npx tsc --noEmit -p tsconfig.json
  ```
  Expected: exits 0. Confirms Drizzle column types (including nullable `polyline`) are consistent throughout the new repos and route handlers.

- [ ] **Step 3: Lint.**
  ```bash
  npm run lint
  ```
  Expected: no errors.

- [ ] **Step 4: Production build.**
  ```bash
  npm run build
  ```
  Expected: build succeeds. New routes appear as dynamic:
  - `GET /api/trips/[tripId]/places` (`ƒ`)
  - `GET /api/photos/[placeId]/[variant]` (`ƒ`)
  The SW data cache already covers `/api/trips` (the places endpoint). The SW photos cache already covers `/api/photos/…`.

- [ ] **Step 5: Commit any incidental fixups only.**
  ```bash
  git add -A
  git commit -m "chore(b1): fix typecheck/lint issues found during group verification

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```
  If Steps 1–4 were already green, skip.

---

**B1 deliverables (file paths):**
- `src/db/repos/places.ts` + `places.test.ts` — 9 functions: `listByDay`, `listSaved`, `listAllForTrip`, `getPlace`, `addPlace`, `updatePlace`, `deletePlace`, `reorderDay`, `promoteToDay`, `moveToSaved`
- `src/db/repos/legs.ts` (extended from B0) + `legs.test.ts` — adds `legsForDay`, `invalidateLegsTouchingPlace`
- `app/_actions/places.ts` + `places.test.ts` — 7 actions: `addPlaceAction`, `updatePlaceAction`, `deletePlaceAction`, `reorderDayAction`, `promoteToDayAction`, `moveToSavedAction`, `recomputeDayLegsAction`
- `app/api/trips/[tripId]/places/route.ts` + `route.test.ts` — returns `{ places: PlaceDTO[], legs: LegDTO[] }`
- `app/api/photos/[placeId]/[variant]/route.ts` + `route.test.ts` — streams `photoLocalPath`, 404 if none

**Wire shapes exported for B2/B3:**
- `PlaceDTO` (extends `Place` with `photoPath: string | null`) and `LegDTO` (= `TravelLeg` incl. `polyline: string | null`) from `app/api/trips/[tripId]/places/route.ts`
- `recomputeDayLegsAction(tripId, dayDate, mode) → Promise<TravelLeg[]>` from `app/_actions/places.ts`
- All place mutate actions: `addPlaceAction`, `updatePlaceAction`, `deletePlaceAction`, `reorderDayAction`, `promoteToDayAction`, `moveToSavedAction`

---

# Plan 1B — Group B2: Plan tab (PlanClient + Today + add-place + Saved)

This is the cohesive Plan-tab UI. It consumes (does **not** define) the B0/B1 seams:

- **B0** client wrappers: `components/plan/useGooglePlaces.ts` (`usePlacesAutocomplete()`) and `components/plan/googleClient.ts` (`reverseGeocode(lat, lng)`). The Google JS loader / fetches behind these are **mocked** in tests.
- **B1** Server Actions in `app/_actions/places.ts`: `addPlaceAction`, `updatePlaceAction`, `deletePlaceAction`, `reorderDayAction`, `promoteToDayAction`, `moveToSavedAction`, `recomputeDayLegsAction`. Mocked in tests.
- **B1** read handler `GET /api/trips/[tripId]/places` → `{ places: PlaceDTO[], legs: LegDTO[] }`.
- **B1** photos handler `GET /api/photos/[placeId]/[variant]`; UI thumbnails use `PlaceDTO.photoPath` → `/api/photos/[id]/card`.
- **B3** `components/plan/PlanMap.tsx` (the real map). B2 only **mounts** it via the exact prop seam below; it never implements the map.

`PlaceDTO`/`LegDTO` are the JSON shapes returned by the B1 read handler. Their fields are a structural superset of the relevant `Place`/`TravelLeg` columns plus `photoPath` (on `PlaceDTO`) and `polyline` (on `LegDTO`). The tests below construct DTO fixtures directly; helpers and components type their inputs against these DTOs (declared once in B2.1).

**PlanMap prop seam (locked — B3 must match):**
```ts
PlanMap({
  bucket: 'days' | 'saved',
  dayGroups: Array<{ date: string | null; dayNumber: number | null; colorIndex: number; places: PlaceDTO[] }>,
  legs: LegDTO[],            // already for the active day-mode
  mode: TravelMode,
  visibleDates: Set<string>, // which day groups are shown
  onToggleDate: (date: string) => void,
  onSelectPlace: (placeId: string) => void,
  onOpenDayRoute: (date: string) => void,
  online: boolean,
})
```

**Conventions (match the repo):**
- Tests: Vitest + RTL + `@testing-library/user-event`; jsdom; `globals: true`; alias `@` → repo root. Components are wrapped in `<NextIntlClientProvider locale="en" messages={en}>`.
- No `typecheck` npm script exists — typecheck with `npx tsc --noEmit`.
- Commit per task with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.
- Offline = `!navigator.onLine` (plus the `online`/`offline` events). Cached reads always render; every mutation control is disabled offline, and `recomputeDayLegsAction` is online-only.
- ONE `PlanClient`, ONE `TodayHero`, ONE `landingDate`. The next-stop pointer is transient (resets on reload), recomputed via a `useEffect` keyed on a stable stop-id signature — **no setState-in-render, no persistence, no schema field.**

---

### Task B2.1: Plan DTO types + pure planView helpers (bucket/saved/dayColor/pinLabel)

**Files:**
- Create `src/lib/planView.ts`
- Create `src/lib/planView.test.ts`

Declare the client-facing DTO shapes (`PlaceDTO`, `LegDTO`) that the B1 read handler returns, and the pure data-prep the Plan UI needs (no React, no fetch, no Google): bucket a flat `PlaceDTO[]` into per-day ordered lists + the Saved bucket, assign each day a stable color index from the palette, and expose the pin label (`orderIndex + 1`).

- [ ] **Step 1: Write the failing test.**

```ts
// src/lib/planView.test.ts
import { describe, it, expect } from 'vitest';
import {
  bucketByDay,
  savedPlaces,
  placesForDay,
  dayColor,
  colorIndexForDay,
  pinLabel,
  DAY_COLORS,
  type PlaceDTO,
} from '@/src/lib/planView';

function place(over: Partial<PlaceDTO> = {}): PlaceDTO {
  return {
    id: 'p1',
    tripId: 't1',
    dayDate: '2026-05-03',
    googlePlaceId: null,
    name: 'Senso-ji',
    address: 'Asakusa',
    lat: 35.71,
    lng: 139.79,
    category: 'sightseeing',
    scheduledTime: null,
    durationMin: null,
    cost: null,
    notes: null,
    orderIndex: 0,
    photoPath: null,
    ...over,
  };
}

describe('planView helpers', () => {
  it('placesForDay returns only that day, sorted by orderIndex', () => {
    const places = [
      place({ id: 'b', dayDate: '2026-05-03', orderIndex: 1 }),
      place({ id: 'a', dayDate: '2026-05-03', orderIndex: 0 }),
      place({ id: 'c', dayDate: '2026-05-04', orderIndex: 0 }),
      place({ id: 's', dayDate: null, orderIndex: 0 }),
    ];
    expect(placesForDay(places, '2026-05-03').map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('savedPlaces returns only dayDate=null rows, sorted by orderIndex', () => {
    const places = [
      place({ id: 's2', dayDate: null, orderIndex: 1 }),
      place({ id: 's1', dayDate: null, orderIndex: 0 }),
      place({ id: 'd', dayDate: '2026-05-03', orderIndex: 0 }),
    ];
    expect(savedPlaces(places).map((p) => p.id)).toEqual(['s1', 's2']);
  });

  it('bucketByDay groups by dayDate and excludes saved', () => {
    const places = [
      place({ id: 'a', dayDate: '2026-05-03', orderIndex: 0 }),
      place({ id: 'b', dayDate: '2026-05-04', orderIndex: 0 }),
      place({ id: 's', dayDate: null, orderIndex: 0 }),
    ];
    const buckets = bucketByDay(places);
    expect(Object.keys(buckets).sort()).toEqual(['2026-05-03', '2026-05-04']);
    expect(buckets['2026-05-03']!.map((p) => p.id)).toEqual(['a']);
  });

  it('pinLabel is orderIndex + 1', () => {
    expect(pinLabel(place({ orderIndex: 0 }))).toBe(1);
    expect(pinLabel(place({ orderIndex: 4 }))).toBe(5);
  });

  it('colorIndexForDay clamps/cycles, never out of range', () => {
    expect(colorIndexForDay(0)).toBe(0);
    expect(colorIndexForDay(1)).toBe(1);
    expect(colorIndexForDay(DAY_COLORS.length)).toBe(0); // wraps
    expect(colorIndexForDay(-3)).toBe(0); // clamps
  });

  it('dayColor is stable per day index and cycles through the palette', () => {
    expect(dayColor(0)).toBe(DAY_COLORS[0]);
    expect(dayColor(1)).toBe(DAY_COLORS[1]);
    expect(dayColor(DAY_COLORS.length)).toBe(DAY_COLORS[0]);
    expect(dayColor(-3)).toBe(DAY_COLORS[0]);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**
  `npx vitest run src/lib/planView.test.ts`
  Expect: FAIL (module `@/src/lib/planView` does not exist).

- [ ] **Step 3: Minimal implementation.**

```ts
// src/lib/planView.ts
/**
 * Plan-tab DTO shapes + pure data-prep (spec §3.3–§3.5). No React, no fetch,
 * no Google. The Plan UI client-fetches `{ places, legs }` from
 * `GET /api/trips/[tripId]/places`; these helpers bucket the flat `PlaceDTO[]`
 * by day / Saved, keep each bucket ordered by `orderIndex`, and assign stable
 * per-day color indexes + pin labels (`orderIndex + 1`).
 */
import type { TravelMode } from '@/src/lib/googleMapsUrl';

/**
 * One place as returned by the B1 read handler. Structural superset of the
 * relevant `places` columns plus `photoPath` (the cached Google card photo, or
 * null → fall back to the category glyph).
 */
export interface PlaceDTO {
  id: string;
  tripId: string;
  dayDate: string | null; // null = Saved bucket
  googlePlaceId: string | null;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  category: 'sightseeing' | 'lodging' | 'transport' | 'activity' | 'other';
  scheduledTime: string | null; // HH:MM
  durationMin: number | null;
  cost: number | null; // minor units
  notes: string | null;
  orderIndex: number; // 0-based; pin label = orderIndex + 1
  photoPath: string | null; // place_details_cache.photoLocalPath, else null
}

/** One cached travel leg as returned by the B1 read handler. */
export interface LegDTO {
  fromPlaceId: string;
  toPlaceId: string;
  mode: TravelMode;
  durationSeconds: number;
  distanceMeters: number;
  polyline: string | null;
}

/**
 * Per-day pin/route colors (spec §3.4). Drawn from the Sunset Wanderer palette
 * (tailwind.config.ts) and cycled by day index so day 1 = Coral, day 2 = Teal…
 */
export const DAY_COLORS = [
  '#EE5B3C', // coral
  '#4F8A86', // teal
  '#F2C879', // sun
  '#D94E30', // coral-press
  '#3E8E6E', // success/green
  '#6E5544', // ink
] as const;

export type DayColor = (typeof DAY_COLORS)[number];

const byOrder = (a: PlaceDTO, b: PlaceDTO) => a.orderIndex - b.orderIndex;

/** Stable palette index for a 0-based day index; clamps/cycles, never NaN. */
export function colorIndexForDay(dayIndex: number): number {
  if (!Number.isFinite(dayIndex) || dayIndex < 0) return 0;
  return Math.floor(dayIndex) % DAY_COLORS.length;
}

/** Stable color for a 0-based day index; clamps/cycles, never undefined. */
export function dayColor(dayIndex: number): DayColor {
  return DAY_COLORS[colorIndexForDay(dayIndex)]!;
}

/** Displayed pin number for a place (spec §5.8: `orderIndex + 1`). */
export function pinLabel(place: PlaceDTO): number {
  return place.orderIndex + 1;
}

/** All places on a given dayDate, ordered by orderIndex. */
export function placesForDay(places: PlaceDTO[], dayDate: string): PlaceDTO[] {
  return places.filter((p) => p.dayDate === dayDate).sort(byOrder);
}

/** The Saved bucket (dayDate = null), ordered by orderIndex. */
export function savedPlaces(places: PlaceDTO[]): PlaceDTO[] {
  return places.filter((p) => p.dayDate === null).sort(byOrder);
}

/** Map of dayDate → ordered places. Saved (null) rows are excluded. */
export function bucketByDay(places: PlaceDTO[]): Record<string, PlaceDTO[]> {
  const out: Record<string, PlaceDTO[]> = {};
  for (const p of places) {
    if (p.dayDate === null) continue;
    (out[p.dayDate] ??= []).push(p);
  }
  for (const date of Object.keys(out)) out[date]!.sort(byOrder);
  return out;
}
```

- [ ] **Step 4: Run it, expect PASS.**
  `npx vitest run src/lib/planView.test.ts`
  Expect: 6 passed.

- [ ] **Step 5: Commit.**
  ```
  git add src/lib/planView.ts src/lib/planView.test.ts
  git commit -m "$(printf 'feat(plan): plan DTO types + pure planView helpers\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
  ```

---

### Task B2.2: Pure legView helpers — leg lookup, leg formatting, next-stop selection

**Files:**
- Create `src/lib/legView.ts`
- Create `src/lib/legView.test.ts`

Pure helpers for: indexing `LegDTO[]` by `(fromId, toId, mode)` for O(1) lookup between consecutive stops; formatting a leg as `"🚶 12 min · 0.9 km"` (canonical `—` when absent); and the transient Today next-stop default rule (§3.6: first stop whose `scheduledTime` is strictly in the future, else stop 0, -1 for empty). Clock is injected (`nowHHMM` string) so tests are deterministic.

- [ ] **Step 1: Write the failing test.**

```ts
// src/lib/legView.test.ts
import { describe, it, expect } from 'vitest';
import type { LegDTO, PlaceDTO } from '@/src/lib/planView';
import {
  indexLegs,
  legBetween,
  formatLeg,
  nextStopIndex,
  LEG_PLACEHOLDER,
  type LegLookup,
} from '@/src/lib/legView';

function leg(over: Partial<LegDTO> = {}): LegDTO {
  return {
    fromPlaceId: 'a',
    toPlaceId: 'b',
    mode: 'walk',
    durationSeconds: 720,
    distanceMeters: 900,
    polyline: null,
    ...over,
  };
}

function place(over: Partial<PlaceDTO> = {}): PlaceDTO {
  return {
    id: 'a', tripId: 't1', dayDate: '2026-05-03', googlePlaceId: null,
    name: 'Stop', address: null, lat: 0, lng: 0, category: 'sightseeing',
    scheduledTime: null, durationMin: null, cost: null, notes: null,
    orderIndex: 0, photoPath: null, ...over,
  };
}

describe('legView helpers', () => {
  it('legBetween finds a cached leg by (from,to,mode) and misses otherwise', () => {
    const lookup: LegLookup = indexLegs([leg({ fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk' })]);
    expect(legBetween(lookup, 'a', 'b', 'walk')?.durationSeconds).toBe(720);
    expect(legBetween(lookup, 'a', 'b', 'drive')).toBeUndefined();
    expect(legBetween(lookup, 'b', 'a', 'walk')).toBeUndefined();
  });

  it('formatLeg renders mode glyph + minutes + km', () => {
    expect(formatLeg(leg({ mode: 'walk', durationSeconds: 720, distanceMeters: 900 }))).toBe(
      '🚶 12 min · 0.9 km',
    );
    expect(formatLeg(leg({ mode: 'drive', durationSeconds: 305, distanceMeters: 4200 }))).toBe(
      '🚗 5 min · 4.2 km',
    );
    expect(formatLeg(leg({ mode: 'transit', durationSeconds: 60, distanceMeters: 150 }))).toBe(
      '🚆 1 min · 0.2 km',
    );
  });

  it('formatLeg clamps sub-minute durations to a 1 min floor', () => {
    expect(formatLeg(leg({ mode: 'walk', durationSeconds: 20, distanceMeters: 150 }))).toBe(
      '🚶 1 min · 0.2 km',
    );
  });

  it('formatLeg returns the canonical placeholder for an absent leg', () => {
    expect(formatLeg(undefined)).toBe(LEG_PLACEHOLDER);
    expect(LEG_PLACEHOLDER).toBe('—');
  });

  it('nextStopIndex picks the first strictly-future scheduled stop', () => {
    const stops = [
      place({ id: 'a', orderIndex: 0, scheduledTime: '09:00' }),
      place({ id: 'b', orderIndex: 1, scheduledTime: '13:00' }),
      place({ id: 'c', orderIndex: 2, scheduledTime: '18:00' }),
    ];
    expect(nextStopIndex(stops, '11:30')).toBe(1);
  });

  it('nextStopIndex treats a stop scheduled exactly now as past', () => {
    const stops = [
      place({ id: 'a', orderIndex: 0, scheduledTime: '09:30' }),
      place({ id: 'b', orderIndex: 1, scheduledTime: '11:00' }),
    ];
    expect(nextStopIndex(stops, '09:30')).toBe(1);
  });

  it('nextStopIndex falls back to stop 0 when no stop has a future time', () => {
    const stops = [
      place({ id: 'a', orderIndex: 0, scheduledTime: '09:00' }),
      place({ id: 'b', orderIndex: 1, scheduledTime: null }),
    ];
    expect(nextStopIndex(stops, '23:00')).toBe(0);
  });

  it('nextStopIndex defaults to stop 0 when no stop has a time', () => {
    const stops = [place({ id: 'a', orderIndex: 0 }), place({ id: 'b', orderIndex: 1 })];
    expect(nextStopIndex(stops, '10:00')).toBe(0);
  });

  it('nextStopIndex returns -1 for an empty day', () => {
    expect(nextStopIndex([], '10:00')).toBe(-1);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**
  `npx vitest run src/lib/legView.test.ts`
  Expect: FAIL (module not found).

- [ ] **Step 3: Minimal implementation.**

```ts
// src/lib/legView.ts
/**
 * Pure data-prep for per-leg travel chips (spec §3.4) and the Today next-stop
 * pointer (spec §3.6). No React, no fetch, no Google — the Plan UI passes in the
 * `LegDTO[]` it fetched and a wall-clock "HH:MM" string. Stops are assumed
 * already ordered by `orderIndex`.
 */
import type { LegDTO, PlaceDTO } from '@/src/lib/planView';
import type { TravelMode } from '@/src/lib/googleMapsUrl';

/** O(1) cached-leg lookup keyed by `${fromId}|${toId}|${mode}`. */
export type LegLookup = Map<string, LegDTO>;

const MODE_GLYPH: Record<TravelMode, string> = {
  walk: '🚶',
  drive: '🚗',
  transit: '🚆',
};

/** Canonical placeholder for an uncomputed/unavailable leg (spec §3.4). */
export const LEG_PLACEHOLDER = '—';

function key(fromId: string, toId: string, mode: string): string {
  return `${fromId}|${toId}|${mode}`;
}

/** Build a lookup map from a flat list of cached legs. */
export function indexLegs(legs: LegDTO[]): LegLookup {
  const map: LegLookup = new Map();
  for (const l of legs) map.set(key(l.fromPlaceId, l.toPlaceId, l.mode), l);
  return map;
}

/** Cached leg for an ordered pair + mode, or undefined on a miss. */
export function legBetween(
  lookup: LegLookup,
  fromId: string,
  toId: string,
  mode: TravelMode,
): LegDTO | undefined {
  return lookup.get(key(fromId, toId, mode));
}

/** "🚶 12 min · 0.9 km" for a leg, or the canonical `—` when absent. */
export function formatLeg(leg: LegDTO | undefined): string {
  if (!leg) return LEG_PLACEHOLDER;
  const minutes = Math.max(1, Math.round(leg.durationSeconds / 60));
  const km = (leg.distanceMeters / 1000).toFixed(1);
  return `${MODE_GLYPH[leg.mode]} ${minutes} min · ${km} km`;
}

/**
 * Transient next-stop selection (spec §3.6): the first stop (in order) whose
 * `scheduledTime` is strictly after `nowHHMM`; if none, stop 0; -1 if empty.
 */
export function nextStopIndex(orderedStops: readonly PlaceDTO[], nowHHMM: string): number {
  if (orderedStops.length === 0) return -1;
  const idx = orderedStops.findIndex((s) => s.scheduledTime !== null && s.scheduledTime > nowHHMM);
  return idx === -1 ? 0 : idx;
}
```

- [ ] **Step 4: Run it, expect PASS.**
  `npx vitest run src/lib/legView.test.ts`
  Expect: 9 passed.

- [ ] **Step 5: Commit.**
  ```
  git add src/lib/legView.ts src/lib/legView.test.ts
  git commit -m "$(printf 'feat(plan): pure legView helpers (leg lookup/format/next-stop)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
  ```

---

### Task B2.3: Pure planUrl helpers — URL state, thumbnail/glyph, PlanMap day-group seam

**Files:**
- Create `src/lib/planUrl.ts`
- Create `src/lib/planUrl.test.ts`

Pure helpers for (a) the `?view=list|map&bucket=days|saved&date=YYYY-MM-DD` URL contract (parse with defaults + clamp the date into the trip range, falling back to the landing date; build a query string for `router.replace`); (b) the canonical Place-card thumbnail precedence (§5.8: cached Google photo → category glyph), where the photo is served via the B1 photos handler `GET /api/photos/[id]/card`; and (c) `buildDayGroups`, the pure transform that produces the exact `dayGroups` array PlanClient passes to `PlanMap` (the locked B3 seam).

- [ ] **Step 1: Write the failing test.**

```ts
// src/lib/planUrl.test.ts
import { describe, it, expect } from 'vitest';
import type { DerivedDay } from '@/src/lib/days';
import type { PlaceDTO } from '@/src/lib/planView';
import {
  parsePlanParams,
  buildPlanQuery,
  categoryGlyph,
  thumbForPlace,
  cardPhotoUrl,
  buildDayGroups,
  type PlanParams,
} from '@/src/lib/planUrl';

const range = { startDate: '2026-05-03', endDate: '2026-05-05' };

function place(over: Partial<PlaceDTO> = {}): PlaceDTO {
  return {
    id: 'p1', tripId: 't1', dayDate: '2026-05-03', googlePlaceId: null,
    name: 'A', address: null, lat: 0, lng: 0, category: 'sightseeing',
    scheduledTime: null, durationMin: null, cost: null, notes: null,
    orderIndex: 0, photoPath: null, ...over,
  };
}

describe('planUrl URL state', () => {
  it('applies defaults when params are missing', () => {
    const p = parsePlanParams(new URLSearchParams(''), range, '2026-05-03');
    expect(p).toEqual<PlanParams>({ view: 'list', bucket: 'days', date: '2026-05-03' });
  });

  it('falls back the date to the landing date when out of range', () => {
    const p = parsePlanParams(
      new URLSearchParams('view=map&bucket=saved&date=2026-12-31'),
      range,
      '2026-05-04',
    );
    expect(p).toEqual<PlanParams>({ view: 'map', bucket: 'saved', date: '2026-05-04' });
  });

  it('keeps an in-range date and clamps unknown enum values to defaults', () => {
    const p = parsePlanParams(
      new URLSearchParams('view=grid&bucket=other&date=2026-05-04'),
      range,
      '2026-05-03',
    );
    expect(p).toEqual<PlanParams>({ view: 'list', bucket: 'days', date: '2026-05-04' });
  });

  it('serializes a full param set deterministically', () => {
    expect(buildPlanQuery({ view: 'map', bucket: 'days', date: '2026-05-04' })).toBe(
      'view=map&bucket=days&date=2026-05-04',
    );
  });
});

describe('planUrl thumbnails', () => {
  it('categoryGlyph maps each enum to a glyph', () => {
    expect(categoryGlyph('sightseeing')).toBe('🏛️');
    expect(categoryGlyph('lodging')).toBe('🛏️');
    expect(categoryGlyph('transport')).toBe('🚆');
    expect(categoryGlyph('activity')).toBe('🎟️');
    expect(categoryGlyph('other')).toBe('📍');
  });

  it('cardPhotoUrl points at the B1 photos handler card variant', () => {
    expect(cardPhotoUrl('p9')).toBe('/api/photos/p9/card');
  });

  it('thumbForPlace prefers the cached photo (served via the photos handler), else the glyph', () => {
    expect(thumbForPlace(place({ id: 'p9', category: 'sightseeing', photoPath: '/x/y.webp' }))).toEqual({
      kind: 'photo',
      src: '/api/photos/p9/card',
    });
    expect(thumbForPlace(place({ category: 'lodging', photoPath: null }))).toEqual({
      kind: 'glyph',
      glyph: '🛏️',
    });
  });
});

describe('buildDayGroups (PlanMap seam)', () => {
  const days: DerivedDay[] = [
    { date: '2026-05-03', dayNumber: 1, weekday: 'Sunday', isToday: false },
    { date: '2026-05-04', dayNumber: 2, weekday: 'Monday', isToday: false },
  ];
  const places = [
    place({ id: 'a', dayDate: '2026-05-03', orderIndex: 0 }),
    place({ id: 'b', dayDate: '2026-05-03', orderIndex: 1 }),
    place({ id: 'c', dayDate: '2026-05-04', orderIndex: 0 }),
    place({ id: 's', dayDate: null, orderIndex: 0 }),
  ];

  it('days bucket → one group per trip day, ordered, with colorIndex + dayNumber', () => {
    const groups = buildDayGroups('days', days, places);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ date: '2026-05-03', dayNumber: 1, colorIndex: 0 });
    expect(groups[0]!.places.map((p) => p.id)).toEqual(['a', 'b']);
    expect(groups[1]).toMatchObject({ date: '2026-05-04', dayNumber: 2, colorIndex: 1 });
    expect(groups[1]!.places.map((p) => p.id)).toEqual(['c']);
  });

  it('saved bucket → a single group with null date/dayNumber and colorIndex 0', () => {
    const groups = buildDayGroups('saved', days, places);
    expect(groups).toEqual([
      { date: null, dayNumber: null, colorIndex: 0, places: [places[3]] },
    ]);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**
  `npx vitest run src/lib/planUrl.test.ts`
  Expect: FAIL (module not found).

- [ ] **Step 3: Minimal implementation.**

```ts
// src/lib/planUrl.ts
/**
 * Pure helpers for the Plan tab URL contract (spec §2.2/§3.3:
 * `?view=list|map&bucket=days|saved&date=YYYY-MM-DD`), the canonical Place-card
 * thumbnail precedence (spec §5.8), and the `dayGroups` transform PlanClient
 * feeds to PlanMap (the locked B3 seam). No React, no Next router — the Plan UI
 * parses `useSearchParams()` through `parsePlanParams` and feeds `buildPlanQuery`
 * to `router.replace`. Personal photo uploads are Plan 2, so thumbnail
 * precedence is cached-Google-photo → category glyph.
 */
import type { DerivedDay } from '@/src/lib/days';
import { colorIndexForDay, placesForDay, savedPlaces, type PlaceDTO } from '@/src/lib/planView';

export type PlanView = 'list' | 'map';
export type PlanBucket = 'days' | 'saved';

export interface PlanParams {
  view: PlanView;
  bucket: PlanBucket;
  date: string; // YYYY-MM-DD, always within [startDate, endDate]
}

type Category = PlaceDTO['category'];

const CATEGORY_GLYPH: Record<Category, string> = {
  sightseeing: '🏛️',
  lodging: '🛏️',
  transport: '🚆',
  activity: '🎟️',
  other: '📍',
};

/** Category glyph for a place (placeholder thumbnail + meta-row icon). */
export function categoryGlyph(category: Category): string {
  return CATEGORY_GLYPH[category];
}

/**
 * Parse the Plan search params: defaults (list/days), clamp `date` into the trip
 * range, falling back to `landingDate` when missing/out-of-range. Unknown enum
 * values fall back to their defaults so a hand-edited URL never breaks the view.
 */
export function parsePlanParams(
  params: URLSearchParams,
  range: { startDate: string; endDate: string },
  landingDate: string,
): PlanParams {
  const view: PlanView = params.get('view') === 'map' ? 'map' : 'list';
  const bucket: PlanBucket = params.get('bucket') === 'saved' ? 'saved' : 'days';
  const raw = params.get('date');
  const date = raw && raw >= range.startDate && raw <= range.endDate ? raw : landingDate;
  return { view, bucket, date };
}

/** Serialize Plan params to a query string for `router.replace`. */
export function buildPlanQuery(p: PlanParams): string {
  return new URLSearchParams({ view: p.view, bucket: p.bucket, date: p.date }).toString();
}

/** URL for a place's cached Google card photo (B1 photos handler). */
export function cardPhotoUrl(placeId: string): string {
  return `/api/photos/${placeId}/card`;
}

export type Thumb = { kind: 'photo'; src: string } | { kind: 'glyph'; glyph: string };

/**
 * Canonical Place-card thumbnail (spec §5.8). A cached Google photo (`photoPath`
 * present) is served by id via the photos handler; otherwise the category glyph.
 */
export function thumbForPlace(place: Pick<PlaceDTO, 'id' | 'category' | 'photoPath'>): Thumb {
  if (place.photoPath) return { kind: 'photo', src: cardPhotoUrl(place.id) };
  return { kind: 'glyph', glyph: categoryGlyph(place.category) };
}

/** One PlanMap day group (locked B3 seam shape). */
export interface DayGroup {
  date: string | null;
  dayNumber: number | null;
  colorIndex: number;
  places: PlaceDTO[];
}

/**
 * Build the `dayGroups` array PlanClient passes to PlanMap. `days` bucket → one
 * group per trip day (ordered places, palette colorIndex by day index). `saved`
 * bucket → a single group with null date/dayNumber and colorIndex 0.
 */
export function buildDayGroups(
  bucket: PlanBucket,
  days: DerivedDay[],
  places: PlaceDTO[],
): DayGroup[] {
  if (bucket === 'saved') {
    return [{ date: null, dayNumber: null, colorIndex: 0, places: savedPlaces(places) }];
  }
  return days.map((d, i) => ({
    date: d.date,
    dayNumber: d.dayNumber,
    colorIndex: colorIndexForDay(i),
    places: placesForDay(places, d.date),
  }));
}
```

- [ ] **Step 4: Run it, expect PASS.**
  `npx vitest run src/lib/planUrl.test.ts`
  Expect: 9 passed.

- [ ] **Step 5: Commit.**
  ```
  git add src/lib/planUrl.ts src/lib/planUrl.test.ts
  git commit -m "$(printf 'feat(plan): pure planUrl helpers (URL state, thumbnail/glyph, dayGroups seam)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
  ```

---

### Task B2.4: `landingDate` helper (the single copy, reuses `tripStatus`)

**Files:**
- Create `src/lib/landingDate.ts`
- Create `src/lib/landingDate.test.ts`

The ONE landing-date helper (spec §2/§3.8), reused by both PlanClient and TripShellClient: active trip → today (container TZ); upcoming/past → `startDate` (an explicit Day 1 keeps the cached URL stable). It **reuses** `tripStatus` from `days.ts` rather than reimplementing status; `todayInTz` is a tiny private copy that mirrors the exact `Intl.DateTimeFormat('en-CA', …)` call in `days.ts` so the two never diverge. Pure (reads the system clock via `Intl`); tests freeze time.

> Per RESOLUTIONS there is exactly one `landingDate` — here, in `src/lib/landingDate.ts`. Do **not** add a copy to `planView.ts` or `planUrl.ts`.

- [ ] **Step 1: Write the failing test.**

```ts
// src/lib/landingDate.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { landingDate } from '@/src/lib/landingDate';

function freezeUtc(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}
afterEach(() => vi.useRealTimers());

const trip = (startDate: string, endDate: string) => ({ startDate, endDate });

describe('landingDate', () => {
  it('returns today when the trip is active (today within range)', () => {
    freezeUtc('2026-06-05T10:00:00Z');
    expect(landingDate(trip('2026-06-03', '2026-06-08'), 'UTC')).toBe('2026-06-05');
  });

  it('returns the start date for an upcoming trip', () => {
    freezeUtc('2026-06-01T10:00:00Z');
    expect(landingDate(trip('2026-06-03', '2026-06-08'), 'UTC')).toBe('2026-06-03');
  });

  it('returns the start date for a past trip (stable Day 1 URL)', () => {
    freezeUtc('2026-07-01T10:00:00Z');
    expect(landingDate(trip('2026-06-03', '2026-06-08'), 'UTC')).toBe('2026-06-03');
  });

  it('returns today on the inclusive start boundary', () => {
    freezeUtc('2026-06-03T00:00:00Z');
    expect(landingDate(trip('2026-06-03', '2026-06-08'), 'UTC')).toBe('2026-06-03');
  });

  it('returns today on the inclusive end boundary', () => {
    freezeUtc('2026-06-08T23:59:00Z');
    expect(landingDate(trip('2026-06-03', '2026-06-08'), 'UTC')).toBe('2026-06-08');
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**
  `npx vitest run src/lib/landingDate.test.ts`
  Expect: FAIL (module not found).

- [ ] **Step 3: Minimal implementation.**

```ts
// src/lib/landingDate.ts
/**
 * The single Plan/Days landing date (spec §2 / §3.8). Active trip → today
 * (container TZ); upcoming/past → the start date (explicit Day 1 keeps the
 * cached URL stable; never a bare /plan). Reuses `tripStatus` from days.ts so
 * status logic lives in one place; `todayInTz` mirrors days.ts's exact Intl call
 * so results never diverge. Pure: reads the system clock; tests freeze time.
 */
import { tripStatus, type TripDates } from '@/src/lib/days';

function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function landingDate(trip: TripDates, tz: string): string {
  return tripStatus(trip, tz) === 'active' ? todayInTz(tz) : trip.startDate;
}
```

- [ ] **Step 4: Run it, expect PASS.**
  `npx vitest run src/lib/landingDate.test.ts`
  Expect: 5 passed.

- [ ] **Step 5: Commit.**
  ```
  git add src/lib/landingDate.ts src/lib/landingDate.test.ts
  git commit -m "$(printf 'feat(plan): single landingDate helper (reuses tripStatus)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
  ```

---

### Task B2.5: i18n strings for the Plan tab (one `plan` namespace, Today merged in)

**Files:**
- Modify `messages/en.json`
- Create `src/lib/planMessages.test.ts`

Add every visible Plan string under a single `plan` namespace (Today/“Up next”/Skip strings merged in here — there is no separate `today` namespace) plus a `placeCategory` namespace. A focused test pins the keys so the component tests can rely on `en.plan.*` and a missing key fails CI. English only (zh deferred).

- [ ] **Step 1: Write the failing test.**

```ts
// src/lib/planMessages.test.ts
import { describe, it, expect } from 'vitest';
import en from '@/messages/en.json';

describe('en.plan messages', () => {
  it('contains every key the Plan UI references', () => {
    const keys = [
      'listTab', 'mapTab', 'daysTab', 'savedTab',
      'dayChip', 'todayDot', 'travelModeWalk', 'travelModeDrive', 'travelModeTransit',
      'legNeedsConnection', 'openInGoogleMaps', 'openDayRoute',
      'addPlace', 'addFromSaved', 'addToDay', 'moveToSaved', 'moveToDay', 'delete',
      'emptyDayHeadline', 'emptyDaySubtext', 'emptySavedHeadline', 'emptySavedSubtext',
      'searchPlaceholder', 'dropPinTab', 'searchSubTab', 'longPressHint', 'confirm', 'cancel',
      'nameLabel', 'addressLabel', 'categoryLabel', 'timeLabel', 'costLabel', 'notesLabel', 'save',
      'mapNeedsConnectionHeadline', 'mapNeedsConnectionSubtext',
      'upNext', 'noTimeSet', 'skip', 'dayPickerTitle', 'recompute',
      'loading', 'errorHeadline', 'errorSubtext', 'reorderHint',
    ];
    for (const k of keys) {
      expect(en.plan, `missing plan.${k}`).toHaveProperty(k);
      expect(typeof (en.plan as Record<string, string>)[k]).toBe('string');
    }
  });

  it('contains the place category labels', () => {
    for (const c of ['sightseeing', 'lodging', 'transport', 'activity', 'other']) {
      expect(en.placeCategory, `missing placeCategory.${c}`).toHaveProperty(c);
    }
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**
  `npx vitest run src/lib/planMessages.test.ts`
  Expect: FAIL (`en.plan` undefined).

- [ ] **Step 3: Add the strings.** In `messages/en.json`, insert two top-level keys after the `"comingSoon"` block (keep `comingSoon.plan` for the other tabs). Add:

```json
  "plan": {
    "listTab": "List",
    "mapTab": "Map",
    "daysTab": "Days",
    "savedTab": "Saved",
    "dayChip": "Day {n} · {weekday} {date}",
    "todayDot": "Today",
    "travelModeWalk": "Walk",
    "travelModeDrive": "Drive",
    "travelModeTransit": "Transit",
    "legNeedsConnection": "needs connection",
    "openInGoogleMaps": "Open in Google Maps",
    "openDayRoute": "Open day route in Google Maps",
    "addPlace": "Add place",
    "addFromSaved": "Add from Saved",
    "addToDay": "Add to day",
    "moveToSaved": "Move to Saved",
    "moveToDay": "Move to another day",
    "delete": "Delete",
    "emptyDayHeadline": "Nothing planned for {dayLabel} yet",
    "emptyDaySubtext": "Add your first stop, or pull one in from Saved.",
    "emptySavedHeadline": "No saved spots yet",
    "emptySavedSubtext": "Stash places you might want — promote them to a day later.",
    "searchPlaceholder": "Search for a place",
    "dropPinTab": "Drop a pin",
    "searchSubTab": "Search",
    "longPressHint": "Long-press the map to drop a pin.",
    "confirm": "Confirm",
    "cancel": "Cancel",
    "nameLabel": "Name",
    "addressLabel": "Address",
    "categoryLabel": "Category",
    "timeLabel": "Time",
    "costLabel": "Cost",
    "notesLabel": "Notes",
    "save": "Save",
    "mapNeedsConnectionHeadline": "The map needs a connection",
    "mapNeedsConnectionSubtext": "Your saved plan still works offline. Open in Google Maps to navigate.",
    "upNext": "Up next",
    "noTimeSet": "No time set",
    "skip": "Skip",
    "dayPickerTitle": "Add to which day?",
    "recompute": "Recompute travel times",
    "loading": "Loading your plan…",
    "errorHeadline": "Couldn't load this plan",
    "errorSubtext": "Connect to the internet and try again.",
    "reorderHint": "Drag to reorder"
  },
  "placeCategory": {
    "sightseeing": "Sightseeing",
    "lodging": "Lodging",
    "transport": "Transport",
    "activity": "Activity",
    "other": "Other"
  },
```

- [ ] **Step 4: Run it, expect PASS.**
  `npx vitest run src/lib/planMessages.test.ts`
  Expect: 2 passed. Confirm the JSON still parses + imports:
  `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); console.log('ok')"` → `ok`; `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit.**
  ```
  git add messages/en.json src/lib/planMessages.test.ts
  git commit -m "$(printf 'feat(plan): i18n strings for Plan tab incl. Today (en)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
  ```

---

### Task B2.6: PlaceCard component (numbered pin, category, meta row, thumbnail, swipe actions)

**Files:**
- Create `components/plan/PlaceCard.tsx`
- Create `components/plan/PlaceCard.test.tsx`

A presentational card for one `PlaceDTO` in a Days bucket: numbered pin (`pinLabel`, day color), name (Ink bold), category glyph + label, address (muted), optional meta row (`scheduledTime`, duration minutes, cost via `formatMoney`), thumbnail (`thumbForPlace` → cached Google card photo or glyph), and a swipe-actions row (Move to Saved / Move to day / Delete) disabled when `disabled` (offline). All callbacks injected; no fetch, no Google.

- [ ] **Step 1: Write the failing test.**

```tsx
// components/plan/PlaceCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { PlaceDTO } from '@/src/lib/planView';
import { PlaceCard } from './PlaceCard';

function place(over: Partial<PlaceDTO> = {}): PlaceDTO {
  return {
    id: 'p1', tripId: 't1', dayDate: '2026-05-03', googlePlaceId: 'g1',
    name: 'Senso-ji', address: 'Asakusa, Tokyo', lat: 35.71, lng: 139.79,
    category: 'sightseeing', scheduledTime: '09:30', durationMin: 90, cost: 1500,
    notes: null, orderIndex: 0, photoPath: null, ...over,
  };
}

function renderCard(props: Partial<React.ComponentProps<typeof PlaceCard>> = {}) {
  const onTap = vi.fn();
  const onMoveToSaved = vi.fn();
  const onMoveToDay = vi.fn();
  const onDelete = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PlaceCard
        place={place()}
        pinNumber={1}
        pinColor="#EE5B3C"
        currency="JPY"
        locale="en"
        disabled={false}
        onTap={onTap}
        onMoveToSaved={onMoveToSaved}
        onMoveToDay={onMoveToDay}
        onDelete={onDelete}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onTap, onMoveToSaved, onMoveToDay, onDelete };
}

describe('PlaceCard', () => {
  it('renders the pin number, name, address, and meta row', () => {
    renderCard();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Senso-ji')).toBeInTheDocument();
    expect(screen.getByText(/Asakusa, Tokyo/)).toBeInTheDocument();
    expect(screen.getByText('09:30')).toBeInTheDocument();
    expect(screen.getByText('90 min')).toBeInTheDocument();
    expect(screen.getByText('¥1,500')).toBeInTheDocument();
  });

  it('shows the cached Google card photo via the photos handler when photoPath is set', () => {
    renderCard({ place: place({ id: 'p9', photoPath: '/whatever/x.webp' }) });
    const img = screen.getByRole('img', { name: 'Senso-ji' });
    expect(img).toHaveAttribute('src', '/api/photos/p9/card');
  });

  it('invokes onTap when the card body is clicked', async () => {
    const { onTap } = renderCard();
    await userEvent.click(screen.getByText('Senso-ji'));
    expect(onTap).toHaveBeenCalledWith('p1');
  });

  it('fires the swipe actions', async () => {
    const { onMoveToSaved, onMoveToDay, onDelete } = renderCard();
    await userEvent.click(screen.getByRole('button', { name: en.plan.moveToSaved }));
    await userEvent.click(screen.getByRole('button', { name: en.plan.moveToDay }));
    await userEvent.click(screen.getByRole('button', { name: en.plan.delete }));
    expect(onMoveToSaved).toHaveBeenCalledWith('p1');
    expect(onMoveToDay).toHaveBeenCalledWith('p1');
    expect(onDelete).toHaveBeenCalledWith('p1');
  });

  it('disables the swipe-action buttons when disabled (offline)', () => {
    renderCard({ disabled: true });
    expect(screen.getByRole('button', { name: en.plan.moveToSaved })).toBeDisabled();
    expect(screen.getByRole('button', { name: en.plan.delete })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**
  `npx vitest run components/plan/PlaceCard.test.tsx`
  Expect: FAIL (component not found).

- [ ] **Step 3: Minimal implementation.**

```tsx
// components/plan/PlaceCard.tsx
'use client';

import { useTranslations } from 'next-intl';
import type { PlaceDTO } from '@/src/lib/planView';
import { formatMoney } from '@/src/lib/currency';
import { categoryGlyph, thumbForPlace } from '@/src/lib/planUrl';

type PlaceCardProps = {
  place: PlaceDTO;
  pinNumber: number;
  pinColor: string;
  currency: string;
  locale: string;
  /** Offline → swipe actions disabled (mutations are online-only). */
  disabled: boolean;
  onTap: (placeId: string) => void;
  onMoveToSaved: (placeId: string) => void;
  onMoveToDay: (placeId: string) => void;
  onDelete: (placeId: string) => void;
};

export function PlaceCard({
  place,
  pinNumber,
  pinColor,
  currency,
  locale,
  disabled,
  onTap,
  onMoveToSaved,
  onMoveToDay,
  onDelete,
}: PlaceCardProps) {
  const t = useTranslations('plan');
  const tCat = useTranslations('placeCategory');
  const thumb = thumbForPlace(place);
  const hasMeta =
    place.scheduledTime != null || place.durationMin != null || place.cost != null;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-chip text-caption font-bold text-white"
          style={{ backgroundColor: pinColor }}
        >
          {pinNumber}
        </span>
        <span className="mt-1 w-px flex-1 bg-line" aria-hidden="true" />
      </div>

      <div className="mb-3 flex-1 rounded-card bg-card p-3 shadow-card">
        <button
          type="button"
          onClick={() => onTap(place.id)}
          className="flex w-full items-start gap-3 text-left"
        >
          {thumb.kind === 'photo' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb.src}
              alt={place.name}
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-control object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-control bg-paper text-2xl"
            >
              {thumb.glyph}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1">
              <span aria-hidden="true">{categoryGlyph(place.category)}</span>
              <span className="truncate text-body font-bold text-ink">{place.name}</span>
            </span>
            <span className="block truncate text-caption text-ink-muted">
              {tCat(place.category)}
              {place.address ? ` · ${place.address}` : ''}
            </span>
            {hasMeta ? (
              <span className="mt-1 flex flex-wrap gap-2 text-caption text-ink-muted [font-variant-numeric:tabular-nums]">
                {place.scheduledTime ? <span>{place.scheduledTime}</span> : null}
                {place.durationMin != null ? <span>{place.durationMin} min</span> : null}
                {place.cost != null ? <span>{formatMoney(place.cost, currency, locale)}</span> : null}
              </span>
            ) : null}
          </span>
        </button>

        <div className="mt-2 flex gap-2 border-t border-line pt-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onMoveToSaved(place.id)}
            className="text-caption font-medium text-teal disabled:opacity-40"
          >
            {t('moveToSaved')}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onMoveToDay(place.id)}
            className="text-caption font-medium text-teal disabled:opacity-40"
          >
            {t('moveToDay')}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onDelete(place.id)}
            className="text-caption font-medium text-danger disabled:opacity-40"
          >
            {t('delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run it, expect PASS.**
  `npx vitest run components/plan/PlaceCard.test.tsx`
  Expect: 5 passed.

- [ ] **Step 5: Commit.**
  ```
  git add components/plan/PlaceCard.tsx components/plan/PlaceCard.test.tsx
  git commit -m "$(printf 'feat(plan): PlaceCard (numbered pin, meta, thumbnail, swipe actions)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
  ```

---

### Task B2.7: LegConnector + DayModeControl components

**Files:**
- Create `components/plan/LegConnector.tsx`
- Create `components/plan/DayModeControl.tsx`
- Create `components/plan/LegConnector.test.tsx`
- Create `components/plan/DayModeControl.test.tsx`

`LegConnector` renders the per-leg travel chip via `formatLeg` and, when the leg is absent, appends the "needs connection" caption. `DayModeControl` is the per-day walk/drive/transit segmented control; it surfaces the online-only "Recompute" affordance and is disabled offline.

- [ ] **Step 1: Write the failing tests.**

```tsx
// components/plan/LegConnector.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { LegDTO } from '@/src/lib/planView';
import { LegConnector } from './LegConnector';

function leg(over: Partial<LegDTO> = {}): LegDTO {
  return {
    fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk',
    durationSeconds: 720, distanceMeters: 900, polyline: null, ...over,
  };
}

function renderLeg(l: LegDTO | undefined) {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <LegConnector leg={l} />
    </NextIntlClientProvider>,
  );
}

describe('LegConnector', () => {
  it('renders the formatted cached leg without the offline caption', () => {
    renderLeg(leg());
    expect(screen.getByText('🚶 12 min · 0.9 km')).toBeInTheDocument();
    expect(screen.queryByText(en.plan.legNeedsConnection)).not.toBeInTheDocument();
  });

  it('renders the placeholder and caption when the leg is absent', () => {
    renderLeg(undefined);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText(en.plan.legNeedsConnection)).toBeInTheDocument();
  });
});
```

```tsx
// components/plan/DayModeControl.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import { DayModeControl } from './DayModeControl';

function renderControl(props: Partial<React.ComponentProps<typeof DayModeControl>> = {}) {
  const onChange = vi.fn();
  const onRecompute = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DayModeControl mode="walk" disabled={false} onChange={onChange} onRecompute={onRecompute} {...props} />
    </NextIntlClientProvider>,
  );
  return { onChange, onRecompute };
}

describe('DayModeControl', () => {
  it('marks the current mode as pressed', () => {
    renderControl({ mode: 'drive' });
    expect(screen.getByRole('button', { name: en.plan.travelModeDrive })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: en.plan.travelModeWalk })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the chosen mode', async () => {
    const { onChange } = renderControl();
    await userEvent.click(screen.getByRole('button', { name: en.plan.travelModeTransit }));
    expect(onChange).toHaveBeenCalledWith('transit');
  });

  it('disables mode buttons and hides recompute when offline', () => {
    renderControl({ disabled: true });
    expect(screen.getByRole('button', { name: en.plan.travelModeWalk })).toBeDisabled();
    expect(screen.queryByRole('button', { name: en.plan.recompute })).not.toBeInTheDocument();
  });

  it('fires onRecompute online', async () => {
    const { onRecompute } = renderControl();
    await userEvent.click(screen.getByRole('button', { name: en.plan.recompute }));
    expect(onRecompute).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run them, expect FAIL.**
  `npx vitest run components/plan/LegConnector.test.tsx components/plan/DayModeControl.test.tsx`
  Expect: FAIL (components not found).

- [ ] **Step 3: Minimal implementations.**

```tsx
// components/plan/LegConnector.tsx
'use client';

import { useTranslations } from 'next-intl';
import type { LegDTO } from '@/src/lib/planView';
import { formatLeg } from '@/src/lib/legView';

/** Slim leg connector between two Place cards (spec §3.4). */
export function LegConnector({ leg }: { leg: LegDTO | undefined }) {
  const t = useTranslations('plan');
  return (
    <div className="-mt-2 mb-1 flex items-center gap-2 pl-[1.625rem] text-caption text-ink-muted">
      <span className="[font-variant-numeric:tabular-nums]">{formatLeg(leg)}</span>
      {leg ? null : <span className="text-ink-faint">{t('legNeedsConnection')}</span>}
    </div>
  );
}
```

```tsx
// components/plan/DayModeControl.tsx
'use client';

import { useTranslations } from 'next-intl';
import type { TravelMode } from '@/src/lib/googleMapsUrl';

const MODES: TravelMode[] = ['walk', 'drive', 'transit'];
const LABEL_KEY: Record<TravelMode, 'travelModeWalk' | 'travelModeDrive' | 'travelModeTransit'> = {
  walk: 'travelModeWalk',
  drive: 'travelModeDrive',
  transit: 'travelModeTransit',
};

type DayModeControlProps = {
  mode: TravelMode;
  /** Offline → mode switching + recompute disabled/hidden. */
  disabled: boolean;
  onChange: (mode: TravelMode) => void;
  onRecompute: () => void;
};

export function DayModeControl({ mode, disabled, onChange, onRecompute }: DayModeControlProps) {
  const t = useTranslations('plan');
  return (
    <div className="flex items-center justify-between gap-2">
      <div role="group" className="flex rounded-control bg-card p-0.5 shadow-inset">
        {MODES.map((m) => {
          const active = m === mode;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onChange(m)}
              className={`rounded-control px-3 py-1.5 text-caption font-medium disabled:opacity-40 ${
                active ? 'bg-coral text-white' : 'text-ink-muted'
              }`}
            >
              {t(LABEL_KEY[m])}
            </button>
          );
        })}
      </div>
      {disabled ? null : (
        <button type="button" onClick={onRecompute} className="text-caption font-medium text-teal">
          {t('recompute')}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run them, expect PASS.**
  `npx vitest run components/plan/LegConnector.test.tsx components/plan/DayModeControl.test.tsx`
  Expect: 2 passed + 4 passed.

- [ ] **Step 5: Commit.**
  ```
  git add components/plan/LegConnector.tsx components/plan/DayModeControl.tsx components/plan/LegConnector.test.tsx components/plan/DayModeControl.test.tsx
  git commit -m "$(printf 'feat(plan): LegConnector + DayModeControl components\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
  ```

---

### Task B2.8: DayStrip component (swipeable day chips, today dot)

**Files:**
- Create `components/plan/DayStrip.tsx`
- Create `components/plan/DayStrip.test.tsx`

A horizontal, horizontally-scrollable (swipeable) strip of day chips built from `DerivedDay[]` (from `deriveDays`). Selected chip is Coral; today's chip carries a Sun dot. Tapping a chip calls `onSelect(date)`. Pure props in.

- [ ] **Step 1: Write the failing test.**

```tsx
// components/plan/DayStrip.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { DerivedDay } from '@/src/lib/days';
import { DayStrip } from './DayStrip';

const days: DerivedDay[] = [
  { date: '2026-05-03', dayNumber: 1, weekday: 'Sunday', isToday: false },
  { date: '2026-05-04', dayNumber: 2, weekday: 'Monday', isToday: true },
  { date: '2026-05-05', dayNumber: 3, weekday: 'Tuesday', isToday: false },
];

function renderStrip(selectedDate = '2026-05-04') {
  const onSelect = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DayStrip days={days} selectedDate={selectedDate} onSelect={onSelect} />
    </NextIntlClientProvider>,
  );
  return { onSelect };
}

describe('DayStrip', () => {
  it('renders a chip per day with the day number', () => {
    renderStrip();
    expect(screen.getByRole('button', { name: /Day 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Day 2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Day 3/ })).toBeInTheDocument();
  });

  it('marks the selected chip as current', () => {
    renderStrip('2026-05-05');
    expect(screen.getByRole('button', { name: /Day 3/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /Day 1/ })).not.toHaveAttribute('aria-current');
  });

  it('shows a today dot on the active day', () => {
    renderStrip();
    expect(screen.getByLabelText(en.plan.todayDot)).toBeInTheDocument();
  });

  it('calls onSelect with the chip date', async () => {
    const { onSelect } = renderStrip();
    await userEvent.click(screen.getByRole('button', { name: /Day 3/ }));
    expect(onSelect).toHaveBeenCalledWith('2026-05-05');
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**
  `npx vitest run components/plan/DayStrip.test.tsx`
  Expect: FAIL (component not found).

- [ ] **Step 3: Minimal implementation.**

```tsx
// components/plan/DayStrip.tsx
'use client';

import { useTranslations } from 'next-intl';
import type { DerivedDay } from '@/src/lib/days';

type DayStripProps = {
  days: DerivedDay[];
  selectedDate: string;
  onSelect: (date: string) => void;
};

/** Short "May 3" label from a YYYY-MM-DD string (UTC-stable). */
function shortDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateStr}T00:00:00Z`));
}

export function DayStrip({ days, selectedDate, onSelect }: DayStripProps) {
  const t = useTranslations('plan');
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {days.map((d) => {
        const active = d.date === selectedDate;
        return (
          <button
            key={d.date}
            type="button"
            aria-current={active ? 'true' : undefined}
            onClick={() => onSelect(d.date)}
            className={`relative flex shrink-0 items-center gap-1 rounded-chip px-3 py-1.5 text-caption font-medium ${
              active ? 'bg-coral text-white' : 'bg-card text-ink-muted shadow-card'
            }`}
          >
            {d.isToday ? (
              <span aria-label={t('todayDot')} className="h-1.5 w-1.5 rounded-full bg-sun" />
            ) : null}
            <span>
              {t('dayChip', {
                n: d.dayNumber,
                weekday: d.weekday.slice(0, 3),
                date: shortDate(d.date),
              })}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run it, expect PASS.**
  `npx vitest run components/plan/DayStrip.test.tsx`
  Expect: 4 passed.

- [ ] **Step 5: Commit.**
  ```
  git add components/plan/DayStrip.tsx components/plan/DayStrip.test.tsx
  git commit -m "$(printf 'feat(plan): DayStrip (day chips, selected state, today dot)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
  ```

---

### Task B2.9: AddPlaceSheet component (Autocomplete search + map-drop, mocked Google)

**Files:**
- Create `components/plan/AddPlaceSheet.tsx`
- Create `components/plan/AddPlaceSheet.test.tsx`

The add-place bottom sheet with two sub-tabs: **Search** (Places Autocomplete via the B0 `usePlacesAutocomplete()` wrapper → Place Details proxy → autofill → `addPlaceAction`) and **Drop a pin** (mini-map long-press → `reverseGeocode` proxy → `addPlaceAction` with `googlePlaceId=null`). The B0 wrappers and the actions module are mocked. The sheet writes to the target bucket (`dayDate` set for Days, `null` for Saved) and is fully disabled offline.

Assumes from B0: `usePlacesAutocomplete()` → `{ query, setQuery, predictions: { placeId, description }[], selectPrediction(placeId) }` where `selectPrediction` resolves the details proxy and returns `{ name, address, lat, lng, category, googlePlaceId }`; and `reverseGeocode(lat, lng) → { address }`. Assumes from B1: `addPlaceAction(input): Promise<PlaceDTO>` with `input = { tripId, dayDate, name, address, lat, lng, category, googlePlaceId, scheduledTime?, notes? }`.

- [ ] **Step 1: Write the failing test.**

```tsx
// components/plan/AddPlaceSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

const addPlaceAction = vi.fn(async () => ({ id: 'p-new' }));
vi.mock('@/app/_actions/places', () => ({
  addPlaceAction: (...a: unknown[]) => addPlaceAction(...a),
  updatePlaceAction: vi.fn(),
  deletePlaceAction: vi.fn(),
  reorderDayAction: vi.fn(),
  promoteToDayAction: vi.fn(),
  moveToSavedAction: vi.fn(),
  recomputeDayLegsAction: vi.fn(),
}));

const selectPrediction = vi.fn(async () => ({
  name: 'Senso-ji', address: 'Asakusa, Tokyo', lat: 35.71, lng: 139.79,
  googlePlaceId: 'g1', category: 'sightseeing' as const,
}));
const setQuery = vi.fn();
vi.mock('@/components/plan/useGooglePlaces', () => ({
  usePlacesAutocomplete: () => ({
    query: 'sen',
    setQuery,
    predictions: [{ placeId: 'g1', description: 'Senso-ji, Asakusa' }],
    selectPrediction,
  }),
}));

const reverseGeocode = vi.fn(async () => ({ address: '1 Chome, Asakusa' }));
vi.mock('@/components/plan/googleClient', () => ({
  reverseGeocode: (...a: unknown[]) => reverseGeocode(...a),
}));

import { AddPlaceSheet } from './AddPlaceSheet';

function renderSheet(props: Partial<React.ComponentProps<typeof AddPlaceSheet>> = {}) {
  const onClose = vi.fn();
  const onAdded = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AddPlaceSheet
        open
        tripId="t1"
        dayDate="2026-05-03"
        disabled={false}
        onClose={onClose}
        onAdded={onAdded}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onClose, onAdded };
}

beforeEach(() => {
  addPlaceAction.mockClear();
  selectPrediction.mockClear();
  reverseGeocode.mockClear();
});

describe('AddPlaceSheet', () => {
  it('adds a place from an Autocomplete selection with the day bucket', async () => {
    const { onAdded, onClose } = renderSheet();
    await userEvent.click(screen.getByText('Senso-ji, Asakusa'));
    await waitFor(() => expect(addPlaceAction).toHaveBeenCalled());
    expect(addPlaceAction).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: 't1', dayDate: '2026-05-03', name: 'Senso-ji',
        googlePlaceId: 'g1', category: 'sightseeing',
      }),
    );
    expect(onAdded).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('saves a Saved-bucket place when dayDate is null', async () => {
    renderSheet({ dayDate: null });
    await userEvent.click(screen.getByText('Senso-ji, Asakusa'));
    await waitFor(() =>
      expect(addPlaceAction).toHaveBeenCalledWith(expect.objectContaining({ dayDate: null })),
    );
  });

  it('drops a pin → reverse-geocode → add with googlePlaceId null', async () => {
    renderSheet();
    await userEvent.click(screen.getByRole('tab', { name: en.plan.dropPinTab }));
    await userEvent.click(screen.getByTestId('map-drop-target'));
    await waitFor(() => expect(reverseGeocode).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: en.plan.confirm }));
    await waitFor(() =>
      expect(addPlaceAction).toHaveBeenCalledWith(
        expect.objectContaining({
          tripId: 't1', dayDate: '2026-05-03', googlePlaceId: null, address: '1 Chome, Asakusa',
        }),
      ),
    );
  });

  it('disables search input + drop target when offline', () => {
    renderSheet({ disabled: true });
    expect(screen.getByPlaceholderText(en.plan.searchPlaceholder)).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**
  `npx vitest run components/plan/AddPlaceSheet.test.tsx`
  Expect: FAIL (component not found).

- [ ] **Step 3: Minimal implementation.**

```tsx
// components/plan/AddPlaceSheet.tsx
'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { PlaceDTO } from '@/src/lib/planView';
import { addPlaceAction } from '@/app/_actions/places';
import { usePlacesAutocomplete } from '@/components/plan/useGooglePlaces';
import { reverseGeocode } from '@/components/plan/googleClient';

type SubTab = 'search' | 'drop';
type Dropped = { lat: number; lng: number; address: string | null };

type AddPlaceSheetProps = {
  open: boolean;
  tripId: string;
  /** Target bucket: a day date for Days, or null for the Saved bucket. */
  dayDate: string | null;
  disabled: boolean;
  onClose: () => void;
  onAdded: (place: PlaceDTO) => void;
};

export function AddPlaceSheet({
  open,
  tripId,
  dayDate,
  disabled,
  onClose,
  onAdded,
}: AddPlaceSheetProps) {
  const t = useTranslations('plan');
  const [tab, setTab] = useState<SubTab>('search');
  const [dropped, setDropped] = useState<Dropped | null>(null);
  const [dropName, setDropName] = useState('');
  const [isPending, startTransition] = useTransition();
  const { query, setQuery, predictions, selectPrediction } = usePlacesAutocomplete();

  if (!open) return null;

  function commit(payload: Parameters<typeof addPlaceAction>[0]) {
    startTransition(async () => {
      const place = await addPlaceAction(payload);
      onAdded(place);
      onClose();
    });
  }

  async function handlePrediction(placeId: string) {
    const filled = await selectPrediction(placeId);
    commit({
      tripId,
      dayDate,
      name: filled.name,
      address: filled.address,
      lat: filled.lat,
      lng: filled.lng,
      category: filled.category,
      googlePlaceId: filled.googlePlaceId,
    });
  }

  async function handleDrop(lat: number, lng: number) {
    const { address } = await reverseGeocode(lat, lng);
    setDropped({ lat, lng, address });
  }

  function confirmDrop() {
    if (!dropped) return;
    commit({
      tripId,
      dayDate,
      name: dropName.trim() || (dropped.address ?? 'Dropped pin'),
      address: dropped.address,
      lat: dropped.lat,
      lng: dropped.lng,
      category: 'other',
      googlePlaceId: null,
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('addPlace')}
      className="fixed inset-0 z-50 flex items-end bg-[rgb(110_85_68_/_0.45)]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-card p-6 shadow-lift"
      >
        <div role="tablist" className="mb-4 flex rounded-control bg-paper p-0.5 shadow-inset">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'search'}
            onClick={() => setTab('search')}
            className={`flex-1 rounded-control py-1.5 text-label font-medium ${
              tab === 'search' ? 'bg-coral text-white' : 'text-ink-muted'
            }`}
          >
            {t('searchSubTab')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'drop'}
            onClick={() => setTab('drop')}
            className={`flex-1 rounded-control py-1.5 text-label font-medium ${
              tab === 'drop' ? 'bg-coral text-white' : 'text-ink-muted'
            }`}
          >
            {t('dropPinTab')}
          </button>
        </div>

        {tab === 'search' ? (
          <div>
            <input
              type="text"
              value={query}
              disabled={disabled}
              placeholder={t('searchPlaceholder')}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
            />
            <ul className="mt-2 flex flex-col">
              {predictions.map((p) => (
                <li key={p.placeId}>
                  <button
                    type="button"
                    disabled={disabled || isPending}
                    onClick={() => void handlePrediction(p.placeId)}
                    className="w-full rounded-control px-2 py-2 text-left text-body text-ink hover:bg-paper disabled:opacity-40"
                  >
                    {p.description}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div>
            <p className="mb-2 text-caption text-ink-muted">{t('longPressHint')}</p>
            {/* B3's mini Google map mounts here; the drop callback is the contract.
                The test affordance simulates a long-press drop. */}
            <button
              type="button"
              data-testid="map-drop-target"
              disabled={disabled}
              onClick={() => void handleDrop(35.71, 139.79)}
              className="flex h-48 w-full items-center justify-center rounded-card bg-paper text-caption text-ink-muted shadow-inset disabled:opacity-40"
            >
              {t('longPressHint')}
            </button>
            {dropped ? (
              <div className="mt-3">
                <label className="block text-label font-medium text-ink" htmlFor="drop-name">
                  {t('nameLabel')}
                </label>
                <input
                  id="drop-name"
                  type="text"
                  value={dropName}
                  onChange={(e) => setDropName(e.target.value)}
                  className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink"
                />
                <p className="mt-1 text-caption text-ink-muted">{dropped.address}</p>
                <button
                  type="button"
                  disabled={disabled || isPending}
                  onClick={confirmDrop}
                  className="mt-3 w-full rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
                >
                  {t('confirm')}
                </button>
              </div>
            ) : null}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run it, expect PASS.**
  `npx vitest run components/plan/AddPlaceSheet.test.tsx`
  Expect: 4 passed.

- [ ] **Step 5: Commit.**
  ```
  git add components/plan/AddPlaceSheet.tsx components/plan/AddPlaceSheet.test.tsx
  git commit -m "$(printf 'feat(plan): AddPlaceSheet (Autocomplete search + map-drop)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
  ```

---

### Task B2.10: PlaceDetailSheet component (editable fields + Open in Google Maps)

**Files:**
- Create `components/plan/PlaceDetailSheet.tsx`
- Create `components/plan/PlaceDetailSheet.test.tsx`

An editable detail sheet for one `PlaceDTO`: name, address, category, scheduled time, cost, notes → `updatePlaceAction`; plus an "Open in Google Maps" anchor built from `placeUrl` (offline, no API call). Fields + Save are disabled offline; the Open-in-Maps link is always enabled.

Assumes `updatePlaceAction(id, patch): Promise<PlaceDTO>` from `app/_actions/places.ts`.

- [ ] **Step 1: Write the failing test.**

```tsx
// components/plan/PlaceDetailSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { PlaceDTO } from '@/src/lib/planView';

const updatePlaceAction = vi.fn(async () => ({ id: 'p1' }));
vi.mock('@/app/_actions/places', () => ({
  addPlaceAction: vi.fn(),
  updatePlaceAction: (...a: unknown[]) => updatePlaceAction(...a),
  deletePlaceAction: vi.fn(),
  reorderDayAction: vi.fn(),
  promoteToDayAction: vi.fn(),
  moveToSavedAction: vi.fn(),
  recomputeDayLegsAction: vi.fn(),
}));

import { PlaceDetailSheet } from './PlaceDetailSheet';

function place(over: Partial<PlaceDTO> = {}): PlaceDTO {
  return {
    id: 'p1', tripId: 't1', dayDate: '2026-05-03', googlePlaceId: 'g1',
    name: 'Senso-ji', address: 'Asakusa', lat: 35.71, lng: 139.79,
    category: 'sightseeing', scheduledTime: '09:30', durationMin: 90, cost: 1500,
    notes: 'Bring cash', orderIndex: 0, photoPath: null, ...over,
  };
}

function renderSheet(props: Partial<React.ComponentProps<typeof PlaceDetailSheet>> = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PlaceDetailSheet
        open
        place={place()}
        currency="JPY"
        locale="en"
        disabled={false}
        onClose={onClose}
        onSaved={onSaved}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onClose, onSaved };
}

beforeEach(() => updatePlaceAction.mockClear());

describe('PlaceDetailSheet', () => {
  it('renders an Open in Google Maps link with a query_place_id deep link', () => {
    renderSheet();
    const link = screen.getByRole('link', { name: en.plan.openInGoogleMaps });
    expect(link).toHaveAttribute('href', expect.stringContaining('query_place_id=g1'));
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('falls back to coordinates for map-drop pins (no googlePlaceId)', () => {
    renderSheet({ place: place({ googlePlaceId: null }) });
    const link = screen.getByRole('link', { name: en.plan.openInGoogleMaps });
    expect(link).toHaveAttribute('href', expect.stringContaining('query=35.71%2C139.79'));
  });

  it('saves edited fields via updatePlaceAction', async () => {
    const { onSaved } = renderSheet();
    const name = screen.getByLabelText(en.plan.nameLabel);
    await userEvent.clear(name);
    await userEvent.type(name, 'Senso-ji Temple');
    await userEvent.click(screen.getByRole('button', { name: en.plan.save }));
    await waitFor(() => expect(updatePlaceAction).toHaveBeenCalled());
    expect(updatePlaceAction).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Senso-ji Temple' }));
    expect(onSaved).toHaveBeenCalled();
  });

  it('disables editable fields + Save when offline but keeps Open in Maps enabled', () => {
    renderSheet({ disabled: true });
    expect(screen.getByLabelText(en.plan.nameLabel)).toBeDisabled();
    expect(screen.getByRole('button', { name: en.plan.save })).toBeDisabled();
    expect(screen.getByRole('link', { name: en.plan.openInGoogleMaps })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**
  `npx vitest run components/plan/PlaceDetailSheet.test.tsx`
  Expect: FAIL (component not found).

- [ ] **Step 3: Minimal implementation.**

```tsx
// components/plan/PlaceDetailSheet.tsx
'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { PlaceDTO } from '@/src/lib/planView';
import { placeUrl } from '@/src/lib/googleMapsUrl';
import { currencyExponent } from '@/src/lib/currency';
import { updatePlaceAction } from '@/app/_actions/places';

const CATEGORIES: PlaceDTO['category'][] = [
  'sightseeing', 'lodging', 'transport', 'activity', 'other',
];

type PlaceDetailSheetProps = {
  open: boolean;
  place: PlaceDTO;
  currency: string;
  locale: string;
  disabled: boolean;
  onClose: () => void;
  onSaved: (place: PlaceDTO) => void;
};

export function PlaceDetailSheet({
  open,
  place,
  currency,
  disabled,
  onClose,
  onSaved,
}: PlaceDetailSheetProps) {
  const t = useTranslations('plan');
  const tCat = useTranslations('placeCategory');
  const exponent = currencyExponent(currency);
  const [name, setName] = useState(place.name);
  const [address, setAddress] = useState(place.address ?? '');
  const [category, setCategory] = useState<PlaceDTO['category']>(place.category);
  const [time, setTime] = useState(place.scheduledTime ?? '');
  const [costMajor, setCostMajor] = useState(
    place.cost != null ? String(place.cost / 10 ** exponent) : '',
  );
  const [notes, setNotes] = useState(place.notes ?? '');
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  const mapsHref = placeUrl({
    name: place.name,
    lat: place.lat ?? 0,
    lng: place.lng ?? 0,
    googlePlaceId: place.googlePlaceId,
  });

  function handleSave() {
    const costMinor =
      costMajor.trim() === '' ? null : Math.round(Number(costMajor) * 10 ** exponent);
    startTransition(async () => {
      const updated = await updatePlaceAction(place.id, {
        name: name.trim(),
        address: address.trim() || null,
        category,
        scheduledTime: time || null,
        cost: costMinor != null && Number.isFinite(costMinor) ? costMinor : null,
        notes: notes.trim() || null,
      });
      onSaved(updated);
      onClose();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={place.name}
      className="fixed inset-0 z-50 flex items-end bg-[rgb(110_85_68_/_0.45)]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-card p-6 shadow-lift"
      >
        <label className="block text-label font-medium text-ink" htmlFor="pd-name">{t('nameLabel')}</label>
        <input
          id="pd-name" type="text" value={name} disabled={disabled}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="pd-address">{t('addressLabel')}</label>
        <input
          id="pd-address" type="text" value={address} disabled={disabled}
          onChange={(e) => setAddress(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="pd-category">{t('categoryLabel')}</label>
        <select
          id="pd-category" value={category} disabled={disabled}
          onChange={(e) => setCategory(e.target.value as PlaceDTO['category'])}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{tCat(c)}</option>
          ))}
        </select>

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="pd-time">{t('timeLabel')}</label>
        <input
          id="pd-time" type="time" value={time} disabled={disabled}
          onChange={(e) => setTime(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="pd-cost">{t('costLabel')}</label>
        <input
          id="pd-cost" type="number" inputMode="decimal" value={costMajor} disabled={disabled}
          onChange={(e) => setCostMajor(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="pd-notes">{t('notesLabel')}</label>
        <textarea
          id="pd-notes" value={notes} disabled={disabled}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />

        <a
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block w-full rounded-control bg-teal px-4 py-3 text-center text-label font-medium text-white shadow-card"
        >
          {t('openInGoogleMaps')}
        </a>

        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={disabled || isPending}
            onClick={handleSave}
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

- [ ] **Step 4: Run it, expect PASS.**
  `npx vitest run components/plan/PlaceDetailSheet.test.tsx`
  Expect: 4 passed.

- [ ] **Step 5: Commit.**
  ```
  git add components/plan/PlaceDetailSheet.tsx components/plan/PlaceDetailSheet.test.tsx
  git commit -m "$(printf 'feat(plan): PlaceDetailSheet (editable fields + Open in Google Maps)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
  ```

---

### Task B2.11: DayItinerary component (ordered cards + interleaved legs + reorder/day-mode/empty state)

**Files:**
- Create `components/plan/DayItinerary.tsx`
- Create `components/plan/DayItinerary.test.tsx`

Composes the ordered `PlaceCard`s with interleaved `LegConnector`s for one day, the `DayModeControl` header, an "Add place" / "Add from Saved" footer, and the empty state (mascot via `EmptyState`) when the day has no stops. Drag-to-reorder uses native HTML5 drag events; the reorder *computation* is a pure helper (`reorderIds`) tested here, and committing calls the injected `onReorder(orderedIds)` (PlanClient rewrites orderIndex + recomputes legs).

- [ ] **Step 1: Write the failing test (pure helper + component).**

```tsx
// components/plan/DayItinerary.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { PlaceDTO, LegDTO } from '@/src/lib/planView';
import { indexLegs } from '@/src/lib/legView';
import { DayItinerary, reorderIds } from './DayItinerary';

function place(over: Partial<PlaceDTO> = {}): PlaceDTO {
  return {
    id: 'a', tripId: 't1', dayDate: '2026-05-03', googlePlaceId: null,
    name: 'A', address: null, lat: 0, lng: 0, category: 'other',
    scheduledTime: null, durationMin: null, cost: null, notes: null,
    orderIndex: 0, photoPath: null, ...over,
  };
}

const walkLeg: LegDTO = {
  fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk',
  durationSeconds: 720, distanceMeters: 900, polyline: null,
};

describe('reorderIds', () => {
  it('moves an id from one index to another, preserving the rest', () => {
    expect(reorderIds(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(reorderIds(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(reorderIds(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
  });
});

function renderDay(props: Partial<React.ComponentProps<typeof DayItinerary>> = {}) {
  const onAddPlace = vi.fn();
  const onAddFromSaved = vi.fn();
  const onReorder = vi.fn();
  const onTapPlace = vi.fn();
  const onMoveToSaved = vi.fn();
  const onMoveToDay = vi.fn();
  const onDelete = vi.fn();
  const onModeChange = vi.fn();
  const onRecompute = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DayItinerary
        dayLabel="Day 1"
        stops={[place({ id: 'a', orderIndex: 0, name: 'A' }), place({ id: 'b', orderIndex: 1, name: 'B' })]}
        legs={indexLegs([walkLeg])}
        mode="walk"
        dayColor="#EE5B3C"
        currency="JPY"
        locale="en"
        disabled={false}
        onAddPlace={onAddPlace}
        onAddFromSaved={onAddFromSaved}
        onReorder={onReorder}
        onTapPlace={onTapPlace}
        onMoveToSaved={onMoveToSaved}
        onMoveToDay={onMoveToDay}
        onDelete={onDelete}
        onModeChange={onModeChange}
        onRecompute={onRecompute}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onAddPlace, onAddFromSaved, onReorder, onModeChange };
}

describe('DayItinerary', () => {
  it('renders ordered cards with the interleaved leg chip', () => {
    renderDay();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('🚶 12 min · 0.9 km')).toBeInTheDocument();
  });

  it('shows the day mode control and forwards a mode change', async () => {
    const { onModeChange } = renderDay();
    await userEvent.click(screen.getByRole('button', { name: en.plan.travelModeDrive }));
    expect(onModeChange).toHaveBeenCalledWith('drive');
  });

  it('forwards Add place / Add from Saved', async () => {
    const { onAddPlace, onAddFromSaved } = renderDay();
    await userEvent.click(screen.getByRole('button', { name: en.plan.addPlace }));
    await userEvent.click(screen.getByRole('button', { name: en.plan.addFromSaved }));
    expect(onAddPlace).toHaveBeenCalled();
    expect(onAddFromSaved).toHaveBeenCalled();
  });

  it('shows the empty state for a day with no stops', () => {
    renderDay({ stops: [], dayLabel: 'Day 3' });
    expect(
      screen.getByText(en.plan.emptyDayHeadline.replace('{dayLabel}', 'Day 3')),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**
  `npx vitest run components/plan/DayItinerary.test.tsx`
  Expect: FAIL (component + `reorderIds` not found).

- [ ] **Step 3: Minimal implementation.**

```tsx
// components/plan/DayItinerary.tsx
'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import type { PlaceDTO } from '@/src/lib/planView';
import type { TravelMode } from '@/src/lib/googleMapsUrl';
import type { LegLookup } from '@/src/lib/legView';
import { legBetween } from '@/src/lib/legView';
import { pinLabel } from '@/src/lib/planView';
import { EmptyState } from '@/components/EmptyState';
import { PlaceCard } from '@/components/plan/PlaceCard';
import { LegConnector } from '@/components/plan/LegConnector';
import { DayModeControl } from '@/components/plan/DayModeControl';

/** Pure reorder: move the item at `from` to `to`, preserving the rest. */
export function reorderIds(ids: string[], from: number, to: number): string[] {
  const next = ids.slice();
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return ids;
  next.splice(to, 0, moved);
  return next;
}

type DayItineraryProps = {
  dayLabel: string;
  stops: PlaceDTO[]; // already ordered by orderIndex
  legs: LegLookup;
  mode: TravelMode;
  dayColor: string;
  currency: string;
  locale: string;
  disabled: boolean;
  onAddPlace: () => void;
  onAddFromSaved: () => void;
  onReorder: (orderedIds: string[]) => void;
  onTapPlace: (placeId: string) => void;
  onMoveToSaved: (placeId: string) => void;
  onMoveToDay: (placeId: string) => void;
  onDelete: (placeId: string) => void;
  onModeChange: (mode: TravelMode) => void;
  onRecompute: () => void;
};

export function DayItinerary({
  dayLabel,
  stops,
  legs,
  mode,
  dayColor,
  currency,
  locale,
  disabled,
  onAddPlace,
  onAddFromSaved,
  onReorder,
  onTapPlace,
  onMoveToSaved,
  onMoveToDay,
  onDelete,
  onModeChange,
  onRecompute,
}: DayItineraryProps) {
  const t = useTranslations('plan');
  const dragFrom = useRef<number | null>(null);

  function handleDrop(toIndex: number) {
    const from = dragFrom.current;
    dragFrom.current = null;
    if (from === null || from === toIndex) return;
    onReorder(reorderIds(stops.map((s) => s.id), from, toIndex));
  }

  return (
    <div>
      <div className="mb-3">
        <DayModeControl mode={mode} disabled={disabled} onChange={onModeChange} onRecompute={onRecompute} />
      </div>

      {stops.length === 0 ? (
        <EmptyState
          mascotAlt={t('addPlace')}
          headline={t('emptyDayHeadline', { dayLabel })}
          subtext={t('emptyDaySubtext')}
          actionLabel={disabled ? undefined : t('addPlace')}
          onAction={disabled ? undefined : onAddPlace}
        />
      ) : (
        <ol>
          {stops.map((stop, i) => {
            const prev = stops[i - 1];
            return (
              <li
                key={stop.id}
                draggable={!disabled}
                onDragStart={() => {
                  dragFrom.current = i;
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(i)}
              >
                {prev ? <LegConnector leg={legBetween(legs, prev.id, stop.id, mode)} /> : null}
                <PlaceCard
                  place={stop}
                  pinNumber={pinLabel(stop)}
                  pinColor={dayColor}
                  currency={currency}
                  locale={locale}
                  disabled={disabled}
                  onTap={onTapPlace}
                  onMoveToSaved={onMoveToSaved}
                  onMoveToDay={onMoveToDay}
                  onDelete={onDelete}
                />
              </li>
            );
          })}
        </ol>
      )}

      {stops.length > 0 ? (
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={onAddPlace}
            className="flex-1 rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
          >
            {t('addPlace')}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onAddFromSaved}
            className="flex-1 rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset disabled:opacity-40"
          >
            {t('addFromSaved')}
          </button>
        </div>
      ) : disabled ? null : (
        <div className="mt-2 text-center">
          <button type="button" onClick={onAddFromSaved} className="text-label font-medium text-teal">
            {t('addFromSaved')}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run it, expect PASS.**
  `npx vitest run components/plan/DayItinerary.test.tsx`
  Expect: reorderIds 1 passed + DayItinerary 4 passed.

- [ ] **Step 5: Commit.**
  ```
  git add components/plan/DayItinerary.tsx components/plan/DayItinerary.test.tsx
  git commit -m "$(printf 'feat(plan): DayItinerary (ordered cards + legs + reorder + empty state)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
  ```

---

### Task B2.12: SavedList component (wishlist cards + one-tap "Add to day" picker → promote)

**Files:**
- Create `components/plan/SavedList.tsx`
- Create `components/plan/SavedList.test.tsx`

The Saved bucket list (no numbered pins, no legs): cards with name/category/address/notes/thumbnail and a Coral "Add to day" button. Tapping it opens a compact day picker (from `DerivedDay[]`); choosing a day calls `onPromote(placeId, date)` (PlanClient wires `promoteToDayAction` + recompute). Empty state via `EmptyState`. Buttons disabled offline.

- [ ] **Step 1: Write the failing test.**

```tsx
// components/plan/SavedList.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { PlaceDTO } from '@/src/lib/planView';
import type { DerivedDay } from '@/src/lib/days';
import { SavedList } from './SavedList';

const days: DerivedDay[] = [
  { date: '2026-05-03', dayNumber: 1, weekday: 'Sunday', isToday: false },
  { date: '2026-05-04', dayNumber: 2, weekday: 'Monday', isToday: true },
];

function place(over: Partial<PlaceDTO> = {}): PlaceDTO {
  return {
    id: 's1', tripId: 't1', dayDate: null, googlePlaceId: 'g1',
    name: 'Backup Cafe', address: 'Shibuya', lat: 0, lng: 0, category: 'other',
    scheduledTime: null, durationMin: null, cost: null, notes: 'maybe',
    orderIndex: 0, photoPath: null, ...over,
  };
}

function renderSaved(props: Partial<React.ComponentProps<typeof SavedList>> = {}) {
  const onPromote = vi.fn();
  const onTapPlace = vi.fn();
  const onAddPlace = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <SavedList
        saved={[place()]}
        days={days}
        disabled={false}
        onPromote={onPromote}
        onTapPlace={onTapPlace}
        onAddPlace={onAddPlace}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onPromote, onTapPlace, onAddPlace };
}

describe('SavedList', () => {
  it('renders saved cards with name and address', () => {
    renderSaved();
    expect(screen.getByText('Backup Cafe')).toBeInTheDocument();
    expect(screen.getByText(/Shibuya/)).toBeInTheDocument();
  });

  it('opens a day picker and promotes to the chosen day', async () => {
    const { onPromote } = renderSaved();
    await userEvent.click(screen.getByRole('button', { name: en.plan.addToDay }));
    expect(screen.getByText(en.plan.dayPickerTitle)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Day 2/ }));
    expect(onPromote).toHaveBeenCalledWith('s1', '2026-05-04');
  });

  it('disables the add-to-day button offline', () => {
    renderSaved({ disabled: true });
    expect(screen.getByRole('button', { name: en.plan.addToDay })).toBeDisabled();
  });

  it('shows the empty state when there are no saved places', () => {
    renderSaved({ saved: [] });
    expect(screen.getByText(en.plan.emptySavedHeadline)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**
  `npx vitest run components/plan/SavedList.test.tsx`
  Expect: FAIL (component not found).

- [ ] **Step 3: Minimal implementation.**

```tsx
// components/plan/SavedList.tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PlaceDTO } from '@/src/lib/planView';
import type { DerivedDay } from '@/src/lib/days';
import { categoryGlyph, thumbForPlace } from '@/src/lib/planUrl';
import { EmptyState } from '@/components/EmptyState';

type SavedListProps = {
  saved: PlaceDTO[];
  days: DerivedDay[];
  disabled: boolean;
  onPromote: (placeId: string, date: string) => void;
  onTapPlace: (placeId: string) => void;
  onAddPlace: () => void;
};

export function SavedList({
  saved,
  days,
  disabled,
  onPromote,
  onTapPlace,
  onAddPlace,
}: SavedListProps) {
  const t = useTranslations('plan');
  const tCat = useTranslations('placeCategory');
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  if (saved.length === 0) {
    return (
      <EmptyState
        mascotAlt={t('addPlace')}
        headline={t('emptySavedHeadline')}
        subtext={t('emptySavedSubtext')}
        actionLabel={disabled ? undefined : t('addPlace')}
        onAction={disabled ? undefined : onAddPlace}
      />
    );
  }

  return (
    <div>
      <ul className="flex flex-col gap-3">
        {saved.map((p) => {
          const thumb = thumbForPlace(p);
          return (
            <li key={p.id} className="rounded-card bg-card p-3 shadow-card">
              <button
                type="button"
                onClick={() => onTapPlace(p.id)}
                className="flex w-full items-start gap-3 text-left"
              >
                {thumb.kind === 'photo' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb.src}
                    alt={p.name}
                    width={56}
                    height={56}
                    className="h-14 w-14 shrink-0 rounded-control object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-control bg-paper text-2xl"
                  >
                    {thumb.glyph}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span aria-hidden="true">{categoryGlyph(p.category)}</span>
                    <span className="truncate text-body font-bold text-ink">{p.name}</span>
                  </span>
                  <span className="block truncate text-caption text-ink-muted">
                    {tCat(p.category)}
                    {p.address ? ` · ${p.address}` : ''}
                  </span>
                  {p.notes ? (
                    <span className="mt-1 block truncate text-caption text-ink-muted">{p.notes}</span>
                  ) : null}
                </span>
              </button>

              <button
                type="button"
                disabled={disabled}
                onClick={() => setPickerFor(p.id)}
                className="mt-2 w-full rounded-control bg-coral px-4 py-2 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
              >
                {t('addToDay')}
              </button>
            </li>
          );
        })}
      </ul>

      {pickerFor ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('dayPickerTitle')}
          className="fixed inset-0 z-50 flex items-end bg-[rgb(110_85_68_/_0.45)]"
          onClick={() => setPickerFor(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[70vh] w-full overflow-y-auto rounded-t-sheet bg-card p-6 shadow-lift"
          >
            <h2 className="mb-3 text-title font-bold text-ink">{t('dayPickerTitle')}</h2>
            <ul className="flex flex-col gap-2">
              {days.map((d) => (
                <li key={d.date}>
                  <button
                    type="button"
                    onClick={() => {
                      onPromote(pickerFor, d.date);
                      setPickerFor(null);
                    }}
                    className="w-full rounded-control bg-paper px-4 py-3 text-left text-body font-medium text-ink shadow-inset"
                  >
                    {`Day ${d.dayNumber} · ${d.weekday.slice(0, 3)}`}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run it, expect PASS.**
  `npx vitest run components/plan/SavedList.test.tsx`
  Expect: 4 passed.

- [ ] **Step 5: Commit.**
  ```
  git add components/plan/SavedList.tsx components/plan/SavedList.test.tsx
  git commit -m "$(printf 'feat(plan): SavedList (wishlist cards + day-picker promote)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
  ```

---

### Task B2.13: TodayHero component (the single copy — next-stop card + transient Skip pointer)

**Files:**
- Create `components/plan/TodayHero.tsx`
- Create `components/plan/TodayHero.test.tsx`

The ONE Coral "Up next" hero (spec §3.6), owned by B2 and mounted by PlanClient atop the itinerary when the trip is active and the selected date is today. It shows the next stop (name, `scheduledTime` or "No time set", category glyph), the cached travel leg into it (from the previous ordered stop, via `legBetween`), a big "Open in Google Maps" link (`placeUrl`), and a transient **Skip** pointer.

Per RESOLUTIONS the pointer is **transient/client-only with no schema field**, and is (re)initialized via a `useEffect` keyed on a **stable stop-id signature** (the join of stop ids). It resets on reload by construction (plain `useState`) and re-derives the default when the day's stop set changes — **no setState during render.** `nowHHMM` (current wall-clock in the trip TZ) is a prop so the test is deterministic; the default index uses `nextStopIndex`. Skip advances by one and clamps at the last stop (the control hides there).

> This single component replaces both draft copies (draftB2's `components/plan/TodayHero.tsx` used a bare `initialIndex` that never reset on data change; draftB4 split it into `NextStopCard`/`useNextStopPointer`/`TodayHero` under `components/` and mutated state during render). Conform to this one.

- [ ] **Step 1: Write the failing test.**

```tsx
// components/plan/TodayHero.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { PlaceDTO, LegDTO } from '@/src/lib/planView';
import { indexLegs } from '@/src/lib/legView';
import { TodayHero } from './TodayHero';

function place(over: Partial<PlaceDTO> = {}): PlaceDTO {
  return {
    id: 'a', tripId: 't1', dayDate: '2026-05-04', googlePlaceId: 'g-a',
    name: 'A', address: null, lat: 1, lng: 2, category: 'sightseeing',
    scheduledTime: '09:00', durationMin: null, cost: null, notes: null,
    orderIndex: 0, photoPath: null, ...over,
  };
}

const walkLeg: LegDTO = {
  fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk',
  durationSeconds: 720, distanceMeters: 900, polyline: null,
};

function renderHero(props: Partial<React.ComponentProps<typeof TodayHero>> = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <TodayHero
        stops={[
          place({ id: 'a', orderIndex: 0, name: 'Stop A', scheduledTime: '09:00', googlePlaceId: 'g-a' }),
          place({ id: 'b', orderIndex: 1, name: 'Stop B', scheduledTime: '13:00', googlePlaceId: 'g-b' }),
        ]}
        legs={indexLegs([walkLeg])}
        mode="walk"
        nowHHMM="08:00"
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

describe('TodayHero', () => {
  it('shows the Up next label and the default next stop with an Open in Maps link', () => {
    // now 08:00 → first future timed stop is Stop A (09:00).
    renderHero();
    expect(screen.getByText(en.plan.upNext)).toBeInTheDocument();
    expect(screen.getByText('Stop A')).toBeInTheDocument();
    expect(screen.getByText('09:00')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: en.plan.openInGoogleMaps });
    expect(link).toHaveAttribute('href', expect.stringContaining('query_place_id=g-a'));
  });

  it('selects the first future-timed stop when an earlier stop is already past', () => {
    // now 11:00 → Stop A (09:00) past, Stop B (13:00) is next.
    renderHero({ nowHHMM: '11:00' });
    expect(screen.getByText('Stop B')).toBeInTheDocument();
    // Stop B is the last stop → no Skip control.
    expect(screen.queryByRole('button', { name: en.plan.skip })).not.toBeInTheDocument();
    // The leg into Stop B is shown.
    expect(screen.getByText('🚶 12 min · 0.9 km')).toBeInTheDocument();
  });

  it('Skip advances the transient pointer and clamps at the last stop', async () => {
    renderHero();
    await userEvent.click(screen.getByRole('button', { name: en.plan.skip }));
    expect(screen.getByText('Stop B')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: en.plan.openInGoogleMaps }),
    ).toHaveAttribute('href', expect.stringContaining('query_place_id=g-b'));
    // Clamped at the last stop → control gone.
    expect(screen.queryByRole('button', { name: en.plan.skip })).not.toBeInTheDocument();
  });

  it('shows "No time set" when the next stop has no scheduledTime', () => {
    renderHero({
      stops: [place({ id: 'a', orderIndex: 0, name: 'Stop A', scheduledTime: null })],
      nowHHMM: '08:00',
    });
    expect(screen.getByText(en.plan.noTimeSet)).toBeInTheDocument();
  });

  it('renders nothing for an empty day', () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <TodayHero stops={[]} legs={indexLegs([])} mode="walk" nowHHMM="08:00" />
      </NextIntlClientProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**
  `npx vitest run components/plan/TodayHero.test.tsx`
  Expect: FAIL (component not found).

- [ ] **Step 3: Minimal implementation.**

```tsx
// components/plan/TodayHero.tsx
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PlaceDTO } from '@/src/lib/planView';
import type { TravelMode } from '@/src/lib/googleMapsUrl';
import { placeUrl } from '@/src/lib/googleMapsUrl';
import type { LegLookup } from '@/src/lib/legView';
import { legBetween, formatLeg, nextStopIndex } from '@/src/lib/legView';
import { categoryGlyph } from '@/src/lib/planUrl';

type TodayHeroProps = {
  stops: PlaceDTO[]; // today's day, ordered by orderIndex
  legs: LegLookup;
  mode: TravelMode;
  /** Current wall-clock "HH:MM" in the trip TZ (PlanClient injects it). */
  nowHHMM: string;
};

/** Stable signature of the day's stop set; the pointer resets when it changes. */
function stopSignature(stops: PlaceDTO[]): string {
  return stops.map((s) => s.id).join('|');
}

export function TodayHero({ stops, legs, mode, nowHHMM }: TodayHeroProps) {
  const t = useTranslations('plan');
  const signature = stopSignature(stops);

  // Transient, client-only pointer (spec §3.6): plain useState (resets on reload),
  // re-seeded to the default via an effect keyed on the stable stop-id signature —
  // never set during render, never persisted, no schema field.
  const [index, setIndex] = useState(() => nextStopIndex(stops, nowHHMM));
  useEffect(() => {
    setIndex(nextStopIndex(stops, nowHHMM));
    // Keyed on the stop set only; recompute on add/reorder/delete, not every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (stops.length === 0 || index < 0 || index >= stops.length) return null;

  const stop = stops[index]!;
  const prev = stops[index - 1];
  const leg = prev ? legBetween(legs, prev.id, stop.id, mode) : undefined;
  const canSkip = index < stops.length - 1;

  const href = placeUrl({
    name: stop.name,
    lat: stop.lat ?? 0,
    lng: stop.lng ?? 0,
    googlePlaceId: stop.googlePlaceId,
  });

  return (
    <section
      aria-label={t('upNext')}
      className="mb-4 rounded-card bg-coral p-4 text-white shadow-lift"
    >
      <p className="text-caption font-semibold uppercase tracking-wide opacity-90">{t('upNext')}</p>
      <div className="mt-1 flex items-center gap-2">
        <span aria-hidden="true" className="text-xl">{categoryGlyph(stop.category)}</span>
        <h2 className="min-w-0 flex-1 truncate text-heading font-bold">{stop.name}</h2>
      </div>
      <div className="mt-1 flex flex-wrap gap-3 text-caption opacity-90 [font-variant-numeric:tabular-nums]">
        <span>{stop.scheduledTime ?? t('noTimeSet')}</span>
        {prev ? <span>{formatLeg(leg)}</span> : null}
      </div>
      <div className="mt-3 flex gap-3">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-control bg-white px-4 py-3 text-center text-label font-bold text-coral shadow-card"
        >
          {t('openInGoogleMaps')}
        </a>
        {canSkip ? (
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(i + 1, stops.length - 1))}
            className="rounded-control bg-coral-press px-4 py-3 text-label font-medium text-white"
          >
            {t('skip')}
          </button>
        ) : null}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run it, expect PASS.**
  `npx vitest run components/plan/TodayHero.test.tsx`
  Expect: 5 passed.

- [ ] **Step 5: Commit.**
  ```
  git add components/plan/TodayHero.tsx components/plan/TodayHero.test.tsx
  git commit -m "$(printf 'feat(plan): single TodayHero (next-stop card + transient Skip via effect)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
  ```

---

### Task B2.14: PlanClient — the single Plan client (fetch, URL state, toggles, mutations, PlanMap seam)

**Files:**
- Create `components/plan/PlanClient.tsx`
- Create `components/plan/PlanClient.test.tsx`

The ONE Plan client (RESOLUTIONS PlanClient contract): `PlanClient({ tripId, tz, currency, locale })`. It client-fetches `/api/trips/[tripId]` (→ `{ trip }`) and `/api/trips/[tripId]/places` (→ `{ places, legs }`), derives the day list client-side via `deriveDays(trip, tz)`, resolves the `landingDate` via the shared helper, parses/writes URL state with `useSearchParams`/`useRouter().replace` through the `planUrl` helpers, and renders the List/Map + Days/Saved toggles, `DayStrip`, `TodayHero`, `DayItinerary` / `SavedList`, the add/detail sheets, and (map view) `<PlanMap …/>`.

**Mutations** route through the B1 actions and re-fetch; on any change to a day's stop set (add / reorder / delete / promote) **and** on a day travel-mode change, it calls `recomputeDayLegsAction(tripId, dayDate, mode)` (online only) then re-fetches. Cached legs render offline; `disabled = !online` gates every mutation control.

**PlanMap is mounted via the exact seam** (B3 consumes it; B2 never implements the map): `bucket`, `dayGroups` (from `buildDayGroups`), `legs` (the fetched `LegDTO[]`, already the active day-mode), `mode`, `visibleDates`, `onToggleDate`, `onSelectPlace`, `onOpenDayRoute` (builds `dayRouteUrl` from the group's ordered coords and opens it), `online`.

- [ ] **Step 1: Write the failing test.**

```tsx
// components/plan/PlanClient.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { PlaceDTO, LegDTO } from '@/src/lib/planView';

const replace = vi.fn();
let search = 'view=list&bucket=days&date=2026-05-03';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/trip/t1/plan',
  useSearchParams: () => new URLSearchParams(search),
}));

const promoteToDayAction = vi.fn(async () => ({ id: 'p' }));
const reorderDayAction = vi.fn(async () => undefined);
const recomputeDayLegsAction = vi.fn(async () => []);
const moveToSavedAction = vi.fn(async () => ({ id: 'p1' }));
const deletePlaceAction = vi.fn(async () => undefined);
vi.mock('@/app/_actions/places', () => ({
  addPlaceAction: vi.fn(async () => ({ id: 'p-new' })),
  updatePlaceAction: vi.fn(async () => ({ id: 'p1' })),
  deletePlaceAction: (...a: unknown[]) => deletePlaceAction(...a),
  reorderDayAction: (...a: unknown[]) => reorderDayAction(...a),
  promoteToDayAction: (...a: unknown[]) => promoteToDayAction(...a),
  moveToSavedAction: (...a: unknown[]) => moveToSavedAction(...a),
  recomputeDayLegsAction: (...a: unknown[]) => recomputeDayLegsAction(...a),
}));

// Stub the Google-dependent sheet + the B3 map so PlanClient is testable
// without the Google loader / the real map internals.
vi.mock('@/components/plan/AddPlaceSheet', () => ({
  AddPlaceSheet: ({ open }: { open: boolean }) => (open ? <div data-testid="add-place-sheet" /> : null),
}));
vi.mock('@/components/plan/PlanMap', () => ({
  PlanMap: (props: Record<string, unknown>) => (
    <div data-testid="plan-map" data-bucket={String(props.bucket)} data-online={String(props.online)} />
  ),
}));

import { PlanClient } from './PlanClient';

const trip = {
  id: 't1', name: 'Tokyo', startDate: '2026-05-03', endDate: '2026-05-05',
  coverPhoto: null,
};
const places: PlaceDTO[] = [
  { id: 'a', tripId: 't1', dayDate: '2026-05-03', googlePlaceId: 'g-a', name: 'Stop A', address: 'X', lat: 1, lng: 2, category: 'sightseeing', scheduledTime: '09:00', durationMin: null, cost: null, notes: null, orderIndex: 0, photoPath: null },
  { id: 'b', tripId: 't1', dayDate: '2026-05-03', googlePlaceId: 'g-b', name: 'Stop B', address: 'Y', lat: 3, lng: 4, category: 'other', scheduledTime: null, durationMin: null, cost: null, notes: null, orderIndex: 1, photoPath: null },
  { id: 's', tripId: 't1', dayDate: null, googlePlaceId: null, name: 'Saved One', address: 'Z', lat: 5, lng: 6, category: 'other', scheduledTime: null, durationMin: null, cost: null, notes: null, orderIndex: 0, photoPath: null },
];
const legs: LegDTO[] = [
  { fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk', durationSeconds: 720, distanceMeters: 900, polyline: null },
];

/** Route fetch by URL: /api/trips/t1 → {trip}; /places → {places,legs}. */
function mockFetch() {
  const f = vi.fn(async (url: string) => {
    if (url.endsWith('/places')) {
      return { ok: true, json: async () => JSON.parse(JSON.stringify({ places, legs })) };
    }
    return { ok: true, json: async () => JSON.parse(JSON.stringify({ trip })) };
  });
  vi.stubGlobal('fetch', f as unknown as typeof fetch);
  return f;
}

function renderPlan() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PlanClient tripId="t1" tz="UTC" currency="JPY" locale="en" />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  search = 'view=list&bucket=days&date=2026-05-03';
  replace.mockClear();
  promoteToDayAction.mockClear();
  reorderDayAction.mockClear();
  recomputeDayLegsAction.mockClear();
  moveToSavedAction.mockClear();
  deletePlaceAction.mockClear();
  vi.stubGlobal('navigator', { onLine: true });
});
afterEach(() => vi.unstubAllGlobals());

describe('PlanClient', () => {
  it('fetches both endpoints and renders the day itinerary', async () => {
    const f = mockFetch();
    renderPlan();
    expect(await screen.findByText('Stop A')).toBeInTheDocument();
    expect(screen.getByText('Stop B')).toBeInTheDocument();
    expect(f).toHaveBeenCalledWith('/api/trips/t1', { credentials: 'same-origin' });
    expect(f).toHaveBeenCalledWith('/api/trips/t1/places', { credentials: 'same-origin' });
  });

  it('switches to the Saved bucket via the toggle, writing URL state', async () => {
    mockFetch();
    renderPlan();
    await screen.findByText('Stop A');
    await userEvent.click(screen.getByRole('button', { name: en.plan.savedTab }));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('bucket=saved'));
  });

  it('switching to Map view writes URL state and mounts the PlanMap seam (online)', async () => {
    mockFetch();
    renderPlan();
    await screen.findByText('Stop A');
    await userEvent.click(screen.getByRole('button', { name: en.plan.mapTab }));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('view=map'));
  });

  it('renders the PlanMap (with online=true) when view=map', async () => {
    search = 'view=map&bucket=days&date=2026-05-03';
    mockFetch();
    renderPlan();
    const map = await screen.findByTestId('plan-map');
    expect(map).toHaveAttribute('data-online', 'true');
    expect(map).toHaveAttribute('data-bucket', 'days');
  });

  it('shows the map offline placeholder when offline + map view', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    search = 'view=map&bucket=days&date=2026-05-03';
    mockFetch();
    renderPlan();
    expect(await screen.findByText(en.plan.mapNeedsConnectionHeadline)).toBeInTheDocument();
    expect(screen.queryByTestId('plan-map')).not.toBeInTheDocument();
  });

  it('promotes a Saved place to a day and recomputes that day legs', async () => {
    search = 'view=list&bucket=saved&date=2026-05-03';
    mockFetch();
    renderPlan();
    await screen.findByText('Saved One');
    await userEvent.click(screen.getByRole('button', { name: en.plan.addToDay }));
    await userEvent.click(screen.getByRole('button', { name: /Day 2/ }));
    await waitFor(() => expect(promoteToDayAction).toHaveBeenCalledWith('s', '2026-05-04'));
    await waitFor(() =>
      expect(recomputeDayLegsAction).toHaveBeenCalledWith('t1', '2026-05-04', 'walk'),
    );
  });

  it('disables mutations when offline (List view)', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    mockFetch();
    renderPlan();
    await screen.findByText('Stop A');
    expect(screen.getByRole('button', { name: en.plan.addPlace })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**
  `npx vitest run components/plan/PlanClient.test.tsx`
  Expect: FAIL (component not found).

- [ ] **Step 3: Minimal implementation.**

```tsx
// components/plan/PlanClient.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { deriveDays, type DerivedDay } from '@/src/lib/days';
import { dayRouteUrl, type TravelMode } from '@/src/lib/googleMapsUrl';
import { landingDate } from '@/src/lib/landingDate';
import {
  parsePlanParams,
  buildPlanQuery,
  buildDayGroups,
  type PlanParams,
} from '@/src/lib/planUrl';
import {
  placesForDay,
  savedPlaces,
  dayColor,
  type PlaceDTO,
  type LegDTO,
} from '@/src/lib/planView';
import { indexLegs } from '@/src/lib/legView';
import {
  reorderDayAction,
  promoteToDayAction,
  moveToSavedAction,
  deletePlaceAction,
  recomputeDayLegsAction,
} from '@/app/_actions/places';
import { EmptyState } from '@/components/EmptyState';
import { DayStrip } from '@/components/plan/DayStrip';
import { DayItinerary } from '@/components/plan/DayItinerary';
import { SavedList } from '@/components/plan/SavedList';
import { TodayHero } from '@/components/plan/TodayHero';
import { AddPlaceSheet } from '@/components/plan/AddPlaceSheet';
import { PlaceDetailSheet } from '@/components/plan/PlaceDetailSheet';
import { PlanMap } from '@/components/plan/PlanMap';

type TripLite = { id: string; name: string; startDate: string; endDate: string; coverPhoto: string | null };
type PlanData = { trip: TripLite; places: PlaceDTO[]; legs: LegDTO[] };
type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; data: PlanData };

/** Current wall-clock HH:MM in the trip timezone (for next-stop selection). */
function nowHHMM(tz: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
}

export function PlanClient({
  tripId,
  tz,
  currency,
  locale = 'en',
}: {
  tripId: string;
  tz: string;
  currency: string;
  locale?: string;
}) {
  const t = useTranslations('plan');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [online, setOnline] = useState(true);
  const [dayMode, setDayMode] = useState<TravelMode>('walk');
  const [addOpen, setAddOpen] = useState(false);
  const [detailFor, setDetailFor] = useState<PlaceDTO | null>(null);
  const [visibleDates, setVisibleDates] = useState<Set<string>>(new Set());

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

  const load = useCallback(async () => {
    try {
      const [tripRes, placesRes] = await Promise.all([
        fetch(`/api/trips/${tripId}`, { credentials: 'same-origin' }),
        fetch(`/api/trips/${tripId}/places`, { credentials: 'same-origin' }),
      ]);
      if (!tripRes.ok || !placesRes.ok) throw new Error('load failed');
      const { trip } = (await tripRes.json()) as { trip: TripLite };
      const { places, legs } = (await placesRes.json()) as { places: PlaceDTO[]; legs: LegDTO[] };
      setState({ status: 'loaded', data: { trip, places, legs } });
    } catch {
      setState({ status: 'error' });
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  const legLookup = useMemo(
    () => indexLegs(state.status === 'loaded' ? state.data.legs : []),
    [state],
  );

  if (state.status === 'loading') {
    return <p className="px-4 py-8 text-center text-body text-ink-muted">{t('loading')}</p>;
  }
  if (state.status === 'error') {
    return (
      <EmptyState mascotAlt={t('addPlace')} headline={t('errorHeadline')} subtext={t('errorSubtext')} />
    );
  }

  const { trip, places, legs } = state.data;
  const days: DerivedDay[] = deriveDays(trip, tz);
  const landing = landingDate(trip, tz);
  const range = { startDate: trip.startDate, endDate: trip.endDate };
  const params: PlanParams = parsePlanParams(searchParams, range, landing);

  function setParams(patch: Partial<PlanParams>) {
    router.replace(`${pathname}?${buildPlanQuery({ ...params, ...patch })}`);
  }

  const dayIndex = days.findIndex((d) => d.date === params.date);
  const dayLabel = dayIndex >= 0 ? `Day ${days[dayIndex]!.dayNumber}` : 'Day';
  const color = dayColor(Math.max(0, dayIndex));
  const stops = placesForDay(places, params.date);
  const saved = savedPlaces(places);
  const selectedDay = days[dayIndex];
  const showTodayHero =
    params.bucket === 'days' && params.view === 'list' && !!selectedDay?.isToday && stops.length > 0;

  const placeById = (id: string) => places.find((p) => p.id === id) ?? null;

  /**
   * Run a mutation, recompute that day's legs (online only; saved bucket / null
   * date skips recompute), then re-fetch. `mode` defaults to the current day
   * mode but is passed explicitly on a mode change (state is stale in-closure).
   */
  async function mutateDay(
    date: string | null,
    fn: () => Promise<unknown>,
    mode: TravelMode = dayMode,
  ) {
    await fn();
    if (online && date) await recomputeDayLegsAction(tripId, date, mode);
    await load();
  }

  function onModeChange(m: TravelMode) {
    setDayMode(m);
    // Recompute with the NEW mode explicitly — `dayMode` state is still stale in
    // this closure until the next render.
    if (online) void mutateDay(params.date, async () => undefined, m);
  }

  // PlanMap seam (locked): build dayGroups + handlers; pass legs + mode + online.
  const dayGroups = buildDayGroups(params.bucket, days, places);
  function onOpenDayRoute(date: string) {
    const group = dayGroups.find((g) => g.date === date);
    if (!group || group.places.length === 0) return;
    const coords = group.places
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => ({ lat: p.lat as number, lng: p.lng as number }));
    if (coords.length === 0) return;
    window.open(dayRouteUrl(coords, dayMode), '_blank', 'noopener,noreferrer');
  }
  function onToggleDate(date: string) {
    setVisibleDates((cur) => {
      const next = new Set(cur);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-24 pt-2">
      {/* List/Map + Days/Saved toggles */}
      <div className="mb-3 flex gap-2">
        <div role="group" className="flex flex-1 rounded-control bg-card p-0.5 shadow-inset">
          <button
            type="button"
            aria-pressed={params.view === 'list'}
            onClick={() => setParams({ view: 'list' })}
            className={`flex-1 rounded-control py-1.5 text-caption font-medium ${params.view === 'list' ? 'bg-coral text-white' : 'text-ink-muted'}`}
          >
            {t('listTab')}
          </button>
          <button
            type="button"
            aria-pressed={params.view === 'map'}
            onClick={() => setParams({ view: 'map' })}
            className={`flex-1 rounded-control py-1.5 text-caption font-medium ${params.view === 'map' ? 'bg-coral text-white' : 'text-ink-muted'}`}
          >
            {t('mapTab')}
          </button>
        </div>
        <div role="group" className="flex flex-1 rounded-control bg-card p-0.5 shadow-inset">
          <button
            type="button"
            aria-pressed={params.bucket === 'days'}
            onClick={() => setParams({ bucket: 'days' })}
            className={`flex-1 rounded-control py-1.5 text-caption font-medium ${params.bucket === 'days' ? 'bg-coral text-white' : 'text-ink-muted'}`}
          >
            {t('daysTab')}
          </button>
          <button
            type="button"
            aria-pressed={params.bucket === 'saved'}
            onClick={() => setParams({ bucket: 'saved' })}
            className={`flex-1 rounded-control py-1.5 text-caption font-medium ${params.bucket === 'saved' ? 'bg-coral text-white' : 'text-ink-muted'}`}
          >
            {t('savedTab')}
          </button>
        </div>
      </div>

      {params.bucket === 'days' ? (
        <div className="mb-3">
          <DayStrip days={days} selectedDate={params.date} onSelect={(date) => setParams({ date })} />
        </div>
      ) : null}

      {params.view === 'map' ? (
        online ? (
          <PlanMap
            bucket={params.bucket}
            dayGroups={dayGroups}
            legs={legs}
            mode={dayMode}
            visibleDates={visibleDates}
            onToggleDate={onToggleDate}
            onSelectPlace={(id) => setDetailFor(placeById(id))}
            onOpenDayRoute={onOpenDayRoute}
            online={online}
          />
        ) : (
          <EmptyState
            mascotAlt={t('mapTab')}
            headline={t('mapNeedsConnectionHeadline')}
            subtext={t('mapNeedsConnectionSubtext')}
          />
        )
      ) : params.bucket === 'days' ? (
        <>
          {showTodayHero ? (
            <TodayHero stops={stops} legs={legLookup} mode={dayMode} nowHHMM={nowHHMM(tz)} />
          ) : null}
          <DayItinerary
            dayLabel={dayLabel}
            stops={stops}
            legs={legLookup}
            mode={dayMode}
            dayColor={color}
            currency={currency}
            locale={locale}
            disabled={!online}
            onAddPlace={() => setAddOpen(true)}
            onAddFromSaved={() => setParams({ bucket: 'saved' })}
            onReorder={(ids) => void mutateDay(params.date, () => reorderDayAction(tripId, params.date, ids))}
            onTapPlace={(id) => setDetailFor(placeById(id))}
            onMoveToSaved={(id) => void mutateDay(params.date, () => moveToSavedAction(id))}
            onMoveToDay={(id) => setDetailFor(placeById(id))}
            onDelete={(id) => void mutateDay(params.date, () => deletePlaceAction(id))}
            onModeChange={onModeChange}
            onRecompute={() => void mutateDay(params.date, async () => undefined)}
          />
        </>
      ) : (
        <SavedList
          saved={saved}
          days={days}
          disabled={!online}
          onPromote={(id, date) => void mutateDay(date, () => promoteToDayAction(id, date))}
          onTapPlace={(id) => setDetailFor(placeById(id))}
          onAddPlace={() => setAddOpen(true)}
        />
      )}

      <AddPlaceSheet
        open={addOpen}
        tripId={tripId}
        dayDate={params.bucket === 'saved' ? null : params.date}
        disabled={!online}
        onClose={() => setAddOpen(false)}
        onAdded={() => void mutateDay(params.bucket === 'saved' ? null : params.date, async () => undefined)}
      />

      {detailFor ? (
        <PlaceDetailSheet
          open
          place={detailFor}
          currency={currency}
          locale={locale}
          disabled={!online}
          onClose={() => setDetailFor(null)}
          onSaved={() => {
            setDetailFor(null);
            void load();
          }}
        />
      ) : null}
    </main>
  );
}
```

> **Note on `onAdded` / `recomputeDayLegsAction`:** `AddPlaceSheet` performs the `addPlaceAction` itself and signals success via `onAdded`; PlanClient's `onAdded` then recomputes the affected day's legs (online) and re-fetches. `mutateDay(null, …)` (Saved bucket) skips recompute since saved places have no day legs.

- [ ] **Step 4: Run it, expect PASS.**
  `npx vitest run components/plan/PlanClient.test.tsx`
  Expect: 7 passed.

- [ ] **Step 5: Commit.**
  ```
  git add components/plan/PlanClient.tsx components/plan/PlanClient.test.tsx
  git commit -m "$(printf 'feat(plan): PlanClient orchestrator (fetch, URL state, mutations, PlanMap seam)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
  ```

---

### Task B2.15: Wire the Plan page (static shell) replacing the placeholder

**Files:**
- Modify `app/trip/[tripId]/plan/page.tsx`
- Create `app/trip/[tripId]/plan/page.test.tsx`

Replace the coming-soon placeholder with a static shell that mounts `<PlanClient tripId tz currency locale />`. The page stays `force-static` (no server DB read, no `cookies()`) so it is SW-cacheable + offline-readable; `tz`/`currency` come from `env`, `locale` is the static `'en'` (matching `i18n/request.ts`). `PlanClient` client-fetches everything and resolves `landingDate` post-fetch — the page needs no DB.

- [ ] **Step 1: Write the failing test.**

```tsx
// app/trip/[tripId]/plan/page.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const planClientSpy = vi.fn();
vi.mock('@/components/plan/PlanClient', () => ({
  PlanClient: (props: Record<string, unknown>) => {
    planClientSpy(props);
    return <div data-testid="plan-client" />;
  },
}));

vi.mock('@/src/env', () => ({ env: { TZ: 'Asia/Tokyo', DEFAULT_CURRENCY: 'JPY' } }));

import PlanPage from './page';

describe('PlanPage', () => {
  it('renders PlanClient with tripId, tz, currency, and locale', async () => {
    const ui = await PlanPage({ params: Promise.resolve({ tripId: 't1' }) });
    render(ui);
    expect(screen.getByTestId('plan-client')).toBeInTheDocument();
    expect(planClientSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: 't1', tz: 'Asia/Tokyo', currency: 'JPY', locale: 'en' }),
    );
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**
  `npx vitest run "app/trip/[tripId]/plan/page.test.tsx"`
  Expect: FAIL (page still renders the placeholder `EmptyState`, no `PlanClient`).

- [ ] **Step 3: Replace the Plan page.** Overwrite `app/trip/[tripId]/plan/page.tsx`:

```tsx
import { env } from '@/src/env';
import { PlanClient } from '@/components/plan/PlanClient';

// Static app shell: no server DB read, no cookies() — so the SW caches the page
// document and it loads offline. PlanClient client-fetches /api/trips/:id (+
// /places), derives the day strip, resolves the landing date, and owns the URL
// state (?view&bucket&date). English-only locale matches i18n/request.ts.
// (spec §7.3/§8.2)
export const dynamic = 'force-static';

export default async function PlanPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <PlanClient tripId={tripId} tz={env.TZ} currency={env.DEFAULT_CURRENCY} locale="en" />;
}
```

- [ ] **Step 4: Run it, expect PASS.**
  `npx vitest run "app/trip/[tripId]/plan/page.test.tsx"`
  Expect: 1 passed.

- [ ] **Step 5: Commit.**
  ```
  git add "app/trip/[tripId]/plan/page.tsx" "app/trip/[tripId]/plan/page.test.tsx"
  git commit -m "$(printf 'feat(plan): wire Plan page static shell, replace placeholder\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
  ```

---

### Task B2.16: Client-side active-trip auto-land in TripShellClient

**Files:**
- Modify `components/TripShellClient.tsx`
- Modify `components/TripShellClient.test.tsx`

Wire the active-trip auto-land (spec §2/§3.8) into `TripShellClient`, which already client-fetches `/api/trips/:id`. After the trip resolves, if we are on the `/plan` path with **no `date` param**, replace the URL with `?view=list&bucket=days&date=<landingDate>` (today for active trips, else start date). This is a **client effect** — the page stays a static, cacheable shell (no server DB read, no `force-dynamic`). The shared `landingDate` helper carries the logic. `TZ` is server-only, so the client resolves the browser's IANA zone (frozen-UTC tests resolve to UTC).

- [ ] **Step 1: Update the test.** In `components/TripShellClient.test.tsx`, replace the existing `next/navigation` mock with one that also exposes controllable `useRouter`/`useSearchParams` (keep `usePathname`, which `BottomTabBar` consumes), and add the auto-land describe block. Add `beforeEach` to the imports.

Replace:
```tsx
vi.mock('next/navigation', () => ({
  usePathname: () => '/trip/trip-1/plan',
}));
```
with:
```tsx
const replaceMock = vi.fn();
let pathnameValue = '/trip/trip-1/plan';
let searchValue = '';
vi.mock('next/navigation', () => ({
  usePathname: () => pathnameValue,
  useSearchParams: () => new URLSearchParams(searchValue),
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));
```
Update the import line to include `beforeEach` (`import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';`) and append:

```tsx
describe('TripShellClient — active-trip auto-land (§3.8)', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    pathnameValue = '/trip/trip-1/plan';
    searchValue = '';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T10:00:00Z')); // within Osaka 06-05..06-07
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("replaces the URL with today's date on an active trip when no date param", async () => {
    mockFetch({ trip: TRIP });
    renderShell();
    await screen.findByText('Osaka');
    await vi.waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith(
        '/trip/trip-1/plan?view=list&bucket=days&date=2026-06-06',
      ),
    );
  });

  it('does not redirect when a date param is already present', async () => {
    searchValue = 'view=list&bucket=days&date=2026-06-05';
    mockFetch({ trip: TRIP });
    renderShell();
    await screen.findByText('Osaka');
    await Promise.resolve();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('lands on start_date for a non-active (past) trip', async () => {
    vi.setSystemTime(new Date('2026-07-01T10:00:00Z')); // after Osaka end
    mockFetch({ trip: TRIP });
    renderShell();
    await screen.findByText('Osaka');
    await vi.waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith(
        '/trip/trip-1/plan?view=list&bucket=days&date=2026-06-05',
      ),
    );
  });

  it('does not redirect on a non-plan path (e.g. eats)', async () => {
    pathnameValue = '/trip/trip-1/eats';
    mockFetch({ trip: TRIP });
    renderShell();
    await screen.findByText('Osaka');
    await Promise.resolve();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
```

> The existing `mockFetch(body)` returns the same body for every fetch; `TripShellClient` only reads `{ trip }`, so `mockFetch({ trip: TRIP })` is sufficient. The four pre-existing TripShellClient tests still pass unchanged.

- [ ] **Step 2: Run it, expect FAIL.**
  `npx vitest run components/TripShellClient.test.tsx`
  Expect: FAIL — `replaceMock` never called (no auto-land wiring yet).

- [ ] **Step 3: Wire the auto-land.** Edit `components/TripShellClient.tsx`.

Add to the imports:
```tsx
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { landingDate } from '@/src/lib/landingDate';
```
Add a module-scope helper (outside the component):
```tsx
/** Browser-resolved IANA timezone; mirrors env.TZ for client-side day math. */
function clientTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
```
Inside `TripShellClient`, after `const [state, setState] = useState<ShellState>({ status: 'loading' });`, add the hooks + effect:
```tsx
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active-trip auto-land (spec §2/§3.8): once the trip resolves, if we are on
  // the Plan path with no `date` param, replace the URL with the landing date
  // (today for active trips, start_date otherwise). Client-side so the page
  // stays a static, cacheable shell — no server DB read, no force-dynamic.
  useEffect(() => {
    if (state.status !== 'loaded') return;
    if (!pathname.endsWith('/plan')) return;
    if (searchParams.get('date')) return;
    const date = landingDate(state.trip, clientTz());
    router.replace(`/trip/${tripId}/plan?view=list&bucket=days&date=${date}`);
  }, [state, pathname, searchParams, router, tripId]);
```

- [ ] **Step 4: Run it, expect PASS.**
  `npx vitest run components/TripShellClient.test.tsx`
  Expect: all passed (the original 4 + 4 new = 8).

- [ ] **Step 5: Typecheck + commit.**
  ```
  npx tsc --noEmit
  git add components/TripShellClient.tsx components/TripShellClient.test.tsx
  git commit -m "$(printf 'feat(plan): client-side active-trip auto-land to today (TripShellClient)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
  ```

---

### Task B2.17: Full Plan-tab regression sweep

**Files:** (no new files; verification only)

A final guard that the whole B2 surface is green together and nothing in 1A/B0/B1 regressed.

- [ ] **Step 1: Run the entire suite.**
  `npm test`
  Expect: all suites pass. New B2 suites + approximate counts: planView (6), legView (9), planUrl (9), landingDate (5), planMessages (2), PlaceCard (5), LegConnector (2), DayModeControl (4), DayStrip (4), AddPlaceSheet (4), PlaceDetailSheet (4), DayItinerary (1+4), SavedList (4), TodayHero (5), PlanClient (7), plan/page (1), TripShellClient (8 incl. 4 new).

- [ ] **Step 2: Typecheck + lint.**
  `npx tsc --noEmit && npm run lint`
  Expect: no type errors; lint clean (the `no-img-element` eslint-disable comments match the existing 1A convention for offline-safe `<img>`).

- [ ] **Step 3: Build (static-shell guard).**
  `npm run build`
  Expect: build succeeds. The Plan page is `force-static` and every Google call is client-side/mocked, so absent Google keys are fine (1A's `src/env.ts` already treats `GOOGLE_MAPS_SERVER_KEY` as optional and the browser key defaults to `''`).

- [ ] **Step 4: Commit (only if the sweep surfaced fixups; otherwise skip).**
  ```
  git add -A
  git commit -m "$(printf 'test(plan): green Plan-tab regression sweep (B2)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
  ```

---

## B2 boundaries & notes for the implementer

- **B2 consumes, does not define** these B0/B1/B3 artifacts (import as-is; reconcile the mock + call site, not the test intent, if a signature differs):
  - B0: `components/plan/useGooglePlaces.ts` (`usePlacesAutocomplete()`), `components/plan/googleClient.ts` (`reverseGeocode(lat, lng)`).
  - B1: Server Actions in `app/_actions/places.ts` (`addPlaceAction`, `updatePlaceAction`, `deletePlaceAction`, `reorderDayAction`, `promoteToDayAction`, `moveToSavedAction`, `recomputeDayLegsAction`); the read handler `GET /api/trips/[tripId]/places` → `{ places, legs }`; the photos handler `GET /api/photos/[placeId]/[variant]`.
  - B3: `components/plan/PlanMap.tsx` — mounted via the locked prop seam only.
- **PlanMap prop seam (locked — B3 must match exactly):** `{ bucket, dayGroups, legs, mode, visibleDates, onToggleDate, onSelectPlace, onOpenDayRoute, online }`. PlanClient builds `dayGroups` (via `buildDayGroups`), `visibleDates`, and the handlers; it passes the fetched `legs` (already the active day-mode) + `mode` + `online`. B3 draws pins (label `orderIndex + 1`, per-day `colorIndex` → palette), the real `polyline` (falling back to a straight line when null), and the offline mascot placeholder is rendered by **PlanClient** when `!online` (it never mounts PlanMap offline). `onOpenDayRoute` opens `dayRouteUrl(orderedCoords, mode)`.
- **Single sources of truth:** ONE `PlanClient` (`components/plan/PlanClient.tsx`), ONE `TodayHero` (`components/plan/TodayHero.tsx`), ONE `landingDate` (`src/lib/landingDate.ts`). `TravelMode` is imported only from `@/src/lib/googleMapsUrl`. The `PlaceDTO`/`LegDTO` shapes live once in `src/lib/planView.ts`.
- **Directions get invoked:** PlanClient calls `recomputeDayLegsAction(tripId, dayDate, mode)` (online only) whenever a day's stop set changes (add / reorder / delete / promote) or the day travel-mode changes, then re-fetches. Cached legs render offline; recompute is online-only.
- **Offline = `!navigator.onLine`** (plus the `online`/`offline` events). It disables every mutation control, hides Recompute, and swaps the Map for the mascot placeholder; all cached reads (day strip, cards, cached legs, Open-in-Google-Maps deep links) keep working. No optimistic local mutation; all mutations route through actions then re-fetch (matching 1A's `onCreated → loadTrips()` pattern).
- **No setState-in-render / no module-scope mutable render state.** The Today next-stop pointer is a transient `useState` re-seeded by a `useEffect` keyed on the stable stop-id signature; it resets on reload and has no persistence and no schema field.
- **Cache-safe pages:** `app/trip/[tripId]/plan/page.tsx` stays `force-static` (no DB read, no `cookies()`); the active-trip auto-land is a client effect in `TripShellClient`.
- **Out of scope (do NOT build here):** PlanMap internals (B3), per-leg travel-mode override, personal photo upload, zh i18n, and any Eats/Budget/Journal/Plan-2/3 features.

---

### Group B3 — PlanMap: Self-Contained Google Map Component

> **Seam contract (RESOLUTIONS §PlanMap):** `PlanMap` is a pure-props client component.
> It never imports `PlanClient` and never fetches data. B2 owns `dayGroups`, `visibleDates`,
> and all action handlers; B3 consumes them. The exact prop signature is:
>
> ```ts
> PlanMap({
>   bucket: 'days' | 'saved',
>   dayGroups: Array<{ date: string|null, dayNumber: number|null, colorIndex: number, places: PlaceDTO[] }>,
>   legs: LegDTO[],
>   mode: TravelMode,
>   visibleDates: Set<string>,
>   onToggleDate: (date: string) => void,
>   onSelectPlace: (placeId: string) => void,
>   onOpenDayRoute: (date: string) => void,
>   online: boolean,
> })
> ```
>
> **`PlaceDTO`** (from RESOLUTIONS §Data shapes):
> `{ id, tripId, dayDate, googlePlaceId, name, address, lat, lng, category, scheduledTime, durationMin, cost, notes, orderIndex, photoPath }`
>
> **`LegDTO`**: `{ fromPlaceId, toPlaceId, mode, durationSeconds, distanceMeters, polyline: string|null }`
>
> **B0 assumption:** `loadGoogleMaps(): Promise<typeof google.maps>` is exported from
> `@/src/lib/googleLoader` (built in B0). All Google loader/network calls are mocked in tests.

---

### Task B3.1 — `src/lib/map/colors.ts`: per-day color palette + stable assignment

**Files:**
- Create: `src/lib/map/colors.ts`
- Create: `src/lib/map/colors.test.ts`

The map assigns each day group a stable, palette-derived color used for its pins, polyline, and legend chip. Color assignment is purely a function of `colorIndex` (the integer B2 embeds in each `DayGroup`): `DAY_COLORS[colorIndex % DAY_COLORS.length]`. This module also exports helpers that work directly with the `dayGroups` prop shape (ordered list of color-index tagged groups). It is the foundational pure helper every later B3 piece imports.

- [ ] **Step 1: Write the failing test.**
  Create `src/lib/map/colors.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { DAY_COLORS, colorForIndex, colorForGroup } from '@/src/lib/map/colors';

  describe('DAY_COLORS', () => {
    it('is a non-empty palette of #RRGGBB hex strings', () => {
      expect(DAY_COLORS.length).toBeGreaterThan(0);
      for (const c of DAY_COLORS) {
        expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('leads with the spec route Coral (#EE5B3C) and includes Teal (#4F8A86)', () => {
      expect(DAY_COLORS[0]).toBe('#EE5B3C');
      expect(DAY_COLORS).toContain('#4F8A86');
    });
  });

  describe('colorForIndex', () => {
    it('returns the palette color for a given colorIndex', () => {
      expect(colorForIndex(0)).toBe(DAY_COLORS[0]);
      expect(colorForIndex(1)).toBe(DAY_COLORS[1]);
    });

    it('wraps around when colorIndex exceeds palette length', () => {
      expect(colorForIndex(DAY_COLORS.length)).toBe(DAY_COLORS[0]);
      expect(colorForIndex(DAY_COLORS.length + 1)).toBe(DAY_COLORS[1]);
    });

    it('falls back to the first color for negative or NaN indices', () => {
      expect(colorForIndex(-1)).toBe(DAY_COLORS[0]);
      expect(colorForIndex(NaN)).toBe(DAY_COLORS[0]);
    });
  });

  describe('colorForGroup', () => {
    it('resolves a DayGroup colorIndex to the palette color', () => {
      expect(colorForGroup({ colorIndex: 0 })).toBe(DAY_COLORS[0]);
      expect(colorForGroup({ colorIndex: 2 })).toBe(DAY_COLORS[2]);
    });

    it('wraps on overflow just like colorForIndex', () => {
      expect(colorForGroup({ colorIndex: DAY_COLORS.length })).toBe(DAY_COLORS[0]);
    });
  });
  ```

- [ ] **Step 2: Run it and watch it FAIL.**
  ```bash
  npx vitest run src/lib/map/colors.test.ts
  ```
  EXPECT: FAIL — `Failed to resolve import "@/src/lib/map/colors"`.

- [ ] **Step 3: Implement `colors.ts`.**
  Create `src/lib/map/colors.ts`:
  ```ts
  /**
   * Per-day color palette for the Plan▸Map view (spec §3.4 / §9.1).
   * Each day group in the active bucket receives a stable color driven by its
   * `colorIndex` (assigned by B2's PlanClient) used for pins, polylines, and
   * legend chips. The palette wraps modulo its length for long trips.
   *
   * Day 1 leads with the route Coral (#EE5B3C, spec §9.1); remaining entries
   * are visually distinct hues from the "Sunset Wanderer" family + Teal.
   */
  export const DAY_COLORS: readonly string[] = [
    '#EE5B3C', // coral  — day 1 route color (spec §9.1)
    '#4F8A86', // teal
    '#E0992F', // amber
    '#7E6BBF', // violet
    '#3E8E6E', // green  (= Tailwind `success`)
    '#C2452E', // brick  (= Tailwind `danger`)
    '#2F6F8F', // ocean
    '#B5642A', // clay
  ];

  /**
   * Return the palette color for a numeric `colorIndex`.
   * Wraps modulo the palette length; any invalid value (negative, NaN) falls
   * back to the first color.
   */
  export function colorForIndex(colorIndex: number): string {
    if (!Number.isFinite(colorIndex) || colorIndex < 0) return DAY_COLORS[0]!;
    return DAY_COLORS[colorIndex % DAY_COLORS.length]!;
  }

  /**
   * Convenience overload that accepts any object with a `colorIndex` field —
   * matches the B2 `DayGroup` prop shape directly.
   */
  export function colorForGroup(group: { colorIndex: number }): string {
    return colorForIndex(group.colorIndex);
  }
  ```

- [ ] **Step 4: Run it and watch it PASS.**
  ```bash
  npx vitest run src/lib/map/colors.test.ts
  ```
  EXPECT: PASS — `8 passed (8 tests)`.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/lib/map/colors.ts src/lib/map/colors.test.ts
  git commit -m "feat(map): per-day color palette + colorIndex resolver (spec §3.4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B3.2 — `src/lib/map/polyline.ts`: encoded-polyline decoder + per-day path assembly

**Files:**
- Create: `src/lib/map/polyline.ts`
- Create: `src/lib/map/polyline.test.ts`

Each day's consecutive stops are joined by a route polyline stored on `LegDTO.polyline` (Google's encoded format). This task ships our own decoder so paths render without the `google.maps` geometry library, and a `buildDayPaths` assembler that stitches each day's leg geometries into one ordered path — falling back to straight stop-to-stop segments when a leg's polyline is null (offline / not yet computed). Inputs are the B3 prop types directly (`DayGroup` + `LegDTO`).

- [ ] **Step 1: Write the failing test.**
  Create `src/lib/map/polyline.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { decodePolyline, buildDayPaths } from '@/src/lib/map/polyline';
  import type { DayGroup, LegDTO } from '@/src/lib/map/types';

  // Minimal PlaceDTO stubs (only lat/lng/id/orderIndex used by path assembly).
  function p(id: string, orderIndex: number, lat: number, lng: number) {
    return { id, orderIndex, lat, lng, name: id, category: 'other' as const,
             tripId: 't', dayDate: '2026-06-04', googlePlaceId: null,
             address: null, scheduledTime: null, durationMin: null, cost: null,
             notes: null, photoPath: null };
  }

  function group(date: string, places: ReturnType<typeof p>[], colorIndex = 0): DayGroup {
    return { date, dayNumber: 1, colorIndex, places };
  }

  describe('decodePolyline', () => {
    it('decodes the canonical Google reference string', () => {
      // From Google's "Encoded Polyline Algorithm Format" docs.
      const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
      expect(pts).toEqual([
        { lat: 38.5,   lng: -120.2   },
        { lat: 40.7,   lng: -120.95  },
        { lat: 43.252, lng: -126.453 },
      ]);
    });

    it('returns an empty array for an empty string', () => {
      expect(decodePolyline('')).toEqual([]);
    });
  });

  describe('buildDayPaths', () => {
    const g = group('2026-06-04', [
      p('a', 0, 38.5,   -120.2),
      p('b', 1, 40.7,   -120.95),
    ]);

    it('uses a leg polyline for the segment between two stops', () => {
      const legs: LegDTO[] = [
        { fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk',
          durationSeconds: 0, distanceMeters: 0,
          polyline: '_p~iF~ps|U_ulLnnqC' },
      ];
      const paths = buildDayPaths([g], legs);
      expect(paths).toHaveLength(1);
      expect(paths[0]!.date).toBe('2026-06-04');
      expect(paths[0]!.path).toEqual([
        { lat: 38.5,  lng: -120.2  },
        { lat: 40.7,  lng: -120.95 },
      ]);
    });

    it('falls back to a straight segment when the leg polyline is null', () => {
      const paths = buildDayPaths([g], []); // no legs
      expect(paths[0]!.path).toEqual([
        { lat: 38.5,  lng: -120.2  },
        { lat: 40.7,  lng: -120.95 },
      ]);
    });

    it('falls back per-segment when only some legs have a polyline', () => {
      const g3 = group('2026-06-04', [
        p('a', 0, 38.5,   -120.2),
        p('b', 1, 40.7,   -120.95),
        p('c', 2, 43.252, -126.453),
      ]);
      const legs: LegDTO[] = [
        { fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk',
          durationSeconds: 0, distanceMeters: 0,
          polyline: '_p~iF~ps|U_ulLnnqC' },
        // b→c has no polyline (null)
        { fromPlaceId: 'b', toPlaceId: 'c', mode: 'walk',
          durationSeconds: 0, distanceMeters: 0, polyline: null },
      ];
      const paths = buildDayPaths([g3], legs);
      expect(paths[0]!.path).toEqual([
        { lat: 38.5,   lng: -120.2   }, // a (from decoded a→b)
        { lat: 40.7,   lng: -120.95  }, // b (from decoded a→b)
        { lat: 43.252, lng: -126.453 }, // c (straight fallback b→c)
      ]);
    });

    it('produces no path for a day with fewer than two plottable stops', () => {
      const single = group('2026-06-04', [p('only', 0, 1, 2)]);
      expect(buildDayPaths([single], [])).toEqual([]);
    });

    it('skips stops without coordinates (cannot plot them)', () => {
      const g2 = group('2026-06-04', [
        { ...p('a', 0, 35.0, 139.0) },
        { ...p('b', 1, 0, 0), lat: null as unknown as number, lng: null as unknown as number },
        { ...p('c', 2, 35.1, 139.1) },
      ]);
      // Only a and c are plottable; the path is the straight a→c fallback.
      const paths = buildDayPaths([g2], []);
      expect(paths[0]!.path).toEqual([
        { lat: 35.0, lng: 139.0 },
        { lat: 35.1, lng: 139.1 },
      ]);
    });

    it('ignores legs not matching the day adjacency', () => {
      const legs: LegDTO[] = [
        { fromPlaceId: 'x', toPlaceId: 'y', mode: 'drive',
          durationSeconds: 0, distanceMeters: 0,
          polyline: '_p~iF~ps|U_ulLnnqC' },
      ];
      const paths = buildDayPaths([g], legs);
      // No matching leg → straight fallback.
      expect(paths[0]!.path).toEqual([
        { lat: 38.5,  lng: -120.2  },
        { lat: 40.7,  lng: -120.95 },
      ]);
    });
  });
  ```

- [ ] **Step 2: Run it and watch it FAIL.**
  ```bash
  npx vitest run src/lib/map/polyline.test.ts
  ```
  EXPECT: FAIL — `Failed to resolve import "@/src/lib/map/polyline"` (and `"@/src/lib/map/types"`).

- [ ] **Step 3: Create the shared type file `src/lib/map/types.ts`.**
  This file re-exports the B3 prop types as TypeScript interfaces so every helper can share them without depending on the component file. It mirrors the RESOLUTIONS §Data shapes.
  ```ts
  /**
   * Shared client-side types for the Plan▸Map surface. These mirror the
   * RESOLUTIONS §Data shapes served by GET /api/trips/[tripId]/places and
   * passed by B2's PlanClient to PlanMap via props. Helpers import from here;
   * the component imports from here too (not re-defined per file).
   */
  import type { TravelMode } from '@/src/lib/googleMapsUrl';

  /** Client DTO for a trip place (produced by B1's read handler). */
  export interface PlaceDTO {
    id: string;
    tripId: string;
    dayDate: string | null;
    googlePlaceId: string | null;
    name: string;
    address: string | null;
    lat: number | null;
    lng: number | null;
    category: 'sightseeing' | 'lodging' | 'transport' | 'activity' | 'other';
    scheduledTime: string | null;
    durationMin: number | null;
    cost: number | null;
    notes: string | null;
    orderIndex: number;
    /** `/api/photos/[googlePlaceId]/card` for Google places; null for map-drop pins. */
    photoPath: string | null;
  }

  /** Client DTO for a travel leg (produced by B1's read handler). */
  export interface LegDTO {
    fromPlaceId: string;
    toPlaceId: string;
    mode: TravelMode;
    durationSeconds: number;
    distanceMeters: number;
    /** Google encoded overview polyline; null when uncomputed / offline. */
    polyline: string | null;
  }

  /** B2's day-group prop shape passed into PlanMap. */
  export interface DayGroup {
    date: string | null;
    dayNumber: number | null;
    /** Index into DAY_COLORS palette; B2 assigns it once and it is stable. */
    colorIndex: number;
    places: PlaceDTO[];
  }

  export interface LatLngLiteral {
    lat: number;
    lng: number;
  }

  /** One day's assembled route path with its assigned color. */
  export interface DayPath {
    date: string;
    color: string;
    path: LatLngLiteral[];
  }
  ```
  Create `src/lib/map/types.ts` with the above content.

- [ ] **Step 4: Implement `polyline.ts`.**
  Create `src/lib/map/polyline.ts`:
  ```ts
  /**
   * Encoded-polyline decoder + per-day route path assembler (spec §3.4).
   * We ship our own decoder so paths render without the google.maps geometry
   * library and fall back to straight stop-to-stop segments when a leg's
   * polyline is missing (offline / not yet computed).
   */
  import type { DayGroup, LegDTO, DayPath, LatLngLiteral } from '@/src/lib/map/types';
  import { colorForGroup } from '@/src/lib/map/colors';

  /**
   * Decode a Google "Encoded Polyline Algorithm Format" string.
   * Precision is e5 (5 decimal places). Values are rounded to 6 decimal
   * places to avoid binary float drift against reference vectors.
   */
  export function decodePolyline(encoded: string): LatLngLiteral[] {
    const points: LatLngLiteral[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    const len = encoded.length;

    while (index < len) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      result = 0;
      shift = 0;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({
        lat: Math.round(lat * 1e-5 * 1e6) / 1e6,
        lng: Math.round(lng * 1e-5 * 1e6) / 1e6,
      });
    }
    return points;
  }

  function legKey(fromId: string, toId: string): string {
    return `${fromId} ${toId}`;
  }

  function hasCoords(p: { lat: number | null; lng: number | null }): boolean {
    return typeof p.lat === 'number' && typeof p.lng === 'number';
  }

  /**
   * Assemble each day's ordered route path.
   * - Places are sorted by orderIndex; those without coordinates are dropped.
   * - For each consecutive plottable pair: use the decoded leg polyline when
   *   present; fall back to a straight 2-point segment otherwise.
   * - Days with fewer than two plottable stops produce no path.
   * - The shared vertex between consecutive segments is deduplicated.
   */
  export function buildDayPaths(groups: DayGroup[], legs: LegDTO[]): DayPath[] {
    const byPair = new Map<string, LegDTO>();
    for (const leg of legs) {
      byPair.set(legKey(leg.fromPlaceId, leg.toPlaceId), leg);
    }

    const result: DayPath[] = [];

    for (const group of groups) {
      if (!group.date) continue;

      const plottable = group.places
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .filter(hasCoords) as Array<{ id: string; lat: number; lng: number }>;

      if (plottable.length < 2) continue;

      const path: LatLngLiteral[] = [];
      for (let i = 0; i < plottable.length - 1; i += 1) {
        const from = plottable[i]!;
        const to = plottable[i + 1]!;
        const leg = byPair.get(legKey(from.id, to.id));
        const decoded = leg?.polyline ? decodePolyline(leg.polyline) : [];
        const segment =
          decoded.length >= 2
            ? decoded
            : [{ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }];

        for (const pt of segment) {
          const last = path[path.length - 1];
          if (last && last.lat === pt.lat && last.lng === pt.lng) continue;
          path.push(pt);
        }
      }

      result.push({ date: group.date, color: colorForGroup(group), path });
    }

    return result;
  }
  ```

- [ ] **Step 5: Run it and watch it PASS.**
  ```bash
  npx vitest run src/lib/map/polyline.test.ts
  ```
  EXPECT: PASS — `9 passed (9 tests)`.

- [ ] **Step 6: Commit.**
  ```bash
  git add src/lib/map/types.ts src/lib/map/polyline.ts src/lib/map/polyline.test.ts
  git commit -m "feat(map): shared types + polyline decoder + per-day path assembly (spec §3.4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B3.3 — `src/lib/map/bounds.ts`: fit-bounds extent math

**Files:**
- Create: `src/lib/map/bounds.ts`
- Create: `src/lib/map/bounds.test.ts`

The map centers on the trip's visible pins. This task TDD's the pure extent math: given a set of lat/lng points, return the `{ south, west, north, east }` literal you pass to `google.maps.LatLngBounds` + `fitBounds`. A single point gets a small padded box so the map does not over-zoom to street level. Keeping this pure means the thin map component only has to convert the literal and call `fitBounds`.

- [ ] **Step 1: Write the failing test.**
  Create `src/lib/map/bounds.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { computeBounds, boundsCenter } from '@/src/lib/map/bounds';
  import type { LatLngLiteral } from '@/src/lib/map/types';

  const pts = (xs: [number, number][]): LatLngLiteral[] =>
    xs.map(([lat, lng]) => ({ lat, lng }));

  describe('computeBounds', () => {
    it('returns the tight bounding box over multiple points', () => {
      const b = computeBounds(pts([[35.0, 139.0], [36.0, 140.0], [34.5, 139.5]]));
      expect(b).toEqual({ south: 34.5, west: 139.0, north: 36.0, east: 140.0 });
    });

    it('returns a small padded box around a single point (so fitBounds does not over-zoom)', () => {
      const b = computeBounds(pts([[35.0, 139.0]]))!;
      expect(b.south).toBeLessThan(35.0);
      expect(b.north).toBeGreaterThan(35.0);
      expect(b.west).toBeLessThan(139.0);
      expect(b.east).toBeGreaterThan(139.0);
      // The point sits at the box center.
      expect((b.south + b.north) / 2).toBeCloseTo(35.0, 6);
      expect((b.west + b.east) / 2).toBeCloseTo(139.0, 6);
    });

    it('returns null for no points', () => {
      expect(computeBounds([])).toBeNull();
    });
  });

  describe('boundsCenter', () => {
    it('returns the midpoint of a bounds literal', () => {
      const c = boundsCenter({ south: 34.0, west: 139.0, north: 36.0, east: 141.0 });
      expect(c).toEqual({ lat: 35.0, lng: 140.0 });
    });
  });
  ```

- [ ] **Step 2: Run it and watch it FAIL.**
  ```bash
  npx vitest run src/lib/map/bounds.test.ts
  ```
  EXPECT: FAIL — `Failed to resolve import "@/src/lib/map/bounds"`.

- [ ] **Step 3: Implement `bounds.ts`.**
  Create `src/lib/map/bounds.ts`:
  ```ts
  /**
   * Pure viewport math for the Plan▸Map view (spec §3.4).
   * `computeBounds` returns a plain literal the thin map component passes to
   * `google.maps.LatLngBounds` for `fitBounds`. A lone point gets a small
   * padded box (~1.1 km) to avoid over-zoom to street level.
   */
  import type { LatLngLiteral } from '@/src/lib/map/types';

  export interface BoundsLiteral {
    south: number;
    west: number;
    north: number;
    east: number;
  }

  /** Degrees of pad applied around a lone point (~1.1 km at equator). */
  const SINGLE_POINT_PAD = 0.01;

  /** Tight bounding box over the given points, or null when there are none. */
  export function computeBounds(points: LatLngLiteral[]): BoundsLiteral | null {
    if (points.length === 0) return null;

    let south = Infinity;
    let north = -Infinity;
    let west = Infinity;
    let east = -Infinity;

    for (const p of points) {
      if (p.lat < south) south = p.lat;
      if (p.lat > north) north = p.lat;
      if (p.lng < west) west = p.lng;
      if (p.lng > east) east = p.lng;
    }

    if (south === north && west === east) {
      return {
        south: south - SINGLE_POINT_PAD,
        north: north + SINGLE_POINT_PAD,
        west: west - SINGLE_POINT_PAD,
        east: east + SINGLE_POINT_PAD,
      };
    }
    return { south, west, north, east };
  }

  /** Geometric center of a bounds literal. */
  export function boundsCenter(b: BoundsLiteral): LatLngLiteral {
    return { lat: (b.south + b.north) / 2, lng: (b.west + b.east) / 2 };
  }
  ```

- [ ] **Step 4: Run it and watch it PASS.**
  ```bash
  npx vitest run src/lib/map/bounds.test.ts
  ```
  EXPECT: PASS — `4 passed (4 tests)`.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/lib/map/bounds.ts src/lib/map/bounds.test.ts
  git commit -m "feat(map): pure fit-bounds extent math for trip pin viewport (spec §3.4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B3.4 — `src/lib/map/markers.ts`: build per-day marker sets from DayGroup prop

**Files:**
- Create: `src/lib/map/markers.ts`
- Create: `src/lib/map/markers.test.ts`

The map renders pins grouped by day (numbered `orderIndex+1`, in the day's color, Coral-on-color per spec §3.4). The Saved bucket renders un-numbered, un-colored wishlist pins. This task extracts the pure data-prep that turns the `DayGroup[]` prop (B2-computed) into ordered, color-tagged, numbered marker sets the thin map component feeds straight into `google.maps.Marker`. Places lacking coordinates are dropped (cannot be plotted). Per the seam, this function consumes `DayGroup` directly — it does NOT re-group or re-sort by date (B2 already did that).

- [ ] **Step 1: Write the failing test.**
  Create `src/lib/map/markers.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { buildMarkers, buildSavedMarkers } from '@/src/lib/map/markers';
  import { DAY_COLORS } from '@/src/lib/map/colors';
  import type { DayGroup, PlaceDTO } from '@/src/lib/map/types';

  function p(id: string, orderIndex: number, lat: number | null, lng: number | null,
             extra: Partial<PlaceDTO> = {}): PlaceDTO {
    return {
      id, orderIndex, lat, lng,
      name: id, category: 'other', tripId: 't', dayDate: '2026-06-04',
      googlePlaceId: null, address: null, scheduledTime: null, durationMin: null,
      cost: null, notes: null, photoPath: null, ...extra,
    };
  }

  function group(colorIndex: number, places: PlaceDTO[]): DayGroup {
    return { date: '2026-06-04', dayNumber: 1, colorIndex, places };
  }

  describe('buildMarkers', () => {
    it('returns one marker per plottable place, sorted by orderIndex, labeled 1..n', () => {
      const g = group(0, [
        p('b', 1, 35.1, 139.1),
        p('a', 0, 35.0, 139.0),
      ]);
      const markers = buildMarkers(g);
      expect(markers.map((m) => m.id)).toEqual(['a', 'b']);
      expect(markers.map((m) => m.label)).toEqual(['1', '2']);
    });

    it('assigns the palette color matching colorIndex', () => {
      const markers = buildMarkers(group(1, [p('a', 0, 35.0, 139.0)]));
      expect(markers[0]!.color).toBe(DAY_COLORS[1]);
    });

    it('wraps the color when colorIndex exceeds the palette', () => {
      const markers = buildMarkers(group(DAY_COLORS.length, [p('a', 0, 35.0, 139.0)]));
      expect(markers[0]!.color).toBe(DAY_COLORS[0]);
    });

    it('drops places without coordinates', () => {
      const g = group(0, [
        p('has', 0, 35.0, 139.0),
        p('no-lat', 1, null, 139.0),
        p('no-lng', 2, 35.0, null),
      ]);
      const markers = buildMarkers(g);
      expect(markers.map((m) => m.id)).toEqual(['has']);
    });

    it('renumbers labels after coord-less stops are dropped', () => {
      const g = group(0, [
        p('skip', 0, null, null),
        p('first', 1, 35.0, 139.0),
        p('second', 2, 35.1, 139.1),
      ]);
      const markers = buildMarkers(g);
      expect(markers.map((m) => m.label)).toEqual(['1', '2']);
    });

    it('carries name, category, googlePlaceId, photoPath for the info card', () => {
      const g = group(0, [
        p('p', 0, 35.0, 139.0, { name: 'Tower', category: 'activity',
                                  googlePlaceId: 'gx',
                                  photoPath: '/api/photos/gx/card' }),
      ]);
      const m = buildMarkers(g)[0]!;
      expect(m.name).toBe('Tower');
      expect(m.category).toBe('activity');
      expect(m.googlePlaceId).toBe('gx');
      expect(m.photoPath).toBe('/api/photos/gx/card');
    });

    it('returns an empty array for a group with no plottable places', () => {
      expect(buildMarkers(group(0, [p('z', 0, null, null)]))).toEqual([]);
    });
  });

  describe('buildSavedMarkers', () => {
    it('returns only plottable Saved places, un-numbered, no color', () => {
      const places: PlaceDTO[] = [
        p('s1', 0, 35.0, 139.0),
        p('s2', 1, 35.1, 139.1),
        p('no', 2, null, null),
      ];
      const markers = buildSavedMarkers(places);
      expect(markers.map((m) => m.id)).toEqual(['s1', 's2']);
      expect(markers.every((m) => m.label === null)).toBe(true);
      expect(markers.every((m) => m.color === null)).toBe(true);
    });
  });
  ```

- [ ] **Step 2: Run it and watch it FAIL.**
  ```bash
  npx vitest run src/lib/map/markers.test.ts
  ```
  EXPECT: FAIL — `Failed to resolve import "@/src/lib/map/markers"`.

- [ ] **Step 3: Implement `markers.ts`.**
  Create `src/lib/map/markers.ts`:
  ```ts
  /**
   * Pure marker-set builder for the Plan▸Map view (spec §3.4). Converts a
   * B2 DayGroup (already grouped + ordered by PlanClient) into a flat list of
   * PlaceMarker objects the thin map component passes to google.maps.Marker.
   * Places without coordinates are dropped. Labels are 1-based after dropping.
   */
  import type { DayGroup, PlaceDTO, LatLngLiteral } from '@/src/lib/map/types';
  import { colorForGroup } from '@/src/lib/map/colors';

  /** One plottable pin. */
  export interface PlaceMarker {
    id: string;
    name: string;
    category: PlaceDTO['category'];
    googlePlaceId: string | null;
    photoPath: string | null;
    position: LatLngLiteral;
    /** "1".."n" for day stops (Coral text, spec §3.4); null for Saved pins. */
    label: string | null;
    /** Day palette color for day markers; null for Saved markers. */
    color: string | null;
  }

  function hasCoords(p: PlaceDTO): p is PlaceDTO & { lat: number; lng: number } {
    return typeof p.lat === 'number' && typeof p.lng === 'number';
  }

  /**
   * Build the ordered, numbered, colored markers for one day group.
   * B2 owns the grouping and ordering; this function only drops
   * coord-less places, re-numbers survivors, and attaches the color.
   */
  export function buildMarkers(group: DayGroup): PlaceMarker[] {
    const color = colorForGroup(group);
    return group.places
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .filter(hasCoords)
      .map((p, idx) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        googlePlaceId: p.googlePlaceId,
        photoPath: p.photoPath,
        position: { lat: p.lat, lng: p.lng },
        label: String(idx + 1),
        color,
      }));
  }

  /**
   * Build un-numbered, un-colored markers for the Saved bucket.
   * `places` here is the flat list of saved-bucket places from the bucket's
   * single DayGroup (date=null) that B2 passes in for the Saved view.
   */
  export function buildSavedMarkers(places: PlaceDTO[]): PlaceMarker[] {
    return places
      .filter(hasCoords)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        googlePlaceId: p.googlePlaceId,
        photoPath: p.photoPath,
        position: { lat: p.lat as number, lng: p.lng as number },
        label: null,
        color: null,
      }));
  }
  ```

- [ ] **Step 4: Run it and watch it PASS.**
  ```bash
  npx vitest run src/lib/map/markers.test.ts
  ```
  EXPECT: PASS — `9 passed (9 tests)`.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/lib/map/markers.ts src/lib/map/markers.test.ts
  git commit -m "feat(map): pure DayGroup → PlaceMarker builder (spec §3.4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B3.5 — Map i18n strings + `MapLegend` chip component

**Files:**
- Modify: `messages/en.json`
- Create: `components/map/MapLegend.tsx`
- Create: `components/map/MapLegend.test.tsx`

Add every new Map-view string to `messages/en.json` (English only; zh is deferred per RESOLUTIONS), then build the small presentational **legend chip row**. The legend is pure UI: it renders an "All days" chip + one chip per visible day (color swatch + "Day N"), reflects visibility via `aria-pressed`, and calls back on tap. B3's `PlanMap` drives it; keeping it separate lets us RTL-test it with no Google loader.

- [ ] **Step 1: Add the Map strings to `messages/en.json`.**
  Insert the `planMap` and `category` blocks into `messages/en.json` after the `comingSoon` block and before `settings`:
  ```json
  "planMap": {
    "allDays": "All days",
    "dayChip": "Day {n}",
    "legendLabel": "Day visibility",
    "openDayRoute": "Open day route in Google Maps",
    "openInMaps": "Open in Google Maps",
    "addToDay": "Add to day →",
    "offlineHeadline": "Map needs a connection",
    "offlineSubtext": "Tap any place to open Google Maps.",
    "emptyHeadline": "No places to map yet",
    "emptySubtext": "Add a place to see it on the map.",
    "loading": "Loading map…",
    "infoCardLabel": "Place"
  },
  "category": {
    "sightseeing": "Sightseeing",
    "lodging": "Lodging",
    "transport": "Transport",
    "activity": "Activity",
    "other": "Other"
  },
  ```
  Verify the file is still valid JSON:
  ```bash
  node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); console.log('en.json OK')"
  ```
  EXPECT: `en.json OK`.

- [ ] **Step 2: Write the failing test for `MapLegend`.**
  Create `components/map/MapLegend.test.tsx`:
  ```tsx
  import { describe, it, expect, vi, afterEach } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import userEvent from '@testing-library/user-event';
  import { NextIntlClientProvider } from 'next-intl';
  import en from '@/messages/en.json';
  import { MapLegend } from './MapLegend';

  interface LegendEntry {
    date: string;
    dayNumber: number;
    color: string;
    visible: boolean;
  }

  const ENTRIES: LegendEntry[] = [
    { date: '2026-06-04', dayNumber: 1, color: '#EE5B3C', visible: true  },
    { date: '2026-06-05', dayNumber: 2, color: '#4F8A86', visible: false },
  ];

  function renderLegend(props: Partial<React.ComponentProps<typeof MapLegend>> = {}) {
    return render(
      <NextIntlClientProvider locale="en" messages={en}>
        <MapLegend
          entries={ENTRIES}
          allVisible={false}
          onToggleDay={vi.fn()}
          onToggleAll={vi.fn()}
          {...props}
        />
      </NextIntlClientProvider>,
    );
  }

  afterEach(() => vi.clearAllMocks());

  describe('MapLegend', () => {
    it('renders an "All days" chip plus one chip per day', () => {
      renderLegend();
      expect(screen.getByRole('button', { name: en.planMap.allDays })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Day 1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Day 2' })).toBeInTheDocument();
    });

    it('reflects each day visibility via aria-pressed', () => {
      renderLegend();
      expect(screen.getByRole('button', { name: 'Day 1' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Day 2' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('marks "All days" pressed only when allVisible is true', () => {
      renderLegend({ allVisible: true });
      expect(
        screen.getByRole('button', { name: en.planMap.allDays }),
      ).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls onToggleDay with the date when a day chip is tapped', async () => {
      const onToggleDay = vi.fn();
      const user = userEvent.setup();
      renderLegend({ onToggleDay });
      await user.click(screen.getByRole('button', { name: 'Day 2' }));
      expect(onToggleDay).toHaveBeenCalledWith('2026-06-05');
    });

    it('calls onToggleAll when the "All days" chip is tapped', async () => {
      const onToggleAll = vi.fn();
      const user = userEvent.setup();
      renderLegend({ onToggleAll });
      await user.click(screen.getByRole('button', { name: en.planMap.allDays }));
      expect(onToggleAll).toHaveBeenCalledTimes(1);
    });

    it('renders nothing when there are no day entries (Saved bucket)', () => {
      const { container } = renderLegend({ entries: [] });
      expect(container).toBeEmptyDOMElement();
    });
  });
  ```

- [ ] **Step 3: Run it and watch it FAIL.**
  ```bash
  npx vitest run components/map/MapLegend.test.tsx
  ```
  EXPECT: FAIL — `Failed to resolve import "./MapLegend"`.

- [ ] **Step 4: Implement `MapLegend`.**
  Create `components/map/MapLegend.tsx`:
  ```tsx
  'use client';

  import { useTranslations } from 'next-intl';

  export interface LegendEntry {
    date: string;
    dayNumber: number;
    color: string;
    visible: boolean;
  }

  /**
   * Horizontal legend chips for the Plan▸Map per-day visibility filter
   * (spec §3.4). Purely presentational: "All days" toggle + one chip per day
   * (color swatch + "Day N"), reflecting visibility via aria-pressed and
   * forwarding taps to the PlanMap handlers. Returns null for the Saved bucket
   * (no days to filter).
   */
  export function MapLegend({
    entries,
    allVisible,
    onToggleDay,
    onToggleAll,
  }: {
    entries: LegendEntry[];
    allVisible: boolean;
    onToggleDay: (date: string) => void;
    onToggleAll: () => void;
  }) {
    const t = useTranslations('planMap');
    if (entries.length === 0) return null;

    return (
      <div
        role="group"
        aria-label={t('legendLabel')}
        className="flex gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <button
          type="button"
          aria-pressed={allVisible}
          onClick={onToggleAll}
          className={`shrink-0 rounded-chip border px-3 py-1.5 text-caption font-medium transition-colors ${
            allVisible
              ? 'border-coral bg-coral-tint text-coral'
              : 'border-line bg-card text-ink-muted'
          }`}
        >
          {t('allDays')}
        </button>

        {entries.map((e) => (
          <button
            key={e.date}
            type="button"
            aria-pressed={e.visible}
            onClick={() => onToggleDay(e.date)}
            className={`flex shrink-0 items-center gap-1.5 rounded-chip border px-3 py-1.5 text-caption font-medium transition-colors ${
              e.visible ? 'border-line bg-card text-ink' : 'border-line bg-card text-ink-faint'
            }`}
          >
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-chip"
              style={{
                backgroundColor: e.visible ? e.color : 'transparent',
                boxShadow: `inset 0 0 0 2px ${e.color}`,
              }}
            />
            {t('dayChip', { n: e.dayNumber })}
          </button>
        ))}
      </div>
    );
  }
  ```

- [ ] **Step 5: Run it and watch it PASS.**
  ```bash
  npx vitest run components/map/MapLegend.test.tsx
  ```
  EXPECT: PASS — `6 passed (6 tests)`.

- [ ] **Step 6: Commit.**
  ```bash
  git add messages/en.json components/map/MapLegend.tsx components/map/MapLegend.test.tsx
  git commit -m "feat(map): i18n strings + presentational legend chip row (spec §3.4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B3.6 — `PlaceInfoCard`: pin-tap info card (name/category/thumb + Open in Google Maps)

**Files:**
- Create: `components/map/PlaceInfoCard.tsx`
- Create: `components/map/PlaceInfoCard.test.tsx`

Tapping a pin opens a compact info card: name, localized category, cached SW-precached thumbnail (`/api/photos/<googlePlaceId>/card`), and "Open in Google Maps" (a plain `placeUrl` deep-link — works offline). In the Saved bucket the card also offers "Add to day →" which calls `onSelectPlace(id)` to let B2's PlanClient handle promotion. The card is presentational and RTL-testable with no Google loader.

- [ ] **Step 1: Write the failing test.**
  Create `components/map/PlaceInfoCard.test.tsx`:
  ```tsx
  import { describe, it, expect, vi, afterEach } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import userEvent from '@testing-library/user-event';
  import { NextIntlClientProvider } from 'next-intl';
  import en from '@/messages/en.json';
  import { PlaceInfoCard } from './PlaceInfoCard';
  import type { PlaceMarker } from '@/src/lib/map/markers';

  const DAY_MARKER: PlaceMarker = {
    id: 'p1',
    name: 'Senso-ji Temple',
    category: 'sightseeing',
    googlePlaceId: 'ChIJ8T1GpMGOGGARDYGSgpooDWw',
    photoPath: '/api/photos/ChIJ8T1GpMGOGGARDYGSgpooDWw/card',
    position: { lat: 35.7148, lng: 139.7967 },
    label: '1',
    color: '#EE5B3C',
  };

  function renderCard(
    marker: PlaceMarker = DAY_MARKER,
    bucket: 'days' | 'saved' = 'days',
    props: Partial<React.ComponentProps<typeof PlaceInfoCard>> = {},
  ) {
    return render(
      <NextIntlClientProvider locale="en" messages={en}>
        <PlaceInfoCard
          marker={marker}
          bucket={bucket}
          onClose={vi.fn()}
          onSelectPlace={vi.fn()}
          {...props}
        />
      </NextIntlClientProvider>,
    );
  }

  afterEach(() => vi.clearAllMocks());

  describe('PlaceInfoCard', () => {
    it('shows the name, localized category, and SW-cached thumbnail', () => {
      renderCard();
      expect(screen.getByText('Senso-ji Temple')).toBeInTheDocument();
      expect(screen.getByText(en.category.sightseeing)).toBeInTheDocument();
      const img = screen.getByRole('img', { name: 'Senso-ji Temple' });
      expect(img).toHaveAttribute('src', '/api/photos/ChIJ8T1GpMGOGGARDYGSgpooDWw/card');
    });

    it('builds an Open-in-Google-Maps link via placeUrl (place_id form)', () => {
      renderCard();
      const link = screen.getByRole('link', { name: en.planMap.openInMaps });
      const u = new URL(link.getAttribute('href')!);
      expect(u.origin + u.pathname).toBe('https://www.google.com/maps/search/');
      expect(u.searchParams.get('query_place_id')).toBe('ChIJ8T1GpMGOGGARDYGSgpooDWw');
    });

    it('falls back to a coordinate query when there is no googlePlaceId', () => {
      renderCard({ ...DAY_MARKER, googlePlaceId: null });
      const link = screen.getByRole('link', { name: en.planMap.openInMaps });
      expect(new URL(link.getAttribute('href')!).searchParams.get('query')).toBe(
        '35.7148,139.7967',
      );
    });

    it('omits the thumbnail when photoPath is null', () => {
      renderCard({ ...DAY_MARKER, photoPath: null });
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('shows "Add to day" only in the Saved bucket and calls onSelectPlace', async () => {
      const onSelectPlace = vi.fn();
      const user = userEvent.setup();
      renderCard(DAY_MARKER, 'saved', { onSelectPlace });
      const btn = screen.getByRole('button', { name: en.planMap.addToDay });
      await user.click(btn);
      expect(onSelectPlace).toHaveBeenCalledWith('p1');
    });

    it('does not show "Add to day" in the days bucket', () => {
      renderCard();
      expect(
        screen.queryByRole('button', { name: en.planMap.addToDay }),
      ).not.toBeInTheDocument();
    });

    it('calls onClose from the close button', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderCard(DAY_MARKER, 'days', { onClose });
      await user.click(screen.getByRole('button', { name: /close/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
  ```

- [ ] **Step 2: Run it and watch it FAIL.**
  ```bash
  npx vitest run components/map/PlaceInfoCard.test.tsx
  ```
  EXPECT: FAIL — `Failed to resolve import "./PlaceInfoCard"`.

- [ ] **Step 3: Implement `PlaceInfoCard`.**
  Create `components/map/PlaceInfoCard.tsx`:
  ```tsx
  'use client';

  import { useTranslations } from 'next-intl';
  import { placeUrl } from '@/src/lib/googleMapsUrl';
  import type { PlaceMarker } from '@/src/lib/map/markers';

  /**
   * Compact pin-tap info card (spec §3.4): name, localized category, SW-cached
   * thumbnail, and "Open in Google Maps" (plain placeUrl — works offline).
   * Saved-bucket pins also expose "Add to day →" which calls onSelectPlace(id);
   * B2's PlanClient owns the actual promote action. Presentational; PlanMap
   * positions and dismisses it.
   */
  export function PlaceInfoCard({
    marker,
    bucket,
    onClose,
    onSelectPlace,
  }: {
    marker: PlaceMarker;
    bucket: 'days' | 'saved';
    onClose: () => void;
    onSelectPlace: (placeId: string) => void;
  }) {
    const t = useTranslations('planMap');
    const tc = useTranslations('category');

    const href = placeUrl({
      name: marker.name,
      lat: marker.position.lat,
      lng: marker.position.lng,
      googlePlaceId: marker.googlePlaceId,
    });

    return (
      <div
        role="dialog"
        aria-label={t('infoCardLabel')}
        className="pointer-events-auto w-72 rounded-card bg-card p-3 shadow-lift"
      >
        <div className="flex items-start gap-3">
          {marker.photoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={marker.photoPath}
              alt={marker.name}
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-control object-cover"
            />
          ) : null}

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-label font-semibold text-ink">{marker.name}</h3>
            <p className="text-caption text-ink-muted">{tc(marker.category)}</p>
          </div>

          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mr-1 -mt-1 shrink-0 rounded-chip p-1 text-ink-faint active:bg-line"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-control bg-coral px-3 py-2 text-center text-caption font-medium text-white active:bg-coral-press"
          >
            {t('openInMaps')}
          </a>

          {bucket === 'saved' ? (
            <button
              type="button"
              onClick={() => onSelectPlace(marker.id)}
              className="rounded-control border border-teal px-3 py-2 text-caption font-medium text-teal active:bg-teal-tint"
            >
              {t('addToDay')}
            </button>
          ) : null}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4: Run it and watch it PASS.**
  ```bash
  npx vitest run components/map/PlaceInfoCard.test.tsx
  ```
  EXPECT: PASS — `7 passed (7 tests)`.

- [ ] **Step 5: Commit.**
  ```bash
  git add components/map/PlaceInfoCard.tsx components/map/PlaceInfoCard.test.tsx
  git commit -m "feat(map): pin-tap info card with offline Open-in-Google-Maps (spec §3.4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B3.7 — `GoogleMapCanvas`: thin Google JS map renderer (markers + polylines)

**Files:**
- Create: `components/map/GoogleMapCanvas.tsx`
- Create: `components/map/GoogleMapCanvas.test.tsx`

This is the thin imperative component that drives `google.maps`: given prepared `PlaceMarker[]` groups and `DayPath[]`, it creates markers, polylines, and calls `fitBounds`. All `google.maps` calls are kept minimal; the test drives it with a **fake `google.maps`** via a mocked `loadGoogleMaps` loader (from B0 at `@/src/lib/googleLoader`). The component receives `onMarkerClick(placeId)` and forwards pin taps to it; PlanMap decides what to show.

- [ ] **Step 1: Write the failing test.**
  Create `components/map/GoogleMapCanvas.test.tsx`:
  ```tsx
  import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
  import { render, screen, waitFor } from '@testing-library/react';
  import type { PlaceMarker } from '@/src/lib/map/markers';
  import type { DayPath } from '@/src/lib/map/types';

  // ---- Fake google.maps captured per render --------------------------------
  type FakeCapture = {
    markers: any[];
    polylines: any[];
    fitBoundsCalls: any[];
  };
  let captured: FakeCapture;

  function makeFakeGoogle() {
    captured = { markers: [], polylines: [], fitBoundsCalls: [] };
    return {
      Map: vi.fn(function (this: any, _el: HTMLElement) {
        this.fitBounds = (b: unknown) => captured.fitBoundsCalls.push(b);
      }),
      Marker: vi.fn(function (this: any, opts: any) {
        this.opts = opts;
        this.listeners = {} as Record<string, () => void>;
        this.addListener = (ev: string, cb: () => void) => {
          this.listeners[ev] = cb;
        };
        captured.markers.push(this);
      }),
      Polyline: vi.fn(function (this: any, opts: any) {
        this.opts = opts;
        captured.polylines.push(this);
      }),
      LatLngBounds: vi.fn(function (this: any) {}),
      LatLng: vi.fn(function (this: any, lat: number, lng: number) {
        this.lat = lat; this.lng = lng;
      }),
      SymbolPath: { CIRCLE: 0 },
    };
  }

  // Mock B0's loader — no real API key in tests.
  const mockLoadGoogleMaps = vi.fn();
  vi.mock('@/src/lib/googleLoader', () => ({
    loadGoogleMaps: () => mockLoadGoogleMaps(),
  }));

  import { GoogleMapCanvas } from './GoogleMapCanvas';

  const MARKERS: PlaceMarker[] = [
    {
      id: 'a', name: 'Senso-ji', category: 'sightseeing', googlePlaceId: 'ga',
      photoPath: null, position: { lat: 35.0, lng: 139.0 }, label: '1', color: '#EE5B3C',
    },
    {
      id: 'b', name: 'Skytree', category: 'activity', googlePlaceId: 'gb',
      photoPath: null, position: { lat: 35.1, lng: 139.1 }, label: '2', color: '#EE5B3C',
    },
  ];
  const PATHS: DayPath[] = [
    { date: '2026-06-04', color: '#EE5B3C',
      path: [{ lat: 35.0, lng: 139.0 }, { lat: 35.1, lng: 139.1 }] },
  ];

  beforeEach(() => {
    mockLoadGoogleMaps.mockReset();
    mockLoadGoogleMaps.mockResolvedValue(makeFakeGoogle());
  });
  afterEach(() => vi.clearAllMocks());

  describe('GoogleMapCanvas', () => {
    it('loads the Maps API and renders the map container', async () => {
      render(
        <GoogleMapCanvas markers={MARKERS} paths={PATHS} onMarkerClick={vi.fn()} />,
      );
      await waitFor(() => expect(mockLoadGoogleMaps).toHaveBeenCalledTimes(1));
      expect(screen.getByTestId('google-map-canvas')).toBeInTheDocument();
    });

    it('creates one marker per entry with correct position and numbered label', async () => {
      render(<GoogleMapCanvas markers={MARKERS} paths={PATHS} onMarkerClick={vi.fn()} />);
      await waitFor(() => expect(captured.markers).toHaveLength(2));
      expect(captured.markers[0].opts.position).toEqual({ lat: 35.0, lng: 139.0 });
      expect(captured.markers[0].opts.label.text).toBe('1');
      expect(captured.markers[1].opts.label.text).toBe('2');
    });

    it('creates a colored polyline per day path', async () => {
      render(<GoogleMapCanvas markers={MARKERS} paths={PATHS} onMarkerClick={vi.fn()} />);
      await waitFor(() => expect(captured.polylines).toHaveLength(1));
      expect(captured.polylines[0].opts.strokeColor).toBe('#EE5B3C');
      expect(captured.polylines[0].opts.path).toEqual([
        { lat: 35.0, lng: 139.0 },
        { lat: 35.1, lng: 139.1 },
      ]);
    });

    it('creates un-labeled, un-numbered markers when label is null (Saved pins)', async () => {
      const savedMarkers: PlaceMarker[] = [
        { id: 's', name: 'Wish', category: 'other', googlePlaceId: null,
          photoPath: null, position: { lat: 35.5, lng: 139.5 }, label: null, color: null },
      ];
      render(<GoogleMapCanvas markers={savedMarkers} paths={[]} onMarkerClick={vi.fn()} />);
      await waitFor(() => expect(captured.markers).toHaveLength(1));
      expect(captured.markers[0].opts.label).toBeUndefined();
    });

    it('calls fitBounds with the marker extent', async () => {
      render(<GoogleMapCanvas markers={MARKERS} paths={PATHS} onMarkerClick={vi.fn()} />);
      await waitFor(() => expect(captured.fitBoundsCalls).toHaveLength(1));
    });

    it('forwards a marker tap with the place id to onMarkerClick', async () => {
      const onMarkerClick = vi.fn();
      render(<GoogleMapCanvas markers={MARKERS} paths={PATHS} onMarkerClick={onMarkerClick} />);
      await waitFor(() => expect(captured.markers).toHaveLength(2));
      captured.markers[0].listeners['click']!();
      expect(onMarkerClick).toHaveBeenCalledWith('a');
    });

    it('renders the container but creates no markers when the loader rejects', async () => {
      mockLoadGoogleMaps.mockRejectedValue(new Error('no key'));
      render(<GoogleMapCanvas markers={MARKERS} paths={PATHS} onMarkerClick={vi.fn()} />);
      await waitFor(() => expect(mockLoadGoogleMaps).toHaveBeenCalled());
      // Container still visible; markers were never created.
      expect(screen.getByTestId('google-map-canvas')).toBeInTheDocument();
      expect(captured.markers).toHaveLength(0);
    });
  });
  ```

- [ ] **Step 2: Run it and watch it FAIL.**
  ```bash
  npx vitest run components/map/GoogleMapCanvas.test.tsx
  ```
  EXPECT: FAIL — `Failed to resolve import "./GoogleMapCanvas"`.

- [ ] **Step 3: Implement `GoogleMapCanvas`.**
  Create `components/map/GoogleMapCanvas.tsx`:
  ```tsx
  'use client';

  import { useEffect, useRef } from 'react';
  import { loadGoogleMaps } from '@/src/lib/googleLoader';
  import type { PlaceMarker } from '@/src/lib/map/markers';
  import type { DayPath } from '@/src/lib/map/types';
  import { computeBounds } from '@/src/lib/map/bounds';

  /**
   * Thin imperative Google Maps JS renderer (spec §3.4). Given the prepared
   * marker list + colored day paths (from B3's pure helpers), creates numbered
   * colored markers, route polylines, and fits the viewport. All data-prep is
   * in the pure helpers; this file only translates to google.maps objects so
   * the test drives it with a fake maps namespace via a mocked loader.
   *
   * Re-renders from prop changes rebuild overlays cleanly via the effect
   * cleanup path (visibility filtering is applied upstream in PlanMap).
   */
  export function GoogleMapCanvas({
    markers,
    paths,
    onMarkerClick,
  }: {
    markers: PlaceMarker[];
    paths: DayPath[];
    onMarkerClick: (placeId: string) => void;
  }) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    // Keep the latest callback without forcing a full map rebuild.
    const clickRef = useRef(onMarkerClick);
    clickRef.current = onMarkerClick;

    useEffect(() => {
      let cancelled = false;
      // Track overlays from this run so cleanup can remove them.
      const overlays: Array<{ setMap: (m: unknown) => void }> = [];

      void (async () => {
        let maps: typeof google.maps;
        try {
          maps = await loadGoogleMaps();
        } catch {
          // Offline / missing key — PlanMap shows the offline state; here we
          // simply render an empty container (spec §3.4).
          return;
        }
        if (cancelled || !containerRef.current) return;

        const allPositions = markers.map((m) => m.position);
        const bounds = computeBounds(allPositions);
        const center = bounds
          ? { lat: (bounds.south + bounds.north) / 2, lng: (bounds.west + bounds.east) / 2 }
          : { lat: 0, lng: 0 };

        const map = new maps.Map(containerRef.current, {
          center,
          zoom: 12,
          disableDefaultUI: false,
          clickableIcons: false,
        });

        // Polylines under the markers.
        for (const dp of paths) {
          if (dp.path.length < 2) continue;
          const line = new maps.Polyline({
            path: dp.path,
            strokeColor: dp.color,
            strokeOpacity: 0.9,
            strokeWeight: 4,
            map,
          });
          overlays.push(line as unknown as { setMap: (m: unknown) => void });
        }

        // Numbered, colored markers (Coral label text, spec §3.4).
        for (const m of markers) {
          const marker = new maps.Marker({
            position: m.position,
            map,
            title: m.name,
            label: m.label
              ? { text: m.label, color: '#FFFFFF', fontSize: '12px', fontWeight: '700' }
              : undefined,
            icon: {
              path: maps.SymbolPath?.CIRCLE ?? 0,
              scale: m.label ? 12 : 9,
              fillColor: m.color ?? '#4F8A86',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2,
            },
          });
          const id = m.id;
          marker.addListener('click', () => clickRef.current(id));
          overlays.push(marker as unknown as { setMap: (m: unknown) => void });
        }

        if (bounds) {
          map.fitBounds(
            new maps.LatLngBounds(
              new maps.LatLng(bounds.south, bounds.west),
              new maps.LatLng(bounds.north, bounds.east),
            ),
          );
        }
      })();

      return () => {
        cancelled = true;
        for (const o of overlays) o.setMap(null);
      };
    }, [markers, paths]);

    return (
      <div
        ref={containerRef}
        data-testid="google-map-canvas"
        className="h-full w-full"
      />
    );
  }
  ```

- [ ] **Step 4: Run it and watch it PASS.**
  ```bash
  npx vitest run components/map/GoogleMapCanvas.test.tsx
  ```
  EXPECT: PASS — `7 passed (7 tests)`.

- [ ] **Step 5: Commit.**
  ```bash
  git add components/map/GoogleMapCanvas.tsx components/map/GoogleMapCanvas.test.tsx
  git commit -m "feat(map): thin Google JS map renderer — markers + polylines + fitBounds (spec §3.4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B3.8 — `PlanMap`: the self-contained top-level map component (the B3 deliverable)

**Files:**
- Create: `components/plan/PlanMap.tsx`
- Create: `components/plan/PlanMap.test.tsx`

This is the single component B2's PlanClient mounts when `view=map`. It receives the exact RESOLUTIONS seam props, owns the in-component visibility state (driven by `visibleDates`/`onToggleDate` from the parent), branches on `online`, assembles marker groups and day paths from the day-group props, and composes the sub-components built in B3.1–B3.7. It never imports `PlanClient`. The test mocks `GoogleMapCanvas` and controls `online` via a mocked `useOnline` hook.

- [ ] **Step 1: Write the failing test.**
  Create `components/plan/PlanMap.test.tsx`:
  ```tsx
  import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
  import { render, screen, waitFor } from '@testing-library/react';
  import userEvent from '@testing-library/user-event';
  import { NextIntlClientProvider } from 'next-intl';
  import en from '@/messages/en.json';
  import type { DayGroup, LegDTO } from '@/src/lib/map/types';

  // Control connectivity.
  const mockOnline = vi.fn(() => true);
  vi.mock('@/src/lib/useOnline', () => ({ useOnline: () => mockOnline() }));

  // Stub GoogleMapCanvas: render pins as tappable buttons.
  vi.mock('@/components/map/GoogleMapCanvas', () => ({
    GoogleMapCanvas: ({
      markers,
      onMarkerClick,
    }: {
      markers: { id: string; name: string }[];
      onMarkerClick: (id: string) => void;
    }) => (
      <div data-testid="map-canvas">
        {markers.map((m) => (
          <button key={m.id} type="button" onClick={() => onMarkerClick(m.id)}>
            pin:{m.name}
          </button>
        ))}
      </div>
    ),
  }));

  import { PlanMap } from './PlanMap';

  function place(id: string, orderIndex: number, lat: number, lng: number,
                 googlePlaceId: string | null = null) {
    return {
      id, orderIndex, lat, lng, name: id, category: 'other' as const,
      tripId: 't', dayDate: '2026-06-04', googlePlaceId,
      address: null, scheduledTime: null, durationMin: null, cost: null,
      notes: null, photoPath: googlePlaceId ? `/api/photos/${googlePlaceId}/card` : null,
    };
  }

  const DAY_GROUPS: DayGroup[] = [
    {
      date: '2026-06-04', dayNumber: 1, colorIndex: 0,
      places: [
        place('a', 0, 35.0, 139.0, 'ga'),
        place('b', 1, 35.1, 139.1, 'gb'),
      ],
    },
    {
      date: '2026-06-05', dayNumber: 2, colorIndex: 1,
      places: [place('c', 0, 35.2, 139.2, 'gc')],
    },
  ];
  const LEGS: LegDTO[] = [];
  const ALL_DATES = new Set(['2026-06-04', '2026-06-05']);

  const onToggleDate = vi.fn();
  const onSelectPlace = vi.fn();
  const onOpenDayRoute = vi.fn();

  function renderMap(overrides: Partial<React.ComponentProps<typeof PlanMap>> = {}) {
    return render(
      <NextIntlClientProvider locale="en" messages={en}>
        <PlanMap
          bucket="days"
          dayGroups={DAY_GROUPS}
          legs={LEGS}
          mode="walk"
          visibleDates={ALL_DATES}
          onToggleDate={onToggleDate}
          onSelectPlace={onSelectPlace}
          onOpenDayRoute={onOpenDayRoute}
          online={true}
          {...overrides}
        />
      </NextIntlClientProvider>,
    );
  }

  beforeEach(() => {
    mockOnline.mockReturnValue(true);
    vi.clearAllMocks();
  });
  afterEach(() => vi.clearAllMocks());

  describe('PlanMap (online, days bucket)', () => {
    it('renders the map canvas and the legend', () => {
      renderMap();
      expect(screen.getByTestId('map-canvas')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: en.planMap.allDays })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Day 1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Day 2' })).toBeInTheDocument();
    });

    it('renders pins for ALL visible day-group places', () => {
      renderMap();
      expect(screen.getByRole('button', { name: 'pin:a' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'pin:b' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'pin:c' })).toBeInTheDocument();
    });

    it('calls onToggleDate when a day chip is clicked', async () => {
      const user = userEvent.setup();
      renderMap();
      await user.click(screen.getByRole('button', { name: 'Day 1' }));
      expect(onToggleDate).toHaveBeenCalledWith('2026-06-04');
    });

    it('hides pins for dates not in visibleDates', () => {
      renderMap({ visibleDates: new Set(['2026-06-05']) });
      expect(screen.queryByRole('button', { name: 'pin:a' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'pin:c' })).toBeInTheDocument();
    });

    it('opens the info card on pin tap with the correct place data', async () => {
      const user = userEvent.setup();
      renderMap();
      await user.click(screen.getByRole('button', { name: 'pin:a' }));
      expect(screen.getByRole('dialog', { name: en.planMap.infoCardLabel })).toBeInTheDocument();
      expect(screen.getByText('a')).toBeInTheDocument();
    });

    it('calls onSelectPlace when the Saved-bucket "Add to day" is tapped', async () => {
      const user = userEvent.setup();
      const savedGroup: DayGroup = {
        date: null, dayNumber: null, colorIndex: 0,
        places: [place('s', 0, 35.5, 139.5, 'gs')],
      };
      renderMap({ bucket: 'saved', dayGroups: [savedGroup], visibleDates: new Set() });
      await user.click(screen.getByRole('button', { name: 'pin:s' }));
      const addBtn = screen.getByRole('button', { name: en.planMap.addToDay });
      await user.click(addBtn);
      expect(onSelectPlace).toHaveBeenCalledWith('s');
    });

    it('renders a per-day "Open day route in Google Maps" link calling onOpenDayRoute', async () => {
      const user = userEvent.setup();
      renderMap();
      // There should be one link per day with visible places.
      const links = screen.getAllByRole('link', { name: en.planMap.openDayRoute });
      expect(links.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PlanMap (online, saved bucket)', () => {
    it('renders saved pins with no legend (no day chips)', () => {
      const savedGroup: DayGroup = {
        date: null, dayNumber: null, colorIndex: 0,
        places: [place('s', 0, 35.5, 139.5)],
      };
      renderMap({ bucket: 'saved', dayGroups: [savedGroup], visibleDates: new Set() });
      expect(screen.queryByRole('button', { name: en.planMap.allDays })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'pin:s' })).toBeInTheDocument();
    });
  });

  describe('PlanMap (offline)', () => {
    it('shows the mascot offline placeholder instead of the map canvas', () => {
      renderMap({ online: false });
      expect(screen.queryByTestId('map-canvas')).not.toBeInTheDocument();
      expect(screen.getByText(en.planMap.offlineHeadline)).toBeInTheDocument();
    });

    it('lists visible places as Open-in-Google-Maps deep links when offline', () => {
      renderMap({ online: false });
      expect(screen.getByRole('link', { name: /^a$/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^c$/ })).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2: Run it and watch it FAIL.**
  ```bash
  npx vitest run components/plan/PlanMap.test.tsx
  ```
  EXPECT: FAIL — `Failed to resolve import "./PlanMap"`.

- [ ] **Step 3: Implement `PlanMap`.**
  Create `components/plan/PlanMap.tsx`:
  ```tsx
  'use client';

  import { useMemo, useState } from 'react';
  import { useTranslations } from 'next-intl';
  import type { DayGroup, LegDTO, LatLngLiteral } from '@/src/lib/map/types';
  import type { TravelMode } from '@/src/lib/googleMapsUrl';
  import { dayRouteUrl, placeUrl } from '@/src/lib/googleMapsUrl';
  import { buildMarkers, buildSavedMarkers, type PlaceMarker } from '@/src/lib/map/markers';
  import { buildDayPaths } from '@/src/lib/map/polyline';
  import { colorForGroup } from '@/src/lib/map/colors';
  import { GoogleMapCanvas } from '@/components/map/GoogleMapCanvas';
  import { MapLegend, type LegendEntry } from '@/components/map/MapLegend';
  import { PlaceInfoCard } from '@/components/map/PlaceInfoCard';
  import { EmptyState } from '@/components/EmptyState';

  export type PlanMapBucket = 'days' | 'saved';

  /**
   * Self-contained Plan▸Map component (spec §3.4 / RESOLUTIONS §PlanMap seam).
   * Receives everything via props — never fetches, never imports PlanClient.
   * B2's PlanClient owns dayGroups/visibleDates/handlers; B3 consumes them.
   *
   * Online: renders GoogleMapCanvas + MapLegend + per-day "Open day route" links
   *         + PlaceInfoCard on pin tap.
   * Offline: renders the mascot EmptyState + each visible place as a placeUrl
   *          deep-link (constructible offline from cached coords).
   * Saved bucket: un-routed pins (no polylines, no legend).
   */
  export function PlanMap({
    bucket,
    dayGroups,
    legs,
    mode,
    visibleDates,
    onToggleDate,
    onSelectPlace,
    onOpenDayRoute,
    online,
  }: {
    bucket: PlanMapBucket;
    dayGroups: DayGroup[];
    legs: LegDTO[];
    mode: TravelMode;
    visibleDates: Set<string>;
    onToggleDate: (date: string) => void;
    onSelectPlace: (placeId: string) => void;
    onOpenDayRoute: (date: string) => void;
    online: boolean;
  }) {
    const t = useTranslations('planMap');
    const tm = useTranslations('mascot');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // --- Days bucket: filter groups to visible, build markers + polylines. ---
    const visibleDayGroups = useMemo(
      () =>
        bucket === 'days'
          ? dayGroups.filter((g) => g.date !== null && visibleDates.has(g.date!))
          : [],
      [bucket, dayGroups, visibleDates],
    );

    const dayMarkers = useMemo(
      () => visibleDayGroups.flatMap((g) => buildMarkers(g)),
      [visibleDayGroups],
    );

    const dayPaths = useMemo(
      () => (bucket === 'days' ? buildDayPaths(visibleDayGroups, legs) : []),
      [bucket, visibleDayGroups, legs],
    );

    // --- Saved bucket: flat un-numbered markers. ---
    const savedMarkers = useMemo(
      () =>
        bucket === 'saved'
          ? buildSavedMarkers(dayGroups.flatMap((g) => g.places))
          : [],
      [bucket, dayGroups],
    );

    const activeMarkers: PlaceMarker[] = bucket === 'days' ? dayMarkers : savedMarkers;

    // --- Legend (days bucket only): all day groups flagged by visibleDates. ---
    const legend: LegendEntry[] = useMemo(
      () =>
        bucket === 'days'
          ? dayGroups
              .filter((g) => g.date !== null)
              .map((g) => ({
                date: g.date!,
                dayNumber: g.dayNumber ?? 1,
                color: colorForGroup(g),
                visible: visibleDates.has(g.date!),
              }))
          : [],
      [bucket, dayGroups, visibleDates],
    );

    const allVisible =
      legend.length > 0 && legend.every((l) => l.visible);

    // --- Per-day "Open day route" deep-links. ---
    const routeLinks = useMemo(
      () =>
        bucket === 'days'
          ? visibleDayGroups
              .map((g) => {
                const pts: LatLngLiteral[] = g.places
                  .slice()
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .filter(
                    (p): p is typeof p & { lat: number; lng: number } =>
                      typeof p.lat === 'number' && typeof p.lng === 'number',
                  )
                  .map((p) => ({ lat: p.lat, lng: p.lng }));
                if (pts.length === 0 || !g.date) return null;
                return {
                  date: g.date,
                  color: colorForGroup(g),
                  url: dayRouteUrl(pts, mode),
                };
              })
              .filter(Boolean)
          : [],
      [bucket, visibleDayGroups, mode],
    ) as Array<{ date: string; color: string; url: string }>;

    // --- Marker id → place lookup for the info card. ---
    const markerById = useMemo(() => {
      const m = new Map<string, PlaceMarker>();
      for (const mk of activeMarkers) m.set(mk.id, mk);
      return m;
    }, [activeMarkers]);

    const selectedMarker = selectedId ? (markerById.get(selectedId) ?? null) : null;

    // --- Offline branch. ---
    if (!online) {
      // Collect all plottable visible places as deep-links (works offline).
      const offlinePlaces = bucket === 'days'
        ? visibleDayGroups.flatMap((g) =>
            g.places
              .filter(
                (p): p is typeof p & { lat: number; lng: number } =>
                  typeof p.lat === 'number' && typeof p.lng === 'number',
              )
              .map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, googlePlaceId: p.googlePlaceId }))
          )
        : dayGroups
            .flatMap((g) => g.places)
            .filter(
              (p): p is typeof p & { lat: number; lng: number } =>
                typeof p.lat === 'number' && typeof p.lng === 'number',
            )
            .map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, googlePlaceId: p.googlePlaceId }));

      return (
        <div className="flex flex-col">
          <EmptyState
            mascotAlt={tm('alt')}
            headline={t('offlineHeadline')}
            subtext={t('offlineSubtext')}
          />
          {offlinePlaces.length > 0 ? (
            <ul className="space-y-2 px-4 pb-6">
              {offlinePlaces.map((p) => (
                <li key={p.id}>
                  <a
                    href={placeUrl({
                      name: p.name,
                      lat: p.lat,
                      lng: p.lng,
                      googlePlaceId: p.googlePlaceId,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-card bg-card px-4 py-3 text-label text-ink shadow-card"
                  >
                    <span className="truncate">{p.name}</span>
                    <span aria-hidden="true" className="ml-2 shrink-0 text-teal">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    }

    // --- Online branch. ---
    return (
      <div className="flex flex-col">
        {bucket === 'days' ? (
          <MapLegend
            entries={legend}
            allVisible={allVisible}
            onToggleDay={onToggleDate}
            onToggleAll={() => {
              // When all are visible, hide all; when any are hidden, show all.
              const allDates = dayGroups
                .filter((g) => g.date !== null)
                .map((g) => g.date!);
              if (allVisible) {
                allDates.forEach((d) => {
                  if (visibleDates.has(d)) onToggleDate(d);
                });
              } else {
                allDates.forEach((d) => {
                  if (!visibleDates.has(d)) onToggleDate(d);
                });
              }
            }}
          />
        ) : null}

        <div className="relative h-[52vh] w-full overflow-hidden rounded-card">
          <GoogleMapCanvas
            markers={activeMarkers}
            paths={dayPaths}
            onMarkerClick={(id) => setSelectedId(id)}
          />

          {selectedMarker ? (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
              <PlaceInfoCard
                marker={selectedMarker}
                bucket={bucket}
                onClose={() => setSelectedId(null)}
                onSelectPlace={(id) => {
                  onSelectPlace(id);
                  setSelectedId(null);
                }}
              />
            </div>
          ) : null}
        </div>

        {bucket === 'days' && routeLinks.length > 0 ? (
          <ul className="space-y-2 px-3 py-3">
            {routeLinks.map((r) => (
              <li key={r.date}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenDayRoute(r.date);
                    window.open(r.url, '_blank', 'noopener,noreferrer');
                  }}
                  className="flex items-center gap-2 rounded-control border border-line bg-card px-3 py-2 text-caption font-medium text-teal"
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-chip"
                    style={{ backgroundColor: r.color }}
                  />
                  {t('openDayRoute')}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  ```

- [ ] **Step 4: Run it and watch it PASS.**
  ```bash
  npx vitest run components/plan/PlanMap.test.tsx
  ```
  EXPECT: PASS — `10 passed (10 tests)`.

  **If the `onToggleAll` toggle-all test is brittle** (the test drives `onToggleDate` individually — it does not test toggle-all directly; the toggle-all logic calls `onToggleDate` in a loop over allGroups dates, which is correct but order-dependent): adjust only the test assertion to `expect(onToggleDate).toHaveBeenCalledTimes(...)` rather than checking order — the behavior is correct.

- [ ] **Step 5: Commit.**
  ```bash
  git add components/plan/PlanMap.tsx components/plan/PlanMap.test.tsx
  git commit -m "feat(map): PlanMap — self-contained map component (seam §B3, spec §3.4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task B3.9 — Full B3 suite verification: typecheck + build

**Files:** (no new files; verification only)

Run the complete B3 test suite, typecheck, and build to confirm the entire surface is green before handing off to B2 for mounting.

- [ ] **Step 1: Run all B3 tests.**
  ```bash
  npx vitest run src/lib/map components/map components/plan/PlanMap.test.tsx
  ```
  EXPECT: ALL PASS — `0 failed`. The test count across all B3 tasks should total approximately 60+ tests.

- [ ] **Step 2: TypeScript check.**
  ```bash
  npx tsc --noEmit -p tsconfig.json
  ```
  EXPECT: No output, exit code 0.

  **Common type errors to fix if they appear:**
  - `google.maps` namespace not found: verify `@types/google.maps` is installed (`npm install --save-dev @types/google.maps`) and that `tsconfig.json` includes `"types": ["@types/google.maps"]` or references the package.
  - `SymbolPath` undefined: already guarded with `?.` and `?? 0` in `GoogleMapCanvas.tsx`.
  - `PlaceDTO` not matching `Place` from schema: `PlaceDTO` is defined in `src/lib/map/types.ts` and is the client DTO shape (includes `photoPath`, omits DB-only fields like `createdAt`). Ensure tests and components import from `@/src/lib/map/types` not `@/src/db/schema`.

- [ ] **Step 3: Build.**
  ```bash
  npm run build
  ```
  EXPECT: Next.js build succeeds. The `components/plan/PlanMap.tsx` is a client component (`'use client'`) so it participates in the client bundle. No SW changes are needed in B3 (the existing `google` NetworkOnly rule in `app/sw.ts` already covers Google Maps JS and `/api/google/*` traffic).

- [ ] **Step 4: Commit the verification.**
  If any type fixes were needed (e.g. installing `@types/google.maps`):
  ```bash
  git add package.json package-lock.json tsconfig.json   # only if changed
  git commit -m "chore(map): install @types/google.maps + tsconfig for B3 typecheck

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```
  If everything was already green (no changes needed), skip this commit.

---

## B3 Summary

| Task  | Files Created                                                      | Tests |
|-------|--------------------------------------------------------------------|-------|
| B3.1  | `src/lib/map/colors.ts` + `.test.ts`                               | ~8    |
| B3.2  | `src/lib/map/types.ts`, `polyline.ts` + `.test.ts`                 | ~9    |
| B3.3  | `src/lib/map/bounds.ts` + `.test.ts`                               | ~4    |
| B3.4  | `src/lib/map/markers.ts` + `.test.ts`                              | ~9    |
| B3.5  | `messages/en.json` (modified), `components/map/MapLegend.tsx` + `.test.tsx` | ~6 |
| B3.6  | `components/map/PlaceInfoCard.tsx` + `.test.tsx`                   | ~7    |
| B3.7  | `components/map/GoogleMapCanvas.tsx` + `.test.tsx`                 | ~7    |
| B3.8  | `components/plan/PlanMap.tsx` + `.test.tsx`                        | ~10   |
| B3.9  | (verification — no new files)                                      | —     |

**PlanMap prop contract** (exact match to RESOLUTIONS §PlanMap seam):
```ts
PlanMap({
  bucket: 'days' | 'saved',
  dayGroups: Array<{ date: string|null, dayNumber: number|null, colorIndex: number, places: PlaceDTO[] }>,
  legs: LegDTO[],
  mode: TravelMode,
  visibleDates: Set<string>,
  onToggleDate: (date: string) => void,
  onSelectPlace: (placeId: string) => void,
  onOpenDayRoute: (date: string) => void,
  online: boolean,
})
```

**RESOLUTIONS compliance:**
- PlanMap is pure-props. It never imports PlanClient, never fetches, never edits any shared file.
- No module-scope mutable state (`seenDates` from the draft is NOT present — `const visibleSynced = visible` per RESOLUTIONS §TDD quality fixes).
- `onOpenDayRoute` fires via B3's per-day link click; `dayRouteUrl` is called locally within `PlanMap` from `@/src/lib/googleMapsUrl`.
- Polylines: real decode when `leg.polyline` is non-null; straight-line fallback when null.
- `online === false`: EmptyState mascot + deep-link list (no Google map load).
- `bucket === 'saved'`: un-routed pins, no polylines, no legend.
- All strings via `messages/en.json` `planMap`/`category` namespaces.
- `@types/google.maps` mocked in every test via `vi.mock('@/src/lib/googleLoader', ...)`.
