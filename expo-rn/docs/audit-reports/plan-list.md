# plan-list audit

Checked: 97

## Must-fix
- PlanScreen does not fill the new MapRestaurant contract fields (address, googlePlaceId, photoUrl, googleRating)
- Leg duration formatting deviates: '0 min' possible and '1 h 5 min' instead of web's always-minutes 'max(1, …) min'
- Category glyphs wrong for sightseeing and museum
- Photo full-screen viewer/pager missing from the edit sheet
- In-flight mutation guard releases before the refetch completes (double-fire window)
- Read card's Edit button disabled offline — web opens the (read-only) edit sheet offline
- Guide-link add button label 'Add' instead of web's 'Add a guide link'
- Shared SegmentedControl inactive text uses `faint` — Atlas recipe (and web) use `sub`
- EmptyState lacks the mascot image web shows on every Plan empty state

## Accepted/platform
- Two-tap 'Sure? Delete' / 'Delete list? Places stay' confirms instead of web's immediate delete [acceptable]
- Device-local 'today'/'now' instead of trip-timezone for TripOverview/TodayHero/trip status [acceptable]
- Time field is a lenient HH:MM text input rather than a native time picker [acceptable]
- Photo picker offers photo library only — no direct camera capture [acceptable]
- Blessed/strictly-better divergences: single full fetch, stale-data-preserving errors + Retry, read card as bottom sheet, cached/online-gated weather, validated POI category guess [acceptable]
- Map pin-clustering preference (Settings clusterPins) is not plumbed through PlanScreen [platform-constraint]

## Fix report
Per-gap status:

1. **MapRestaurant contract fields (address/googlePlaceId/photoUrl/googleRating)** — FIXED. PlanScreen's restaurant mapping now fills all four; photoUrl mirrors web thumbForRestaurant precedence: `photos[0] → photoUrl.personal(id,'card')`, else `photoPath → photoUrl.restaurant(id,'card')`, else null.
2. **Leg duration formatting ('0 min' / '1 h 5 min' deviations)** — FIXED. `formatDuration` in expo-rn/lib/legView.ts is now `Math.max(1, Math.round(seconds/60)) + ' min'` (always minutes, 1-min floor); flows to LegConnector, TodayHero, and map LegChip via formatLeg.
3. **Category glyphs (sightseeing/museum)** — FIXED. expo-rn/lib/theme.ts GLYPH: sightseeing '🏞️', museum '🏛️' (verified against web src/lib/planUrl.ts CATEGORY_GLYPH).
4. **Photo full-screen viewer missing** — FIXED. PlaceDetailSheet thumbnails are now pressable (accessibilityLabel "Photo of {name}") and open a transparent Modal: rgba(0,0,0,0.85) scrim, `photoUrl.personal(id,'full')` contained image, ‹ / › wrap-around buttons when >1 photo, "Close photo" white chip buttons, tap-outside closes, photo tap swallowed (web parity). Works on iOS + react-native-web (nested Modal inside the Sheet Modal is the supported descendant pattern).
5. **In-flight guard releases before refetch** — FIXED. `run()`'s finally now does `await fetchData()` BEFORE `if (mountedRef.current) setPending(false)`, holding actionDisabled through the reload like web's startTransition.
6. **Edit button disabled offline** — FIXED. Removed `disabled={!online}` + opacity dim from PlaceViewSheet's Edit; the edit sheet already renders read-only offline (Cost now reachable offline).
7. **Guide-link button label** — FIXED. Button now reads "Add a guide link" (busy '…' kept); URL input got `accessibilityLabel="Add a guide link"`. Secondary string: consciously KEPT RN's clearer photo-delete error "Couldn't remove the photo." over web's reused "Couldn't upload — please try again." (web's string is factually wrong for a delete; behavior/style otherwise identical).
8. **SegmentedControl inactive `faint` → `sub`** — ALREADY FIXED upstream: components/ui/index.tsx segmentText is already `colors.sub` (a concurrent shared-kit agent landed it; git status confirms that file modified outside my edits). No action needed from me; verified correct.
9. **EmptyState mascot** — ALREADY FIXED upstream: components/ui/index.tsx EmptyState already renders the bundled burgergo-logo.png at 112×112, opacity 0.9, ~24px below-spacing. Verified correct; no action from me.

Skipped (per instructions): all acceptable/platform items (two-tap deletes, device-local today, HH:MM text input, library-only picker, blessed divergences, clusterPins plumbing).

Gate: `npx tsc --noEmit` in expo-rn → EXIT 0, zero errors.

Files changed by me:
- /Users/eric/own/BurgerGo/expo-rn/screens/plan/PlanScreen.tsx (gaps 1, 5)
- /Users/eric/own/BurgerGo/expo-rn/screens/plan/PlaceDetailSheet.tsx (gaps 4, 7)
- /Users/eric/own/BurgerGo/expo-rn/screens/plan/PlaceViewSheet.tsx (gap 6)
- /Users/eric/own/BurgerGo/expo-rn/lib/legView.ts (gap 2 — path explicitly granted by audit rnTarget)
- /Users/eric/own/BurgerGo/expo-rn/lib/theme.ts (gap 3 — path explicitly granted by audit rnTarget)

Not touched: PlanMap.* / screens/plan/map/** (sibling's; PlanMap.types.ts shows as modified in git by the map agent, not me), components/ui/** (gaps 8–9 already landed there by the shared-kit agent), package.json/app.json.