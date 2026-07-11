# expo-rn Plan list view redesign — Implementation Plan

> Subagent-driven. Steps `- [ ]`. Visual-only: NO data/API/handler changes. Gates per task: `cd expo-rn && npm run typecheck` (NEVER bare tsc) + `npx expo export --platform ios`. Branch: `feature/rn-plan-list` off master.

**Goal:** Turn the Plan → Days itinerary into a day **timeline** (day-colored rail + numbered nodes + photo-led place cards with category glyph + time chip; travel legs as pills on the rail) and polish the Saved cards, per the approved concept `expo-rn/docs/handoff/plan/plan-concept.png`. Also **change the default itinerary density from `'rows'` to `'cards'`** (user request).

## Locked decisions
- **Timeline is owned by DayItinerary** (rail + numbered nodes + leg pills). PlaceCard gets a `timeline` prop; in timeline mode it renders the card only (NO internal pin — the node is drawn by DayItinerary on the rail). Applies to BOTH densities (rail/nodes are density-independent; only the card look differs).
- **Default density → `'cards'`** (`useState<PlaceDensity>('cards')` in DayItinerary; AsyncStorage `bg.itineraryDensity` still overrides once set).
- Photo-less hero → reuse the existing `PhotoPlaceholder` (category-tinted glyph). Photos via `thumbForPlace(place,'full')` (cards) — tokenless `<Image>`.
- Category glyph via `glyph(category)` (theme). Category label via `categoryLabel` (planShared). Day color via the `dayColor` PlanScreen already passes to DayItinerary/PlaceCard.
- Keep every handler/prop: reorder, View/Manage, move/copy/delete, leg-mode change, day-mode, add place/from saved, saved list ops. NO functional change.

---

### Task A: LegConnector → leg pill on the rail
**File:** `screens/plan/LegConnector.tsx`
- [ ] Restyle the leg row to sit indented on the timeline (the rail + a small hollow node are drawn by DayItinerary, so LegConnector renders inside the same left-padded lane). Replace the current dotted-rail + plain text with: a **pill** (`surface` bg, hairline border, radius 999) = mode glyph (`walk→🚶 drive→🚗 transit→🚆` — reuse the MODE glyph already embedded in `formatLeg`, or a small leading emoji) + `formatLeg(leg)` text ("42 min · 38 mi") or `—`/hint when no leg; then the Walk/Drive/Transit underline tabs pushed to the right (keep exactly as now). Keep `onModeChange`, `leg`, `mode`, `disabled`, `online` props + behavior. Drop the component's own `rail` (DayItinerary owns it).
- [ ] Gate + commit `feat(expo-rn): leg connector as a pill on the itinerary rail`.

### Task B: PlaceCard — photo-hero card + timeline mode + default note
**File:** `screens/plan/PlaceCard.tsx`
- [ ] Add prop `timeline?: boolean`. When `timeline`, do NOT render the internal pin/pinCol (DayItinerary draws the node). Keep `pinNumber`/`pinColor` props (harmless if unused in timeline).
- [ ] **`cards` density** (the new default) → the concept card: `borderRadius:16`, hairline border, soft shadow, `overflow:hidden`:
  - Photo hero ~118px: `thumbForPlace(place,'full')` `<Image cover>` OR `<PhotoPlaceholder category={place.category} height={118}>` when no photo. Overlay: **category glyph chip** top-left (34px white rounded chip, `glyph(place.category)`), and a **time chip** top-right (white pill with `place.scheduledTime`) only when scheduledTime set.
  - Body: `name` (15.5 bold), meta row: `durationMin` → "2h 30m"/"45 min" in `accent` when set, `·`, `categoryLabel(category)` in `sub`. (Add a small `formatDuration(min)` helper: ≥60 → "Xh Ym"/"Xh", else "N min".)
  - Actions: keep `View` / `Manage` (Manage toggles the existing manage pills: Move to Saved / Move / Copy / Delete two-tap) + the up/down chevrons — lay them in a footer row (View/Manage links left, chevrons right). Preserve all handlers.
- [ ] **`rows` density** → keep the compact inline row largely as-is (54px thumb + name/sub/meta + View/Manage + chevrons), but in timeline mode drop the internal pin column (node external) and keep the hairline separators. Light touch.
- [ ] Gate + commit `feat(expo-rn): photo-hero itinerary place card (glyph + time chip), timeline-aware`.

### Task C: DayItinerary — timeline layout + default density
**File:** `screens/plan/DayItinerary.tsx` (depends on Task B's `timeline` prop)
- [ ] Change default density: `useState<PlaceDensity>('cards')`.
- [ ] Wrap the stops+legs map in a **timeline container** (`position:'relative'`, `paddingLeft:38`):
  - An absolute **rail**: `left:15, top:~10, bottom:~26, width:2, backgroundColor: dayColor` at ~0.5 opacity (spans first→last node).
  - Per stop: an absolute **node** on the rail (`left:5, 22px circle, backgroundColor: dayColor, white ${pinNumber}, 3px white ring, zIndex:2`) aligned to the card's top; the `<PlaceCard timeline ... />` renders in normal flow (full width of the padded lane).
  - Per leg (between stops): a small absolute **hollow node** (`14px, white bg, 2px line border`) + the `<LegConnector/>` in flow (indented). 
  - Keep the `StaggerIn` wrappers + keys (`leg-${dayDate}`/`stop-${dayDate}`) + continuous index exactly.
- [ ] Restyle the **day header** (Day N + inline title + density toggle) and add a small **day-mode chip** ("🚗 Driving") next to the title that opens/reflects DayModeControl (keep DayModeControl for the full control, or fold its mode label into the chip — simplest: keep DayModeControl block as-is below the header, just ensure it reads clean). Keep the density toggle (Rows3/LayoutGrid).
- [ ] Restyle the **Add row** footer: "＋ Add place" (orange primary) + "Add from Saved" (secondary) + "Copy day as text" link — keep handlers.
- [ ] Empty state unchanged.
- [ ] Gate + commit `feat(expo-rn): itinerary day timeline (rail + nodes + leg pills); default to large cards`.

### Task D: SavedList SavedPlaceCard polish
**File:** `screens/plan/SavedList.tsx`
- [ ] Restyle `SavedPlaceCard` to match the concept: photo hero ~118px (`thumbForPlace(place,'card')` or `PhotoPlaceholder`), **category glyph chip** overlay top-left (move the glyph out of the name row into a chip on the photo), body: name + `categoryLabel · address` + notes (1 line), actions: orange **＋ Add to day** + **Manage** (Move to list / two-tap Delete). Keep grouping (collapsible list headers + ⋯ menu), "+ New list", loose places, "Add place" — all handlers unchanged.
- [ ] Gate + commit `feat(expo-rn): photo-led saved place cards (glyph chip)`.

### Task E: verify + visual pass + OTA
- [ ] Clean `npm run typecheck` + `npx expo export --platform ios` + `--platform web` on the settled tree; confirm all task commits present (`git log`).
- [ ] Controller visual pass on `npm run web`: open Kona Test → Plan (Days) — verify the timeline rail/nodes/leg pills + photo cards + default large cards; toggle to compact rows; Plan → Saved — verify saved cards + groups. Screenshot.
- [ ] Merge to master, `eas update --channel preview -m "Plan itinerary timeline + saved redesign"`.

## Self-review
- Visual-only; default density flip is the only behavior change (user-requested). Timeline owned by DayItinerary; PlaceCard timeline-aware; LegConnector + SavedList restyled. Reuses glyph/categoryLabel/thumbForPlace/PhotoPlaceholder/dayColor. Coupling: C depends on B (run B before C); A/B/D disjoint files.
