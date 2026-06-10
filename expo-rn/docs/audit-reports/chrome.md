# chrome audit

Checked: 27

## Must-fix
- AI import UI entirely missing (entry button + full AiImportSheet flow)
- Global offline banner missing (web shows an ink strip on every screen when offline)
- Trip header date-range subtitle missing
- Tap-trip-name-to-rename (RenameSheet) missing in trip chrome
- Home settings chip lacks the surface-chip treatment and pressed state
- Scrim token mismatch: RN 0.35 vs web 0.42 alpha (affects every sheet app-wide)
- Tab bar minor fidelity deviations (icon size/active stroke/label size)

## Accepted/platform
- Native stack back button instead of the web's 36px surface chevron chip [acceptable]
- No trip-shell loading skeleton or 'Trip not found' state in RN [acceptable]

## Fix report
Gate passes with zero errors. All work complete.

PER-GAP STATUS:

1. **AI import UI (entry + full AiImportSheet flow) — FIXED.** New `expo-rn/components/ai/AiImportSheet.tsx`: phases input → extracting → preview → creating → done; bottom sheet (ui-kit `Sheet`, maxHeight 88% of window, top radius 22, 40×4 handle, scrim + tap-outside close, pinned header with 18px bold title + faint ✕ chip, scrollable body). Input phase: 4-col 64px thumbnail grid with ink/70 white-✕ remove badges, dashed-border "Add images" picker (teal label + faint "{n}/8 images" hint, disabled at 8; expo-image-picker `allowsMultipleSelection` + `base64` + `quality: 0.6`, web-uri data-URL handling, unreadable images silently skipped), 5-row multiline text input, danger errors ("Couldn't find any places…", "Something went wrong…") returning to input with state kept, full-width orange "Extract places"/"Reading…" gated on `online && !pending && (images||text)`. Preview phase: "Found {n} — review & create" caption, per-row cards (hairline border, radius 14, staggered fade-up min(i,6)×40ms via Animated), inline Restaurant|Saved place segmented toggle (surface track, 3px padding, white thumb + ink + thumb shadow), per-row remove-✕ (web has NO checkboxes — matched web), editable Name (14 medium ink) + Address (13 sub) inputs with accent focus border, "⚠ Not found on Google — won't show on the map" faint caption when `!resolved`, create error stays in preview, footer = outline Back (state-preserving) + flex-1 orange "Create {n}"/"Creating…" disabled on pending/empty/offline. Done phase: "Imported!" title, centered "Added {r} to Eats and {p} to Saved.", orange Close. Create payload sends only type/name/address/lat/lng/googlePlaceId/cuisine/category/notes. Entry: 36×36 round accentTint chip with teal 18px stroke-2 Sparkles in the Trip header right (`TripHeaderRight` in `expo-rn/navigation/TripHeader.tsx`), key-remounted per open. Refresh after create relies on Plan/Eats `useFocusEffect` refetch per the assignment ("Plan/Eats refetch on focus handles refresh"); the sheet also exposes the web-parity optional `onCreated` callback for future wiring — note the currently-focused tab refreshes only after a tab switch, since I'm barred from `lib/**` (event emitter) and section screens.

2. **Global offline banner — FIXED.** New `expo-rn/components/OfflineBanner.tsx` (ink bg, white 12px medium centered text, py-8/px-16 + safe-area top, `accessibilityLiveRegion="polite"`, exact web copy "Offline — viewing saved data. Editing needs a connection.", hidden online via `useOnline`), mounted in App.tsx above NavigationContainer inside SafeAreaProvider so it shows on every screen.

3. **Trip header date-range subtitle — FIXED.** `TripHeaderTitle` (navigation/TripHeader.tsx) renders the name at web title spec (19px bold, −0.38 tracking, truncating) over "{MMM d} – {MMM d}" (12px medium sub, tabular-nums, en dash with spaces, reusing `screens/home/tripDates.ts` formatMonthDay), wired as custom `headerTitle` in App.tsx.

4. **Tap-name-to-rename (RenameSheet) — FIXED.** Header name is pressable (scale 0.99) opening a key-remounted RenameSheet (navigation/TripHeader.tsx): "Rename trip" title, "Trip name" labeled input prefilled, "Please enter a trip name." / "Couldn't save — please try again." errors, Cancel (outline flex-1) + Save (orange flex-1, disabled while pending) via `api.trips.update`; on success `navigation.setParams({ name })` updates header + TripContext.

5. **Home settings chip — FIXED** (a concurrent stray edit had partially landed it; final state verified): 36×36 round `surface` chip, 18px ink icon, pressed scale 0.95.

6. **Scrim token 0.35 → 0.42 — FIXED (already applied).** `lib/theme.ts` already read `rgba(27, 31, 28, 0.42)` when I went to edit it (concurrent fix); verified, no change needed from me. Backdrop blur skipped per audit (needs expo-blur — accepted).

7. **Tab bar fidelity — FIXED.** `navigation/TripTabs.tsx`: icons 21px stroke 2 in both states (active = color-only), labels 10px.

GATE: `npx tsc --noEmit` in expo-rn → zero errors.

FILES CHANGED:
- /Users/eric/own/BurgerGo/expo-rn/components/ai/AiImportSheet.tsx (new)
- /Users/eric/own/BurgerGo/expo-rn/components/OfflineBanner.tsx (new)
- /Users/eric/own/BurgerGo/expo-rn/navigation/TripHeader.tsx (new)
- /Users/eric/own/BurgerGo/expo-rn/App.tsx
- /Users/eric/own/BurgerGo/expo-rn/navigation/TripTabs.tsx
- /Users/eric/own/BurgerGo/expo-rn/lib/theme.ts (verified only — scrim already 0.42)

NOTES: (a) expo-image-manipulator is not installed and package.json is off-limits, so images aren't resized to ≤1024px like web's downscale — picker `quality: 0.6` re-encoding keeps payloads reasonable; server caps at 8 images / 20k chars. (b) The stale "max ~4" comment at lib/api/index.ts:282 is wrong (server allows 8) but lib/** is off-limits — comment-only, no behavior impact.