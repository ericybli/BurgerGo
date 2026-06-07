# BurgerGo Plan 4 — Place Enrichment, Map Filter & Plan-tab UX

**Status:** Approved design (brainstorm) → ready for implementation plan.
**Date:** 2026-06-06

## Goal

Eight Plan-tab/place improvements: single-day map isolation, exact-on-coordinate
pins, an AI place summary (OpenAI), per-place attached travel-guide links, a rich
read view on pin tap, touch-friendly reordering, cleaner card action buttons, and
a fully scroll-locked app shell.

## Architecture

Builds on existing BurgerGo conventions: Next.js 15 App Router + TS (strict,
`noUncheckedIndexedAccess`) + Drizzle/better-sqlite3 + Serwist + Tailwind v3;
pure repos, online-only Server Actions, static-shell + client-fetch reads,
Mapbox the active in-app renderer (Google kept switchable). One migration
(`0005`), one new server service (OpenAI via `fetch`, no SDK), and targeted
component changes. No new runtime npm dependencies.

## Conventions to preserve (from prior plans)

- DB timestamps are Unix **seconds** (`{mode:'timestamp'}`); repos use `new Date(now())`.
- `NEXT_PUBLIC_*` are build-args + literal `process.env` reads; **server-only** keys
  (`OPENAI_API_KEY`) are runtime env, never `NEXT_PUBLIC`, never logged.
- `tsc` is a required gate (vitest strips types).
- Money = integer minor units; photo/link path-traversal + SSRF guards stay intact.
- Link fetches stay behind the SSRF-guarded `/api/links/preview` with IP-pinning.

---

## §1 Data model — migration `0005`

Add to **`places`**:
- `ai_summary text` — AI-generated intro; nullable; user-editable.

Add to **`saved_links`**:
- `place_id text` → `references(() => places.id, { onDelete: 'cascade' })`, nullable.
  - `place_id IS NULL` → trip reading list (today's behavior, unchanged).
  - `place_id = <id>` → a travel-guide link attached to that place.

`Place` / `SavedLink` inferred types pick the columns up automatically. Generate
with `npm run db:generate`; migration applies on container start.

## §2 OpenAI service — `src/lib/openai/server.ts`

Server-only. Plain `fetch` to `https://api.openai.com/v1/chat/completions`
(model `gpt-4o-mini`), no npm SDK.

```
generatePlaceSummary(input: {
  name: string; address: string | null; category: string;
  tripName: string; startDate: string; endDate: string;
}): Promise<string | null>
```

- Reads `process.env.OPENAI_API_KEY`; returns `null` if missing (feature degrades
  silently — places still save without a summary).
- Prompt: a concise 2–3 sentence traveler-oriented intro for `<name>` (a
  `<category>` near `<address>`) for a trip to `<tripName>`. System message caps
  length and forbids markdown/headers (plain text). `max_tokens` ~160,
  `temperature` ~0.6.
- Network/JSON/HTTP errors → caught → `null` (never throws to the caller).
- Never logs the key; logs only a generic failure marker.

## §3 Item 1 — map day filter becomes single-select

`MapLegend` + `PlanClient` change the day-visibility semantics:
- Tapping a **day chip** selects **only** that day → `visibleDates = {date}`.
- Tapping **"All days"** → `visibleDates = {all day dates}` (the default on load).
- `aria-pressed` reflects the active selection (a single day, or All days).

Consequence: the rendered pins, route polylines, the per-day "Open day route"
links, and the offline deep-link list all already derive from `visibleDates`, so
they follow the single selection automatically. `MapLegend` prop renames the
day handler to `onSelectDay(date)` (sets, not toggles); `onToggleAll` stays.

## §4 Item 2 — pins centered exactly on the coordinate

Keep the **round disc**, anchored on the coordinate, but stop the day-number
badge from skewing the perceived center:
- **Mapbox** (`createMarkerEl`): the disc stays `anchor:'center'` (its center is
  already on the point). Move the number from a protruding top-right badge to a
  **horizontally-centered** chip overlapping the disc's bottom edge, so the
  marker is left/right symmetric — the visual center sits on the coordinate.
  Glyph stays centered in the disc.
- **Google** already renders a centered glyph label on a centered circle (no
  corner badge) — unchanged.
- Verify in-browser: at high zoom the disc center sits on a known coordinate.

## §5 Item 5 — rich read view on pin tap (`PlaceReadCard`)

New component replacing the compact `PlaceInfoCard` for map pin taps. Read-only,
shows when present, each long block with a **"show more"/"show less"** toggle
(collapsed to ~3 lines):
- Photo(s): first personal photo, else the cached Google card photo, else the
  category glyph.
- AI summary (`aiSummary`).
- Notes (`notes`).
- Attached links (`links[]`): title + thumbnail + opens in a new tab.

Actions: **Open in Google Maps** (offline-safe `placeUrl`) and **Edit** →
opens the existing `PlaceDetailSheet` editor for that place. Saved-bucket pins
still show "Add to day". As a map overlay it mirrors the current info card
(near the bottom), scrolling internally if tall.

**Reachable from the list too:** each list `PlaceCard` gets a **View** button
that opens this same read view (rendered as a bottom sheet when opened from the
list). Tapping the card body still opens the editor directly (unchanged), so
View = read, body-tap/Edit = edit.

## §6 Item 3 — AI summary flow

- **On add:** after `addPlaceAction` resolves (place saved + client-side
  geocode done), `AddPlaceSheet` fires `generatePlaceSummaryAction(placeId)`
  (fire-and-forget) then triggers the normal reload, so the summary appears once
  ready. Not awaited in the save path → adding stays fast and never blocks on
  OpenAI.
- **Regenerate:** a "Regenerate summary" button in the `PlaceDetailSheet` editor
  (and/or the read view) re-runs the action.
- **Editable:** the summary is a normal editable text field in the editor, saved
  via `updatePlaceAction` (schema gains `aiSummary`). Regenerate overwrites it.
- **Action** `generatePlaceSummaryAction(placeId)`: loads the place + its trip,
  calls `generatePlaceSummary(...)`, writes `ai_summary` (no-op on `null`),
  `revalidatePath('/trip/<tripId>/plan')`.
- **Public-app note:** the app has no auth; the generate endpoint is callable by
  anyone with the URL. Accepted (single-user, obscure URL). Cost ≈ fractions of a
  cent/call on `gpt-4o-mini`. No heavy rate limiting in scope.

## §7 Item 4 — per-place attached links

Reuse the entire reading-list/OG-preview/thumbnail/SSRF stack via `place_id`:
- Repo (`savedLinks.ts`): `addLink` input gains optional `placeId`;
  `listLinksForTrip` filters `place_id IS NULL`; new `listLinksForPlace(db, placeId)`.
- Action (`savedLinks.ts`): `addLinkAction` accepts optional `placeId`;
  `revalidatePath('/trip/<tripId>/plan')` when place-scoped. Delete unchanged
  (already removes the thumbnail file best-effort).
- Editor: `PlaceDetailSheet` gains an "Travel guides / links" section — paste a
  URL → `POST /api/links/preview` prefills title/thumbnail → save; list existing
  with remove. (Mirrors the Journal reading-list `LinkSheet` UX, scoped to the place.)
- Read view: render the place's `links[]` with thumbnails.

## §8 Item 6 — reorder via up/down arrows

`PlaceCard` gains ▲/▼ buttons (▲ disabled on the first stop, ▼ on the last).
Each calls a new `onMove(placeId, 'up'|'down')` that `DayItinerary` maps to the
existing `reorderIds(...)` + `onReorder(orderedIds)` path (same Server Action as
today). Remove the desktop-only HTML5 `draggable`/`onDrop` wiring (touch never
fired it). Accessible: real `<button>`s with aria-labels.

## §9 Item 7 — distinct pill action buttons

Replace the run-together text row in `PlaceCard` with clearly separated outlined
pill buttons, each a clear tap target: a **View** pill (opens the read view,
§5) plus the three management pills **Save** (teal), **Move** (teal), **Delete**
(red). View is visually distinct from the management group (e.g. leading, or
slightly emphasized). Disabled state preserved on the management pills (View
stays enabled offline — it's read-only).

## §10 Item 8 — lock the page so only inner regions scroll

- `globals.css`: `html, body { height: 100%; overscroll-behavior: none; }` and
  remove document-level bounce. Keep `body` background; do **not** globally set
  `overflow:hidden` (Home/Settings must still scroll).
- Trip shell (`TripShellClient`): the inner scroll region gets
  `overscroll-contain` so list scrolling never chains to the document; the shell
  stays pinned to the dynamic viewport (`h-[100dvh]` / `100dvh`). `OfflineBanner`
  remains an in-flow strip only when offline (returns null online → no height).
- Net: on the Plan map/list, only the inner list scrolls / the map drags; the
  document itself does not rubber-band. Home and Settings still scroll normally.

## §11 PlaceDTO extension

Add to **both** `PlaceDTO` definitions (the `app/api/trips/[tripId]/places`
route's `extends Place`, and the structural `src/lib/planView.ts` interface):
- `aiSummary: string | null` (from `Place`).
- `links: { id: string; url: string; title: string | null; thumbnail: string | null }[]`
  — batch-loaded in the route like `photos` (one `inArray(place_id, ids)` query),
  ordered newest-first.

## §12 i18n (en.json)

New `plan` keys: `aiSummary` ("About"), `regenerateSummary`, `regenerating`,
`summaryFailed`, `guidesLabel` ("Travel guides"), `addGuideLink`, `guideUrlPlaceholder`,
`showMore`, `showLess`, `moveUp`, `moveDown`, `move`, `view`, `edit`. New `planMap` key
`readCardLabel` (read-view dialog aria-label). Reuse existing keys where they
already exist: `planMap.openInMaps`, `plan.moveToSaved`, `plan.delete`,
`plan.save`, `plan.cancel`, and the link-error keys from the Journal namespace.

## §13 Deployment / env

- `OPENAI_API_KEY` is a **runtime** server env var (not a build arg): add to
  `docker-compose.yml` `environment` passthrough and to `/opt/webapp/.env` on the
  server (owner pastes it directly — do not transcribe). Absent key → AI summary
  silently disabled; everything else works.
- Migration `0005` applies on container start. Deploy via `./scripts/deploy.sh`.

## §14 Testing

- Repo: `savedLinks` place-scoping (`listLinksForPlace`, `listLinksForTrip`
  excludes place links); migration `0005` shape (schema.shape test updated).
- OpenAI service: unit test with mocked `fetch` (success → string; missing key →
  null; HTTP/JSON error → null). Never hits the network.
- Actions: `generatePlaceSummaryAction` (mocked service) writes `ai_summary`;
  `addLinkAction` with `placeId`; `updatePlaceAction` accepts `aiSummary`.
- Components: `MapLegend` single-select; `PlaceCard` ▲/▼ + pill buttons;
  `PlaceReadCard` show-more + Edit; `DayItinerary` move mapping;
  `AddPlaceSheet` fires summary generation (mocked) after add.
- Full `vitest` + `tsc` + `eslint` + `next build` gates; in-browser verify;
  deploy.

## §15 Task groups (for the plan)

- **D0 — Data & services:** migration `0005`; OpenAI service; PlaceDTO extension
  (+ route batch-load of links); repo/action plumbing (`aiSummary`, place links).
- **D1 — Map:** day-filter single-select (item 1); pin recenter (item 2);
  `PlaceReadCard` on pin tap (item 5).
- **D2 — Place content:** AI summary auto+regenerate+edit (item 3); per-place
  links editor + read display (item 4).
- **D3 — List UX:** reorder arrows (item 6); pill action buttons (item 7);
  scroll lock (item 8).

Each group: tests → `tsc`/lint/build → browser-verify → deploy (or one deploy
after D3, with intermediate self-checks).

## §16 Out of scope / risks

- No auth/rate-limit on the AI endpoint (accepted; single-user public app).
- AI summaries are best-effort; quality/accuracy not guaranteed (it's a starter
  blurb the user can edit).
- Attached-link fetches keep the existing SSRF protections; no new fetch surface.
- Google renderer stays glyph-only (no number badge); Mapbox is the active map.
