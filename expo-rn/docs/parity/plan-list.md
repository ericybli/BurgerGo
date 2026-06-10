# plan-list parity spec

Source of truth: `/Users/eric/own/BurgerGo/components/plan/*` + `/Users/eric/own/BurgerGo/src/lib/{planView,planUrl,legView,exportDay,days,weather}.ts`. RN target: `/Users/eric/own/BurgerGo/expo-rn/screens/plan/*` + `/Users/eric/own/BurgerGo/expo-rn/lib/*`. Scope = Plan **list** view (map excluded except where chrome is shared).

## Web feature inventory (grouped by UI region)

### A. Sticky chrome (list view only)
- In list view, a sticky region pins to the top of the scroll area (`sticky top-0 z-20`, white `bg`, bottom hairline `border-line`); only the itinerary scrolls beneath. In map view it is not sticky.
- Contents (top→bottom): TripOverview (days bucket only) → two segmented controls side-by-side → DayStrip (days bucket + list view only; hidden in map view).
- Above the sticky region: transient mutation-error banner `role="alert"`: **"Action failed — please try again."** (save path: **"Couldn't save — please try again."**). Shown on any failed mutation; cleared at the start of the next one.

### B. Segmented toggles
- Left control: **List | Map**. Right control: **Days | Saved**. Both: track `bg-surface` rounded-10 p-[3px]; active thumb = white `bg` + `text-ink` + `shadow-thumb`; inactive `text-sub`. `aria-pressed` per button.
- Web persists `?view=&bucket=&date=` in the URL; RN keeps equivalent local state. There is **no "All days" view** on web — exactly one day is selected at a time.

### C. TripOverview (collapsible "at a glance" panel; days bucket only)
- Rounded-12 hairline card. Header button: chevron (Right collapsed / Down expanded), label **"Overview"**; when collapsed also a one-line summary `"Day {n} · Sat, Sep 5"` + weather chip `"{emoji} {round(tMaxC)}°"`.
- Collapsed by default; persisted (web: localStorage `burgergo.overview.collapsed`, `'0'` = expanded).
- "Relevant day": today when trip active; day 1 when upcoming; last day when past.
- Expanded rows (hairline `divide-line`):
  1. Day heading `"Day {n} · Sat, Sep 5"`; when upcoming + `daysToStart > 0` right-aligned **"{days}d to go"**.
  2. Weather: `"{emoji} {max}°/{min}° {label}"` + `" · {precipProb}% rain"` (only when > 0) + `" · typical"` when `source === 'normal'`. Hidden if fetch fails/offline. Source: `GET /api/trips/{tripId}/weather?date=YYYY-MM-DD` → `{ weather: { code, tMaxC, tMinC, precipProb, source } | null }`; map `code` → emoji/label like `src/lib/weather.ts#weatherCodeInfo`.
  3. **"Up next"** (micro uppercase faint label): next stop = first stop with `scheduledTime > nowHHMM` (trip TZ), else stop 0 (only "today" logic when relevant day is today; otherwise stop 0). Row = category glyph + time (sub) + name; tap → place read card; trailing `↗` opens Google Maps `placeUrl`.
  4. **"Hotel"** row (`🛏` + name) for the first stop whose category ∈ {lodging, hotel, airbnb}; tap → read card.
  5. **"Plan"** (micro uppercase): every stop of the day as a row `[time col w-10 | glyph | name truncate]`, each tap → read card. Empty: **"No stops planned yet"**.

### D. DayStrip (two-line chips)
- Equal-width chips (`min-w 56px`, flex-1), horizontal scroll, hidden scrollbar, gap 6.
- Each chip: line 1 = 3-letter weekday, 10px semibold uppercase tracking 0.08em; line 2 = day-of-month number (no leading zero), 16px bold tabular.
- Active chip: solid `ink` background + `border-ink`; weekday `white/65`, number white. Inactive: `bg` + `border-line`, weekday `faint`, number `ink`.
- Today: 6px round dot in `day-2` amber beside the number (accessible label "Today").
- A11y label: `"Day {n} · {Wed} {May 3}"`. Selecting a day drives the itinerary (and map day filter).

### E. Day header row + density toggle
- Row: `"Day {n}"` (13px bold ink, shrink-0) · day title (flex-1) · density toggle (shrink-0).
- **Day title tap-to-edit**: display = title in `sub`, or placeholder **"Add a title…"** in `faint`; truncates. Tap (disabled when offline/pending) → inline input, autofocus, placeholder "Add a title…", a11y label "Day title". Enter/blur commits (trimmed; empty ⇒ clear/null; no-op if unchanged); Escape cancels. Switching days closes an in-flight edit. Optimistic local update; on failure show save error + refetch.
- **Density toggle**: tiny segmented (surface track, 2px padding) with Rows3 / LayoutGrid icons (13px), labels "Compact rows"/"Large cards"; active = white thumb + `shadow-thumb`, inactive `faint`. Persisted under key `bg.itineraryDensity`; default **rows**.

### F. DayModeControl
- Label **"Default"** (11.5px semibold uppercase `faint`) + segmented **Walk | Drive | Transit** (same recipe as B). Default day mode = `dayModes[date] ?? 'drive'`.
- Right side: **"Recompute"** text button in `accent` — *hidden entirely when offline/disabled*.
- Mode change: optimistic dayModes update → persist mode → recompute day legs with the new mode → refetch.

### G. Stops list (per selected day; ordered by `orderIndex`)
- Pin: 22px circle, day color (`dayColor(dayIndex)` cycling teal/amber/violet/red), white bold `orderIndex + 1`.
- **Rows density**: 54px square thumb (rounded-10) or category-glyph placeholder; name 14px semibold truncate; `"{Category} · {address}"` 11.5px `sub` truncate; meta line (when time or duration set): `scheduledTime` and `"{durationMin} min"` 11.5 `faint` tabular. Action line: **View** (12px semibold `accent`) + **Manage** (12px semibold `sub`, `aria-expanded`). Up/Down chevron buttons in a right column (disabled at ends/offline, 30% opacity). Hairline `border-line` row separator except last.
- **Cards density**: rounded-card hairline card; 140px full-bleed photo/placeholder; name (heading) + category·address + meta; pills **View** (accent outline) / **Manage** (line outline); up/down icon buttons right-aligned.
- **Manage** expands a wrap of pills: **Move to Saved**, **Move**, **Copy** (accent outline) and **Delete** (danger outline). All disabled when offline/pending. Move/Copy open the day picker; Delete is immediate on web (RN keeps its confirm Alert — acceptable mobile affordance).
- Thumbnail precedence: first personal photo (`/api/photos/p/{photoId}/card`) → cached Google photo (`/api/photos/{placeId}/card`) → category glyph (🏞️🛏️🏨🏠✈️🚆🎟️🛍️🅿️🚪🏛️🎉📍).
- Tap on the card body → **edit sheet** (`onTap`); **View** → read card.

### H. LegConnector (between consecutive stops)
- Dotted 2px vertical `line` border at left (aligned under pins); content indented.
- Leg text 11.5px `sub` tabular: `"{glyph} {min} min · {mi} mi"` — glyphs 🚶/🚗/🚆; `min = max(1, round(durationSeconds/60))`; `mi = (distanceMeters/1609.344)` rounded to 1 decimal (e.g. **"🚗 5 min · 3.2 mi"**). Missing leg → **"—"** plus hint: **"no route"** (online) / **"needs connection"** (offline) in `faint`.
- Per-leg mode control: three text tabs **Walk/Drive/Transit**, active = `accent` text + 2px `accent` underline; inactive `faint`. Active mode = arriving stop's `legMode ?? dayMode`. Change → set leg mode on the arriving place → recompute day → refetch. Disabled offline.
- Leg lookup key: `${fromId}|${toId}|${mode}` (a mode switch shows "—" until recompute returns).

### I. Day footer
- `stops > 0`: side-by-side **"Add place"** (solid orange, rounded-12) + **"Add from Saved"** (hairline outline; switches bucket to Saved). Below, centered text button **"Copy day as text"** (12px semibold `sub`) → ExportDaySheet.
- `stops === 0`: EmptyState **"Nothing planned for Day {n} yet"** / **"Add your first stop, or pull one in from Saved."** with "Add place" action (hidden offline); plus centered accent link "Add from Saved" (online only).
- **ExportDaySheet**: title **"Day itinerary"**; readonly multiline text (select-all on focus); buttons Cancel + **Copy** (orange) → clipboard; label flips to **"Copied ✓"** for 2s. Text format (`formatDayItinerary`): header `"Day {n} · YYYY-MM-DD"`, blank line, then `"{i}. {Name} ({Category}) · {HH:MM}"` (time omitted when unset) with address on an indented second line.

### J. TodayHero
- Shown only when bucket=days, view=list, selected day `isToday`, stops>0: a "now/next" banner above the itinerary (next-stop pointer per §C.3 rule). Secondary priority for RN.

### K. Saved bucket
- Top: dashed-outline **"+ New list…"** button (accent text).
- Lists first (collapsed by default), each header = rounded-12 hairline row: `▸/▾` + name + count (faint, tabular) + `⋯` ("List options") menu → **Rename** / **Delete list** with 2-tap confirm (**"Delete list? Places stay"**). Open + empty: **"No places in this list yet."**
- Loose (no `listId`) places after the lists. Saved card: 130px photo/placeholder, glyph+name, category·address, notes (1-line clamp); **"Add to day"** (solid orange) + **Manage** → **"Move to list"** (accent outline) / **Delete** (danger). Tap card → edit sheet.
- ListPickerSheet (pick list / "loose" / new-list entry), ListNameSheet (create/rename; titles "New list"/"Rename list", submit "Create"/"Save").
- Empty bucket: **"No saved spots yet"** / **"Stash places you might want — promote them to a day later."**
- List mutations don't recompute legs (saved bucket has none).

### L. Add place sheet (remounted blank each open)
- Title **"Add place"**. Fields: **Name**; **Address** with Google autocomplete (placeholder **"Search or type an address"**, hint **"Pick a suggestion, or just type an address."**, in-field × "Clear address"); suggestion list (hairline bordered rows of `description`); **Category** select (13 categories, default `other`).
- Picking a suggestion: fills name (if empty), address, category guess, captures `{lat,lng,googlePlaceId}`; typing afterwards invalidates the pick. Autocomplete uses one session-token UUID per search→select cycle passed to both autocomplete and details endpoints.
- Save validation: name OR address required, else **"Please enter a name."**. No coords + typed address → forward-geocode; if geocode returns a place id, fetch details (caches photo) and auto-fill name; final fallback name = address. Then create place (to `dayDate` or Saved), fire-and-forget AI summary generation, recompute day (when dayDate, online), refetch, close. Failure: **"Couldn't save — please try again."**
- Buttons: **Save** (orange) above **Cancel** (outline).

### M. Edit sheet (PlaceDetailSheet)
- Title = place name. Fields: **Name**; **Address** (autocomplete with re-pin: hint **"Search and pick a suggestion to fix this place's map pin."**; coords/googlePlaceId only patched when a suggestion was re-picked; × clear); **Category**; **Time** (native time input + **Clear** button when set); **Cost** (currency code prefix from trip currency, decimal text input, stored as integer minor units) + **"Add as expense"** button (disabled until valid positive cost; creates expense with `placeCategoryToBudget` category, `spentOn = dayDate ?? today`, note = place name, `linkedPlaceId`; success label **"Added to budget ✓"**); **About** (`aiSummary` textarea) with **Regenerate** ("Generating…" while busy); **Notes** textarea; photo gallery with per-photo delete + **"Add photo"** picker (errors: "That image is too large (max 10MB)." / photo-limit max 12 / "Please choose an image file."; offline hint "Connect to add photos"); **Travel guides** (PlaceLinks: list + add URL + remove); full-width **"Open in Google Maps"** (solid accent); **Cancel** / **Save** (orange).
- Save patches name/address/category/scheduledTime/cost/notes/aiSummary (+ coords if re-picked); parent applies optimistic patch then refetches.

### N. Read card (PlaceReadCard, "View")
- Works offline. Header: 48px glyph box (only when no photo) + name (18px bold) + `"{Category} · {address}"` + ✕. Photo 165px rounded-14 when present.
- Sections (micro uppercase `faint` headers): **"About"** (aiSummary, collapsible: >400 chars → 6-line clamp + **Show more/Show less**), **"Notes"** (same collapsible), **"Travel guides"** (hairline rows: 32px thumb via `/api/links/thumb/{linkId}` when `thumbnail` set, title ?? url, external-link icon in accent; opens URL).
- Footer: **"Open in Maps"** (solid accent, flex-1) + **Edit** (outline, 76px). Saved-bucket places only: full-width orange **"Add to day"** → day picker.

### O. Day picker sheet
- Titles: move **"Move to which day?"**, copy **"Copy to which day?"**, promote/saved **"Add to which day?"**. Rows `"Day {n} · {Mon}"` (3-letter weekday); pick → action → close.
- Move recomputes **both** source and target days; copy recomputes target; promote recomputes target; move-to-saved/delete recompute the source day. All followed by full refetch.

## Already in RN seed (works as-is)

- Screen scaffolding: load on focus (`places?detail=full` + restaurants), loading/error states, List/Map segmented, Sheet plumbing (view/add/edit/move), online gate (`useOnline`) — `expo-rn/screens/plan/PlanScreen.tsx`.
- Card list with pins (orderIndex+1, day colors), up/down reorder arrows (adjacent swap ≡ web reorder), View/Manage split, manage pills (Move to Saved/Move/Copy/Delete + native confirm), leg row between stops, "no route"/offline placeholders — `PlanList.tsx`.
- DayModeControl (Walk/Drive/Transit + Recompute, hidden-ish when offline) wired to `setMode`/`recompute` endpoints.
- MoveSheet (move/copy day rows incl. "Saved (no day)"), PlaceViewSheet (collapsible About/Notes >400-char rule, links with thumbs, Open in Google Maps, Edit, Add to day), PlaceFormSheet (add/edit fields, minor-unit cost conversion, photo add/delete with mapped upload errors).
- API client: `api.places.{list,create,update,remove,move,reorder,setMode,recompute}`, `api.photos.{upload,remove}`, photo URL helpers — `expo-rn/lib/api/index.ts`.
- Currency helpers (`minorToInput`/`inputToMinor`/`formatMoney`), day color cycling, leg indexing.

## Gaps to build (numbered)

1. **Chrome restructure — Days/Saved bucket toggle + single-day strip.** Replace the "All / Day n / Saved" chip strip with: List|Map + Days|Saved segmented pair, then DayStrip (days bucket only). Drop the "All days" list view (web has none). Sticky header region with bottom hairline. Data: existing places payload. Edge: bucket switch keeps selected date; "Add from Saved" sets bucket=saved.
2. **Two-line DayStrip chips** per §D (weekday over date number, equal width, active solid ink, `day-2` today dot, a11y label `"Day {n} · {Wed} {May 3}"`). Edge: long trips scroll horizontally; date number without leading zero.
3. **TripOverview panel** per §C. Endpoint: `GET /api/trips/{tripId}/weather?date=` (add `api.plan.weather`); persist collapsed state in AsyncStorage (`burgergo.overview.collapsed`). Port `weatherCodeInfo` + `tripStatus`/`diffDays` + `nextStopIndex`. Edges: `weather: null` (no coords) → hide row; offline → hide; weather refetches when relevant date changes.
4. **Per-day titles tap-to-edit** per §E. Server already returns `dayTitles` from the places GET — add it to `PlacesResponse` type. **Backend gap: no REST route exists** — add `PUT /api/trips/{tripId}/days/{date}/title` `{ title: string|null }` wrapping `setDayTitleAction` (follow `mode/route.ts` pattern). Edges: trim; empty clears; commit only when changed; cancel restores; optimistic + rollback-by-refetch on failure.
5. **Density toggle (rows/cards)** per §E + build the compact-rows place row (54px thumb, hairline separators, chevrons right). Persist `bg.itineraryDensity` in AsyncStorage; default rows. Show meta `durationMin` (add field to RN `Place` type; server returns it).
6. **Leg formatting in miles + per-leg mode control** per §H. Replace `formatDistance` km with `"{glyph} {min} min · {mi} mi"`; placeholder `"—"` + "no route"/"needs connection"; dotted connector. Per-leg control needs `legMode` on the RN `Place` type (server returns it) and **a new REST route**: `PUT /api/trips/{tripId}/places/{placeId}/leg-mode` `{ mode }` wrapping `setLegModeAction`, then recompute+refetch. Edge: leg lookup keyed by mode — after switching, show "—" until recompute lands.
7. **Recompute orchestration after every itinerary mutation.** Web recomputes the affected day(s) (move = source+target) after add/move/copy/delete/reorder, then refetches; RN currently skips recompute on move/copy/delete/add. Use existing `POST .../days/{date}/recompute`. Edge: skip recompute when offline or target is Saved.
8. **Day footer parity**: "Add place" (orange) + "Add from Saved" side-by-side after the stops; "Copy day as text" → export sheet with `formatDayItinerary` text, readonly selectable text, Copy via `expo-clipboard`, "Copied ✓" 2s. Empty-day EmptyState with web copy (§I).
9. **Saved bucket with lists** per §K (collapsible lists, loose places, Add to day / Move to list / Delete, list create/rename/delete with 2-tap confirm). **Backend gap: no REST routes** — add: `POST /api/trips/{tripId}/lists` `{name}`, `PATCH /api/trips/{tripId}/lists/{listId}` `{name}`, `DELETE .../lists/{listId}` (wrap `addSavedListAction`/`renameSavedListAction`/`deleteSavedListAction`), and `PUT /api/trips/{tripId}/places/{placeId}/list` `{ listId: string|null }` (wrap `setPlaceListAction`). Add `listId` to RN `Place` type; `lists` already in the payload. Edge: create-list-then-move flow (new list from picker moves the place into it).
10. **Google Places autocomplete in add/edit forms** per §L/§M: debounce-as-you-type via `GET /api/google/autocomplete?input=&sessionToken=`; pick → `GET /api/google/details?placeId=&sessionToken=` (fills name/address/coords/categoryGuess, caches photo server-side); typed-address fallback `GET /api/google/geocode?address=`; session token = one UUID per search→select; × clear button; edit-mode re-pin (coords patched only on re-pick). Edge: prod Google key is IP-restricted — endpoints fail from localhost; degrade to plain text input.
11. **AI summary**: fire summary generation after add; **Regenerate** button in edit sheet ("Generating…"). **Backend gap** — add `POST /api/trips/{tripId}/places/{placeId}/summary` wrapping `generatePlaceSummaryAction` (returns `{ place }` with `aiSummary`). Edge: fire-and-forget on add (never block), refetch picks it up.
12. **Edit-sheet field parity**: proper time picker emitting `HH:MM` + Clear button; **"Add as expense"** (uses existing `POST /api/trips/{tripId}/expenses`; category map: lodging/hotel/airbnb→lodging, airport/transport/parking→transport, activity/event/sightseeing/museum/entrance→activities, shopping→shopping, else other; `spentOn = dayDate ?? today`; "Added to budget ✓"). Label changes: AI field label **"About"** (not "Travel guide"), links section **"Travel guides"** (not "Further reading").
13. **Mutation error banner + in-flight guard**: transient "Action failed — please try again." banner; disable action buttons while a mutation is pending (prevents double-fire); always refetch in `finally`.
14. **TodayHero** (lower priority): now/next banner when the selected day is today and has stops.
15. **Day picker label format**: rows `"Day {n} · {Mon}"`; sheet titles per mode (§O). Category labels rendered capitalized ("Sightseeing"), not raw enum values.

**Formatting rules (apply everywhere):** distances in miles (1609.344 m/mi, 1 decimal); durations `max(1, round(s/60))` min; money = integer minor units, displayed via currency helpers with trip `currency` from the places payload; times `HH:MM` 24h; dates `YYYY-MM-DD` wire / `"Sat, Sep 5"`–`"May 3"` display (en-US, UTC-stable); stops sorted by `orderIndex` asc; place links newest-first (server-ordered); lists in server display order; pin label = `orderIndex + 1`.

## Atlas Light styling notes for this section

RN seed still uses warm-editorial `colors.{coral,paper,card,teal}` with card shadows — replace `expo-rn/lib/theme.ts` with Atlas Light tokens (from `tailwind.config.ts`):

| Token | Value | Use here |
|---|---|---|
| `bg` | `#FFFFFF` | screen + card + sheet background (cards are NOT a different color) |
| `surface` | `#F4F5F2` | segmented track, density track, glyph boxes, disabled-button fill |
| `ink` | `#1B1F1C` | primary text, active DayStrip chip fill |
| `sub` | `#6E746E` | secondary text (category·address, meta, Manage) |
| `faint` | `#A8ADA7` | tertiary text, placeholders, chevrons, inactive leg tabs |
| `line` | `#E9EBE6` | ALL borders/dividers — 1px hairlines everywhere (`StyleSheet.hairlineWidth` ok) |
| `accent` / `accent-tint` | `#33677A` / `#E6EFF1` | info/nav ONLY: View, Recompute, leg-tab active, links, Open-in-Maps, autocomplete focus |
| `orange` / `orange-press` | `#E0502C` / `#C84624` | create/save ONLY: Add place, Save, Add to day, Copy (export) |
| `danger` | `#B3402C` | Delete pills, error text |
| `day-1..4` | `#33677A #C99231 #7A5FA0 #B3402C` | pin circles, today dot (`day-2`) |

- **No drop shadows on cards/rows** — hairline `line` borders replace them (kill the RN seed's card `shadowOpacity`/`elevation`). The only allowed shadows: segmented-control active thumb (`0 1px 2px rgba(27,31,28,0.10)` + subtle ring) and bottom sheets (`0 -12px 40px rgba(27,31,28,0.25)`); floating read-card overlay may use `lift` (`0 1px 4px rgba(27,31,28,0.12)`).
- Radii: card 14, control/input 10, sheet top 22, chips/pins 999, big CTA buttons 12.
- Segmented recipe: track `surface` rounded-10 p-3px; active = white `bg` + `ink` + thumb shadow; inactive `sub` (no fill).
- Buttons: solid orange = create/save; solid accent = open-in-maps; everything else outline `line` on white or text-only accent/sub. Disabled = `surface` fill + `faint` text (solid) or 40% opacity (outline).
- Type scale: title 18–19 bold (−0.01em), heading 15/600, body 13.5, label 13/600, caption 12, micro 10.5 uppercase +0.1em (section headers like "About"); tabular numerals for times/distances/counts.
- Sheets: white, rounded-top 22, drag handle = 40×4 `line` pill centered, padding 18, scrim ~rgba ink 0.4.
- Icons: lucide (`lucide-react-native`): ChevronUp/Down, Rows3, LayoutGrid, MoreHorizontal, ExternalLink, X; leg/category glyphs stay emoji.

## API surface (everything plan-list needs)

Reads (public GET; writes require `x-api-key` when `BURGERGO_API_KEY` set — existing `client.ts` behavior):

| # | Method + path | Body / params | Notes |
|---|---|---|---|
| 1 | `GET /api/trips/{tripId}/places?detail=full` | — | `{ places, legs, dayModes, dayTitles, lists, currency }`; full incl. `aiSummary` + polylines (RN: keep `full`; web splits light→`?detail=heavy`) |
| 2 | `GET /api/trips/{tripId}/restaurants` | — | map overlay only; non-critical |
| 3 | `GET /api/trips/{tripId}/weather?date=YYYY-MM-DD` | — | `{ weather: {code,tMaxC,tMinC,precipProb,source} \| null }` |
| 4 | `POST /api/trips/{tripId}/places` | `{ name, address?, category?, dayDate?, lat?, lng?, googlePlaceId?, scheduledTime?, durationMin?, cost?, notes?, list? }` | server geocodes address when no coords |
| 5 | `PATCH /api/trips/{tripId}/places/{placeId}` | `{ name?, address?, category?, scheduledTime?, durationMin?, cost?, notes?, aiSummary?, lat?, lng?, googlePlaceId? }` | coords patch invalidates touching legs |
| 6 | `DELETE /api/trips/{tripId}/places/{placeId}` | — | then recompute source day |
| 7 | `POST /api/trips/{tripId}/places/{placeId}/move` | `{ dayDate: string\|null, copy?: boolean }` | null = to Saved; copy needs dayDate; recompute affected day(s) after |
| 8 | `POST /api/trips/{tripId}/days/{date}/reorder` | `{ orderedIds: string[] }` | full ordered id list |
| 9 | `PUT /api/trips/{tripId}/days/{date}/mode` | `{ mode: 'walk'\|'drive'\|'transit' }` | then recompute |
| 10 | `POST /api/trips/{tripId}/days/{date}/recompute` | `{ mode }` | Recompute button + post-mutation |
| 11 | `POST /api/photos` (multipart) | `tripId, ownerType:'place', ownerId, file` | errors: `too_large`/`too_many`/`invalid_image` |
| 12 | `DELETE /api/photos/p/{photoId}` | — | photo delete |
| 13 | `POST /api/trips/{tripId}/expenses` | `{ amount(minor int>0), category, spentOn, note?, linkedPlaceId? }` | "Add as expense" |
| 14 | `GET /api/google/autocomplete?input=&sessionToken=` | — | `{ predictions: [{placeId, description}] }` |
| 15 | `GET /api/google/details?placeId=&sessionToken=` | — | `{ googlePlaceId, name, address, lat, lng, categoryGuess, ... }`; also caches the place photo |
| 16 | `GET /api/google/geocode?address=` | — | `{ lat, lng, address, googlePlaceId }` fallback geocode |
| 17 | Image GETs | `/api/photos/p/{photoId}/{thumb\|card\|full}`, `/api/photos/{placeId}/card`, `/api/links/thumb/{linkId}` | thumbnail precedence §G |
| 18 | **NEW** `PUT /api/trips/{tripId}/days/{date}/title` | `{ title: string\|null }` | wrap `setDayTitleAction` (no route today) |
| 19 | **NEW** `PUT /api/trips/{tripId}/places/{placeId}/leg-mode` | `{ mode }` | wrap `setLegModeAction` (no route today) |
| 20 | **NEW** `PUT /api/trips/{tripId}/places/{placeId}/list` | `{ listId: string\|null }` | wrap `setPlaceListAction` (no route today) |
| 21 | **NEW** `POST /api/trips/{tripId}/lists` / `PATCH .../lists/{listId}` / `DELETE .../lists/{listId}` | `{ name }` | wrap saved-list actions (no routes today) |
| 22 | **NEW** `POST /api/trips/{tripId}/places/{placeId}/summary` | — | wrap `generatePlaceSummaryAction`; returns `{ place }` |

New routes (18–22) should copy the existing wrapper pattern: `isWriteAuthorized` guard → trip/place ownership check → zod body → call the server action → JSON/error mapping (`app/api/trips/[tripId]/places/[placeId]/route.ts` is the template).