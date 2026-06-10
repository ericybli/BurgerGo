# plan-map audit

Checked: 78

## Must-fix
- Restaurant pin card ignores the richer contract fields (photo, address, rating, exact Google Maps link); notes missing from contract entirely
- POI 'Save restaurant' is broken: REST POST 400s on cuisine:null, and even when fixed it loses the POI's googlePlaceId/coords and Google rating/hours/photo
- POI save failures are silent — no error feedback (web shows a mutation-error banner)
- Category glyph map diverges from web: sightseeing and museum emojis wrong on map pins
- Leg chip figures formatted differently: no 1-minute floor and hours collapsing ('1 h 5 min' vs web '65 min', possible '0 min')
- Online day with zero mapped stops replaces the whole map with an EmptyState — layers/locate/satellite/POI become unreachable
- Native pins can render stale after data edits: tracksViewChanges is disabled 700ms after mount and never re-enabled
- Minor visual fidelity deviations from the web map

## Accepted/platform
- POI toggle persisted across sessions (web resets to OFF every mount) [acceptable]
- Per-day travel mode used for route links / leg lookups / recompute (web uses the single selected-day mode everywhere) [acceptable]
- Small interaction deltas: map-tap dismissals, chip cleared on refetch, inline day-picker, POI maps button always shown, blue-dot halo [acceptable]
- 'All days' legend tap lands the list on day 1 (web keeps the list's selected date independent) [acceptable]
- Native fullscreen expands over the PlanMap area only — day strip and tab bar remain visible [acceptable]
- iOS native (Expo Go / Apple Maps): no POI toggle or basemap-landmark flow; non-Google basemap [platform-constraint]

## Fix report
All gaps addressed and the gate is clean. Final report:

**GATE: `npx tsc --noEmit` in expo-rn — zero errors (whole project clean).**

Per-gap status:

1. **Restaurant pin card richer fields — FIXED.** `/Users/eric/own/BurgerGo/expo-rn/screens/plan/map/RestaurantCard.tsx` rewritten to web RestaurantInfoCard parity: glyph square only when no photo, photo (mt-12, h-176, radius 10, cover), cuisine, googleRating row (per contract), address (caption ink, mt-8), notes (caption sub, mt-4), and `placeUrl({name,lat,lng,googlePlaceId,address})` for the exact-POI Maps link; degrades when optional fields absent. PlanScreen side: the concurrent plan-list agent had already filled address/googlePlaceId/googleRating/photoUrl (verified, correct precedence); I added the missing `notes` plumbing in `PlanScreen.tsx` via a widened annotation `(MapRestaurant & { notes?: string | null })[]` and matching `CardRestaurant` type in the card — the frozen READ-ONLY `PlanMap.types.ts` was NOT touched. If the contract owner later adds `notes?: string | null` to MapRestaurant, both widenings can be deleted.

2. **POI "Save restaurant" 400 + lost POI identity — FIXED** in `/Users/eric/own/BurgerGo/expo-rn/screens/plan/PlanScreen.tsx` (`onPoiSaveRestaurant`; edit granted by this gap's explicit rnTarget). Mirrors the proven RestaurantForm pattern: create lean (`{name, status:'want-to-try', address?}` — no null fields, so the zod schema passes), then `PATCH /restaurants/{id}` with `{lat,lng,googlePlaceId}` so the tapped POI's real place id wins over the server's address-geocode and updateRestaurantAction refreshes persisted Google rating/hours/photo. No backend change needed. NOTE for the Eats auditor (outside my paths): `expo-rn/screens/eats/RestaurantForm.tsx` create path still sends `cuisine/rating/notes/address: null` in `base` → same POST 400 risk.

3. **Silent POI save failures — FIXED.** `/Users/eric/own/BurgerGo/expo-rn/screens/plan/map/PoiCard.tsx`: new `saveFailed` state set in `run()`'s catch (cleared on retry), rendered as inline `accessibilityRole="alert"` danger text "Couldn't save — please try again." (web saveFailed string) above the action buttons.

4. **Glyph map (sightseeing/museum) — ALREADY FIXED** by the concurrent plan-list agent in `expo-rn/lib/theme.ts` (verified in working tree: sightseeing 🏞️, museum 🏛️ — matches web). No edit by me (lib/ is forbidden for me anyway).

5. **Leg figures formatting — ALREADY FIXED** in `expo-rn/lib/legView.ts` (verified: `formatDuration` = `Math.max(1, Math.round(s/60)) + ' min'`, no hour collapsing; LegChip/TodayHero/LegConnector are the only consumers, all want web semantics). No edit by me.

6. **Empty day unmounted the map — FIXED.** Removed the `basePins.length === 0` early returns in `PlanMap.native.tsx` and `PlanMap.web.tsx`; the canvas now stays live (layers/locate/satellite/POI reachable, viewport persists since the fit is skipped on empty fitKey) with a new non-blocking floating hint `/Users/eric/own/BurgerGo/expo-rn/screens/plan/map/EmptyHint.tsx` (`pointerEvents="none"`, translucent bg/95 + hairline + lift). Legend still renders. Web file's `loadFailed`/`!MAPS_KEY` branches preserved.

7. **Stale native marker bitmaps — FIXED.** `NativePin` in `PlanMap.native.tsx` now re-arms `tracksViewChanges` (true → 700ms → false) via `useEffect` keyed on `[pin.label, pin.scheduledTime, pin.color, pin.glyph]`.

8. **Visual fidelity — FIXED.** Walk-dot symbol scale 2.5 → 1.6 (`PlanMap.web.tsx`); native `lineDashPattern` [1,10] → [1,8] (`PlanMap.native.tsx`); LegChip close 30 → 28px (`map/LegChip.tsx`; RestaurantCard/PoiCard close stays 30px = web h-[30px]); DayLegend chips got pressed feedback — scale 0.95 always, surface bg on inactive chips (`map/DayLegend.tsx`).

Skipped: all items in the acceptable/platform list, per instructions.

Files changed by me: `expo-rn/screens/plan/map/RestaurantCard.tsx`, `expo-rn/screens/plan/map/PoiCard.tsx`, `expo-rn/screens/plan/map/LegChip.tsx`, `expo-rn/screens/plan/map/DayLegend.tsx`, `expo-rn/screens/plan/map/EmptyHint.tsx` (new), `expo-rn/screens/plan/PlanMap.native.tsx`, `expo-rn/screens/plan/PlanMap.web.tsx`, `expo-rn/screens/plan/PlanScreen.tsx` (only the two spots named in gaps 1/2: restaurant mapping + onPoiSaveRestaurant). Not touched: `PlanMap.types.ts` (READ-ONLY), `expo-rn/lib/**`, backend.