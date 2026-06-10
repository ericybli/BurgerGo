Both gates pass. Final report:

## plan-list port — report

**Gate:** `npx tsc --noEmit` in `/Users/eric/own/BurgerGo/expo-rn` → exit 0, zero errors.

### Files created
- `/Users/eric/own/BurgerGo/expo-rn/screens/plan/planShared.ts` — UTC date formatters, tripStatus/diffDays, nextStopIndex, weatherCodeInfo, category labels, placeCategoryToBudget, formatDayItinerary, mode-aware leg lookup (`from|to|mode`), copyText, useTwoTapConfirm
- `screens/plan/planApi.ts` — plan-local REST wrappers (leg-mode, place→list, summary, geocode, details normalization, place links) via `lib/api/client` (imported, not edited)
- `screens/plan/useAutocomplete.ts` — debounced (300ms, ≥2 chars) autocomplete + one session token per search→select cycle
- `screens/plan/DayStrip.tsx`, `TripOverview.tsx`, `TodayHero.tsx`, `DayItinerary.tsx`, `PlaceCard.tsx`, `LegConnector.tsx`, `SavedList.tsx`, `ListPickerSheet.tsx`, `ListNameSheet.tsx`, `DayPickerSheet.tsx`, `ExportDaySheet.tsx`, `AddPlaceSheet.tsx`, `PlaceDetailSheet.tsx`

### Files rewritten
- `PlanScreen.tsx` (chrome restructure, mutation orchestration, map contract wiring), `DayModeControl.tsx`, `PlaceViewSheet.tsx` (PlaceReadCard parity), `PhotoPlaceholder.tsx` (Atlas tokens)

### Files deleted
- `PlanList.tsx`, `MoveSheet.tsx`, `PlaceFormSheet.tsx` (superseded; only `PlanScreen` is imported externally — verified)

### Spec items completed
1–5, 7, 8, 10, 12–15 fully: sticky chrome with List|Map + Days|Saved + two-line DayStrip (ink-active, day-2 today dot, no "All days" list view); TripOverview (collapsed persisted `burgergo.overview.collapsed`, per-date weather cache via `api.weather.day`, Up next / Hotel / Plan rows); tap-to-edit day titles (optimistic, Enter/blur commit, Escape cancel via web keypress); density toggle (`bg.itineraryDensity`, rows default, 54px-thumb compact rows, durationMin meta); recompute orchestration (move = source+target, copy/promote = target, delete/move-to-saved/reorder = source, skipped offline/Saved); day footer ("Add place" orange + "Add from Saved" outline + "Copy day as text" export sheet with select-all-able text and "Copied ✓" 2s); saved bucket with collapsible lists, ⋯ menu Rename / 2-tap "Delete list? Places stay", loose places, create-list-then-move flow; mutation banner "Action failed — please try again." + in-flight button guard + refetch-in-finally; TodayHero with Skip; day picker "Day {n} · {Mon}" with per-mode titles; capitalized category labels everywhere; miles-only legs via `formatLeg`. Map rendered as `import PlanMap from './PlanMap'` with exactly the `PlanMapProps` contract; POI callbacks use the prescribed `api.places.create` / `api.eats.create` payloads (categoryGuess validated → 'other' fallback, like web) + refresh; `onSelectDate(null)` → map all-days + list day 1.

### Spec items NOT fully done (backend dependencies — outside expo-rn/, which I'm forbidden to edit)
- **#6 per-leg mode (UI done):** writes `PUT /api/trips/{tripId}/places/{placeId}/leg-mode` per spec table #19 — **route does not exist in the web app yet** (verified: no `leg-mode` dir; the place PATCH zod schema strips `legMode`). Fails gracefully (banner + refetch).
- **#9 move-place-to-list (UI done):** writes `PUT .../places/{placeId}/list` (spec #20) — **route missing**. List create/rename/delete routes exist and work via `api.savedLists`.
- **#11 AI summary (UI done):** fire-and-forget on add + Regenerate ("Generating…") call `POST .../places/{placeId}/summary` (spec #22) — **route missing**; failures are silently swallowed (field unchanged), never block the add.

### Contract assumptions
- `/api/google/details` returns a **flat** object (verified in `app/api/google/details/route.ts`), not the `{details}` wrapper typed in `lib/api` — `planApi.placeDetails` normalizes both shapes.
- `expo-clipboard` is not in package.json (no new deps allowed) → export-day Copy uses `navigator.clipboard` on web and RN core `Clipboard` (present, deprecated) on native, with selectable text as the manual fallback.
- Time field is a plain `HH:MM` text input with lenient normalization ("9:5" → "09:05") per the cross-platform rules (no native time picker, unlike web).
- AI-import sheet is not in the plan-list spec → not built (Home section owns it).
- Empty place name on edit-save falls back to the existing name (server zod requires min 1).