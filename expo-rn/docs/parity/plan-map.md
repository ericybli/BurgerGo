# plan-map parity spec

Trip map inside Plan (web: `components/plan/PlanMap.tsx` + `components/map/GoogleMapCanvas.tsx`, hosted by `PlanClient`; RN: `expo-rn/screens/plan/PlanMap.native.tsx`). Functionality must match the web exactly; visuals follow Atlas Light.

## Web feature inventory (exhaustive, by UI region)

### A. Day legend (above the map, days bucket only)
- Horizontal scroll row of chips, hidden scrollbar. Hidden entirely in the saved bucket or when no dated groups exist.
- First chip: **"All days"** — pressed (`aria-pressed`) iff every day visible. Tap → `onShowAllDays` (make all days visible).
- One chip per dated day group: 7px color dot + **"Day {n}"** (`dayNumber`). Tap → `onShowOnlyDate(date)` (show ONLY that day). Active style: ink bg + white text, dot turns white; inactive: bg + hairline `line` border + `sub` text, dot in the day color.
- Day colors cycle by `colorIndex % 4`: `#33677A` teal (day-1), `#C99231` amber (day-2), `#7A5FA0` violet (day-3), `#B3402C` red (day-4). Invalid/negative index → teal.

### B. Map canvas + pins
- Map created once; overlay redraws never re-create the map (no flash). All native Google chrome disabled (`disableDefaultUI`); `clickableIcons` starts false.
- **Pin DOM (shared spec, `src/lib/map/markerEl.ts`)** — anchor is the exact coordinate; disc centered on it:
  - White disc, **2px ring in the day color**, circular; **34px** for day stops, **28px** for un-numbered pins (Saved/layers). Glyph = category emoji (`planUrl.categoryGlyph`: 🏞️ 🛏️ 🏨 🏠 ✈️ 🚆 🎟️ 🛍️ 🅿️ 🚪 🏛️ 🎉 📍), 15px, tinted? — glyph is emoji; ring + badge carry the color. Soft shadow `0 2px 6px rgba(27,31,28,0.18)`.
  - Day stops only: **stop-number badge** top-right (−6px offsets): day-color disc, white 9.5px bold number, 1.5px white ring, min-width 16px. Number = `orderIndex + 1` (consistent with the list even when coord-less stops exist — do NOT renumber after dropping unmapped places).
  - Day stops with `scheduledTime`: **time pill below the disc** — white bg, 1px `#E9EBE6` hairline border, ink `#1B1F1C` 10px bold tabular digits, radius 6, "HH:MM" 24h, shadow `0 1px 3px rgba(27,31,28,0.12)`.
  - Saved-bucket / saved-layer pins: teal `#33677A` ring, no badge, no time pill. Restaurants layer: amber `#C99231` ring, glyph 🍽️, no badge/pill.
- Pin tap → place read card (`onViewPlace(placeId)`); restaurant-layer pins route to `onViewRestaurant(id)` instead (ids disambiguated by membership in the restaurant layer set).
- Places without coords are dropped from markers (they still count for numbering, see above). Day stops sorted by `orderIndex` asc.

### C. Route polylines (days bucket only)
- One path **per leg** (consecutive plottable pair per visible day), built like `buildDayLegPaths`: sort by `orderIndex`, drop coord-less, match cached leg by `fromId|toId|mode` where mode = destination's `legMode ?? dayDefaultMode` (`dayModes[date] ?? 'drive'`). Leg polyline (Google encoded, e5) decoded; missing/uncomputed leg → straight 2-point fallback line.
- **Drive/transit: solid** 3px line, day color, opacity 0.9. **Walk: dotted** — repeated small round dots in the day color (web: strokeOpacity 0 + circle symbols every 10px; RN: `lineDashPattern` ≈ `[1, 8]` with round cap).
- Each leg segment is tappable via a wide (16px) invisible hit line → opens the **leg chip**.

### D. Leg chip (tapped segment)
- Floating card bottom-center (above bottom controls): hairline `line` border, bg/95 blur, two lines:
  - line 1 (`caption`/`sub`, truncated): `{fromName} → {toName}`
  - line 2 (`label`, ink, tabular): `formatLeg` → `"🚶 12 min · 0.6 mi"` (mode glyph 🚶/🚗/🚆, minutes = `max(1, round(durationSeconds/60))`, **miles only** = `distanceMeters/1609.344` rounded to 1 decimal). Uncomputed leg (`leg === null`) → `"—"`.
- ✕ close button (30px circle, `surface` bg, `sub` text). Chip auto-clears whenever visibleDates / bucket / mode changes.

### E. Custom map controls (all float over the map; no native controls)
- **Layers** (top-left, days bucket only): pill button, layers icon + "Layers", `aria-expanded`. Opens a small menu card (w-44, bg/95, blur) with two checkbox rows: **"Saved places"** (teal pins overlay) and **"Restaurants"** (amber 🍽️ pins overlay), both default OFF. Toggling layers must NOT move the viewport.
- **Fullscreen** (top-right): 40px round icon button, Maximize/Minimize lucide icon. Fullscreen = map fills the window (safe-area padded), Escape/back closes; map instance is preserved (resize, keep center — no remount, no refit).
- **Satellite toggle** (bottom-left, above attribution): pill labeled **"Satellite"** when in roadmap, **"Map"** when in hybrid; toggles roadmap ↔ hybrid (satellite + labels).
- **Locate** (bottom-right): 40px round button, LocateFixed icon; disabled (faint) while a fix is in flight. On success: blue dot marker (Google-blue `#4285F4`, white 2.5px ring) dropped/updated (never cleared by overlay redraws), pan to it, zoom raised to 14 if currently lower. Permission denied → silently re-enable.
- **POI toggle** (right side, above Locate): 40px round button, Landmark icon, `aria-pressed`. **Default OFF.** OFF = bg/ink; ON = `accent` bg + white icon. ON makes Google basemap landmarks tappable; a landmark tap suppresses Google's own info window and opens the app's POI card. Only rendered when POI taps are supported.

### F. POI info card (tapped basemap landmark)
- Modal/overlay card: max-w-sm, max-h 70vh, scrollable, hairline border, bg. Backdrop tap closes. Keyed by place id (resets pager/hours state per POI).
- States: loading → **"Loading place…"** (sub); error → **"Couldn't load this place. Try again."** (danger).
- Loaded contents, in order (each section hidden when empty):
  1. **Photo pager**: 165px-tall cover image, rounded 14; if >1 photo, ChevronLeft/Right round buttons (32px, bg/90 blur) with wraparound, plus **"n/m"** counter pill bottom-right (ink/70 bg, white 10.5px bold tabular).
  2. Header row: name (15px semibold ink; fallback address, then "Map landmark"), then rating line: **gold/amber star** (filled, day-2 color) + bold rating to 1 decimal + `· {count} review(s)` (singular/plural), then address (caption sub). ✕ close button top-right.
  3. **Editorial summary** paragraph (13px ink) when present.
  4. **Open-now + hours**: status text **"Open now"** (success green) / **"Closed"** (danger red) — or neutral "Hours" if openNow unknown; ▾/▴ disclosure expands the weekday hour lines (caption, sub, tabular), one `<li>` per weekday string from Google. Disclosure disabled when hours list empty.
  5. **Reviews**: "REVIEWS" micro uppercase faint header; each review = author (semibold ink) + small gold star + rating + `· relative time`, then text clamped to 4 lines (12.5px sub); hairline divider between reviews.
  6. **Action buttons**: if `isFood` → single full-width **orange** button **"Save restaurant"** (saves to Eats as want-to-try); else two side-by-side: **orange "Add to day"** (opens the day picker, then adds the place to that date) + outline **"Save place"** (adds to Saved bucket). While saving → "Adding…"; after success the buttons stay disabled and show **"Added to day ✓" / "Saved ✓" / "Saved to Eats ✓"**. All disabled when offline.
  7. **"Open in Google Maps"** — full-width `accent` (teal) solid button when coords exist; `placeUrl` deep link (prefers `query` + `query_place_id`).
- After a successful place add the web fires (fire-and-forget) the AI summary action + `GET /api/google/details?placeId=` (caches the place photo), and recomputes day legs when added to a day while online.

### G. Open day route deep links (below the map, days bucket only)
- One link per **visible** day having ≥1 plottable stop. 1 visible day → the link rendered directly; >1 → a collapsible row **"Open day routes in Google Maps"** (▸/▾), collapsed by default, expanding to one link per day. Each link: centered, hairline border, `accent` text **"Open day route in Google Maps"** with a 8px day-color dot.
- URL = `dayRouteUrl(stops, mode)` (`src/lib/googleMapsUrl.ts`): `https://www.google.com/maps/dir/?api=1` + `origin`/`destination`/`waypoints` (pipe-separated) + `travelmode` mapped walk→`walking`, drive→`driving`, transit→`transit`. Stops with a `googlePlaceId` are sent as **name text + `origin_place_id`/`destination_place_id`**; `waypoint_place_ids` only when EVERY intermediate stop has an id (1:1 rule), otherwise intermediates fall back to `lat,lng`. Stops sorted by `orderIndex`; coord-less dropped. Constructible offline.

### H. Viewport rules
- Fit bounds to **base pins only** (visible day stops, or saved-bucket pins) — overlay layers never affect fit.
- Re-fit ONLY when the base set's positions actually change (compare a `lat,lng|...` key). Opening cards, toggling layers, data refetches that move no pin, container resizes, fullscreen — all preserve the user's center/zoom.
- Clustering: Google provider does NOT cluster (Mapbox-only feature) → RN does not cluster.

### I. Offline branch
- Replaces the whole map: mascot empty state, headline **"Map needs a connection"**, subtext **"Tap any place to open Google Maps."**, followed by a list of every visible plottable place as a tappable row (name + teal ↗) deep-linking via `placeUrl` (works offline from cached coords).

### J. Restaurant pin info card
- Tap on a Restaurants-layer pin: card with 40px glyph square (🍽️) or photo (first personal photo → cached Google photo, 44-high cover, rounded 10), name (14px semibold), cuisine (caption sub), address (caption ink), notes (caption sub, pre-wrap), ✕ close, and a full-width `accent` **"Open in Google Maps"** button.

### K. Saved bucket
- Flat teal un-numbered pins for saved places (sorted by `orderIndex`); no legend, no polylines, no layers button, no route links. Pin tap → place read card.

## Already in RN seed (works as-is)

- Map/List segmented control + day strip (All / Day N / Saved) in `PlanScreen.tsx`; map receives only the selected day(s) — equivalent to web `visibleDates` for the fit set.
- `react-native-maps` MapView with polylines from cached legs (decode + straight-line fallback), per-day colored.
- Layers button + menu with "Saved places" / "Restaurants" toggles (default OFF).
- Satellite (standard↔hybrid) toggle, fullscreen Modal, locate-recenter via `showsUserLocation`.
- Saved-bucket teal pins; pin tap → `onViewPlace` read sheet; restaurants overlay markers.
- `lib/legView.ts`: `decodePolyline`, `regionForCoords`, `indexLegs`, `DEFAULT_DAY_MODE`, photo precedence helper.
- `lib/api`: `getJson`/`writeJson` with `x-api-key`, `places.list(?detail=full)`, `places.add/update/remove/move`, `places.recompute`, `restaurants.list/add`.

## Gaps to build (numbered)

1. **Atlas pin DOM** — Replace filled-color discs with: white disc + 2px day-color ring + category emoji, 34px (day) / 28px (saved/layer); stop-number badge (day-color disc, white number = `orderIndex + 1`, white 1.5px ring, top-right); time pill below (white, hairline `#E9EBE6` border, ink tabular 10px bold) — current RN pill is ink-bg/white-text (wrong). Use `Marker` with custom child + `anchor={{x:0.5,y:0.5}}`, `tracksViewChanges={false}` after first render. Data: `places` from GET places. Edge: number from `orderIndex+1`, not array index after filtering.
2. **Day color palette** — Replace the 10-color legacy palette in `lib/legView.ts` with the Atlas 4-cycle `['#33677A','#C99231','#7A5FA0','#B3402C']`; index = day group `dayNumber-1` (or colorIndex) mod 4. Saved = `#33677A`; restaurants = `#C99231` (current `#C9842E` is wrong).
3. **Leg-aware polylines (mode keyed) + walk dotted** — Key leg lookup by `from|to|mode` where mode = `to.legMode ?? (dayModes[date] ?? 'drive')` (RN currently ignores mode); build per-leg segments carrying `{fromName,toName,mode,leg}`. Walk → dotted (`lineDashPattern:[1,8]`, round cap), drive/transit solid; width 3. Data: `legs` + `dayModes` already in GET places response. Edge: missing leg → straight line, still tappable, chip shows "—".
4. **Per-leg tap chip** — `Polyline` `tappable` + `onPress` (add a second invisible wide line, strokeWidth 16, near-zero alpha, for hit area). Chip: bottom-center floating card, `{fromName} → {toName}` + `"🚶 12 min · 0.6 mi"` (glyph by mode; minutes ≥1; **miles, 1 decimal** — replace RN `formatDistance` km logic for this chip), ✕ close. Clear on day-selection/bucket/mode change. Edge: `leg=null` → "—".
5. **Tappable map legend** — Add "All days" chip + make Day N chips tappable, driving the day filter (tap day = show only that day, i.e. `setSelected(date)`; All = show all). Active = ink bg/white text + white dot; inactive = hairline border + day-color dot. Show whenever ≥1 dated group (web shows even for 1 day; drop the `length<=1` early-return). Reuse the existing PlanScreen `selected` state so list/map stay in sync.
6. **Open day route links** — Below the map (days bucket): port `dayRouteUrl` + `placeUrl` from `src/lib/googleMapsUrl.ts` verbatim (place_ids + names, waypoint 1:1 rule, travelmode map) into `expo-rn/lib`; render single direct link or collapsible "Open day routes in Google Maps" list (collapsed default), day-color dot per link; open with `Linking.openURL`. Edge: skip days with 0 plottable stops; current RN `placeMapsUrl` lacks `query_place_id` — replace it.
7. **POI toggle + POI flow** — Landmark icon button above Locate, default OFF (OFF: bg/ink; ON: accent bg/white). When ON, handle `MapView.onPoiClick` (`e.nativeEvent.placeId`) → fetch `GET /api/google/poi?placeId=` → POI card. Edge: `onPoiClick` is Google-provider only — render the toggle only when the map provider supports it (Android Expo Go OK; iOS needs `PROVIDER_GOOGLE` in a dev build; hide on Apple Maps). When OFF, ignore POI taps entirely.
8. **POI info card** — Full port of section F: photo pager with n/m pill (photos via `GET /api/google/poi-photo?ref&w=800`), gold star rating + review count, address, summary, Open now/Closed + expandable weekday hours, reviews (4-line clamp), buttons: `isFood` → "Save restaurant" (orange) else "Add to day" (orange, opens existing MoveSheet-style day picker) + "Save place" (outline); "Open in Google Maps" accent button. Saving/added/disabled states per F.6 with exact labels ("Adding…", "Saved ✓", "Added to day ✓", "Saved to Eats ✓"). Edge: name fallback address → "Map landmark"; disable saves when offline; key card state by googlePlaceId.
9. **POI saves** — Save place / Add to day: `POST /api/trips/{tripId}/places` `{name, address, lat, lng, googlePlaceId, category: categoryGuess if valid else 'other', dayDate: date|null}`; then fire-and-forget `GET /api/google/details?placeId=` (caches photo) and, when added to a day while online, `POST /api/trips/{tripId}/days/{date}/recompute {mode: dayModes[date] ?? 'drive'}`; then reload places. Save restaurant: `POST /api/trips/{tripId}/restaurants` `{name, address, status:'want-to-try'}` — **caveat:** REST schema does NOT accept lat/lng/googlePlaceId (server geocodes the address); pass the POI address and accept the geocode, or extend the route schema (preferred backend tweak for exact parity with `addRestaurantAction`). No REST endpoint exists for AI summary generation — skip it (accepted gap).
10. **Restaurant pin card + richer layer data** — Extend `MapRestaurant` to carry `googlePlaceId, address, notes, photoPath, photos` (all in GET restaurants response; stop pre-filtering fields in PlanScreen) and route restaurant-pin taps to a RestaurantInfoCard port (section J) instead of the default callout. Edge: drop restaurants with null coords from the layer.
11. **Viewport discipline** — Fit via `fitToCoordinates(base, {edgePadding})` only when the base-pin position key changes (track last key in a ref); never on layer toggles/card opens. Fullscreen must not remount the MapView (render one map; animate its container/use absolute-fill style swap rather than duplicating `content` inside a Modal — the current Modal remounts and loses the viewport). Locate: pan + raise zoom to ≥14 equivalent (delta ≈0.02), button disabled while locating; request permission via `expo-location` before relying on `showsUserLocation`.
12. **Offline branch** — When offline (reuse `lib/online.ts`): mascot EmptyState "Map needs a connection" / "Tap any place to open Google Maps." + list of visible plottable places as `placeUrl` deep-link rows (name + teal ↗). Keep "Nothing to map here" only for the online-but-empty case.
13. **Fullscreen control styling** — Replace "Done" coral pill with a 40px round icon button (maximize-2/minimize-2 glyph), top-right; Android back closes.

## Atlas Light styling notes for this section

- Tokens (web class → RN theme intent): `bg` #FFFFFF surfaces/cards; `surface` = pressed/secondary fill (close buttons, disabled buttons); `ink` #1B1F1C primary text + active chips (ink bg/white text); `sub` secondary text; `faint` disabled/tertiary; `line` #E9EBE6 hairline borders (1px, every card/menu/chip outline); `accent` teal #33677A = info/navigation actions ("Open in Google Maps" solid, layer checkboxes, route-link text, POI toggle ON); `orange` = create/save ONLY ("Save restaurant", "Add to day"); `success`/`danger` for Open now/Closed; day-1..4 = the 4 pin/route colors; gold star uses day-2 amber fill.
- **No card shadows** — hairline `line` borders everywhere (POI card, leg chip, legend chips, route links, layers menu). Exception: floating map controls keep the web's `shadow-lift` + bg/95 translucency (they sit over imagery; in RN use subtle elevation 2–3 / shadowOpacity ≈0.12), and the pin disc/time-pill micro-shadows from markerEl are part of the pin spec.
- Radii: cards ~16 (`rounded-card`), controls/buttons ~10–12 (`rounded-control`), chips/round buttons fully round (`rounded-chip`). Buttons 40×40 for icon controls; chips px-3 py-1.5, caption (≈12px) semibold.
- Type: Instrument Sans equivalents; tabular numerals for times/ratings/counts/leg figures; micro uppercase faint for "REVIEWS".
- Current RN warm-editorial leftovers to delete: `colors.coral` button, `colors.card` cream fills, filled-color pin discs, ink time pill, 10-color palette.

## API surface

All writes send `x-api-key` header (when configured) + `Content-Type: application/json`. Base: `https://eric.month2month.com/burgergo`.

| # | Method + path | Body / params | Used for |
|---|---|---|---|
| 1 | GET `/api/trips/{tripId}/places?detail=full` | — | places (coords, category, orderIndex, scheduledTime HH:MM, legMode, googlePlaceId, photoPath, photos), legs (durationSeconds, distanceMeters, mode, polyline), `dayModes`, `dayTitles`, `lists`, `currency`. (`?detail=heavy` optional perf path: just aiSummary+polyline.) |
| 2 | GET `/api/trips/{tripId}/restaurants` | — | Restaurants layer + restaurant card: id, name, lat/lng, googlePlaceId, cuisine, address, notes, photoPath, photos[] |
| 3 | GET `/api/google/poi?placeId={googlePlaceId}` | — | POI card details: name, address, lat/lng, categoryGuess, rating, ratingCount, openNow, hours[], summary, photoRefs[], reviews[{author,rating,time,text}], isFood. 400 missing id, 502 unavailable |
| 4 | GET `/api/google/poi-photo?ref={photoRef}&w=800` | w clamped 200–1600 | POI gallery image bytes (cacheable, immutable) |
| 5 | GET `/api/google/details?placeId={googlePlaceId}` | — | Fire-and-forget after POI place save (caches Google photo → place thumbnail) |
| 6 | POST `/api/trips/{tripId}/places` | `{name, address?, lat?, lng?, googlePlaceId?, category?, dayDate? (YYYY-MM-DD or null), scheduledTime?, durationMin?, cost?}` → 201 `{place}` | POI "Save place" (dayDate null) / "Add to day" (dayDate set) |
| 7 | POST `/api/trips/{tripId}/restaurants` | `{name, address?, cuisine?, status:'want-to-try', notes?, rating?, priceLevel?}` → 201 `{restaurant}` (server geocodes address; **no lat/lng/googlePlaceId fields** — see Gap 9) | POI "Save restaurant" |
| 8 | POST `/api/trips/{tripId}/days/{date}/recompute` | `{mode:'walk'\|'drive'\|'transit'}` → `{legs}` | Refresh legs after add-to-day (prod-only Google key; tolerate 4xx/5xx silently) |
| 9 | GET `/api/photos/p/{photoId}/{size}` (`thumb|card|full`), GET `/api/photos/r/{restaurantId}/{variant}`, GET `/api/photos/{placeId}/{variant}` | — | Restaurant/place card photos (precedence: first personal photo → cached Google photo → glyph) |

Formatting rules: distances **miles only** (`m/1609.344`, 1 decimal); durations whole minutes, min 1; times `HH:MM` 24h; dates `YYYY-MM-DD` keys, day chips labeled "Day {n}"; money everywhere integer minor units (not used on this surface beyond place `cost` passthrough); stops sorted by `orderIndex` asc, pin numbers `orderIndex+1`; review/rating numbers tabular, rating `toFixed(1)`.