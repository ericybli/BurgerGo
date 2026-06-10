# eats parity spec

Source of truth: `/Users/eric/own/BurgerGo/components/eats/*` (web) vs `/Users/eric/own/BurgerGo/expo-rn/screens/eats/*` (RN). Labels below are exact web strings (`messages/en.json` → `eats`, `planMap`, `plan` namespaces).

## Web feature inventory (exhaustive)

### Header row (`EatsClient.tsx`)
- Title `Eats` (left, bold, ink, 21px, tracking -0.02em).
- Button `Add restaurant` (right): solid orange, white text, radius 10; **disabled while offline** (offline = `navigator.onLine`; RN uses `useOnline()`); disabled style = surface bg + faint text (no opacity wash).

### Filter segmented control
- One row, 3 segments: `All` | `Want to try` | `Been`. Default `all`.
- Track: surface bg, radius 10, 3px padding; active segment: bg-white + ink text + `shadow-thumb`; inactive: sub text. `aria-pressed` semantics.
- Pure client-side filter (`filterByStatus`): `all` passes everything; otherwise `r.status === filter`. No re-fetch on filter change.

### List
- Order: **server order as returned — newest first (`createdAt` DESC, `id` ASC tiebreak)**. Client never re-sorts.
- Each row mounts with a fade-up animation, staggered `min(index,6) * 40ms`.
- Empty state shows **only when total `restaurants.length === 0`** (a filter that yields zero rows shows an empty list, not the EmptyState). EmptyState = mascot logo (112×112), headline `No eats logged yet`, subtext `Add a spot you want to try, or one you've already loved.`, plus an orange `Add restaurant` action **only when online**.
- Loading: centered `Loading your eats…` (sub). Error: EmptyState with `Couldn't load your eats` / `Connect to the internet and try again.`
- Web re-fetches on a `TRIP_DATA_CHANGED` window event; RN equivalent = re-fetch on screen focus (already done via `useFocusEffect`).

### Restaurant card (`RestaurantCard.tsx`) — horizontal row, NOT a boxed card
- Whole row is one tap target → opens detail sheet. Layout: `[72×72 thumb] [text column] [chevron-right]`, hairline `border-b border-line`, vertical padding 10, `active:opacity-70`.
- Thumb (72×72, radius 12, cover) rendered **only when a photo exists**; precedence: first personal photo (`/api/photos/p/{id}/card`) → cached Google photo (`/api/photos/r/{restaurantId}/card`, gated on `photoPath != null`) → **no image** (no glyph on the card).
- Line 1: name — 15px semibold ink, single-line truncate.
- Line 2: status chip (self-start pill, 10.5px bold uppercase tracking 0.04em): `been` → surface bg + sub text `Been`; `want-to-try` → accent-tint bg + accent text `Want to try`.
- Line 3 (meta, 11.5px sub, wraps, gap 8): cuisine as plain text (no chip) · personal-rating stars (`ratingStars`: 1–5 → filled `★` in accent + empty `★` in line color; hidden when null) · price `priceLevelLabel` (`$`…`$$$$`, tabular-nums, hidden when null).
- Line 4 (conditional): notes, 1-line clamp, caption sub.
- Line 5 (conditional): `Scheduled · {scheduledDayDate}` — micro size, uppercase, accent. Date shown raw as `YYYY-MM-DD`.
- Trailing chevron: lucide `ChevronRight` 14px, faint.
- Note: **Google rating / open-now do NOT appear on the card** — detail sheet only.

### Detail sheet (`RestaurantDetailSheet.tsx`) — bottom sheet, max-h 85vh, scrollable
Backdrop: scrim + blur, tap-outside & Escape close. Drag handle (40×4, line color). Order top→bottom:
1. Action-error banner (conditional): `Couldn't save — please try again.` — hairline border box, danger text.
2. Title: name (18px bold).
3. Meta line (caption, sub, wraps): cuisine or fallback `Cuisine not set` · stars (same as card) or `No rating` · price (ink, tabular).
4. Schedule line (micro uppercase accent): `Scheduled · {date}` or `Not scheduled`.
5. **Google block** (conditional; hairline-bordered box, radius 10, px-3 py-2). Render only if `googleRating != null` OR hours non-empty OR live `openNow != null`.
   - Rating row: small gold star (lucide `Star`, 12px, fill = day-2 `#C99231`, no stroke) + `googleRating.toFixed(1)` (semibold ink tabular) + `· {n} review/reviews` (sub, plural) + `· Google` (faint).
   - Open/hours disclosure button (caption semibold): label = `Open now` (success) / `Closed` (danger) when live openNow known, else `Hours` (ink); trailing `▾`/`▴` (faint) shown only when hours exist; button disabled when hours empty. Expanded → list of localized weekday lines (e.g. `Monday: 11:00 AM – 10:00 PM`), one `<li>` per line, caption sub tabular-nums.
   - Hours source: **live first, stored fallback**. On sheet open, when online AND `googlePlaceId` set, fetch `GET /api/google/poi?placeId=` → `{ openNow, hours }`. Stored `googleHours` is a JSON `string[]` (parse defensively → `[]` on bad JSON). `openNow` is **never** read from storage (volatile). Reset live state + collapse hours whenever the sheet re-opens/changes restaurant.
6. Notes paragraph (conditional, body ink).
7. Hero photo (conditional, same precedence as card thumb): full-width, h-192, radius 14, hairline border, cover.
8. Photo-error banner (conditional): `That image is too large (max 10MB).` / `You've reached the photo limit for this place (max 12).` / `Please choose an image file.` / `Couldn't upload — please try again.`
9. Photo gallery (personal photos only): label `Photos`, thumb grid (80×80) each with `✕` delete (immediate, no confirm) + tap → fullscreen viewer (full-size image, `Previous photo`/`Next photo` arrows when >1, `Close photo`).
10. Add photo: label `Add photo`; offline hint `Connect to add photos`; picker; while uploading show `Uploading…`. Upload disabled offline/uploading.
11. Primary toggle button — **accent (teal) filled, white text, radius 12**: `Mark as been` ⇄ `Mark as want to try` (PATCH `{status}`).
12. `Add to a day` (outlined hairline button) → replaces itself inline with picker: label `Add to which day?` + one outlined row per trip day: `Day {dayNumber} · {Weekday} {YYYY-MM-DD}` (weekday = English long name, e.g. `Sunday`; tabular-nums). Tap schedules.
13. `Remove from plan` (outlined; only when `scheduledDayDate` set) → unschedule.
14. `Edit restaurant` (outlined) → closes detail, opens form in edit mode.
15. Delete, two-step: `Delete` (text-style, danger color) → swaps to solid danger `Delete this restaurant?` → confirm deletes.
16. `Cancel` (outlined) → close.
- Every mutating control disabled while offline or a mutation is pending; every successful mutation closes nothing except via `onChanged` → list re-fetch (web closes detail after change; RN keeps detail open synced to re-fetched data — acceptable, but web behavior is **close on change** except photo ops keep it open. Match web: photo add/delete keep sheet open; status/schedule/delete actions close it).
- There are **no external links** (no Maps/website links) on the web eats detail sheet — do not invent any.

### Form sheet (`RestaurantFormSheet.tsx`) — add (restaurant=null) / edit
- Remounted (keyed) on every open so fields reset. Bottom sheet like detail. Save no-ops on empty trimmed name (no error shown); server re-validates.
- Fields in order: `Name` (text) · `Cuisine` (text) · `Address` (text, placeholder `Search or type an address`, autoComplete off) + hint below `Pick a suggestion, or just type an address. We'll map it for you.` · suggestion list (conditional) · `Status` select (`Want to try`/`Been`) · `Rating` select (`No rating`,1–5) · `Price` select (`No price`, `$`,`$$`,`$$$`,`$$$$`) · `Notes` textarea · footer row `Cancel` (outlined, flex-1) + `Save` (solid orange, flex-1).
- **Google autocomplete**: typing in Address calls `GET /api/google/autocomplete?input={q}&sessionToken={uuid}` (debounce not present on web — fires per change; empty input clears). Predictions render as a hairline-bordered list of `description` buttons. Picking one calls `GET /api/google/details?placeId&sessionToken` → auto-fills **name only if currently empty**, replaces address with formatted address, stores `{lat,lng,googlePlaceId}` as "picked", clears the list, rotates the session UUID (one Google billing session per search→select cycle; rotate also on clear/select).
- Editing the address text after a pick **invalidates the pick** (`picked = null`).
- Save-time coordinate resolution (exact web rules):
  - start from `picked ?? existing restaurant` values for lat/lng/googlePlaceId;
  - empty trimmed address → `lat=lng=googlePlaceId=null` (clears the pin);
  - no pick AND address changed from initial → `GET /api/google/geocode?address=` best-effort; on match also call `/api/google/details?placeId={gpid}&sessionToken` once so the Google photo gets downloaded/cached; on no-match save with null coords;
  - unchanged address → keep existing coords (editing other fields never drops the pin).
- Save error banner: `Couldn't save — please try again.` Controls disabled while offline or pending.
- On the server, setting/changing `googlePlaceId` (or first-time) triggers `refreshRestaurantGoogleAction` → persists `googleRating`/`googleRatingCount`/`googleHours` + caches the Google photo. The client just needs to send `googlePlaceId`.

### Formatting rules for this section
- Dates: raw `YYYY-MM-DD` everywhere; weekday = English long name computed UTC-stable. No money, no distances in Eats. Numbers tabular-nums where noted. Personal rating = integer 1–5 stars; Google rating = decimal `toFixed(1)`. Price level 1–4 → `$`-repeat.

## Already in RN seed (works as-is)
- Screen scaffold: load on focus, loading/error/empty states with correct copy, status filter via `SegmentedControl` (Atlas-styled in `expo-rn/components/ui`), add/edit/detail sheets keyed for reset, empty-state-only-when-zero-total logic, offline gating via `useOnline()`.
- `lib/api` namespace complete for CRUD: `api.eats.list/create/update/remove/schedule`, `api.photos.upload/remove`, `photoUrl.personal/restaurant` builders, optional `x-api-key`.
- Card: name/status chip/cuisine/stars/price/notes/scheduled line + thumb precedence logic (`thumbSrc`).
- Detail: meta + fallbacks (`Cuisine not set`, `No rating`), notes, hero, gallery grid with per-photo delete, fullscreen viewer with prev/next/`Close photo`, add-photo via `expo-image-picker` with exact error copy, status toggle, day picker (`Add to which day?`, `Day {n} · {Weekday} {date}`), `Remove from plan`, edit handoff, two-step delete, cancel.
- Form: all fields/options with exact labels, `'0'`-sentinel → null mapping, empty-name no-op, error copy, server-side geocode on create.
- Atlas tokens already exist in `expo-rn/lib/theme.ts` (`colors`, `type`, `radius`, `font`) and the shared ui kit — the eats screens just don't use them canonically yet.

## Gaps to build
1. **Restaurant type: Google fields.** Add `googleRating: number | null`, `googleRatingCount: number | null`, `googleHours: string | null` (JSON string[]), `googleDataUpdatedAt: number | null` to `expo-rn/lib/api/types.ts` `Restaurant` (GET already returns them — DTO spreads all DB columns). Edge: `googleHours` may be malformed → parse in try/catch → `[]`.
2. **Detail: Google block** (rating row + open-now/hours disclosure) per inventory §5. Data: stored fields + live `GET /api/google/poi?placeId={googlePlaceId}` on sheet open when online && `googlePlaceId`. Add a `poiDetails(placeId)` helper to `lib/api`. Edge cases: 502 / network fail → silently fall back to stored data; cancel the fetch result if sheet closed (stale-guard); block hidden entirely when no rating, no hours, no live openNow; disclosure disabled when hours empty; openNow never from storage.
3. **Form: Places autocomplete.** Port `usePlacesAutocomplete` (predictions/search/select/clear + per-cycle UUID session token — use `expo-crypto` `randomUUID` or a tiny uuid fn; `crypto.randomUUID` is unavailable in RN). Endpoints: `GET /api/google/autocomplete?input&sessionToken` → `{predictions:[{placeId,description}]}` (degrades to `[]`, never 5xx); `GET /api/google/details?placeId&sessionToken` → `{googlePlaceId,name,address,lat,lng,...}`. UI: suggestion list under the Address field (hairline border, radius 10, rows of `description`); pick → fill name-if-empty + address + store picked coords + clear list. Edge: typing after pick clears `picked`; offline → skip search (list empty).
4. **Form: save-time geocode + coords payload.** Implement web's exact resolution (picked → keep-existing → clear-on-empty → forward-geocode-on-changed-text via `GET /api/google/geocode?address=`; on geocode match also hit `/api/google/details` once to warm the photo cache). Then: **edit** → PATCH full payload incl. `address/lat/lng/googlePlaceId` (current RN edit silently drops location changes — bug vs web). **Add** → `POST /api/trips/{tripId}/restaurants` accepts only name/address/about/notes/cuisine/status/rating/priceLevel (strips coords) and geocodes server-side; for exact parity when the client resolved a `googlePlaceId` (suggestion pick or client geocode), follow the POST with `PATCH {lat,lng,googlePlaceId}` on the created `restaurant.id` — this also triggers the server's Google rating/hours/photo refresh. Edge: geocode null → save with null coords (still listed, just unpinned).
5. **Card restyle → web row layout.** Replace boxed shadow card with: hairline-bottom row, 72×72 left thumb (radius 12, only when photo), text column (name 15 semibold → status pill **below** name, self-start → meta row with cuisine as plain sub text (drop the cuisine chip) → notes clamp → scheduled micro uppercase accent), trailing chevron-right (14, faint; `lucide-react-native` or `›` glyph). Stars: filled = **accent** (not coral), empty = line. List container: no gap-cards — continuous hairline-divided list, horizontal padding 16.
6. **Detail restyle + behavior parity.** Use `Sheet`+`SheetPanel` (handle, radius 22, white) — drop the custom warm-editorial styles; status-toggle button = solid accent w/ white text (add an `accent` Button variant if missing); outlined actions = hairline border, bg white, ink label; error banners = hairline box + danger text (not bare text); Google block from gap 2 inserted between schedule line and notes; close-on-mutate: status/schedule/unschedule/delete → close sheet then reload (photo ops stay open). Scheduled line: micro uppercase accent / `Not scheduled` same style in accent (web keeps accent color for both).
7. **Header/segment polish.** `Add restaurant` button: radius 10, px 14 / py 8, label 13 semibold; disabled = surface bg + faint text. Title 21 bold tracking −0.42. Segmented active thumb: white bg + `shadow-thumb` equivalent (`shadowOpacity 0.10, radius 2, offset (0,1)` + hairline ring) — allowed shadow exception.
8. **List entrance animation (nice-to-have).** Fade-up stagger 40ms × min(index,6) via `Animated`/`reanimated` to match web `animate-fade-up`.

## Atlas Light styling notes for this section
- Canonical tokens only (`colors.bg/surface/ink/sub/faint/line/accent/accentTint/orange/orangePress/success/danger` in `lib/theme.ts`); **purge legacy aliases** (`coral`, `paper`, `card`, `teal`, `inkMuted`) from all four eats files.
- White `bg` everywhere; **no card shadows** — list rows are hairline-bottom (`StyleSheet.hairlineWidth`, color `line`) flat rows; bordered boxes (Google block, error banners, suggestion list, day-picker rows, outlined buttons) = 1px `line` border, radius `radius.control` (10), white bg.
- Shadow exceptions only: segmented active thumb + bottom sheet (`SheetPanel` already handles sheet elevation).
- Color discipline: `accent` (teal) = information/navigation — status chip want-to-try tint, stars, scheduled line, status-toggle button, focus rings; `orange` = create/save only — `Add restaurant`, form `Save`, empty-state action. Never swap. `danger #B3402C` for delete/closed; `success #3E8E6E` for `Open now`; gold `#C99231` (day-2) solely for the Google star glyph.
- Type: use `type.*` fragments (Instrument Sans family names, never `fontWeight` alone): title 21/bold, row name 15/semibold, meta 11.5 sub, chip micro-ish 10.5 bold uppercase letterSpacing ~0.42, scheduled/section `micro` uppercase, body 13.5, caption 12.
- Radii: control 10 (inputs/buttons/boxes), card 14 (hero), 12 (thumbs, primary CTA), sheet 22, chip 999.
- Web class → token map: `bg-surface`→`colors.surface`; `text-sub`→`colors.sub`; `text-faint`→`colors.faint`; `border-line`→1px `colors.line`; `bg-accent-tint text-accent`→chip tint; `bg-orange`→CTA; `shadow-thumb`→segment thumb; `rounded-control`→10.

## API surface (all relative to `API_BASE = https://eric.month2month.com/burgergo`; writes send `x-api-key` when `WRITE_KEY` set)
| # | Method + path | Body / params | Returns |
|---|---|---|---|
| 1 | `GET /api/trips/{tripId}/restaurants` | — | `{ restaurants: RestaurantDTO[] }` — all DB columns (incl. `googleRating`, `googleRatingCount`, `googleHours` JSON-string, `googleDataUpdatedAt`) + derived `scheduledDayDate`, `photoPath`, `photos:[{id,width,height}]`; newest-first |
| 2 | `POST /api/trips/{tripId}/restaurants` | `{ name, address?, about?, notes?, cuisine?, status?, rating?(1–5), priceLevel?(1–4) }` — coords stripped; server forward-geocodes address | `201 { restaurant }` |
| 3 | `PATCH /api/trips/{tripId}/restaurants/{restaurantId}` | any of `{ name, cuisine, rating, status, priceLevel, notes, address, lat, lng, googlePlaceId }` (nullables clear) — new/changed `googlePlaceId` triggers server Google refresh | `{ restaurant }` |
| 4 | `DELETE /api/trips/{tripId}/restaurants/{restaurantId}` | — | `{ ok: true }` |
| 5 | `POST /api/trips/{tripId}/restaurants/{restaurantId}/schedule` | `{ dayDate: 'YYYY-MM-DD' \| null }` (null = unschedule) | schedule → `{ restaurant, place }`; unschedule → `{ restaurant }` |
| 6 | `GET /api/google/autocomplete?input={q}&sessionToken={uuid}` | — | `{ predictions: [{ placeId, description }] }` (always 200) |
| 7 | `GET /api/google/details?placeId={id}&sessionToken={uuid}` | — | `{ googlePlaceId, name, address, lat, lng, categoryGuess, photoRef, photoLocalPath, cached }` |
| 8 | `GET /api/google/geocode?address={text}` | — | `{ lat, lng, address, googlePlaceId }` (nulls on no match) |
| 9 | `GET /api/google/poi?placeId={id}` | — | `{ googlePlaceId, name, address, lat, lng, categoryGuess, rating, ratingCount, openNow, hours: string[], summary, photoRefs, reviews, isFood }`; 502 when Google unavailable |
| 10 | `POST /api/photos` | multipart: `image` file + `tripId` + `ownerType:'restaurant'` + `ownerId:{restaurantId}` | `{ photo }`; errors: `too_large` 413, `too_many` 409 (max 12), `invalid_image` 415 |
| 11 | `DELETE /api/photos/p/{photoId}` | — | `{ ok: true }` |
| 12 | `GET /api/photos/p/{photoId}/{thumb\|card\|full}` | image | personal photo bytes |
| 13 | `GET /api/photos/r/{restaurantId}/{card\|thumb}` | image | cached Google restaurant photo (use only when `photoPath != null`) |