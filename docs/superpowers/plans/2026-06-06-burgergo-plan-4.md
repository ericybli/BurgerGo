# BurgerGo Plan 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eight Plan-tab/place improvements — single-day map isolation, exact-on-coordinate pins, an AI place summary (OpenAI), per-place travel-guide links, a rich read view (map pin + list View), touch-friendly reordering, distinct card action pills, and a scroll-locked app shell.

**Architecture:** Builds on existing BurgerGo conventions — Drizzle/better-sqlite3 (migration `0005`), pure repos, online-only Server Actions, static-shell + client-fetch reads, Mapbox the active map renderer. One new server service (OpenAI via `fetch`, no SDK). Reuses the photo + link/OG-preview/SSRF pipelines. No new runtime npm dependencies.

**Tech Stack:** Next.js 15 App Router, TypeScript (strict, `noUncheckedIndexedAccess`), Drizzle ORM, Vitest + Testing Library, Tailwind v3, next-intl (English only), `gpt-4o-mini` over REST.

**Spec:** `docs/superpowers/specs/2026-06-06-burgergo-plan-4-design.md`

**Conventions (do not violate):**
- DB timestamps are Unix **seconds** (`{mode:'timestamp'}`); repos use `new Date(now())`.
- `OPENAI_API_KEY` is **server-only** — never `NEXT_PUBLIC`, never logged. Read via `env.OPENAI_API_KEY`.
- `tsc` is a required gate (vitest strips types). Run `npx tsc --noEmit` before each commit that changes types.
- Money = integer minor units; keep photo/link path-traversal + link-preview SSRF guards intact.
- Tests run with `npx vitest run <file>`. Full gate before deploy: `npx vitest run && npx tsc --noEmit && npx eslint <changed> && npm run build`.

---

## File Structure

**Created:**
- `drizzle/0005_*.sql` — generated migration (places.ai_summary, saved_links.place_id).
- `src/lib/openai/server.ts` — server-only OpenAI summary generator (fetch, no SDK).
- `src/lib/openai/server.test.ts` — unit tests (mocked fetch).
- `components/plan/PlaceReadCard.tsx` — rich read view (photo / AI summary / notes / links, show-more).
- `components/plan/PlaceReadCard.test.tsx`.
- `components/plan/PlaceLinks.tsx` — per-place link add/list/remove sub-form (mirrors LinkSheet).
- `components/plan/PlaceLinks.test.tsx`.

**Modified:**
- `src/db/schema.ts` — add columns; `src/db/schema.shape.test.ts` — update expected columns.
- `src/env.ts` — add optional `OPENAI_API_KEY`.
- `src/db/repos/places.ts` — `aiSummary` in `PlacePatch`.
- `src/db/repos/savedLinks.ts` (+`.test.ts`) — `placeId` on add, `listLinksForTrip` excludes place links, new `listLinksForPlace`.
- `app/_actions/places.ts` (+ `places.test.ts`) — `aiSummary` in `updateSchema`; new `generatePlaceSummaryAction`.
- `app/_actions/savedLinks.ts` (+ `savedLinks.test.ts`) — `placeId` on `addLinkAction`.
- `app/api/trips/[tripId]/places/route.ts` (+ `route.test.ts`) — DTO gains `aiSummary` + `links`.
- `src/lib/planView.ts` — `PlaceDTO` gains `aiSummary` + `links`.
- `components/map/MapLegend.tsx` (+ `.test.tsx`) — single-select day filter.
- `components/map/MapboxCanvas.tsx` — number badge bottom-centered.
- `components/plan/PlanMap.tsx` (+ `.test.tsx`) — read card on pin tap; legend handlers.
- `components/plan/PlanClient.tsx` (+ `.test.tsx`) — show-only/show-all handlers; list View → read card; fire summary after add.
- `components/plan/PlaceDetailSheet.tsx` (+ `.test.tsx`) — aiSummary field + Regenerate + PlaceLinks section.
- `components/plan/PlaceCard.tsx` (+ `.test.tsx`) — pill buttons + ▲/▼.
- `components/plan/DayItinerary.tsx` (+ `.test.tsx`) — `onMove`; remove HTML5 DnD.
- `components/plan/AddPlaceSheet.tsx` (+ `.test.tsx`) — fire `generatePlaceSummaryAction` after add.
- `app/globals.css`, `components/TripShellClient.tsx` — scroll lock.
- `messages/en.json` — new keys.
- `docker-compose.yml` already passes `OPENAI_API_KEY` (done).

---

# Group D0 — Data & services

### Task 1: Migration 0005 — `places.ai_summary` + `saved_links.place_id`

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0005_*.sql` (generated)
- Modify: `src/db/schema.shape.test.ts`

- [ ] **Step 1: Add the columns to the schema.** In `src/db/schema.ts`, in the `places` table add after `notes`:

```ts
    notes: text('notes'),
    aiSummary: text('ai_summary'), // OpenAI-generated intro; editable; null until generated
```

In the `savedLinks` table add after `thumbnail`:

```ts
    thumbnail: text('thumbnail'), // relative derivative path; null if none
    placeId: text('place_id').references(() => places.id, { onDelete: 'cascade' }), // null = trip reading list
```

- [ ] **Step 2: Generate the migration.**

Run: `npm run db:generate`
Expected: prints a new `drizzle/0005_*.sql` and `drizzle/meta/0005_snapshot.json`. The SQL should be two `ALTER TABLE ... ADD` statements (`places.ai_summary`, `saved_links.place_id`).

- [ ] **Step 3: Update the schema-shape test.** In `src/db/schema.shape.test.ts`, find the `places` column assertion and add `'ai_summary'`; find the `saved_links` assertion (search `columnNames(savedLinks)`) and add `'place_id'`. If `saved_links` has no shape test yet, skip its edit.

- [ ] **Step 4: Run the shape test.**

Run: `npx vitest run src/db/schema.shape.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/db/schema.ts src/db/schema.shape.test.ts drizzle/0005_*.sql drizzle/meta/
git commit -m "feat(db): migration 0005 — places.ai_summary + saved_links.place_id"
```

---

### Task 2: `places` repo — allow patching `aiSummary`

**Files:**
- Modify: `src/db/repos/places.ts`
- Test: `src/db/repos/places.test.ts` (add a case)

- [ ] **Step 1: Write the failing test.** Add to `src/db/repos/places.test.ts` inside the existing `describe`:

```ts
it('updatePlace persists aiSummary', () => {
  const { db, tripId } = setup(); // use this file's existing setup helper
  const p = addPlace(db, { tripId, name: 'X', category: 'other', dayDate: '2026-06-02' });
  const updated = updatePlace(db, p.id, { aiSummary: 'A lovely spot.' });
  expect(updated?.aiSummary).toBe('A lovely spot.');
});
```

(If the file's setup differs, match its existing pattern for creating a trip + place.)

- [ ] **Step 2: Run it — expect FAIL** (tsc/type error: `aiSummary` not in `PlacePatch`).

Run: `npx vitest run src/db/repos/places.test.ts`

- [ ] **Step 3: Add `aiSummary` to `PlacePatch`.** In `src/db/repos/places.ts`:

```ts
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
    | 'aiSummary'
  >
>;
```

`updatePlace` already spreads the patch, so no other change is needed.

- [ ] **Step 4: Run it — expect PASS.**

Run: `npx vitest run src/db/repos/places.test.ts`

- [ ] **Step 5: Commit.**

```bash
git add src/db/repos/places.ts src/db/repos/places.test.ts
git commit -m "feat(places): allow patching aiSummary"
```

---

### Task 3: `savedLinks` repo — place scoping

**Files:**
- Modify: `src/db/repos/savedLinks.ts`
- Test: `src/db/repos/savedLinks.test.ts`

- [ ] **Step 1: Write failing tests.** Add to `src/db/repos/savedLinks.test.ts` (match its existing trip-seed helper; below assumes a `makeTestDb` + a seeded `tripId='t1'` and a place id — create a place via the places repo or insert directly):

```ts
import { addPlace } from '@/src/db/repos/places';
import { addLink, listLinksForTrip, listLinksForPlace } from '@/src/db/repos/savedLinks';

it('place links are excluded from the trip reading list and listed per place', () => {
  const { db } = makeTestDb();
  // seed a trip 't1' the same way other tests in this file do, then:
  const place = addPlace(db, { tripId: 't1', name: 'P', category: 'other', dayDate: '2026-06-02' });
  addLink(db, { tripId: 't1', url: 'https://a.example' });                 // reading list
  addLink(db, { tripId: 't1', url: 'https://b.example', placeId: place.id }); // place link
  expect(listLinksForTrip(db, 't1').map((l) => l.url)).toEqual(['https://a.example']);
  expect(listLinksForPlace(db, place.id).map((l) => l.url)).toEqual(['https://b.example']);
});
```

- [ ] **Step 2: Run it — expect FAIL** (`placeId` not accepted; `listLinksForPlace` undefined).

Run: `npx vitest run src/db/repos/savedLinks.test.ts`

- [ ] **Step 3: Implement.** In `src/db/repos/savedLinks.ts`:

Add `isNull` to the drizzle import:

```ts
import { and, desc, eq, isNull } from 'drizzle-orm';
```

Extend `AddLinkInput` and `addLink`:

```ts
export interface AddLinkInput {
  tripId: string;
  url: string;
  title?: string | null;
  note?: string | null;
  thumbnail?: string | null; // relative derivative path
  placeId?: string | null;   // null = trip reading list
}

export function addLink(db: Db, input: AddLinkInput): SavedLink {
  const ts = new Date(now());
  const row: SavedLink = {
    id: newId(),
    tripId: input.tripId,
    url: input.url,
    title: input.title ?? null,
    note: input.note ?? null,
    thumbnail: input.thumbnail ?? null,
    placeId: input.placeId ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(savedLinks).values(row).run();
  return row;
}
```

Scope `listLinksForTrip` to the reading list and add a per-place lister:

```ts
/** Trip reading-list links (place_id IS NULL), newest first. */
export function listLinksForTrip(db: Db, tripId: string): SavedLink[] {
  return db
    .select()
    .from(savedLinks)
    .where(and(eq(savedLinks.tripId, tripId), isNull(savedLinks.placeId)))
    .orderBy(desc(savedLinks.createdAt))
    .all();
}

/** Links attached to a place, newest first. */
export function listLinksForPlace(db: Db, placeId: string): SavedLink[] {
  return db
    .select()
    .from(savedLinks)
    .where(eq(savedLinks.placeId, placeId))
    .orderBy(desc(savedLinks.createdAt))
    .all();
}
```

- [ ] **Step 4: Run it — expect PASS.** Also run the existing reading-list tests to confirm none regressed.

Run: `npx vitest run src/db/repos/savedLinks.test.ts`

- [ ] **Step 5: Commit.**

```bash
git add src/db/repos/savedLinks.ts src/db/repos/savedLinks.test.ts
git commit -m "feat(links): place-scope saved links (place_id) + listLinksForPlace"
```

---

### Task 4: `addLinkAction` accepts `placeId`

**Files:**
- Modify: `app/_actions/savedLinks.ts`
- Test: `app/_actions/savedLinks.test.ts`

- [ ] **Step 1: Write the failing test.** Add to `app/_actions/savedLinks.test.ts` (match its existing seed):

```ts
it('addLinkAction stores placeId and revalidates the plan', async () => {
  // seed trip 't1' + a place 'p1' as the file's other tests do
  const link = await addLinkAction({ tripId: 't1', url: 'https://g.example', placeId: 'p1' });
  expect(link.placeId).toBe('p1');
});
```

- [ ] **Step 2: Run it — expect FAIL** (`placeId` rejected by schema).

Run: `npx vitest run app/_actions/savedLinks.test.ts`

- [ ] **Step 3: Implement.** In `app/_actions/savedLinks.ts`, extend `addSchema`, pass `placeId`, and revalidate the plan when place-scoped:

```ts
const addSchema = z.object({
  tripId: z.string().min(1),
  url: urlField,
  title: z.string().max(2000).nullish(),
  note: z.string().max(4000).nullish(),
  thumbnail: z.string().max(1000).nullish(),
  placeId: z.string().min(1).nullish(),
});

export async function addLinkAction(input: AddLinkActionInput): Promise<SavedLink> {
  const data = addSchema.parse(input);
  const link = addLink(db, {
    tripId: data.tripId,
    url: data.url,
    title: data.title ?? null,
    note: data.note ?? null,
    thumbnail: data.thumbnail ?? null,
    placeId: data.placeId ?? null,
  });
  if (data.placeId) revalidatePath(`/trip/${data.tripId}/plan`);
  else revalidateJournal(data.tripId);
  return link;
}
```

(Add `import { revalidatePath } from 'next/cache';` if not already imported — it is.)

- [ ] **Step 4: Run it — expect PASS.**

Run: `npx vitest run app/_actions/savedLinks.test.ts`

- [ ] **Step 5: Commit.**

```bash
git add app/_actions/savedLinks.ts app/_actions/savedLinks.test.ts
git commit -m "feat(links): addLinkAction accepts placeId (place-scoped links)"
```

---

### Task 5: OpenAI summary service + env

**Files:**
- Modify: `src/env.ts`
- Create: `src/lib/openai/server.ts`, `src/lib/openai/server.test.ts`

- [ ] **Step 1: Add the env var.** In `src/env.ts`, inside `envSchema`, after `GOOGLE_MAPS_SERVER_KEY`:

```ts
  // Server-only OpenAI key for AI place summaries; optional (feature degrades to off).
  OPENAI_API_KEY: z.string().min(1).optional(),
```

- [ ] **Step 2: Write the failing test.** Create `src/lib/openai/server.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generatePlaceSummary } from '@/src/lib/openai/server';

const OLD = process.env.OPENAI_API_KEY;
afterEach(() => { process.env.OPENAI_API_KEY = OLD; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
beforeEach(() => { process.env.OPENAI_API_KEY = 'sk-test'; });

const input = { name: 'Senso-ji', address: 'Asakusa', category: 'sightseeing',
  tripName: 'Tokyo', startDate: '2026-09-04', endDate: '2026-09-12' };

it('returns the model text on success', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: '  A historic temple.  ' } }] }),
  })) as unknown as typeof fetch);
  expect(await generatePlaceSummary(input)).toBe('A historic temple.');
});

it('returns null when the key is missing', async () => {
  delete process.env.OPENAI_API_KEY;
  const f = vi.fn();
  vi.stubGlobal('fetch', f as unknown as typeof fetch);
  expect(await generatePlaceSummary(input)).toBeNull();
  expect(f).not.toHaveBeenCalled();
});

it('returns null on a non-ok response', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) })) as unknown as typeof fetch);
  expect(await generatePlaceSummary(input)).toBeNull();
});

it('returns null when fetch throws', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }) as unknown as typeof fetch);
  expect(await generatePlaceSummary(input)).toBeNull();
});
```

- [ ] **Step 3: Run it — expect FAIL** (module not found).

Run: `npx vitest run src/lib/openai/server.test.ts`

- [ ] **Step 4: Implement `src/lib/openai/server.ts`.**

```ts
/**
 * Server-only OpenAI client for AI place summaries (spec §2). Plain REST via
 * fetch — no npm SDK. Reads OPENAI_API_KEY directly from process.env so the test
 * can toggle it. Returns null (never throws) on missing key / HTTP / network /
 * shape errors so the caller degrades gracefully. Never logs the key.
 */
export interface PlaceSummaryInput {
  name: string;
  address: string | null;
  category: string;
  tripName: string;
  startDate: string;
  endDate: string;
}

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

export async function generatePlaceSummary(input: PlaceSummaryInput): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const where = input.address ? ` near ${input.address}` : '';
  const userPrompt =
    `Write a 2-3 sentence traveler-oriented intro for "${input.name}", a ` +
    `${input.category}${where}, for a trip to ${input.tripName} ` +
    `(${input.startDate}–${input.endDate}). Plain prose, no headings, no markdown, ` +
    `no lists. Be concrete and useful; avoid hype.`;

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 180,
        temperature: 0.6,
        messages: [
          { role: 'system', content: 'You are a concise travel assistant. Reply with plain text only.' },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!res.ok) {
      console.error('[openai] summary HTTP', res.status);
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : null;
  } catch {
    console.error('[openai] summary request failed');
    return null;
  }
}
```

- [ ] **Step 5: Run it — expect PASS.**

Run: `npx vitest run src/lib/openai/server.test.ts`

- [ ] **Step 6: tsc + commit.**

```bash
npx tsc --noEmit
git add src/env.ts src/lib/openai/server.ts src/lib/openai/server.test.ts
git commit -m "feat(openai): server-only place-summary generator + OPENAI_API_KEY env"
```

---

### Task 6: `generatePlaceSummaryAction`

**Files:**
- Modify: `app/_actions/places.ts`
- Test: `app/_actions/places.test.ts`

- [ ] **Step 1: Write the failing test.** Add to `app/_actions/places.test.ts`. Mock the service at the top of the file (with the other `vi.mock`s):

```ts
vi.mock('@/src/lib/openai/server', () => ({
  generatePlaceSummary: vi.fn(async () => 'Generated blurb.'),
}));
```

Then a case (match the file's seed for a trip + place):

```ts
it('generatePlaceSummaryAction stores the AI summary on the place', async () => {
  // seed trip 't1' + place 'p1' as the file does
  const updated = await generatePlaceSummaryAction('p1');
  expect(updated?.aiSummary).toBe('Generated blurb.');
});
```

Import `generatePlaceSummaryAction` in the test's import list.

- [ ] **Step 2: Run it — expect FAIL** (action undefined).

Run: `npx vitest run app/_actions/places.test.ts`

- [ ] **Step 3: Implement.** In `app/_actions/places.ts`:

Add to the updateSchema (so the editor can save edited summaries):

```ts
const updateSchema = z.object({
  // ...existing fields...
  notes: z.string().max(2000).nullish(),
  aiSummary: z.string().max(4000).nullish(),
});
```

Add imports + the action (needs the trip for context):

```ts
import { getTrip } from '@/src/db/repos/trips';
import { generatePlaceSummary } from '@/src/lib/openai/server';

// --- generatePlaceSummaryAction -------------------------------------------

export async function generatePlaceSummaryAction(placeId: string): Promise<Place | null> {
  const id = z.string().min(1).parse(placeId);
  const place = getPlace(db, id);
  if (!place) throw new Error('Place not found');
  const trip = getTrip(db, place.tripId);
  if (!trip) throw new Error('Trip not found');

  const summary = await generatePlaceSummary({
    name: place.name,
    address: place.address,
    category: place.category,
    tripName: trip.name,
    startDate: trip.startDate,
    endDate: trip.endDate,
  });
  if (!summary) return null; // no key / failure → leave existing summary untouched

  const updated = updatePlace(db, id, { aiSummary: summary });
  revalidatePlan(place.tripId);
  return updated ?? null;
}
```

- [ ] **Step 4: Run it — expect PASS.**

Run: `npx vitest run app/_actions/places.test.ts`

- [ ] **Step 5: tsc + commit.**

```bash
npx tsc --noEmit
git add app/_actions/places.ts app/_actions/places.test.ts
git commit -m "feat(places): generatePlaceSummaryAction + aiSummary in updateSchema"
```

---

### Task 7: PlaceDTO + places API route — expose `aiSummary` + `links`

**Files:**
- Modify: `src/lib/planView.ts`
- Modify: `app/api/trips/[tripId]/places/route.ts`
- Test: `app/api/trips/[tripId]/places/route.test.ts`

- [ ] **Step 1: Extend the structural DTO.** In `src/lib/planView.ts`, inside `interface PlaceDTO`, after `photos`:

```ts
  photos: { id: string; width: number | null; height: number | null }[];
  /** AI-generated intro (editable); null until generated. */
  aiSummary: string | null;
  /** Travel-guide links attached to this place (newest first). */
  links: { id: string; url: string; title: string | null; thumbnail: string | null }[];
```

- [ ] **Step 2: Write the failing route test.** In `app/api/trips/[tripId]/places/route.test.ts`, add a case asserting a place's `links` + `aiSummary` round-trip (match the file's existing seeding helpers — it seeds places directly; also insert one `saved_links` row with `place_id` set and set `ai_summary` on a place):

```ts
it('includes aiSummary and attached links per place', async () => {
  // seed: trip + one place 'p1' with ai_summary='Hi', and a saved_link row with place_id='p1'
  const res = await GET(new Request('http://t/'), { params: Promise.resolve({ tripId: 't1' }) });
  const body = await res.json();
  const p = body.places.find((x: { id: string }) => x.id === 'p1');
  expect(p.aiSummary).toBe('Hi');
  expect(p.links).toEqual([{ id: expect.any(String), url: 'https://x.example', title: null, thumbnail: null }]);
});
```

(Use the file's existing insert style for `places`/`savedLinks` rows; `ai_summary` and `place_id` are now columns.)

- [ ] **Step 3: Run it — expect FAIL** (route doesn't return links/aiSummary).

Run: `npx vitest run "app/api/trips/[tripId]/places/route.test.ts"`

- [ ] **Step 4: Implement the route.** In `app/api/trips/[tripId]/places/route.ts`:

Update the DTO interface:

```ts
export interface PlaceDTO extends Place {
  photoPath: string | null;
  photos: { id: string; width: number | null; height: number | null }[];
  links: { id: string; url: string; title: string | null; thumbnail: string | null }[];
}
```

Add `savedLinks` to the schema import:

```ts
import { travelLegs, placeDetailsCache, photos as photosTable, savedLinks, type Place, type TravelLeg, type Photo } from '@/src/db/schema';
```

After the personal-photos batch block, add a links batch block (uses `placeIds` already computed):

```ts
  // Batch-load attached travel-guide links for all places (place_id set).
  const linksByPlace = new Map<string, { id: string; url: string; title: string | null; thumbnail: string | null }[]>();
  if (placeIds.length > 0) {
    const linkRows = db
      .select({ id: savedLinks.id, placeId: savedLinks.placeId, url: savedLinks.url, title: savedLinks.title, thumbnail: savedLinks.thumbnail })
      .from(savedLinks)
      .where(inArray(savedLinks.placeId, placeIds))
      .orderBy(asc(savedLinks.placeId), desc(savedLinks.createdAt))
      .all();
    for (const row of linkRows) {
      if (!row.placeId) continue;
      const list = linksByPlace.get(row.placeId) ?? [];
      list.push({ id: row.id, url: row.url, title: row.title, thumbnail: row.thumbnail });
      linksByPlace.set(row.placeId, list);
    }
  }
```

Add `desc` to the drizzle import (`import { and, asc, desc, eq, inArray } from 'drizzle-orm';`). In the final `.map` that builds each `PlaceDTO`, add:

```ts
    photos: photoMapByOwner.get(p.id) ?? [],
    links: linksByPlace.get(p.id) ?? [],
```

`aiSummary` flows automatically via `extends Place`.

- [ ] **Step 5: Run it — expect PASS.**

Run: `npx vitest run "app/api/trips/[tripId]/places/route.test.ts"`

- [ ] **Step 6: tsc + commit.**

```bash
npx tsc --noEmit
git add src/lib/planView.ts "app/api/trips/[tripId]/places/route.ts" "app/api/trips/[tripId]/places/route.test.ts"
git commit -m "feat(places-api): expose aiSummary + attached links on PlaceDTO"
```

---

# Group D1 — Map

### Task 8: Map day filter → single-select

**Files:**
- Modify: `components/map/MapLegend.tsx`, `components/map/MapLegend.test.tsx`
- Modify: `components/plan/PlanMap.tsx`, `components/plan/PlanMap.test.tsx`
- Modify: `components/plan/PlanClient.tsx`

- [ ] **Step 1: Update MapLegend test.** In `components/map/MapLegend.test.tsx`, rename the day-tap handler to `onSelectDay` and assert a day tap calls it with the date; "All days" calls `onToggleAll`. (Adjust the existing render props accordingly.)

- [ ] **Step 2: Implement MapLegend.** In `components/map/MapLegend.tsx` rename the prop `onToggleDay` → `onSelectDay` (signature unchanged: `(date: string) => void`); the day chip `onClick={() => onSelectDay(e.date)}`. Keep `onToggleAll` and `allVisible`. No other change.

- [ ] **Step 3: Update PlanMap.** In `components/plan/PlanMap.tsx`:
  - Change the prop type: replace `onToggleDate: (date: string) => void;` with `onShowOnlyDate: (date: string) => void;` and add `onShowAllDays: () => void;`.
  - In the `<MapLegend>` usage: `onSelectDay={onShowOnlyDate}` and `onToggleAll={onShowAllDays}` (remove the old inline all-toggle logic).

- [ ] **Step 4: Update PlanClient.** In `components/plan/PlanClient.tsx`, replace `onToggleDate` with two handlers and pass them to `<PlanMap>`:

```ts
function showOnlyDate(date: string) {
  setVisibleDates(new Set([date]));
}
function showAllDays() {
  setVisibleDates(new Set(days.map((d) => d.date)));
}
```

```tsx
        <PlanMap
          /* ...existing props... */
          onShowOnlyDate={showOnlyDate}
          onShowAllDays={showAllDays}
        />
```

Remove the now-unused `onToggleDate` function.

- [ ] **Step 5: Update PlanMap.test.** In `components/plan/PlanMap.test.tsx`, replace the `onToggleDate` mock with `onShowOnlyDate` + `onShowAllDays`; update the "day chip click" test to assert `onShowOnlyDate('2026-06-04')`. Update the `renderMap` prop wiring.

- [ ] **Step 6: Run the suites — expect PASS.**

Run: `npx vitest run components/map/MapLegend.test.tsx components/plan/PlanMap.test.tsx components/plan/PlanClient.test.tsx`

- [ ] **Step 7: tsc + commit.**

```bash
npx tsc --noEmit
git add components/map/MapLegend.tsx components/map/MapLegend.test.tsx components/plan/PlanMap.tsx components/plan/PlanMap.test.tsx components/plan/PlanClient.tsx
git commit -m "feat(map): day chip isolates that day; All days shows everything"
```

---

### Task 9: Pin centered on the coordinate (Mapbox number badge bottom-centered)

**Files:**
- Modify: `components/map/MapboxCanvas.tsx`

- [ ] **Step 1: Reposition the number badge.** In `components/map/MapboxCanvas.tsx`, in `createMarkerEl`, replace the badge `style.cssText` array (the `if (isDay)` block) so the chip is horizontally centered under the disc instead of protruding top-right:

```ts
    badge.style.cssText = [
      'position:absolute',
      'bottom:-8px',
      'left:50%',
      'transform:translateX(-50%)',
      'min-width:16px',
      'height:16px',
      'padding:0 4px',
      'box-sizing:border-box',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'border-radius:9999px',
      'background:#fff',
      `color:${bg}`,
      'font-size:10px',
      'font-weight:700',
      'line-height:1',
      'box-shadow:0 1px 2px rgba(0,0,0,0.3)',
    ].join(';');
```

The disc stays `anchor:'center'`, so the disc center sits exactly on the coordinate; the centered chip no longer skews the visual center.

- [ ] **Step 2: Run the canvas test — expect PASS** (count/click unaffected).

Run: `npx vitest run components/map/MapboxCanvas.test.tsx`

- [ ] **Step 3: tsc + commit.**

```bash
npx tsc --noEmit
git add components/map/MapboxCanvas.tsx
git commit -m "fix(map): center the day-number badge so the disc sits on the coordinate"
```

(Visual confirmation happens in the final browser-verify step.)

---

### Task 10: `PlaceReadCard` component (rich read view)

**Files:**
- Create: `components/plan/PlaceReadCard.tsx`, `components/plan/PlaceReadCard.test.tsx`
- Reference: thumbnail URL is `withBase('/api/links/thumb/<linkId>')`; place photo via `thumbForPlace(place)` from `@/src/lib/planUrl`.

- [ ] **Step 1: Write the failing test.** Create `components/plan/PlaceReadCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import { PlaceReadCard } from './PlaceReadCard';
import type { PlaceDTO } from '@/src/lib/planView';

function place(over: Partial<PlaceDTO> = {}): PlaceDTO {
  return {
    id: 'p1', tripId: 't1', dayDate: '2026-06-04', googlePlaceId: null,
    name: 'Senso-ji', address: 'Asakusa', lat: 35, lng: 139, category: 'sightseeing',
    scheduledTime: null, durationMin: null, cost: null, notes: 'My note',
    orderIndex: 0, photoPath: null, photos: [], aiSummary: 'A historic temple.',
    links: [{ id: 'l1', url: 'https://guide.example', title: 'Guide', thumbnail: null }],
    ...over,
  };
}

function renderCard(p = place(), props = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PlaceReadCard place={p} onClose={vi.fn()} onEdit={vi.fn()} {...props} />
    </NextIntlClientProvider>,
  );
}

describe('PlaceReadCard', () => {
  it('shows name, AI summary, notes, and a link', () => {
    renderCard();
    expect(screen.getByText('Senso-ji')).toBeInTheDocument();
    expect(screen.getByText('A historic temple.')).toBeInTheDocument();
    expect(screen.getByText('My note')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Guide/ })).toHaveAttribute('href', 'https://guide.example');
  });

  it('calls onEdit when Edit is tapped', async () => {
    const onEdit = vi.fn();
    renderCard(place(), { onEdit });
    await userEvent.click(screen.getByRole('button', { name: en.plan.edit }));
    expect(onEdit).toHaveBeenCalled();
  });

  it('truncates a long summary behind show more', async () => {
    const long = 'x '.repeat(400);
    renderCard(place({ aiSummary: long }));
    const toggle = screen.getByRole('button', { name: en.plan.showMore });
    expect(toggle).toBeInTheDocument();
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: en.plan.showLess })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (module + i18n keys missing).

Run: `npx vitest run components/plan/PlaceReadCard.test.tsx`

- [ ] **Step 3: Add i18n keys.** In `messages/en.json` under `plan`, add: `"aiSummary": "About"`, `"showMore": "Show more"`, `"showLess": "Show less"`, `"view": "View"`, `"edit": "Edit"`, `"guidesLabel": "Travel guides"`, `"noContent": "No details yet."` (and the link/summary keys used later: `"addGuideLink": "Add a guide link"`, `"guideUrlPlaceholder": "Paste a URL"`, `"regenerateSummary": "Regenerate"`, `"regenerating": "Generating…"`, `"summaryFailed": "Couldn't generate a summary."`, `"moveUp": "Move up"`, `"moveDown": "Move down"`, `"move": "Move"`).

- [ ] **Step 4: Implement `components/plan/PlaceReadCard.tsx`.**

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PlaceDTO } from '@/src/lib/planView';
import { placeUrl } from '@/src/lib/googleMapsUrl';
import { thumbForPlace } from '@/src/lib/planUrl';
import { withBase } from '@/src/lib/basePath';

/** Collapsible long-text block with show more / show less (≈3 lines collapsed). */
function Collapsible({ text }: { text: string }) {
  const t = useTranslations('plan');
  const [open, setOpen] = useState(false);
  const long = text.length > 160;
  return (
    <div>
      <p className={`whitespace-pre-wrap text-body text-ink ${!open && long ? 'line-clamp-3' : ''}`}>{text}</p>
      {long ? (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 text-caption font-medium text-teal">
          {open ? t('showLess') : t('showMore')}
        </button>
      ) : null}
    </div>
  );
}

export function PlaceReadCard({
  place,
  onClose,
  onEdit,
}: {
  place: PlaceDTO;
  onClose: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations('plan');
  const tCat = useTranslations('placeCategory');
  const tMap = useTranslations('planMap');
  const thumb = thumbForPlace(place);
  const mapsHref = placeUrl({ name: place.name, lat: place.lat ?? 0, lng: place.lng ?? 0, googlePlaceId: place.googlePlaceId });

  return (
    <div className="pointer-events-auto max-h-[70vh] w-full overflow-y-auto rounded-card bg-card p-4 shadow-lift">
      <div className="flex items-start gap-3">
        {thumb.kind === 'photo' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb.src} alt={place.name} width={56} height={56} className="h-14 w-14 shrink-0 rounded-control object-cover" />
        ) : (
          <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-control bg-paper text-2xl">{thumb.glyph}</span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-label font-semibold text-ink">{place.name}</h3>
          <p className="truncate text-caption text-ink-muted">{tCat(place.category)}{place.address ? ` · ${place.address}` : ''}</p>
        </div>
        <button type="button" aria-label={t('cancel')} onClick={onClose} className="-mr-1 -mt-1 shrink-0 rounded-chip p-1 text-ink-faint active:bg-line">✕</button>
      </div>

      {place.aiSummary ? (
        <section className="mt-3">
          <h4 className="text-caption font-semibold uppercase tracking-wide text-ink-muted">{t('aiSummary')}</h4>
          <div className="mt-1"><Collapsible text={place.aiSummary} /></div>
        </section>
      ) : null}

      {place.notes ? (
        <section className="mt-3">
          <h4 className="text-caption font-semibold uppercase tracking-wide text-ink-muted">{t('notesLabel')}</h4>
          <div className="mt-1"><Collapsible text={place.notes} /></div>
        </section>
      ) : null}

      {place.links.length > 0 ? (
        <section className="mt-3">
          <h4 className="text-caption font-semibold uppercase tracking-wide text-ink-muted">{t('guidesLabel')}</h4>
          <ul className="mt-1 space-y-2">
            {place.links.map((l) => (
              <li key={l.id}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-control border border-line bg-paper px-2 py-1.5">
                  {l.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={withBase(`/api/links/thumb/${l.id}`)} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded object-cover" />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate text-caption text-ink">{l.title ?? l.url}</span>
                  <span aria-hidden="true" className="shrink-0 text-teal">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-4 flex gap-2">
        <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-control bg-teal px-3 py-2 text-center text-caption font-medium text-white">{tMap('openInMaps')}</a>
        <button type="button" onClick={onEdit} className="rounded-control border border-coral px-3 py-2 text-caption font-medium text-coral active:bg-coral-tint">{t('edit')}</button>
      </div>
    </div>
  );
}
```

(Requires Tailwind `line-clamp` — confirm `@tailwindcss/line-clamp` is built-in for Tailwind v3.3+. If `line-clamp-3` doesn't apply, the plugin is enabled by default in v3.3+; otherwise the test still passes since the toggle is driven by text length, not the clamp.)

- [ ] **Step 5: Run it — expect PASS.**

Run: `npx vitest run components/plan/PlaceReadCard.test.tsx`

- [ ] **Step 6: tsc + commit.**

```bash
npx tsc --noEmit
git add components/plan/PlaceReadCard.tsx components/plan/PlaceReadCard.test.tsx messages/en.json
git commit -m "feat(plan): PlaceReadCard rich read view with show-more"
```

---

### Task 11: Pin tap opens the read view (PlanMap)

**Files:**
- Modify: `components/plan/PlanMap.tsx`, `components/plan/PlanMap.test.tsx`

PlanMap currently renders `PlaceInfoCard` on pin tap. Replace it with `PlaceReadCard` for day-bucket places (it needs full `PlaceDTO`, so PlanMap needs a lookup from marker id → PlaceDTO). The simplest path: have PlanClient pass an `onViewPlace(id)` that opens the read card at the PlanClient level (PlanClient already has the full `places` array and renders sheets). **Chosen design:** PlanMap forwards pin taps up via the existing `onSelectPlace`-style callback to a new `onViewPlace`, and PlanClient renders the read card. This keeps PlaceReadCard fed by the full PlaceDTO.

- [ ] **Step 1: Add `onViewPlace` to PlanMap.** In `components/plan/PlanMap.tsx`:
  - Add prop `onViewPlace: (placeId: string) => void;`.
  - Change the map's `onMarkerClick={(id) => setSelectedId(id)}` to call `onViewPlace(id)` for the **days** bucket, and keep the existing `PlaceInfoCard` (with Add-to-day) for the **saved** bucket. Concretely:

```tsx
        <MapCanvas
          markers={activeMarkers}
          paths={dayPaths}
          onMarkerClick={(id) => (bucket === 'saved' ? setSelectedId(id) : onViewPlace(id))}
        />
```

Leave the `selectedMarker` / `PlaceInfoCard` overlay in place (it now only triggers in the saved bucket).

- [ ] **Step 2: Update PlanMap.test.** The "opens the info card on pin tap" test is days-bucket → now it should assert `onViewPlace('a')` is called (pass an `onViewPlace` mock in `renderMap`). The saved-bucket "Add to day" test stays. Add `onViewPlace: vi.fn()` to the default props.

- [ ] **Step 3: Wire PlanClient.** In `components/plan/PlanClient.tsx`:
  - Add state: `const [viewPlace, setViewPlace] = useState<PlaceDTO | null>(null);`
  - Pass `onViewPlace={(id) => setViewPlace(placeById(id))}` to `<PlanMap>`.
  - Render the read card as a bottom-sheet overlay when `viewPlace` is set, with Edit → open the editor:

```tsx
      {viewPlace ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={viewPlace.name}
          className="fixed inset-0 z-50 flex items-end bg-[rgb(110_85_68_/_0.45)]"
          onClick={() => setViewPlace(null)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full p-3">
            <PlaceReadCard
              place={viewPlace}
              onClose={() => setViewPlace(null)}
              onEdit={() => { setDetailFor(viewPlace); setViewPlace(null); }}
            />
          </div>
        </div>
      ) : null}
```

  - Import `PlaceReadCard`.

- [ ] **Step 4: Run suites — expect PASS.**

Run: `npx vitest run components/plan/PlanMap.test.tsx components/plan/PlanClient.test.tsx`

- [ ] **Step 5: tsc + commit.**

```bash
npx tsc --noEmit
git add components/plan/PlanMap.tsx components/plan/PlanMap.test.tsx components/plan/PlanClient.tsx
git commit -m "feat(map): tapping a day pin opens the rich read view"
```

---

# Group D2 — Place content

### Task 12: AI summary in the editor (field + Regenerate)

**Files:**
- Modify: `components/plan/PlaceDetailSheet.tsx`, `components/plan/PlaceDetailSheet.test.tsx`

- [ ] **Step 1: Write the failing test.** In `components/plan/PlaceDetailSheet.test.tsx`, mock the action and assert Regenerate calls it and fills the field. Add with the other mocks:

```ts
const generatePlaceSummaryAction = vi.fn(async () => ({ id: 'p1', aiSummary: 'Fresh blurb.' }));
```

Add `generatePlaceSummaryAction` to the `vi.mock('@/app/_actions/places', ...)` factory. Then a case:

```ts
it('regenerate fills the AI summary field', async () => {
  renderSheet(); // existing helper that renders with a place
  await userEvent.click(screen.getByRole('button', { name: en.plan.regenerateSummary }));
  await waitFor(() => expect(generatePlaceSummaryAction).toHaveBeenCalledWith('p1'));
  expect(screen.getByLabelText(en.plan.aiSummary)).toHaveValue('Fresh blurb.');
});
```

- [ ] **Step 2: Run it — expect FAIL.**

Run: `npx vitest run components/plan/PlaceDetailSheet.test.tsx`

- [ ] **Step 3: Implement.** In `components/plan/PlaceDetailSheet.tsx`:
  - Import the action: add `generatePlaceSummaryAction` to the import from `@/app/_actions/places`.
  - Add state: `const [aiSummary, setAiSummary] = useState(place.aiSummary ?? '');` and `const [regenerating, setRegenerating] = useState(false);`
  - Add a summary field + Regenerate button before the Notes field:

```tsx
        <div className="mt-3 flex items-center justify-between">
          <label className="block text-label font-medium text-ink" htmlFor="pd-ai">{t('aiSummary')}</label>
          <button
            type="button"
            disabled={disabled || regenerating}
            onClick={async () => {
              setRegenerating(true);
              try {
                const r = await generatePlaceSummaryAction(place.id);
                if (r?.aiSummary) setAiSummary(r.aiSummary);
              } catch { /* leave field as-is */ }
              finally { setRegenerating(false); }
            }}
            className="text-caption font-medium text-teal disabled:opacity-40"
          >
            {regenerating ? t('regenerating') : t('regenerateSummary')}
          </button>
        </div>
        <textarea
          id="pd-ai" value={aiSummary} disabled={disabled}
          onChange={(e) => setAiSummary(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />
```

  - Include `aiSummary` in the save payload in `handleSave`:

```ts
        await updatePlaceAction(place.id, {
          name: name.trim(),
          address: address.trim() || null,
          category,
          scheduledTime: time || null,
          cost: costMinor != null && Number.isFinite(costMinor) ? costMinor : null,
          notes: notes.trim() || null,
          aiSummary: aiSummary.trim() || null,
        });
```

- [ ] **Step 4: Run it — expect PASS.**

Run: `npx vitest run components/plan/PlaceDetailSheet.test.tsx`

- [ ] **Step 5: tsc + commit.**

```bash
npx tsc --noEmit
git add components/plan/PlaceDetailSheet.tsx components/plan/PlaceDetailSheet.test.tsx
git commit -m "feat(plan): editable AI summary + Regenerate in the place editor"
```

---

### Task 13: Auto-generate the summary after Add Place

**Files:**
- Modify: `components/plan/AddPlaceSheet.tsx`, `components/plan/AddPlaceSheet.test.tsx`

- [ ] **Step 1: Write the failing test.** In `components/plan/AddPlaceSheet.test.tsx`, mock both actions; assert that after a successful add, `generatePlaceSummaryAction` is called with the new place id. Add to the `@/app/_actions/places` mock factory: `generatePlaceSummaryAction: (...a) => generatePlaceSummaryAction(...a)` and a top-level `const generatePlaceSummaryAction = vi.fn(async () => null);`. Make `addPlaceAction` resolve to `{ id: 'new-place' }`. Then:

```ts
it('fires AI summary generation after a successful add', async () => {
  renderSheet(); // existing helper
  await userEvent.type(screen.getByLabelText(en.plan.nameLabel), 'Senso-ji');
  await userEvent.click(screen.getByRole('button', { name: en.plan.save }));
  await waitFor(() => expect(addPlaceAction).toHaveBeenCalled());
  await waitFor(() => expect(generatePlaceSummaryAction).toHaveBeenCalledWith('new-place'));
});
```

- [ ] **Step 2: Run it — expect FAIL.**

Run: `npx vitest run components/plan/AddPlaceSheet.test.tsx`

- [ ] **Step 3: Implement.** In `components/plan/AddPlaceSheet.tsx`, import `generatePlaceSummaryAction` from `@/app/_actions/places`. In `handleSave`, capture the created place and fire-and-forget the summary before `onAdded()`:

```ts
        const created = await addPlaceAction({
          tripId, dayDate, name: trimmedName, address: trimmedAddress,
          lat, lng, category, googlePlaceId: picked?.googlePlaceId ?? null,
        });
        // Fire-and-forget AI summary; reload picks it up when it lands. Never blocks the add.
        void generatePlaceSummaryAction(created.id).catch(() => {});
        onAdded();
        onClose();
```

(`onAdded` triggers PlanClient's reload; a later manual refresh or the next reload surfaces the summary. Optionally PlanClient could reload again on focus, but YAGNI — the summary appears on the next data load.)

- [ ] **Step 4: Run it — expect PASS.**

Run: `npx vitest run components/plan/AddPlaceSheet.test.tsx`

- [ ] **Step 5: tsc + commit.**

```bash
npx tsc --noEmit
git add components/plan/AddPlaceSheet.tsx components/plan/AddPlaceSheet.test.tsx
git commit -m "feat(plan): auto-generate AI summary after adding a place"
```

---

### Task 14: Per-place links editor (`PlaceLinks`)

**Files:**
- Create: `components/plan/PlaceLinks.tsx`, `components/plan/PlaceLinks.test.tsx`
- Modify: `components/plan/PlaceDetailSheet.tsx` (embed it)

- [ ] **Step 1: Write the failing test.** Create `components/plan/PlaceLinks.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

const addLinkAction = vi.fn(async () => ({ id: 'l-new' }));
const deleteLinkAction = vi.fn(async () => {});
vi.mock('@/app/_actions/savedLinks', () => ({
  addLinkAction: (...a: unknown[]) => addLinkAction(...a),
  deleteLinkAction: (...a: unknown[]) => deleteLinkAction(...a),
  updateLinkAction: vi.fn(),
}));
vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ title: 'T', thumbnailPath: null }) })) as unknown as typeof fetch);

import { PlaceLinks } from './PlaceLinks';

function renderLinks(props = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PlaceLinks tripId="t1" placeId="p1" links={[]} disabled={false} onChanged={vi.fn()} {...props} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => { addLinkAction.mockClear(); deleteLinkAction.mockClear(); });

describe('PlaceLinks', () => {
  it('adds a link with the place id', async () => {
    const onChanged = vi.fn();
    renderLinks({ onChanged });
    await userEvent.type(screen.getByLabelText(en.plan.addGuideLink), 'https://g.example');
    await userEvent.click(screen.getByRole('button', { name: en.plan.addGuideLink }));
    await waitFor(() => expect(addLinkAction).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: 't1', placeId: 'p1', url: 'https://g.example' }),
    ));
    expect(onChanged).toHaveBeenCalled();
  });

  it('lists existing links with a remove button', async () => {
    const onChanged = vi.fn();
    renderLinks({ links: [{ id: 'l1', url: 'https://x.example', title: 'X', thumbnail: null }], onChanged });
    await userEvent.click(screen.getByRole('button', { name: en.plan.delete }));
    await waitFor(() => expect(deleteLinkAction).toHaveBeenCalledWith('l1'));
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (module missing).

Run: `npx vitest run components/plan/PlaceLinks.test.tsx`

- [ ] **Step 3: Implement `components/plan/PlaceLinks.tsx`** (mirrors `LinkSheet`'s preview→prefill→add, scoped to a place; the add button label doubles as the field label via `aria-label`):

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { withBase } from '@/src/lib/basePath';
import { isHttpUrl } from '@/src/lib/linkPreview';
import { addLinkAction, deleteLinkAction } from '@/app/_actions/savedLinks';

type LinkLite = { id: string; url: string; title: string | null; thumbnail: string | null };

export function PlaceLinks({
  tripId,
  placeId,
  links,
  disabled,
  onChanged,
}: {
  tripId: string;
  placeId: string;
  links: LinkLite[];
  disabled: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations('plan');
  const [url, setUrl] = useState('');
  const [isPending, startTransition] = useTransition();

  async function handleAdd() {
    const value = url.trim();
    if (!isHttpUrl(value) || disabled) return;
    let title: string | null = null;
    let thumbnail: string | null = null;
    try {
      const res = await fetch(withBase('/api/links/preview'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ url: value, tripId }),
      });
      const data = (await res.json()) as { title?: string; thumbnailPath?: string };
      title = data.title ?? null;
      thumbnail = data.thumbnailPath ?? null;
    } catch { /* preview optional */ }
    startTransition(async () => {
      try {
        await addLinkAction({ tripId, placeId, url: value, title, thumbnail });
        setUrl('');
        onChanged();
      } catch { /* surfaced by caller reload */ }
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      try {
        await deleteLinkAction(id);
        onChanged();
      } catch { /* ignore */ }
    });
  }

  return (
    <div className="mt-3">
      <label className="block text-label font-medium text-ink" htmlFor="pl-url">{t('guidesLabel')}</label>
      {links.length > 0 ? (
        <ul className="mt-1 space-y-2">
          {links.map((l) => (
            <li key={l.id} className="flex items-center gap-2 rounded-control border border-line bg-paper px-2 py-1.5">
              {l.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={withBase(`/api/links/thumb/${l.id}`)} alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded object-cover" />
              ) : null}
              <span className="min-w-0 flex-1 truncate text-caption text-ink">{l.title ?? l.url}</span>
              <button type="button" disabled={disabled || isPending} onClick={() => handleRemove(l.id)} className="shrink-0 text-caption font-medium text-danger disabled:opacity-40">{t('delete')}</button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 flex gap-2">
        <input
          id="pl-url" type="url" inputMode="url" value={url} disabled={disabled}
          aria-label={t('addGuideLink')} placeholder={t('guideUrlPlaceholder')}
          onChange={(e) => setUrl(e.target.value)}
          className="min-w-0 flex-1 rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />
        <button type="button" disabled={disabled || isPending} onClick={handleAdd} className="shrink-0 rounded-control border border-teal px-3 py-2 text-caption font-medium text-teal disabled:opacity-40">{t('addGuideLink')}</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Embed in the editor.** In `components/plan/PlaceDetailSheet.tsx`, import `PlaceLinks` and render it after the photo section (before the Open-in-Maps button):

```tsx
        <PlaceLinks
          tripId={place.tripId}
          placeId={place.id}
          links={place.links}
          disabled={disabled}
          onChanged={onSaved}
        />
```

- [ ] **Step 5: Run it — expect PASS.**

Run: `npx vitest run components/plan/PlaceLinks.test.tsx components/plan/PlaceDetailSheet.test.tsx`

- [ ] **Step 6: tsc + commit.**

```bash
npx tsc --noEmit
git add components/plan/PlaceLinks.tsx components/plan/PlaceLinks.test.tsx components/plan/PlaceDetailSheet.tsx
git commit -m "feat(plan): attach travel-guide links to a place (editor)"
```

---

# Group D3 — List UX

### Task 15: PlaceCard — pill actions + ▲/▼ reorder + View

**Files:**
- Modify: `components/plan/PlaceCard.tsx`, `components/plan/PlaceCard.test.tsx`
- Modify: `components/plan/DayItinerary.tsx`, `components/plan/DayItinerary.test.tsx`

- [ ] **Step 1: Update PlaceCard test.** In `components/plan/PlaceCard.test.tsx`, add props `onView`, `onMoveUp`, `onMoveDown`, `isFirst`, `isLast`, and assert: View calls `onView(id)`; ▲ calls `onMoveUp(id)` and is disabled when `isFirst`; ▼ calls `onMoveDown(id)` and is disabled when `isLast`; the three management buttons (`moveToSaved`/`move`/`delete`) still fire. Use `en.plan.view`, `en.plan.moveUp`, `en.plan.moveDown`, `en.plan.move`.

- [ ] **Step 2: Run it — expect FAIL.**

Run: `npx vitest run components/plan/PlaceCard.test.tsx`

- [ ] **Step 3: Implement PlaceCard.** In `components/plan/PlaceCard.tsx`:
  - Extend props:

```ts
type PlaceCardProps = {
  place: PlaceDTO;
  pinNumber: number;
  pinColor: string;
  currency: string;
  locale: string;
  disabled: boolean;
  isFirst: boolean;
  isLast: boolean;
  onTap: (placeId: string) => void;
  onView: (placeId: string) => void;
  onMoveUp: (placeId: string) => void;
  onMoveDown: (placeId: string) => void;
  onMoveToSaved: (placeId: string) => void;
  onMoveToDay: (placeId: string) => void;
  onDelete: (placeId: string) => void;
};
```

  - Add ▲/▼ to the left rail (under the pin number):

```tsx
      <div className="flex flex-col items-center">
        <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-chip text-caption font-bold text-white" style={{ backgroundColor: pinColor }}>{pinNumber}</span>
        <div className="mt-1 flex flex-col gap-0.5">
          <button type="button" aria-label={t('moveUp')} disabled={disabled || isFirst} onClick={() => onMoveUp(place.id)} className="text-ink-faint disabled:opacity-30">▲</button>
          <button type="button" aria-label={t('moveDown')} disabled={disabled || isLast} onClick={() => onMoveDown(place.id)} className="text-ink-faint disabled:opacity-30">▼</button>
        </div>
        <span className="mt-1 w-px flex-1 bg-line" aria-hidden="true" />
      </div>
```

  - Replace the text-link action row with distinct pills (View teal-filled-outline; Save/Move teal outline; Delete red outline):

```tsx
        <div className="mt-2 flex flex-wrap gap-2 border-t border-line pt-2">
          <button type="button" onClick={() => onView(place.id)} className="rounded-control border border-teal px-2.5 py-1 text-caption font-medium text-teal active:bg-teal-tint">{t('view')}</button>
          <button type="button" disabled={disabled} onClick={() => onMoveToSaved(place.id)} className="rounded-control border border-teal px-2.5 py-1 text-caption font-medium text-teal disabled:opacity-40">{t('moveToSaved')}</button>
          <button type="button" disabled={disabled} onClick={() => onMoveToDay(place.id)} className="rounded-control border border-teal px-2.5 py-1 text-caption font-medium text-teal disabled:opacity-40">{t('move')}</button>
          <button type="button" disabled={disabled} onClick={() => onDelete(place.id)} className="rounded-control border border-danger px-2.5 py-1 text-caption font-medium text-danger disabled:opacity-40">{t('delete')}</button>
        </div>
```

- [ ] **Step 4: Update DayItinerary.** In `components/plan/DayItinerary.tsx`:
  - Remove the HTML5 DnD wiring on `<li>` (`draggable`, `onDragStart`, `onDragOver`, `onDrop`, the `dragFrom` ref, `handleDrop`).
  - Add `onMove(placeId, dir)` and pass per-card props:

```tsx
  function move(placeId: string, dir: 'up' | 'down') {
    const ids = stops.map((s) => s.id);
    const from = ids.indexOf(placeId);
    const to = dir === 'up' ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= ids.length) return;
    onReorder(reorderIds(ids, from, to));
  }
```

```tsx
                <PlaceCard
                  place={stop}
                  pinNumber={pinLabel(stop)}
                  pinColor={dayColor}
                  currency={currency}
                  locale={locale}
                  disabled={disabled}
                  isFirst={i === 0}
                  isLast={i === stops.length - 1}
                  onTap={onTapPlace}
                  onView={onViewPlace}
                  onMoveUp={(id) => move(id, 'up')}
                  onMoveDown={(id) => move(id, 'down')}
                  onMoveToSaved={onMoveToSaved}
                  onMoveToDay={onMoveToDay}
                  onDelete={onDelete}
                />
```

  - Add `onViewPlace: (placeId: string) => void;` to `DayItineraryProps` and the destructure.

- [ ] **Step 5: Update DayItinerary.test.** Add `onViewPlace` to the rendered props; replace any drag test with ▲/▼ behavior: clicking ▼ on the first of two stops calls `onReorder(['b','a'])` (or the right order). Keep the existing add-place tests.

- [ ] **Step 6: Run suites — expect PASS.**

Run: `npx vitest run components/plan/PlaceCard.test.tsx components/plan/DayItinerary.test.tsx`

- [ ] **Step 7: tsc + commit.**

```bash
npx tsc --noEmit
git add components/plan/PlaceCard.tsx components/plan/PlaceCard.test.tsx components/plan/DayItinerary.tsx components/plan/DayItinerary.test.tsx
git commit -m "feat(plan): pill actions + ▲/▼ reorder + View on place cards"
```

---

### Task 16: Wire the list View button to the read card (PlanClient)

**Files:**
- Modify: `components/plan/PlanClient.tsx`

- [ ] **Step 1: Pass `onViewPlace` into the itinerary.** `DayItinerary` is rendered by PlanClient. Add `onViewPlace={(id) => setViewPlace(placeById(id))}` to the `<DayItinerary>` usage (the `viewPlace` state + read-card overlay were added in Task 11, so the same overlay now serves list View too).

- [ ] **Step 2: Verify the existing PlanClient test still passes** (no new assertion required; the wiring reuses Task 11 state).

Run: `npx vitest run components/plan/PlanClient.test.tsx`

- [ ] **Step 3: tsc + commit.**

```bash
npx tsc --noEmit
git add components/plan/PlanClient.tsx
git commit -m "feat(plan): list View button opens the read card"
```

---

### Task 17: Scroll-lock the shell

**Files:**
- Modify: `app/globals.css`, `components/TripShellClient.tsx`

- [ ] **Step 1: Lock html/body bounce.** In `app/globals.css`, update the `html, body` rule:

```css
html,
body {
  height: 100%;
  overscroll-behavior: none;
  background-color: var(--paper);
  color: var(--ink);
  font-family: var(--font-sans, system-ui, sans-serif);
  -webkit-font-smoothing: antialiased;
}
```

(Do **not** set `overflow:hidden` globally — Home/Settings must still scroll. `overscroll-behavior:none` stops the document rubber-band; the trip shell remains a fixed-height column.)

- [ ] **Step 2: Contain the inner scroll.** In `components/TripShellClient.tsx`, add `overscroll-contain` to the single scroll region so its scrolling never chains to the document:

```tsx
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain">{children}</div>
```

- [ ] **Step 3: Run the full suite — expect PASS** (no behavioral test; CSS-only).

Run: `npx vitest run`

- [ ] **Step 4: Commit.**

```bash
git add app/globals.css components/TripShellClient.tsx
git commit -m "fix(shell): lock document scroll; only inner list scrolls / map drags"
```

---

## Final: whole-plan verification + deploy

- [ ] **Step 1: Full gate.**

Run: `npx vitest run && npx tsc --noEmit && npx eslint components/plan components/map src/lib/openai app/_actions src/db/repos app/api && npm run build`
Expected: all green.

- [ ] **Step 2: Local browser verify.** Start dev (`PORT=3100 npm run dev`), seed/visit a trip, and confirm:
  - Map: tapping a day chip isolates that day's pins+route; "All days" restores all.
  - Pins: the disc sits centered on the landmark (zoom in to confirm); number chip hangs centered below.
  - Tap a day pin → read card (photo/AI summary/notes/links + show-more + Edit). List card **View** → same read card.
  - Add a place → after a moment, its AI summary appears (requires `OPENAI_API_KEY` in `.env.local`).
  - Editor: edit/regenerate summary; add/remove a guide link.
  - Reorder with ▲/▼; action pills are distinct (Delete red).
  - Page itself doesn't scroll vertically; only the list scrolls / map drags.

- [ ] **Step 3: Deploy.**

Run: `./scripts/deploy.sh`
Expected: image builds, migration `0005` applies on container start, origin health 200. The container reads `OPENAI_API_KEY` from `/opt/webapp/.env` (already staged).

- [ ] **Step 4: Prod smoke.** Load the live plan map; confirm pins/read-card/day-filter; add a place and confirm the AI summary lands (server key live). Note: Mapbox tiles may not render in an automated sandbox (telemetry blocked) — verify in a real browser.

---

## Self-review notes (coverage map)

- Item 1 → Task 8. Item 2 → Task 9. Item 3 → Tasks 5, 6, 12, 13. Item 4 → Tasks 3, 4, 7, 14.
  Item 5 → Tasks 7, 10, 11, 16. Item 6 → Task 15. Item 7 → Task 15. Item 8 → Task 17.
- Data plumbing (migration, DTO, env) → Tasks 1, 2, 7, 5.
- Types are consistent across tasks: `aiSummary: string | null`, `links: {id,url,title,thumbnail}[]`,
  `PlacePatch`/`updateSchema` carry `aiSummary`, `AddLinkInput.placeId`, `generatePlaceSummaryAction(placeId): Promise<Place|null>`,
  MapLegend `onSelectDay`, PlanMap `onViewPlace`/`onShowOnlyDate`/`onShowAllDays`, PlaceCard `onView`/`onMoveUp`/`onMoveDown`/`isFirst`/`isLast`.
